import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import IngestionMethod, SourceType


class SourceBase(BaseModel):
    name: str
    url: str
    source_type: SourceType
    language: str | None = None
    geography: list[str] | None = None
    category: str | None = None
    reliability_score: float | None = Field(default=None, ge=0, le=1)
    ingestion_method: IngestionMethod
    active: bool = True


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    source_type: SourceType | None = None
    language: str | None = None
    geography: list[str] | None = None
    category: str | None = None
    reliability_score: float | None = Field(default=None, ge=0, le=1)
    ingestion_method: IngestionMethod | None = None
    active: bool | None = None


class SourceRead(SourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    last_checked: datetime | None = None
    last_success_at: datetime | None = None
    failure_count: int
