from typing import Protocol

from app.models.source import Source
from app.schemas.ingestion import RawItem


class SourceConnector(Protocol):
    async def fetch(self, source: Source) -> list[RawItem]: ...
