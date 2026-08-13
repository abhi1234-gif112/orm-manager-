import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.article import EMBEDDING_DIM
from app.models.enums import ClusterMethod, EditorialStatus, VerificationStatus


class Story(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "stories"

    canonical_title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    subcategory: Mapped[str | None] = mapped_column(String, nullable=True)
    geography: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    importance_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    relevance_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    novelty_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, name="verification_status"),
        nullable=False,
        default=VerificationStatus.UNVERIFIED,
    )
    editorial_status: Mapped[EditorialStatus] = mapped_column(
        Enum(EditorialStatus, name="editorial_status"),
        nullable=False,
        default=EditorialStatus.INCOMING,
    )
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate="now()", nullable=True
    )


class StoryArticle(Base):
    __tablename__ = "story_articles"

    story_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stories.id"), primary_key=True
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("articles.id"), primary_key=True
    )
    cluster_method: Mapped[ClusterMethod] = mapped_column(
        Enum(ClusterMethod, name="cluster_method"), nullable=False
    )
    cluster_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
