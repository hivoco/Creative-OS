import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import CurrentUser, get_current_user, require_editor
from app.core.ist import ist_date_str
from app.models import Brand, BrandVoice, VideoJob
from app.schemas.video import VideoJobOut, VoiceOut
from app.services import fish, s3, segmind_video

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/video", tags=["video"])

MAX_FILE_SIZE = 32 * 1024 * 1024


def _asset_key(brand_slug: str, date: str, job_id: str, name: str) -> str:
    return f"video/{brand_slug}/{date}/{job_id}/{name}"


# ---- Voices ---------------------------------------------------------------


@router.get("/voices", response_model=list[VoiceOut])
def list_voices(
    current: CurrentUser = Depends(require_editor), db: Session = Depends(get_db)
):
    return (
        db.query(BrandVoice)
        .filter(BrandVoice.brand_id == current.brand_id)
        .order_by(BrandVoice.created_at.desc())
        .all()
    )


@router.post("/voices/clone", response_model=VoiceOut, status_code=201)
async def clone_voice(
    voice_file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    if not fish.is_live():
        raise HTTPException(status_code=503, detail="Voice cloning is not configured")
    content = await voice_file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Audio too large (max 32MB)")
    if not voice_file.content_type or not voice_file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="Invalid audio file")

    try:
        voice_id = fish.clone_voice(audio_bytes=content, title=title, description=description)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Voice clone failed: {e}")

    voice = BrandVoice(
        brand_id=current.brand_id,
        created_by=current.id,
        voice_id=voice_id,
        name=title,
        description=description or None,
    )
    db.add(voice)
    db.commit()
    db.refresh(voice)
    return voice


# ---- Jobs -----------------------------------------------------------------


