import uuid

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin
from app.models.enums import EntityType


class Entity(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "entities"

    name: Mapped[str] = mapped_column(String, nullable=False)
    entity_type: Mapped[EntityType] = mapped_column(Enum(EntityType, name="entity_type"), nullable=False)
    canonical_key: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    entity_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    future_page_slug: Mapped[str | None] = mapped_column(String, nullable=True)


class StoryEntity(Base):
    __tablename__ = "story_entities"

    story_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stories.id"), primary_key=True
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entities.id"), primary_key=True
    )
    role: Mapped[str | None] = mapped_column(String, nullable=True)
