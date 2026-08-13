import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ArticleProcessingStatus


class ArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_id: uuid.UUID
    title: str | None = None
    url: str
    author: str | None = None
    published_at: datetime | None = None
    discovered_at: datetime
    extracted_text: str | None = None
    image_url: str | None = None
    language: str | None = None
    processing_status: ArticleProcessingStatus
