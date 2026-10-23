import httpx

from solution import ApiError, fetch_all_items, get_json

hits = {}
failures = {1: "503", 2: "429", 3: "connect"}


def handler(request: httpx.Request) -> httpx.Response:
    page = int(request.url.params["page"])
    hits[page] = hits.get(page, 0) + 1
    if hits[page] == 1 and page in failures:
        kind = failures[page]
        if kind == "503":
            return httpx.Response(503)
        if kind == "429":
            return httpx.Response(429, headers={"Retry-After": "2"})
        raise httpx.ConnectError("connection refused", request=request)
    return httpx.Response(200, json={"items": [page * 10, page * 10 + 1], "next_page": page + 1 if page < 4 else None})


slept = []
client = httpx.Client(base_url="http://api.test", transport=httpx.MockTransport(handler))
assert fetch_all_items(client, sleep=slept.append) == [10, 11, 20, 21, 30, 31, 40, 41]
assert hits == {1: 2, 2: 2, 3: 2, 4: 1}, hits
assert slept[1] == 2.0 and all(0 <= s <= 0.4 for s in (slept[0], slept[2])), slept

calls = []
not_found = httpx.Client(base_url="http://api.test", transport=httpx.MockTransport(lambda r: calls.append(1) or httpx.Response(404, text="nope")))
try:
    get_json(not_found, "/x", sleep=slept.append)
    raise AssertionError("expected ApiError")
except ApiError:
    pass
assert len(calls) == 1, "4xx other than 408/429 must not be retried"

calls.clear()
down = httpx.Client(base_url="http://api.test", transport=httpx.MockTransport(lambda r: calls.append(1) or httpx.Response(500)))
try:
    get_json(down, "/x", sleep=lambda s: None)
    raise AssertionError("expected ApiError")
except ApiError:
    pass
assert len(calls) == 4
print("ok")
