import json

from fastapi.testclient import TestClient

import solution
from solution import app

c = TestClient(app)
calls = []
real_charge = solution.charge


async def counting_charge(amount, currency):
    calls.append(amount)
    return await real_charge(amount, currency)


solution.charge = counting_charge

assert c.post("/payments", json={"amount": 500, "currency": "USD"}).status_code == 422  # header missing
first = c.post("/payments", json={"amount": 500, "currency": "USD"}, headers={"Idempotency-Key": "k1"})
assert first.status_code == 201, first.text
retry = c.post("/payments", json={"amount": 500, "currency": "USD"}, headers={"Idempotency-Key": "k1"})
assert retry.status_code == 201 and retry.headers["idempotent-replayed"] == "true"
assert retry.json() == first.json()
assert len(calls) == 1
assert c.post("/payments", json={"amount": 999, "currency": "USD"}, headers={"Idempotency-Key": "k1"}).status_code == 422

solution.records["k2"] = {"fingerprint": solution.hashlib.sha256(json.dumps({"amount": 1, "currency": "EUR"}, separators=(",", ":")).encode()).hexdigest(), "state": "in_progress", "expires": 1e18}
assert c.post("/payments", json={"amount": 1, "currency": "EUR"}, headers={"Idempotency-Key": "k2"}).status_code == 409


async def failing(amount, currency):
    raise RuntimeError("down")


solution.charge = failing
assert c.post("/payments", json={"amount": 7, "currency": "EUR"}, headers={"Idempotency-Key": "k3"}).status_code == 502
solution.charge = counting_charge
assert c.post("/payments", json={"amount": 7, "currency": "EUR"}, headers={"Idempotency-Key": "k3"}).status_code == 201
print("ok")
