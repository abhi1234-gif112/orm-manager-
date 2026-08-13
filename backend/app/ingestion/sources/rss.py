from datetime import datetime, timezone
from time import struct_time

import feedparser

from app.core.config import settings
from app.ingestion.extraction import html_to_text
from app.ingestion.http import fetch_text
from app.models.source import Source
from app.schemas.ingestion import RawItem


def _to_datetime(parsed: struct_time | None) -> datetime | None:
    if parsed is None:
        return None
    return datetime(*parsed[:6], tzinfo=timezone.utc)


def _entry_image(entry: feedparser.FeedParserDict) -> str | None:
    media_thumbnail = entry.get("media_thumbnail")
    if media_thumbnail:
        return media_thumbnail[0].get("url")
    for link in entry.get("links", []):
        if link.get("rel") == "enclosure" and str(link.get("type", "")).startswith("image/"):
            return link.get("href")
    return None


class RSSConnector:
    """Handles both RSS and Atom feeds -- feedparser normalizes both to the same
    entry shape, so one connector covers both `SourceType.RSS` and `SourceType.ATOM`."""

    async def fetch(self, source: Source) -> list[RawItem]:
        raw_feed = await fetch_text(source.url)
        parsed = feedparser.parse(raw_feed)

        items: list[RawItem] = []
        for entry in parsed.entries[: settings.INGESTION_MAX_ITEMS_PER_SOURCE]:
            url = entry.get("link")
            if not url:
                continue

            summary_html = entry.get("summary") or entry.get("description")
            items.append(
                RawItem(
                    title=entry.get("title"),
                    url=url,
                    author=entry.get("author"),
                    published_at=_to_datetime(
                        entry.get("published_parsed") or entry.get("updated_parsed")
                    ),
                    raw_content=summary_html,
                    extracted_text=html_to_text(summary_html),
                    image_url=_entry_image(entry),
                    language=parsed.feed.get("language"),
                )
            )
        return items
