"""Helpers for ensuring required PostgreSQL extensions exist.

Creating an extension needs superuser rights, which the application's database
role should not normally have. Three situations are all legitimate:

1. The extension was already installed during database provisioning (Docker
   images, managed Postgres, or a DBA running CREATE EXTENSION). Nothing to do,
   and no special privileges are needed to detect that.
2. Migrations run as a superuser (common in local development, and in the
   pgvector/pgvector Docker image). The extension is created here.
3. Neither -- the migration cannot proceed, and the operator needs to know
   exactly which SQL to run as a superuser rather than being handed a bare
   "permission denied" from Postgres.
"""

from alembic import op
from sqlalchemy import text


def ensure_extension(name: str) -> None:
    connection = op.get_bind()

    already_installed = connection.execute(
        text("SELECT 1 FROM pg_extension WHERE extname = :name"), {"name": name}
    ).scalar()
    if already_installed:
        return

    try:
        connection.execute(text(f'CREATE EXTENSION IF NOT EXISTS "{name}"'))
    except Exception as exc:
        raise RuntimeError(
            f"The PostgreSQL extension '{name}' is required but is not installed, and this "
            f"database role lacks permission to create it.\n\n"
            f"Ask a superuser to run this once against the target database:\n\n"
            f'    CREATE EXTENSION IF NOT EXISTS "{name}";\n\n'
            f"then re-run `alembic upgrade head`. See docs/LOCAL_SETUP.md."
        ) from exc
