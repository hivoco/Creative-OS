from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def ist_now() -> datetime:
    return datetime.now(IST)


def ist_date_str() -> str:
    """YYYY-MM-DD in IST — used to bucket S3 assets by day."""
    return ist_now().strftime("%Y-%m-%d")
