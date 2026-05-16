def test_signup(client):
    r = client.post("/api/v1/auth/signup", json={"name": "Alice", "email": "alice@test.com", "password": "secret123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login(client):
    client.post("/api/v1/auth/signup", json={"name": "Bob", "email": "bob@test.com", "password": "pass1234"})
    r = client.post("/api/v1/auth/login", json={"email": "bob@test.com", "password": "pass1234"})
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/api/v1/auth/signup", json={"name": "Carol", "email": "carol@test.com", "password": "correct"})
    r = client.post("/api/v1/auth/login", json={"email": "carol@test.com", "password": "wrong"})
    assert r.status_code == 401


def test_me(client):
    client.post("/api/v1/auth/signup", json={"name": "Dan", "email": "dan@test.com", "password": "pass5678"})
    login = client.post("/api/v1/auth/login", json={"email": "dan@test.com", "password": "pass5678"})
    token = login.json()["access_token"]
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "dan@test.com"


def test_duplicate_signup(client):
    client.post("/api/v1/auth/signup", json={"name": "Eve", "email": "eve@test.com", "password": "pw"})
    r = client.post("/api/v1/auth/signup", json={"name": "Eve2", "email": "eve@test.com", "password": "pw2"})
    assert r.status_code == 400


def test_unauthenticated_me(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
