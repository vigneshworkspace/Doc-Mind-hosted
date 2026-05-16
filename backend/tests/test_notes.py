def _auth(client, email="t@t.com"):
    client.post("/api/v1/auth/signup", json={"name": "T", "email": email, "password": "pw"})
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_notes_empty_initially(client):
    h = _auth(client)
    r = client.get("/api/v1/notes", headers=h)
    assert r.status_code == 200
    assert r.json() == []


def test_notes_crud(client):
    h = _auth(client)
    r = client.post("/api/v1/notes", json={"title": "Test", "content": "Content", "subject": "CS"}, headers=h)
    assert r.status_code == 201
    note_id = r.json()["id"]

    r = client.get(f"/api/v1/notes/{note_id}", headers=h)
    assert r.json()["title"] == "Test"

    r = client.patch(f"/api/v1/notes/{note_id}", json={"title": "Updated"}, headers=h)
    assert r.json()["title"] == "Updated"
    assert r.json()["content"] == "Content"

    r = client.delete(f"/api/v1/notes/{note_id}", headers=h)
    assert r.status_code == 200

    r = client.get(f"/api/v1/notes/{note_id}", headers=h)
    assert r.status_code == 404


def test_notes_isolation(client):
    h1 = _auth(client, "user1@test.com")
    h2 = _auth(client, "user2@test.com")

    r = client.post("/api/v1/notes", json={"title": "Private", "content": "", "subject": ""}, headers=h1)
    note_id = r.json()["id"]

    r = client.get(f"/api/v1/notes/{note_id}", headers=h2)
    assert r.status_code == 404
