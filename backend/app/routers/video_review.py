from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import (
    CurrentUser,
    get_current_user,
    require_editor,
    require_manager,
)
from app.models import VideoComment, VideoJob, VideoReviewRequest
from app.schemas.video_review import (
    CommentIn,
    CommentResolveIn,
    ReviewActionIn,
    SubmitReviewIn,
    VideoCommentOut,
    VideoReviewRequestOut,
)

router = APIRouter(prefix="/video", tags=["video-review"])


def _owned_job(db: Session, job_id: str, brand_id: str) -> VideoJob:
    job = db.get(VideoJob, job_id)
    if not job or job.brand_id != brand_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _latest_review(db: Session, job_id: str) -> VideoReviewRequest | None:
    return (
        db.query(VideoReviewRequest)
        .filter(VideoReviewRequest.video_job_id == job_id)
        .order_by(VideoReviewRequest.sent_at.desc())
        .first()
    )


@router.get("/jobs/{job_id}/review", response_model=VideoReviewRequestOut | None)
def get_review(
    job_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_job(db, job_id, current.brand_id)
    return _latest_review(db, job_id)


@router.post("/jobs/{job_id}/submit", response_model=VideoReviewRequestOut)
def submit_for_review(
    job_id: str,
    payload: SubmitReviewIn,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    job = _owned_job(db, job_id, current.brand_id)
    if job.status != "completed":
        raise HTTPException(
            status_code=409, detail="Only a finished video can be sent for review"
        )
    if job.review_status not in ("draft", "rejected"):
        raise HTTPException(
            status_code=409, detail=f"Video is {job.review_status}, cannot submit"
        )

    job.review_status = "in_review"
    review = VideoReviewRequest(
        video_job_id=job.id,
        requested_by=current.id,
        reviewer_id=payload.reviewer_id,
        status="pending",
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.post("/jobs/{job_id}/approve", response_model=VideoReviewRequestOut)
def approve(
    job_id: str,
    current: CurrentUser = Depends(require_manager),
    db: Session = Depends(get_db),
):
    job = _owned_job(db, job_id, current.brand_id)
    if job.review_status != "in_review":
        raise HTTPException(status_code=409, detail="Video is not in review")
    review = _latest_review(db, job.id)
    if not review:
        raise HTTPException(status_code=404, detail="No review request found")

    job.review_status = "approved"
    review.status = "approved"
    review.reviewer_id = current.id
    db.commit()
    db.refresh(review)
    return review


@router.post("/jobs/{job_id}/reject", response_model=VideoReviewRequestOut)
def reject(
    job_id: str,
    payload: ReviewActionIn,
    current: CurrentUser = Depends(require_manager),
    db: Session = Depends(get_db),
):
    job = _owned_job(db, job_id, current.brand_id)
    if job.review_status != "in_review":
        raise HTTPException(status_code=409, detail="Video is not in review")

    # A rejection must explain why: 1–100 words.
    reason = (payload.comment or "").strip()
    words = reason.split()
    if not (1 <= len(words) <= 100):
        raise HTTPException(
            status_code=422,
            detail="A rejection reason of 1 to 100 words is required",
        )

    review = _latest_review(db, job.id)
    if not review:
        raise HTTPException(status_code=404, detail="No review request found")

    job.review_status = "rejected"
    review.status = "rejected"
    review.reviewer_id = current.id
    review.note = reason
    db.commit()
    db.refresh(review)
    return review


# ---- Feedback comments ----------------------------------------------------


@router.get("/jobs/{job_id}/comments", response_model=list[VideoCommentOut])
def list_comments(
    job_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_job(db, job_id, current.brand_id)
    return (
        db.query(VideoComment)
        .join(
            VideoReviewRequest,
            VideoComment.review_request_id == VideoReviewRequest.id,
        )
        .filter(VideoReviewRequest.video_job_id == job_id)
        .order_by(VideoComment.created_at.desc())
        .all()
    )


@router.post("/jobs/{job_id}/comments", response_model=VideoCommentOut)
def add_comment(
    job_id: str,
    payload: CommentIn,
    current: CurrentUser = Depends(require_manager),
    db: Session = Depends(get_db),
):
    job = _owned_job(db, job_id, current.brand_id)
    review = _latest_review(db, job.id)
    if not review:
        # A manager can only comment in the context of a review.
        raise HTTPException(
            status_code=409, detail="Video has not been submitted for review"
        )
    if not payload.comment.strip():
        raise HTTPException(status_code=400, detail="Comment is required")

    comment = VideoComment(
        review_request_id=review.id,
        comment=payload.comment.strip(),
        resolved="open",
    )
    db.add(comment)
    if review.status == "pending":
        review.status = "reviewed"
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/comments/{comment_id}", response_model=VideoCommentOut)
def resolve_comment(
    comment_id: str,
    payload: CommentResolveIn,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.get(VideoComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    review = db.get(VideoReviewRequest, comment.review_request_id)
    _owned_job(db, review.video_job_id, current.brand_id)

    if payload.resolved not in ("open", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid resolved state")
    comment.resolved = payload.resolved
    db.commit()
    db.refresh(comment)
    return comment
