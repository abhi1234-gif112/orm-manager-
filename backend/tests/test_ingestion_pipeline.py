import pytest

from app.ingestion import pipeline as pipeline_module
from app.models.article import Article
from app.models.enums import IngestionMethod, SourceType
from app.models.source import Source
from app.schemas.ingestion import RawItem


class StubConnector:
    def __init__(self, items: list[RawItem] | Exception):
        self._items = items

    async def fetch(self, source: Source) -> list[RawItem]:
        if isinstance(self._items, Exception):
            raise self._items
        return self._items


def make_source(db_session, **overrides) -> Source:
    source = Source(
        name="Test Gazette",
        url="https://example.com/feed.xml",
        source_type=SourceType.RSS,
        ingestion_method=IngestionMethod.RSS_POLL,
        **overrides,
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)
    return source


@pytest.fixture(autouse=True)
def allow_robots(monkeypatch):
    async def always_allowed(url: str) -> bool:
        return True

    monkeypatch.setattr(pipeline_module.robots_checker, "can_fetch", always_allowed)


@pytest.mark.asyncio
async def test_ingest_source_stores_new_articles(db_session, monkeypatch):
    source = make_source(db_session)
    items = [
        RawItem(title="Story A", url="https://example.com/a", extracted_text="Body A"),
        RawItem(title="Story B", url="https://example.com/b", extracted_text="Body B"),
    ]
    monkeypatch.setattr(pipeline_module, "get_connector", lambda src: StubConnector(items))

    result = await pipeline_module.ingest_source(db_session, source)

    assert result.fetched == 2
    assert result.stored == 2
    assert result.duplicate == 0
    assert result.failed is False
    assert db_session.query(Article).filter(Article.source_id == source.id).count() == 2
    assert source.failure_count == 0
    assert source.last_success_at is not None


@pytest.mark.asyncio
async def test_ingest_source_skips_exact_duplicates_across_polls(db_session, monkeypatch):
    source = make_source(db_session)
    items = [RawItem(title="Story A", url="https://example.com/a", extracted_text="Body A")]
    monkeypatch.setattr(pipeline_module, "get_connector", lambda src: StubConnector(items))

    first = await pipeline_module.ingest_source(db_session, source)
    second = await pipeline_module.ingest_source(db_session, source)

    assert first.stored == 1
    assert second.stored == 0
    assert second.duplicate == 1
    assert db_session.query(Article).filter(Article.source_id == source.id).count() == 1


@pytest.mark.asyncio
async def test_ingest_source_dedupes_within_a_single_batch(db_session, monkeypatch):
    source = make_source(db_session)
    items = [
        RawItem(title="Story A", url="https://example.com/a", extracted_text="Same body"),
        RawItem(title="Story A repost", url="https://example.com/a-again", extracted_text="Same body"),
    ]
    monkeypatch.setattr(pipeline_module, "get_connector", lambda src: StubConnector(items))

    result = await pipeline_module.ingest_source(db_session, source)

    assert result.stored == 1
    assert result.duplicate == 1


@pytest.mark.asyncio
async def test_ingest_source_records_failure_and_increments_count(db_session, monkeypatch):
    source = make_source(db_session)
    monkeypatch.setattr(
        pipeline_module, "get_connector", lambda src: StubConnector(RuntimeError("boom"))
    )

    result = await pipeline_module.ingest_source(db_session, source)

    assert result.failed is True
    assert result.error == "boom"
    assert source.failure_count == 1


@pytest.mark.asyncio
async def test_ingest_source_auto_deactivates_after_failure_threshold(db_session, monkeypatch):
    from app.core.config import settings

    source = make_source(db_session)
    monkeypatch.setattr(
        pipeline_module, "get_connector", lambda src: StubConnector(RuntimeError("boom"))
    )

    for _ in range(settings.INGESTION_FAILURE_THRESHOLD):
        await pipeline_module.ingest_source(db_session, source)

    assert source.failure_count == settings.INGESTION_FAILURE_THRESHOLD
    assert source.active is False


@pytest.mark.asyncio
async def test_ingest_source_blocked_by_robots_txt(db_session, monkeypatch):
    source = make_source(db_session)

    async def disallowed(url: str) -> bool:
        return False

    monkeypatch.setattr(pipeline_module.robots_checker, "can_fetch", disallowed)

    result = await pipeline_module.ingest_source(db_session, source)

    assert result.failed is True
    assert "robots.txt" in result.error
    assert source.failure_count == 1
