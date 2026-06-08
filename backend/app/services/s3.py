"""Minimal S3 uploader — used to give Segmind a public image URL and to store
the AI-resized output. Mirrors the uploader from the previous (iifl) backend.
"""

from functools import lru_cache
from urllib.parse import unquote, urlparse

import boto3

from app.core.config import settings


def s3_enabled() -> bool:
    return bool(
        settings.aws_bucket_name
        and settings.aws_access_key_id
        and settings.aws_secret_access_key
    )


@lru_cache
def _client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def upload_bytes(*, data: bytes, key: str, content_type: str) -> str:
    """Upload bytes under the base prefix and return the public URL."""
    if not data:
        raise ValueError("data cannot be empty")
    s3_key = f"{settings.s3_base_prefix}/{key}".lstrip("/")
    _client().put_object(
        Bucket=settings.aws_bucket_name,
        Key=s3_key,
        Body=data,
        ContentType=content_type,
    )
    return (
        f"https://{settings.aws_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"
    )


def presigned_download_url(public_url: str, filename: str, expires_in: int = 600) -> str:
    """Presign a GET for an object we previously uploaded, forcing the browser to
    download it (instead of playing it inline) via Content-Disposition.

    A plain ``<a download>`` is ignored for cross-origin S3 URLs, so the only
    reliable way to download is a presigned link that carries an
    ``attachment`` disposition in the response headers.
    """
    key = unquote(urlparse(public_url).path).lstrip("/")
    return _client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.aws_bucket_name,
            "Key": key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=expires_in,
    )
