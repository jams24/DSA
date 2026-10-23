from fastapi.testclient import TestClient

from solution import app

c = TestClient(app)
r = c.post("/books", json={"title": "Dune", "author": "Frank Herbert", "year": 1965, "tags": ["sci-fi"]})
assert r.status_code == 201 and r.headers["location"] == "/books/1", r.text
assert c.post("/books", json={"title": "", "author": "x", "year": 1}).status_code == 422
assert c.post("/books", json={"title": "x", "author": "y", "year": 3000}).status_code == 422
assert c.post("/books", json={"title": "x"}).status_code == 422

for i in range(2, 8):
    c.post("/books", json={"title": f"Book {i}", "author": "Ann" if i % 2 else "Bob", "year": 2000 + i})

seen, cursor = [], None
while True:
    params = {"limit": 3} | ({"cursor": cursor} if cursor else {})
    page = c.get("/books", params=params).json()
    seen += [b["id"] for b in page["data"]]
    cursor = page["next_cursor"]
    if not cursor:
        break
assert seen == [1, 2, 3, 4, 5, 6, 7], seen
assert [b["id"] for b in c.get("/books", params={"author": "ann"}).json()["data"]] == [3, 5, 7]
assert c.get("/books", params={"cursor": "%%%"}).status_code == 400
assert c.get("/books", params={"limit": 0}).status_code == 422

r = c.patch("/books/1", json={"year": 1966})
assert r.json()["year"] == 1966 and r.json()["title"] == "Dune"
assert c.patch("/books/1", json={"year": -5}).status_code == 422
assert c.delete("/books/1").status_code == 204
assert c.get("/books/1").status_code == 404
assert c.delete("/books/1").status_code == 404
print("ok")
