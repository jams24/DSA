from fastapi.testclient import TestClient

from solution import app

c = TestClient(app)
r = c.post("/shorten", json={"url": "https://example.com/a"})
assert r.status_code == 201, r.text
code = r.json()["code"]
assert len(code) == 7 and r.json()["short_url"].endswith(code)

again = c.post("/shorten", json={"url": "https://example.com/a"})
assert again.status_code == 200 and again.json()["code"] == code

r = c.get(f"/{code}", follow_redirects=False)
assert r.status_code == 302 and r.headers["location"] == "https://example.com/a"
assert c.get(f"/stats/{code}").json()["hits"] == 1
assert c.get("/missing").status_code == 404

assert c.post("/shorten", json={"url": "ftp://example.com"}).status_code == 400
assert c.post("/shorten", json={"url": "https://example.com/b", "alias": "promo"}).status_code == 201
assert c.post("/shorten", json={"url": "https://example.com/c", "alias": "promo"}).status_code == 409
assert c.post("/shorten", json={"url": "https://example.com/c", "alias": "a!"}).status_code == 400

statuses = [c.post("/shorten", json={"url": f"https://example.com/{i}"}).status_code for i in range(12)]
assert 429 in statuses, statuses
assert c.post("/shorten", json={"url": "https://example.com/z"}).headers["retry-after"] == "60"
print("ok")
