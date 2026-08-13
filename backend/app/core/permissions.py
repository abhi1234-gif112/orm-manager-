from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.enums import UserRole
from app.models.user import User


def require_role(*allowed_roles: UserRole) -> Callable[..., User]:
    """FastAPI dependency factory enforcing RBAC.

    Every router that mutates state depends on this rather than checking
    `user.role` inline, so the permission model lives in one place (spec:
    ARCHITECTURE.md security model).
    """

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role.value}' is not permitted to perform this action",
            )
        return user

    return dependency


# Convenience shorthands for common tiers used across routers.
require_editor = require_role(UserRole.ADMIN, UserRole.EDITOR)
require_contributor = require_role(UserRole.ADMIN, UserRole.EDITOR, UserRole.CONTRIBUTOR)
require_any_authenticated = require_role(
    UserRole.ADMIN, UserRole.EDITOR, UserRole.CONTRIBUTOR, UserRole.VIEWER
)
