from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import IngestionMethod, SourceType


class Source(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "sources"

    name: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType, name="source_type"), nullable=False)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    geography: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    reliability_score: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ingestion_method: Mapped[IngestionMethod] = mapped_column(
        Enum(IngestionMethod, name="ingestion_method"), nullable=False
    )
    robots_txt_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
