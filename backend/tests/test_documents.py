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


# Regression: GET /documents/{id} must return DocumentDetailOut, which carries the
# parsed text fields the frontend PdfQA screen reads (parsed_md || content) plus
# page_count. An AI reverting the response_model to DocumentOut would silently drop
# these keys, sending the Q&A screen back to showing hardcoded mock content.
# These fields MUST be present in the single-document response.
DOC_DETAIL_FIELDS = ["content", "parsed_md", "summary", "page_count", "outline"]


def test_document_detail_contract(client):
    h = _auth(client, "detail@test.com")
    r = client.post(
        "/api/v1/documents",
        files={"file": ("paper.pdf", io.BytesIO(b"data"), "application/pdf")},
        headers=h,
    )
    doc_id = r.json()["id"]

    # The list endpoint (DocumentOut) does NOT carry parsed text — only the detail does.
    r = client.get(f"/api/v1/documents/{doc_id}", headers=h)
    assert r.status_code == 200
    body = r.json()
    for field in DOC_DETAIL_FIELDS:
        assert field in body, f"DocumentDetailOut missing '{field}' — PdfQA contract broken"
