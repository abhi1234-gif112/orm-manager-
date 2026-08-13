import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_editor
from app.database.session import get_db
from app.models.enums import AuditActorType
from app.models.source import Source
from app.models.user import User
from app.schemas.source import SourceCreate, SourceRead, SourceUpdate
from app.services.audit import record_audit_event

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=list[SourceRead])
def list_sources(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Source]:
    query = db.query(Source)
    if active_only:
        query = query.filter(Source.active.is_(True))
    return query.order_by(Source.name).all()


@router.get("/{source_id}", response_model=SourceRead)
def get_source(
    source_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Source:
    source = db.get(Source, source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    return source


@router.post("", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
def create_source(
    payload: SourceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
) -> Source:
    source = Source(**payload.model_dump())
    db.add(source)
    db.flush()
    record_audit_event(
        db,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="source.created",
        target_type="source",
        target_id=source.id,
        after_state=payload.model_dump(mode="json"),
    )
    db.commit()
    db.refresh(source)
    return source


@router.patch("/{source_id}", response_model=SourceRead)
def update_source(
    source_id: uuid.UUID,
    payload: SourceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
) -> Source:
    source = db.get(Source, source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    before_state = SourceRead.model_validate(source).model_dump(mode="json")
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(source, field, value)
    db.flush()

    record_audit_event(
        db,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="source.updated",
        target_type="source",
        target_id=source.id,
        before_state=before_state,
        after_state=updates,
    )
    db.commit()
    db.refresh(source)
    return source


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_source(
    source_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
) -> None:
    """Sources are deactivated, never deleted -- ingested articles must retain provenance."""
    source = db.get(Source, source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    source.active = False
    db.flush()
    record_audit_event(
        db,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="source.deactivated",
        target_type="source",
        target_id=source.id,
    )
    db.commit()
