import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))


def local_day_bounds_utc() -> tuple[datetime, datetime]:
    """Return the current hospital-local day as naive UTC database bounds."""
    local_start = datetime.now(APP_TIMEZONE).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    local_end = local_start + timedelta(days=1)
    return (
        local_start.astimezone(timezone.utc).replace(tzinfo=None),
        local_end.astimezone(timezone.utc).replace(tzinfo=None),
    )