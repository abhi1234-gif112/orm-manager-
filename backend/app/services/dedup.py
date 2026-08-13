import hashlib
import uuid
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.article import Article


def compute_hash(content: str) -> str:
    normalized = " ".join(content.split()).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def find_exact_duplicate(db: Session, source_id: uuid.UUID, content_hash: str) -> Article | None:
    """Layer 1: exact hash match within the same source -- prevents re-storing the
    same item on every poll cycle (e.g. an RSS feed re-serving unchanged entries)."""
    return (
        db.query(Article)
        .filter(Article.source_id == source_id, Article.hash == content_hash)
        .first()
    )


def find_similar_titles(
    db: Session,
    title: str | None,
    since: datetime,
    threshold: float | None = None,
    limit: int = 5,
) -> list[Article]:
    """Layer 2: cross-source title similarity via pg_trgm.

    Detection only in Phase 2 -- candidates are logged, not suppressed, because
    Story-level clustering (which is where duplicates actually get merged rather
    than discarded, per docs/DATABASE.md) doesn't exist until Phase 3. Suppressing
    storage here would silently drop a source's provenance.
    """
    if not title:
        return []

    threshold = threshold if threshold is not None else settings.INGESTION_TITLE_SIMILARITY_THRESHOLD
    similarity = func.similarity(Article.title, title)
    return (
        db.query(Article)
        .filter(Article.discovered_at >= since, Article.title.isnot(None))
        .filter(similarity > threshold)
        .order_by(similarity.desc())
        .limit(limit)
        .all()
    )
