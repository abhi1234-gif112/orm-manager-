from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.ingestion.connectors import get_connector
from app.ingestion.robots import robots_checker
from app.models.article import Article
from app.models.enums import ArticleProcessingStatus, AuditActorType, IngestionMethod
from app.models.source import Source
from app.schemas.ingestion import IngestionResult
from app.services.audit import record_audit_event
from app.services.dedup import compute_hash, find_exact_duplicate, find_similar_titles

logger = get_logger(__name__)


async def ingest_source(db: Session, source: Source) -> IngestionResult:
    """Fetch, dedup (layers 1-2), and store new articles for one source.

    Always updates the source's health bookkeeping (last_checked, failure_count,
    robots_txt_checked_at) and commits, regardless of outcome, so ingestion is
    observable even when it fails.
    """
    now = datetime.now(timezone.utc)

    if not await robots_checker.can_fetch(source.url):
        source.robots_txt_checked_at = now
        source.last_checked = now
        source.failure_count += 1
        db.commit()
        logger.warning("ingestion_disallowed_by_robots_txt", source_id=str(source.id))
        return IngestionResult(
            source_id=str(source.id), fetched=0, stored=0, duplicate=0,
            failed=True, error="disallowed by robots.txt",
        )

    try:
        connector = get_connector(source)
        raw_items = await connector.fetch(source)
    except Exception as exc:
        source.last_checked = now
        source.robots_txt_checked_at = now
        source.failure_count += 1
        _maybe_deactivate(db, source)
        db.commit()
        error_detail = str(exc) or f"{type(exc).__name__} (no message)"
        logger.warning("ingestion_fetch_failed", source_id=str(source.id), error=error_detail)
        return IngestionResult(
            source_id=str(source.id), fetched=0, stored=0, duplicate=0,
            failed=True, error=error_detail,
        )

    stored = 0
    duplicate = 0
    similarity_window_start = now - timedelta(days=settings.INGESTION_TITLE_SIMILARITY_WINDOW_DAYS)

    for item in raw_items:
        content_for_hash = item.extracted_text or item.raw_content or item.url
        item_hash = compute_hash(content_for_hash)

        if find_exact_duplicate(db, source.id, item_hash):
            duplicate += 1
            continue

        similar = find_similar_titles(db, item.title, since=similarity_window_start)
        if similar:
            logger.info(
                "ingestion_candidate_duplicate_title",
                url=item.url,
                candidate_article_ids=[str(a.id) for a in similar],
            )

        article = Article(
            source_id=source.id,
            title=item.title,
            url=item.url,
            author=item.author,
            published_at=item.published_at,
            raw_content=item.raw_content,
            extracted_text=item.extracted_text,
            image_url=item.image_url,
            language=item.language or source.language,
            hash=item_hash,
            processing_status=(
                ArticleProcessingStatus.EXTRACTED
                if item.extracted_text
                else ArticleProcessingStatus.DISCOVERED
            ),
        )
        db.add(article)
        db.flush()
        stored += 1

    source.last_checked = now
    source.robots_txt_checked_at = now
    source.last_success_at = now
    source.failure_count = 0
    db.commit()

    return IngestionResult(
        source_id=str(source.id),
        fetched=len(raw_items),
        stored=stored,
        duplicate=duplicate,
        failed=False,
    )


def _maybe_deactivate(db: Session, source: Source) -> None:
    if source.failure_count < settings.INGESTION_FAILURE_THRESHOLD:
        return
    source.active = False
    record_audit_event(
        db,
        actor_type=AuditActorType.SYSTEM,
        actor_id=None,
        action="source.auto_deactivated",
        target_type="source",
        target_id=source.id,
        after_state={"failure_count": source.failure_count},
    )
    logger.warning(
        "ingestion_source_auto_deactivated",
        source_id=str(source.id),
        failure_count=source.failure_count,
    )


async def run_ingestion_cycle(session_factory) -> None:
    """Entry point for the scheduler: polls every active, automatable source once."""
    db = session_factory()
    try:
        sources = (
            db.query(Source)
            .filter(
                Source.active.is_(True),
                Source.ingestion_method.in_([IngestionMethod.RSS_POLL, IngestionMethod.WEB_SCRAPE]),
            )
            .all()
        )
        for source in sources:
            try:
                result = await ingest_source(db, source)
                logger.info("ingestion_cycle_source_done", **result.model_dump())
            except Exception:
                db.rollback()
                logger.exception("ingestion_cycle_source_crashed", source_id=str(source.id))
    finally:
        db.close()
