from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.core.logging import get_logger
from app.database.session import SessionLocal
from app.ingestion.pipeline import run_ingestion_cycle

logger = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_ingestion_cycle,
        "interval",
        seconds=settings.INGESTION_POLL_INTERVAL_SECONDS,
        id="ingestion_cycle",
        kwargs={"session_factory": SessionLocal},
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info("ingestion_scheduler_started", interval_seconds=settings.INGESTION_POLL_INTERVAL_SECONDS)
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("ingestion_scheduler_stopped")
