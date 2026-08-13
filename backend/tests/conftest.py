import os
import sys

DEFAULT_TEST_DATABASE_URL = (
    "postgresql+psycopg://saptanga:saptanga@localhost:5432/saptanga_newsroom_test"
)

# This suite calls drop_all() and deletes every row between tests, so pointing it
# at a real database destroys it. DATABASE_URL is deliberately IGNORED here --
# a developer with it exported for normal work (the common case) would otherwise
# have their development database silently wiped by running pytest. Override the
# test database only via TEST_DATABASE_URL.
_test_database_url = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)

if "test" not in _test_database_url.rsplit("/", 1)[-1]:
    sys.exit(
        "Refusing to run tests: the target database name in TEST_DATABASE_URL does not "
        f"contain 'test' ({_test_database_url!r}).\nThis suite drops tables and deletes "
        "rows -- it must never point at a real database."
    )

# Must be set before any `app.*` import so pydantic-settings picks them up.
os.environ["DATABASE_URL"] = _test_database_url
os.environ.setdefault(
    "SUPABASE_JWT_SECRET", "test-secret-not-for-production-01234567890123456789"
)
os.environ["INGESTION_SCHEDULER_ENABLED"] = "false"

import uuid  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import *  # noqa: E402,F401,F403 -- register all models on Base.metadata
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture()
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
        session.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def make_user(db_session):
    def _make(role: UserRole = UserRole.VIEWER, email: str | None = None) -> User:
        user = User(email=email or f"{uuid.uuid4()}@example.com", role=role, active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make


@pytest.fixture()
def token_for():
    def _token(user: User) -> str:
        return jwt.encode(
            {"sub": str(user.id), "email": user.email, "aud": settings.SUPABASE_JWT_AUDIENCE},
            settings.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )

    return _token
