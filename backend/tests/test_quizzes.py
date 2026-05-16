def _auth(client, email="q@q.com"):
    client.post("/api/v1/auth/signup", json={"name": "Q", "email": email, "password": "pw"})
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_quizzes_empty_initially(client):
    h = _auth(client)
    r = client.get("/api/v1/quizzes", headers=h)
    assert r.status_code == 200
    assert r.json() == []


def test_quiz_generate(client):
    h = _auth(client)
    r = client.post("/api/v1/quizzes/generate", json={"count": 3, "difficulty": "easy"}, headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "questions" in data
    assert len(data["questions"]) == 3


def test_quiz_save(client):
    h = _auth(client)
    gen = client.post("/api/v1/quizzes/generate", json={"count": 2}, headers=h).json()
    r = client.post("/api/v1/quizzes", json=gen, headers=h)
    assert r.status_code == 201
    assert r.json()["id"] is not None

    r = client.get("/api/v1/quizzes", headers=h)
    assert len(r.json()) == 1


def test_quiz_unauthenticated(client):
    r = client.get("/api/v1/quizzes")
    assert r.status_code == 401
