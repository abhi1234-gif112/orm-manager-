import jwt
from pydantic import BaseModel

from app.core.config import settings


class TokenPayload(BaseModel):
    sub: str
    email: str | None = None


class InvalidTokenError(Exception):
    pass


def decode_supabase_jwt(token: str) -> TokenPayload:
    """Verify and decode a Supabase Auth-issued JWT.

    Role is deliberately NOT read from the token: Supabase's own `role` claim
    reflects the Postgres role (`authenticated`), not our application role.
    The application role lives in `users.role` and is looked up from the
    database by `sub`, so a forged/stale client claim can never grant access.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=settings.SUPABASE_JWT_AUDIENCE,
        )
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    return TokenPayload(sub=payload["sub"], email=payload.get("email"))
