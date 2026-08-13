import uuid

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.enums import AuditActorType


def record_audit_event(
    db: Session,
    *,
    actor_type: AuditActorType,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    before_state: dict | None = None,
    after_state: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Insert-only audit trail entry. Never update or delete audit_logs rows."""
    entry = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        before_state=before_state,
        after_state=after_state,
        ip_address=ip_address,
    )
    db.add(entry)
    db.flush()
    return entry
