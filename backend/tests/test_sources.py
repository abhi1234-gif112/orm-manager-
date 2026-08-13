from app.models.enums import UserRole

SOURCE_PAYLOAD = {
    "name": "Test Gazette",
    "url": "https://example.com/feed.xml",
    "source_type": "rss",
    "ingestion_method": "rss_poll",
    "language": "en",
    "geography": ["Maharashtra"],
    "category": "government",
}


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_viewer_can_list_but_not_create_sources(client, make_user, token_for):
    viewer = make_user(role=UserRole.VIEWER)
    token = token_for(viewer)

    list_response = client.get("/api/v1/sources", headers=auth_headers(token))
    assert list_response.status_code == 200
    assert list_response.json() == []

    create_response = client.post(
        "/api/v1/sources", json=SOURCE_PAYLOAD, headers=auth_headers(token)
    )
    assert create_response.status_code == 403


def test_editor_can_create_and_deactivate_source(client, make_user, token_for, db_session):
    editor = make_user(role=UserRole.EDITOR)
    token = token_for(editor)

    create_response = client.post(
        "/api/v1/sources", json=SOURCE_PAYLOAD, headers=auth_headers(token)
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Test Gazette"
    assert created["active"] is True

    from app.models.audit import AuditLog

    audit_rows = db_session.query(AuditLog).filter(AuditLog.action == "source.created").all()
    assert len(audit_rows) == 1
    assert str(audit_rows[0].target_id) == created["id"]

    source_id = created["id"]
    delete_response = client.delete(f"/api/v1/sources/{source_id}", headers=auth_headers(token))
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/v1/sources/{source_id}", headers=auth_headers(token))
    assert get_response.json()["active"] is False


def test_unknown_source_returns_404(client, make_user, token_for):
    editor = make_user(role=UserRole.EDITOR)
    token = token_for(editor)

    response = client.get(
        "/api/v1/sources/00000000-0000-0000-0000-000000000000", headers=auth_headers(token)
    )
    assert response.status_code == 404
