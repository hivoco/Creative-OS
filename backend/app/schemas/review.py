from datetime import datetime

from pydantic import BaseModel


class SubmitReviewIn(BaseModel):
    reviewer_id: str | None = None


class ReviewActionIn(BaseModel):
    comment: str | None = None  # optional note (used on reject)


class CommentIn(BaseModel):
    layer_id: str
    language_code: str
    comment: str


class CommentResolveIn(BaseModel):
    resolved: str  # open | resolved


class FeedbackCommentOut(BaseModel):
    id: str
    review_request_id: str
    layer_id: str
    language_code: str
    comment: str
    resolved: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewRequestOut(BaseModel):
    id: str
    template_version_id: str
    requested_by: str
    reviewer_id: str | None = None
    status: str
    note: str | None = None
    sent_at: datetime
    comments: list[FeedbackCommentOut] = []

    model_config = {"from_attributes": True}
