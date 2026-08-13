from app.models.enums import UserRole


def test_me_requires_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_rejects_invalid_token(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert response.status_code == 401


def test_me_returns_current_user(client, make_user, token_for):
    user = make_user(role=UserRole.EDITOR, email="editor@saptanga.test")
    token = token_for(user)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "editor@saptanga.test"
    assert body["role"] == "editor"


def test_inactive_user_rejected(client, make_user, token_for, db_session):
    user = make_user(role=UserRole.EDITOR)
    token = token_for(user)
    user.active = False
    db_session.commit()

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
