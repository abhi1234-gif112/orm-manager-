from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserRead)
def read_current_user(user: User = Depends(get_current_user)) -> User:
    """Confirms the caller's identity and application role.

    Authentication itself happens against Supabase Auth on the frontend;
    this backend only ever verifies the resulting JWT (see core/security.py).
    """
    return user