@router.get("/jobs", response_model=list[VideoJobOut])
def list_jobs(
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    q = db.query(VideoJob).filter(VideoJob.brand_id == current.brand_id)
    # Managers only see the review queue — videos submitted for review.
    if current.role == "manager":
        q = q.filter(VideoJob.review_status == "in_review")
    return q.order_by(VideoJob.created_at.desc()).all()


@router.get("/jobs/{job_id}", response_model=VideoJobOut)
def get_job(
    job_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.get(VideoJob, job_id)
    if not job or job.brand_id != current.brand_id:
        raise HTTPException(status_code=404, detail="Job not found")
    # Managers can only reach videos that are in review.
    if current.role == "manager" and job.review_status != "in_review":
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/download")
def download_job_video(
    job_id: str,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Return a short-lived presigned URL that downloads the finished MP4.

    The frontend points an anchor at this URL; S3 serves it with an
    ``attachment`` disposition so the browser saves the file rather than
    navigating to it.
    """
    job = db.get(VideoJob, job_id)
    if not job or job.brand_id != current.brand_id:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.video_url:
        raise HTTPException(status_code=409, detail="Video is not ready yet")
    if job.review_status != "approved":
        raise HTTPException(
            status_code=409, detail="Video must be approved before download"
        )

    slug = "".join(c if c.isalnum() else "-" for c in (job.title or "video")).strip("-")
    filename = f"{(slug or 'video')[:60]}.mp4"
    return {"url": s3.presigned_download_url(job.video_url, filename)}


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    job = db.get(VideoJob, job_id)
    if not job or job.brand_id != current.brand_id:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()


@router.post("/jobs", response_model=VideoJobOut, status_code=201)
async def create_job(
    background_tasks: BackgroundTasks,
    photo: UploadFile = File(...),
    voice_id: str = Form(...),
    script: str = Form(...),
    resolution: str = Form("480p"),
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    if resolution not in ("480p", "720p"):
        raise HTTPException(status_code=400, detail="Invalid resolution")
    if not (fish.is_live() and s3.s3_enabled()):
        raise HTTPException(status_code=503, detail="Video generation is not configured")

    voice = (
        db.query(BrandVoice)
        .filter(BrandVoice.brand_id == current.brand_id, BrandVoice.voice_id == voice_id)
        .first()
    )
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found for this brand")
    if not script.strip():
        raise HTTPException(status_code=400, detail="Script is required")

    content = await photo.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Photo too large (max 32MB)")
    if not photo.content_type or not photo.content_type.startswith("image"):
        raise HTTPException(status_code=400, detail="Invalid photo file")

    brand = db.get(Brand, current.brand_id)
    job = VideoJob(
        brand_id=current.brand_id,
        created_by=current.id,
        title=script.strip()[:60] or "Untitled video",
        status="pending",
        current_stage="queued",
        photo_url="",  # set after upload
        voice_id=voice_id,
        voice_name=voice.name,
        script_text=script.strip(),
        resolution=resolution,
    )
    db.add(job)
    db.flush()  # get job.id

    date = ist_date_str()
    ext = "png" if (photo.content_type or "").endswith("png") else "jpg"
    photo_upload = s3.upload_bytes(
        data=content,
        key=_asset_key(brand.slug, date, job.id, f"input.{ext}"),
        content_type=photo.content_type or "image/jpeg",
    )
    job.photo_url = photo_upload
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_process_job, job.id, brand.slug, date)
    return job


def _process_job(job_id: str, brand_slug: str, date: str) -> None:
    """Background pipeline: portrait + TTS in parallel, then lipsync."""
    db = SessionLocal()
    try:
        job = db.get(VideoJob, job_id)
        if not job:
            return
        job.status = "processing"
        job.current_stage = "image_audio"
        job.image_status = "processing"
        job.audio_status = "processing"
        db.commit()

        # Capture the fields the worker threads need BEFORE spawning them.
        # db.commit() expires the ORM attributes (expire_on_commit), so touching
        # job.* inside the threads would trigger two concurrent lazy reloads on
        # the same session/connection — SQLAlchemy's "concurrent operations are
        # not permitted" error. Reading into plain locals keeps threads off the
        # session entirely.
        photo_url = job.photo_url
        script_text = job.script_text
        voice_id = job.voice_id

        def run_image() -> str:
            data = segmind_video.generate_portrait(photo_url)
            return s3.upload_bytes(
                data=data,
                key=_asset_key(brand_slug, date, job_id, "portrait.png"),
                content_type="image/png",
            )

        def run_audio() -> str:
            data = fish.generate_audio(text=script_text, voice_id=voice_id)
            return s3.upload_bytes(
                data=data,
                key=_asset_key(brand_slug, date, job_id, "audio.mp3"),
                content_type="audio/mpeg",
            )

        with ThreadPoolExecutor(max_workers=2) as ex:
            image_future = ex.submit(run_image)
            audio_future = ex.submit(run_audio)
            image_url = image_future.result()
            audio_url = audio_future.result()

        job = db.get(VideoJob, job_id)
        job.image_url = image_url
        job.audio_url = audio_url
        job.image_status = "completed"
        job.audio_status = "completed"
        job.current_stage = "lipsync"
        job.lipsync_status = "processing"
        db.commit()

        video_bytes = segmind_video.generate_lipsync(
            image_url=image_url, audio_url=audio_url, resolution=job.resolution
        )
        video_url = s3.upload_bytes(
            data=video_bytes,
            key=_asset_key(brand_slug, date, job_id, "lipsync.mp4"),
            content_type="video/mp4",
        )

        job = db.get(VideoJob, job_id)
        job.video_url = video_url
        job.lipsync_status = "completed"
        job.status = "completed"
        job.current_stage = "completed"
        db.commit()
    except Exception as e:  # noqa: BLE001
        logger.exception("video job %s failed", job_id)
        job = db.get(VideoJob, job_id)
        if job:
            job.status = "failed"
            job.error = str(e)[:1000]
            for attr in ("image_status", "audio_status", "lipsync_status"):
                if getattr(job, attr) == "processing":
                    setattr(job, attr, "failed")
            db.commit()
    finally:
        db.close()
