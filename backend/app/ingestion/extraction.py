from bs4 import BeautifulSoup


def html_to_text(html: str | None) -> str | None:
    """Strips markup to plain text. Not a full readability algorithm -- good enough
    for feed summaries and simple article pages; revisit if a source needs more."""
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    return text or None


def extract_page(html: str) -> tuple[str | None, str | None, str | None]:
    """Returns (title, extracted_text, image_url) for a fetched HTML page."""
    soup = BeautifulSoup(html, "html.parser")

    title = None
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)

    content_root = soup.find("article") or soup.find("main") or soup.body or soup
    text = content_root.get_text(separator=" ", strip=True) if content_root else None

    image_url = None
    og_image = soup.find("meta", attrs={"property": "og:image"})
    if og_image and og_image.get("content"):
        image_url = og_image["content"]

    return title, text or None, image_url
