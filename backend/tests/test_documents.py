import io


def _auth(client, email="u@u.com"):
    client.post("/api/v1/auth/signup", json={"name": "U", "email": email, "password": "pw"})
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_document_upload_and_list(client):
    h = _auth(client)
    r = client.post(
        "/api/v1/documents",
        files={"file": ("test.pdf", io.BytesIO(b"fake pdf content"), "application/pdf")},
        headers=h,
    )
    assert r.status_code == 200
    doc_id = r.json()["id"]
    assert r.json()["name"] == "test.pdf"

    r = client.get("/api/v1/documents", headers=h)
    assert any(d["id"] == doc_id for d in r.json())


def test_document_delete(client):
    h = _auth(client)
    r = client.post(
        "/api/v1/documents",
        files={"file": ("del.pdf", io.BytesIO(b"data"), "application/pdf")},
        headers=h,
    )
    doc_id = r.json()["id"]

    r = client.delete(f"/api/v1/documents/{doc_id}", headers=h)
    assert r.status_code == 200

    r = client.get(f"/api/v1/documents/{doc_id}", headers=h)
    assert r.status_code == 404


def test_documents_isolation(client):
    h1 = _auth(client, "d1@test.com")
    h2 = _auth(client, "d2@test.com")

    r = client.post(
        "/api/v1/documents",
        files={"file": ("private.pdf", io.BytesIO(b"data"), "application/pdf")},
        headers=h1,
    )
    doc_id = r.json()["id"]

    r = client.get(f"/api/v1/documents/{doc_id}", headers=h2)
    assert r.status_code == 404
