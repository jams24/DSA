from solution import analyze, endpoint

SAMPLE = """10.0.0.1 - - [10/Oct/2026:13:55:36 +0000] "GET /api/users/42 HTTP/1.1" 200 512 0.120
10.0.0.2 - - [10/Oct/2026:13:55:37 +0000] "GET /api/users/7?fields=name HTTP/1.1" 200 128 0.080
10.0.0.1 - - [10/Oct/2026:13:55:38 +0000] "POST /api/orders HTTP/1.1" 201 64 0.300
garbage line
10.0.0.3 - - [10/Oct/2026:13:55:39 +0000] "GET /api/users/9 HTTP/1.1" 500 0 1.500
10.0.0.1 - - [10/Oct/2026:13:55:40 +0000] "GET /health HTTP/1.1" 200 2 0.001
10.0.0.2 - - [10/Oct/2026:13:55:41 +0000] "POST /api/orders HTTP/1.1" 503 0 2.000
10.0.0.1 - - [10/Oct/2026:13:55:42 +0000] "GET /api/users/42 HTTP/1.1" 200 512 0.100
10.0.0.4 - - [10/Oct/2026:13:55:43 +0000] "GET /api/orders/3f2a1b4c-1111-2222-3333-444455556666 HTTP/1.1" 404 0 0.010
"""

r = analyze(SAMPLE.splitlines(), k=2)
assert r["requests"] == 8 and r["malformed"] == 1, r
assert r["error_rate"] == 0.25
assert r["top_endpoints"] == [
    {"endpoint": "GET /api/users/:id", "count": 4, "p95_ms": 1500},
    {"endpoint": "POST /api/orders", "count": 2, "p95_ms": 2000},
], r["top_endpoints"]
assert r["top_ips"] == ["10.0.0.1", "10.0.0.2"]
assert analyze([])["requests"] == 0
assert endpoint("GET", "/a/12/b/3f2a1b4c-1111-2222-3333-444455556666") == "GET /a/:id/b/:id"
print("ok")
