#!/bin/sh
set -e

# Postgres accepts TCP connections slightly before it is ready to serve queries,
# and compose's healthcheck covers the container, not this app's own readiness.
echo "Waiting for database..."
until python -c "
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings
try:
    create_engine(settings.DATABASE_URL).connect().execute(text('SELECT 1'))
except Exception:
    sys.exit(1)
" 2>/dev/null; do
  sleep 1
done

echo "Running migrations..."
alembic upgrade head

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
