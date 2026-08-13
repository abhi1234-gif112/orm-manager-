from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from app.core.logging import get_logger
from app.ingestion.http import USER_AGENT, fetch_text

logger = get_logger(__name__)


class RobotsChecker:
    """Per-origin robots.txt cache. One instance is shared for the process lifetime.

    If robots.txt cannot be fetched at all (network error, not just a 404), we treat
    the source as allowed rather than blocking ingestion outright -- a stricter
    "assume disallowed on server error" policy per RFC 9309 is a Phase 8 hardening
    candidate, not required for V1's foundation.
    """

    def __init__(self) -> None:
        self._cache: dict[str, RobotFileParser] = {}

    async def _get_parser(self, url: str) -> RobotFileParser:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        if origin in self._cache:
            return self._cache[origin]

        parser = RobotFileParser()
        try:
            text = await fetch_text(f"{origin}/robots.txt")
            parser.parse(text.splitlines())
        except Exception:
            logger.info("robots_txt_unreachable_assuming_allowed", origin=origin)
            parser.parse([])

        self._cache[origin] = parser
        return parser

    async def can_fetch(self, url: str) -> bool:
        parser = await self._get_parser(url)
        return parser.can_fetch(USER_AGENT, url)


robots_checker = RobotsChecker()
