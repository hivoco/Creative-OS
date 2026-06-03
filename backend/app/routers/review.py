from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import (
    CurrentUser,
    get_current_user,
    require_editor,
    require_manager,
)
from app.models import (
    FeedbackComment,
    ReviewRequest,
    TextLayer,
)
from app.routers.layers import _owned_version
from app.schemas.review import (
    CommentIn,
    CommentResolveIn,
    FeedbackCommentOut,
    ReviewActionIn,
    ReviewRequestOut,
    SubmitReviewIn,
)

router = APIRouter(tags=["review"])


def _latest_review(db: Session, version_id: str) -> ReviewRequest | None:
    return (
        db.query(ReviewRequest)
        .filter(ReviewRequest.template_version_id == version_id)
        .order_by(ReviewRequest.sent_at.desc())
        .first()
    )


@router.get("/versions/{version_id}/review", response_model=ReviewRequestOut | None)
def get_review(
    version_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_version(db, version_id, current.brand_id)
    return _latest_review(db, version_id)


@router.post("/versions/{version_id}/submit", response_model=ReviewRequestOut)
def submit_for_review(
    version_id: str,
    payload: SubmitReviewIn,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    if version.status not in ("draft", "rejected"):
        raise HTTPException(
            status_code=409, detail=f"Version is {version.status}, cannot submit"
        )

    version.status = "in_review"
    review = ReviewRequest(
        template_version_id=version.id,
        requested_by=current.id,
        reviewer_id=payload.reviewer_id,
        status="pending",
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.post("/versions/{version_id}/approve", response_model=ReviewRequestOut)
def approve(
    version_id: str,
    current: CurrentUser = Depends(require_manager),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    if version.status != "in_review":
        raise HTTPException(status_code=409, detail="Version is not in review")
    review = _latest_review(db, version.id)
    if not review:
        raise HTTPException(status_code=404, detail="No review request found")

    version.status = "approved"
    review.status = "approved"
    review.reviewer_id = current.id
    db.commit()
    db.refresh(review)
    return review


@router.post("/versions/{version_id}/reject", response_model=ReviewRequestOut)
def reject(
    version_id: str,
    payload: ReviewActionIn,
    current: CurrentUser = Depends(require_manager),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    if version.status != "in_review":
        raise HTTPException(status_code=409, detail="Version is not in review")

    # A rejection must explain why: 1–100 words.
    reason = (payload.comment or "").strip()
    words = reason.split()
    if not (1 <= len(words) <= 100):
        raise HTTPException(
            status_code=422,
            detail="A rejection reason of 1 to 100 words is required",
        )

    review = _latest_review(db, version.id)
    if not review:
        raise HTTPException(status_code=404, detail="No review request found")

    version.status = "rejected"
    review.status = "rejected"
    review.reviewer_id = current.id
    review.note = reason
    db.commit()
    db.refresh(review)
    return review


# ---- Feedback comments ----------------------------------------------------


@router.get(
    "/versions/{version_id}/comments", response_model=list[FeedbackCommentOut]
)
def list_comments(
    version_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_version(db, version_id, current.brand_id)
    return (
        db.query(FeedbackComment)
        .join(ReviewRequest, FeedbackComment.review_request_id == ReviewRequest.id)
        .filter(ReviewRequest.template_version_id == version_id)
        .order_by(FeedbackComment.created_at.desc())
        .all()
    )


@router.post("/versions/{version_id}/comments", response_model=FeedbackCommentOut)
def add_comment(
    version_id: str,
    payload: CommentIn,
    current: CurrentUser = Depends(require_manager),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    review = _latest_review(db, version.id)
    if not review:
        # A manager can only comment in the context of a review.
        raise HTTPException(
            status_code=409, detail="Version has not been submitted for review"
        )

    layer = db.get(TextLayer, payload.layer_id)
    if not layer or layer.template_version_id != version.id:
        raise HTTPException(status_code=404, detail="Layer not found on this version")

    comment = FeedbackComment(
        review_request_id=review.id,
        layer_id=payload.layer_id,
        language_code=payload.language_code,
        comment=payload.comment,
        resolved="open",
    )
    db.add(comment)
    if review.status == "pending":
        review.status = "reviewed"
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/comments/{comment_id}", response_model=FeedbackCommentOut)
def resolve_comment(
    comment_id: str,
    payload: CommentResolveIn,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.get(FeedbackComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    review = db.get(ReviewRequest, comment.review_request_id)
    _owned_version(db, review.template_version_id, current.brand_id)

    if payload.resolved not in ("open", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid resolved state")
    comment.resolved = payload.resolved
    db.commit()
    db.refresh(comment)
    return comment
