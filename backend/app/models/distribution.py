import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin
from app.models.enums import DistributionAttemptStatus, Platform


class Distribution(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "distribution"

    content_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content.id"), nullable=False
    )
    platform: Mapped[Platform] = mapped_column(Enum(Platform, name="platform"), nullable=False)
    platform_post_id: Mapped[str | None] = mapped_column(String, nullable=True)
    platform_url: Mapped[str | None] = mapped_column(String, nullable=True)
    attempt_status: Mapped[DistributionAttemptStatus] = mapped_column(
        Enum(DistributionAttemptStatus, name="distribution_attempt_status"), nullable=False
    )
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
