import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import InvalidTokenError, decode_supabase_jwt
from app.database.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=True)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_supabase_jwt(token)
        subject_id = uuid.UUID(payload.sub)
    except (InvalidTokenError, ValueError) as exc:
        raise credentials_exception from exc

    user = db.query(User).filter(User.id == subject_id).first()
    if user is None or not user.active:
        raise credentials_exception

    return user
