FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic_helpers ./alembic_helpers
COPY alembic.ini ./
COPY docker-entrypoint.sh ./

RUN pip install --no-cache-dir . \
    && chmod +x docker-entrypoint.sh

EXPOSE 8000

# Migrations run on startup so a fresh `docker compose up` yields a working API
# rather than one pointed at an empty database.
CMD ["./docker-entrypoint.sh"]
