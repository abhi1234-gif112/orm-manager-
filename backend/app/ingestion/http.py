import httpx

from app.core.config import settings

# Identifies SAPTANGA's ingestion bot to source servers -- spec requires respecting
# robots.txt and platform ToS, which starts with being identifiable, not anonymous.
USER_AGENT = "SaptangaNewsroomBot/0.1 (+https://saptanga.example/about-our-bot)"


async def fetch_text(url: str) -> str:
    async with httpx.AsyncClient(
        timeout=settings.INGESTION_HTTP_TIMEOUT_SECONDS,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.text
