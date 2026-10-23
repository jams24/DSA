import time

import jwt
from fastapi.testclient import TestClient

from solution import SECRET, app

c = TestClient(app)
assert c.post("/register", json={"email": "ada@example.com", "password": "short"}).status_code == 422
r = c.post("/register", json={"email": "Ada@example.com", "password": "correct horse"})
assert r.status_code == 201, r.text
uid = r.json()["id"]
assert c.post("/register", json={"email": "ada@example.com", "password": "another one"}).status_code == 409

bad = c.post("/login", json={"email": "ada@example.com", "password": "wrong password"})
unknown = c.post("/login", json={"email": "nobody@example.com", "password": "whatever1"})
assert bad.status_code == 401 and bad.json() == unknown.json()

token = c.post("/login", json={"email": "ada@example.com", "password": "correct horse"}).json()["access_token"]
auth = lambda t: {"Authorization": f"Bearer {t}"}
assert c.get("/me", headers=auth(token)).json() == {"id": uid, "email": "ada@example.com"}
assert c.get("/me").status_code == 401
assert c.get("/me", headers=auth(jwt.encode({"sub": uid}, "x" * 40, algorithm="HS256"))).status_code == 401
assert c.get("/me", headers=auth(jwt.encode({"sub": uid, "exp": int(time.time()) - 5}, SECRET, algorithm="HS256"))).status_code == 401
assert c.get("/me", headers=auth(jwt.encode({"sub": uid}, None, algorithm="none"))).status_code == 401
print("ok")
