import pytest

from app.ingestion.sources.rss import RSSConnector
from app.ingestion.sources.web import WebConnector
from app.models.enums import IngestionMethod, SourceType
from app.models.source import Source

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Gazette</title>
    <language>en</language>
    <item>
      <title>Maharashtra announces new infrastructure project</title>
      <link>https://example.com/articles/infra-project</link>
      <author>desk@example.com</author>
      <description><![CDATA[<p>The state government today <b>announced</b> a new project.</p>]]></description>
      <pubDate>Mon, 10 Aug 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second story</title>
      <link>https://example.com/articles/second</link>
      <description>Plain text summary.</description>
    </item>
  </channel>
</rss>
"""

SAMPLE_LISTING_HTML = """
<html><body>
<a class="press-release" href="/releases/one">Release One</a>
<a class="press-release" href="/releases/two">Release Two</a>
<a class="other-link" href="/about">About</a>
<a class="press-release" href="https://external.example.com/off-domain">Off domain</a>
</body></html>
"""

SAMPLE_ARTICLE_PAGE = """
<html><head><title>Release One Title</title>
<meta property="og:image" content="https://example.com/image.jpg"/>
</head>
<body><article><p>Body text of the release.</p></article></body></html>
"""


def make_rss_source() -> Source:
    return Source(
        name="Test Gazette",
        url="https://example.com/feed.xml",
        source_type=SourceType.RSS,
        ingestion_method=IngestionMethod.RSS_POLL,
    )


def make_web_source(link_selector: str | None = "a.press-release") -> Source:
    return Source(
        name="Official Releases",
        url="https://example.com/releases",
        source_type=SourceType.OFFICIAL_RELEASE,
        ingestion_method=IngestionMethod.WEB_SCRAPE,
        source_metadata={"link_selector": link_selector} if link_selector else None,
    )


@pytest.mark.asyncio
async def test_rss_connector_normalizes_entries(monkeypatch):
    async def fake_fetch_text(url: str) -> str:
        assert url == "https://example.com/feed.xml"
        return SAMPLE_RSS

    monkeypatch.setattr("app.ingestion.sources.rss.fetch_text", fake_fetch_text)

    items = await RSSConnector().fetch(make_rss_source())

    assert len(items) == 2
    first = items[0]
    assert first.title == "Maharashtra announces new infrastructure project"
    assert first.url == "https://example.com/articles/infra-project"
    assert first.author == "desk@example.com"
    assert first.published_at is not None
    assert "announced" in (first.extracted_text or "")
    assert "<b>" not in (first.extracted_text or "")


@pytest.mark.asyncio
async def test_web_connector_follows_listing_links_same_domain_only(monkeypatch):
    calls = []

    async def fake_fetch_text(url: str) -> str:
        calls.append(url)
        if url == "https://example.com/releases":
            return SAMPLE_LISTING_HTML
        return SAMPLE_ARTICLE_PAGE

    monkeypatch.setattr("app.ingestion.sources.web.fetch_text", fake_fetch_text)

    items = await WebConnector().fetch(make_web_source())

    # Only the two same-domain press-release links are followed; the off-domain
    # link and the non-matching selector link are excluded.
    assert len(items) == 2
    assert all(item.title == "Release One Title" for item in items)
    assert "https://external.example.com/off-domain" not in calls


@pytest.mark.asyncio
async def test_web_connector_without_selector_treats_url_as_single_item(monkeypatch):
    async def fake_fetch_text(url: str) -> str:
        return SAMPLE_ARTICLE_PAGE

    monkeypatch.setattr("app.ingestion.sources.web.fetch_text", fake_fetch_text)

    items = await WebConnector().fetch(make_web_source(link_selector=None))

    assert len(items) == 1
    assert items[0].url == "https://example.com/releases"
