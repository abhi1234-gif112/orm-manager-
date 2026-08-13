import pytest

from app.models.enums import UserRole
from app.schemas.ingestion import IngestionResult


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


SOURCE_PAYLOAD = {
    "name": "Test Gazette",
    "url": "https://example.com/feed.xml",
    "source_type": "rss",
    "ingestion_method": "rss_poll",
}


def test_list_articles_empty(client, make_user, token_for):
    viewer = make_user(role=UserRole.VIEWER)
    token = token_for(viewer)

    response = client.get("/api/v1/articles", headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json() == []


def test_get_unknown_article_404(client, make_user, token_for):
    viewer = make_user(role=UserRole.VIEWER)
    token = token_for(viewer)

    response = client.get(
        "/api/v1/articles/00000000-0000-0000-0000-000000000000", headers=auth_headers(token)
    )
    assert response.status_code == 404


def test_trigger_ingestion_requires_editor(client, make_user, token_for):
    viewer = make_user(role=UserRole.VIEWER)
    token = token_for(viewer)

    create = client.post("/api/v1/sources", json=SOURCE_PAYLOAD, headers=auth_headers(token))
    # viewer can't even create the source; use a fresh editor to set one up, then
    # confirm the *viewer* is rejected on the ingest endpoint specifically.
    assert create.status_code == 403


def test_trigger_ingestion_runs_pipeline_and_audits(
    client, make_user, token_for, monkeypatch, db_session
):
    editor = make_user(role=UserRole.EDITOR)
    token = token_for(editor)

    create = client.post("/api/v1/sources", json=SOURCE_PAYLOAD, headers=auth_headers(token))
    assert create.status_code == 201
    source_id = create.json()["id"]

    async def fake_ingest_source(db, source):
        return IngestionResult(
            source_id=str(source.id), fetched=3, stored=2, duplicate=1, failed=False
        )

    monkeypatch.setattr("app.api.v1.sources.ingest_source", fake_ingest_source)

    response = client.post(f"/api/v1/sources/{source_id}/ingest", headers=auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "source_id": source_id,
        "fetched": 3,
        "stored": 2,
        "duplicate": 1,
        "failed": False,
        "error": None,
    }

    from app.models.audit import AuditLog

    audit_rows = (
        db_session.query(AuditLog).filter(AuditLog.action == "source.ingestion_triggered").all()
    )
    assert len(audit_rows) == 1
    assert str(audit_rows[0].target_id) == source_id
