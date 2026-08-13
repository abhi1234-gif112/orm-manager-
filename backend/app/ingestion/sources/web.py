from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.core.config import settings
from app.ingestion.extraction import extract_page
from app.ingestion.http import fetch_text
from app.models.source import Source
from app.schemas.ingestion import RawItem


def _extract_links(html: str, base_url: str, selector: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    base_domain = urlparse(base_url).netloc

    seen: set[str] = set()
    links: list[str] = []
    for anchor in soup.select(selector):
        href = anchor.get("href")
        if not href:
            continue
        resolved = urljoin(base_url, href)
        if urlparse(resolved).netloc != base_domain:
            continue  # stay on the registered source's own domain
        if resolved not in seen:
            seen.add(resolved)
            links.append(resolved)
    return links


class WebConnector:
    """Generic connector for official websites / press-release pages.

    `sources.metadata.link_selector`, if set, treats `source.url` as a listing page
    and follows same-domain links matching that CSS selector (e.g. "a.press-release"),
    fetching each as one item. Without a selector, the source URL itself is treated
    as a single item (e.g. a page that's updated in place, like a notices page).
    """

    async def fetch(self, source: Source) -> list[RawItem]:
        listing_html = await fetch_text(source.url)
        metadata = source.source_metadata or {}
        selector = metadata.get("link_selector")

        if not selector:
            return [self._build_item(source.url, listing_html)]

        links = _extract_links(listing_html, source.url, selector)
        items: list[RawItem] = []
        for link in links[: settings.INGESTION_MAX_LINKS_PER_WEB_SOURCE]:
            try:
                page_html = await fetch_text(link)
            except Exception:
                continue
            items.append(self._build_item(link, page_html))
        return items

    def _build_item(self, url: str, html: str) -> RawItem:
        title, text, image_url = extract_page(html)
        return RawItem(
            title=title,
            url=url,
            raw_content=html,
            extracted_text=text,
            image_url=image_url,
        )
