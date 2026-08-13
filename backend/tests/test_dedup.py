from datetime import datetime, timedelta, timezone

from app.models.article import Article
from app.models.enums import ArticleProcessingStatus, IngestionMethod, SourceType
from app.models.source import Source
from app.services.dedup import compute_hash, find_exact_duplicate, find_similar_titles


def make_source(db_session) -> Source:
    source = Source(
        name="Test Feed",
        url="https://example.com/feed.xml",
        source_type=SourceType.RSS,
        ingestion_method=IngestionMethod.RSS_POLL,
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


def make_article(db_session, source, title, hash_value=None, discovered_at=None):
    article = Article(
        source_id=source.id,
        title=title,
        url=f"https://example.com/{title.replace(' ', '-')}",
        hash=hash_value or compute_hash(title),
        processing_status=ArticleProcessingStatus.DISCOVERED,
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    if discovered_at:
        article.discovered_at = discovered_at
        db_session.commit()
    return article


def test_compute_hash_is_stable_and_normalizes_whitespace():
    assert compute_hash("Hello   World") == compute_hash("hello world")
    assert compute_hash("Hello World") != compute_hash("Goodbye World")


def test_find_exact_duplicate_matches_same_source_and_hash(db_session):
    source = make_source(db_session)
    article = make_article(db_session, source, "Budget announced", hash_value="abc123")

    found = find_exact_duplicate(db_session, source.id, "abc123")
    assert found is not None
    assert found.id == article.id

    assert find_exact_duplicate(db_session, source.id, "different-hash") is None


def test_find_exact_duplicate_is_scoped_per_source(db_session):
    source_a = make_source(db_session)
    source_b = Source(
        name="Other Feed",
        url="https://other.example.com/feed.xml",
        source_type=SourceType.RSS,
        ingestion_method=IngestionMethod.RSS_POLL,
    )
    db_session.add(source_b)
    db_session.commit()
    db_session.refresh(source_b)

    make_article(db_session, source_a, "Shared story", hash_value="same-hash")

    # Same hash, different source -- not a duplicate at layer 1 (each source's
    # provenance is tracked independently until Story clustering exists).
    assert find_exact_duplicate(db_session, source_b.id, "same-hash") is None


def test_find_similar_titles_detects_near_duplicates(db_session):
    source = make_source(db_session)
    make_article(db_session, source, "Maharashtra announces new infrastructure project")

    similar = find_similar_titles(
        db_session,
        "Maharashtra announces infrastructure project",
        since=datetime.now(timezone.utc) - timedelta(days=1),
    )
    assert len(similar) == 1


def test_find_similar_titles_respects_time_window(db_session):
    source = make_source(db_session)
    old_article = make_article(db_session, source, "Old but similar headline text here")
    db_session.query(Article).filter(Article.id == old_article.id).update(
        {"discovered_at": datetime.now(timezone.utc) - timedelta(days=30)}
    )
    db_session.commit()

    similar = find_similar_titles(
        db_session,
        "Old but similar headline text here",
        since=datetime.now(timezone.utc) - timedelta(days=7),
    )
    assert similar == []


def test_find_similar_titles_returns_empty_for_unrelated(db_session):
    source = make_source(db_session)
    make_article(db_session, source, "Completely unrelated topic entirely")

    similar = find_similar_titles(
        db_session,
        "A totally different subject matter",
        since=datetime.now(timezone.utc) - timedelta(days=1),
    )
    assert similar == []
