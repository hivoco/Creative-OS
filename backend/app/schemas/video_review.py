from datetime import datetime

from pydantic import BaseModel


class SubmitReviewIn(BaseModel):
    reviewer_id: str | None = None


class ReviewActionIn(BaseModel):
    comment: str | None = None  # optional note (used on reject)


class CommentIn(BaseModel):
    comment: str


class CommentResolveIn(BaseModel):
    resolved: str  # open | resolved


class VideoCommentOut(BaseModel):
    id: str
    review_request_id: str
    comment: str
    resolved: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoReviewRequestOut(BaseModel):
    id: str
    video_job_id: str
    requested_by: str
    reviewer_id: str | None = None
    status: str
    note: str | None = None
    sent_at: datetime
    comments: list[VideoCommentOut] = []

    model_config = {"from_attributes": True}
