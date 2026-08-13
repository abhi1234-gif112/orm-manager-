#!/usr/bin/env python3
"""Create a local editor user and print a signed JWT for testing the API.

Local development only. Supabase Auth is what issues real tokens in a deployed
setup; this mints an equivalent one directly using SUPABASE_JWT_SECRET so the
backend can be exercised (curl, HTTP client, tests) before a Supabase project
exists. It does not create a Supabase account and will not let you log in
through the Editor Desk UI -- see docs/LOCAL_SETUP.md.

Usage, from the backend/ directory with its virtualenv active:

    python ../scripts/make_dev_token.py
    python ../scripts/make_dev_token.py --email me@example.com --role admin
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import jwt  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.database.session import SessionLocal  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default="editor@saptanga.local")
    parser.add_argument(
        "--role", default="editor", choices=[role.value for role in UserRole]
    )
    args = parser.parse_args()

    if settings.ENVIRONMENT not in {"development", "test", "local"}:
        print(
            f"Refusing to mint a token: ENVIRONMENT is '{settings.ENVIRONMENT}', "
            "not a local environment.",
            file=sys.stderr,
        )
        return 1

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user is None:
            user = User(email=args.email, role=UserRole(args.role), active=True)
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user {user.email} with role {user.role.value}", file=sys.stderr)
        else:
            print(f"Reusing existing user {user.email} (role {user.role.value})", file=sys.stderr)

        token = jwt.encode(
            {
                "sub": str(user.id),
                "email": user.email,
                "aud": settings.SUPABASE_JWT_AUDIENCE,
            },
            settings.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )
    finally:
        db.close()

    print(token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
