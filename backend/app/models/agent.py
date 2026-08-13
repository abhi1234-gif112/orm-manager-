import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, SmallInteger, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin
from app.models.enums import AgentName, AgentRunStatus, AgentTaskStatus, AgentTrigger


class AgentRun(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "agent_runs"

    agent_name: Mapped[AgentName] = mapped_column(Enum(AgentName, name="agent_name"), nullable=False)
    trigger: Mapped[AgentTrigger] = mapped_column(Enum(AgentTrigger, name="agent_trigger"), nullable=False)
    story_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stories.id"), nullable=True
    )
    article_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("articles.id"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[AgentRunStatus] = mapped_column(
        Enum(AgentRunStatus, name="agent_run_status"), nullable=False, default=AgentRunStatus.RUNNING
    )


class AgentTask(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "agent_tasks"

    agent_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False
    )
    agent_name: Mapped[AgentName] = mapped_column(Enum(AgentName, name="agent_name"), nullable=False)
    input_ref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    expected_output_schema: Mapped[str | None] = mapped_column(String, nullable=True)
    output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[AgentTaskStatus] = mapped_column(
        Enum(AgentTaskStatus, name="agent_task_status"), nullable=False, default=AgentTaskStatus.PENDING
    )
    priority: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String, nullable=True)
    token_count_input: Mapped[int | None] = mapped_column(nullable=True)
    token_count_output: Mapped[int | None] = mapped_column(nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    error_state: Mapped[str | None] = mapped_column(String, nullable=True)
    human_approval_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
