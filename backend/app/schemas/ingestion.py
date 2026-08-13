from datetime import datetime

from pydantic import BaseModel


class RawItem(BaseModel):
    """Normalized shape every ingestion connector returns, regardless of source type
    (see docs/REUSE_MAP.md -- one module per source type, common output shape)."""

    title: str | None = None
    url: str
    author: str | None = None
    published_at: datetime | None = None
    raw_content: str | None = None
    extracted_text: str | None = None
    image_url: str | None = None
    language: str | None = None


class IngestionResult(BaseModel):
    source_id: str
    fetched: int
    stored: int
    duplicate: int
    failed: bool
    error: str | None = None
