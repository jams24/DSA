import asyncio
import hashlib
import json
import time
import uuid

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

KEY_TTL_S = 24 * 3600


class PaymentIn(BaseModel):
    amount: int = Field(gt=0, description="minor units, e.g. cents")
    currency: str = Field(pattern=r"^[A-Z]{3}$")


async def charge(amount: int, currency: str) -> str:
    """Stand-in for the card processor: the side effect that must happen at most once."""
    await asyncio.sleep(0.01)
    return f"ch_{uuid.uuid4().hex[:12]}"


app = FastAPI()
records: dict[str, dict] = {}  # in production: a table with a unique index on the key
lock = asyncio.Lock()


@app.post("/payments", status_code=201)
async def create_payment(payment: PaymentIn, idempotency_key: str = Header(max_length=255)):
    fingerprint = hashlib.sha256(payment.model_dump_json().encode()).hexdigest()
    now = time.time()
    async with lock:  # the check-and-claim must be atomic
        rec = records.get(idempotency_key)
        if rec and rec["expires"] > now:
            if rec["fingerprint"] != fingerprint:
                raise HTTPException(422, "Idempotency-Key was already used with a different request body")
            if rec["state"] == "in_progress":
                raise HTTPException(409, "a request with this key is still in progress")
            return JSONResponse(rec["body"], status_code=rec["status"], headers={"Idempotent-Replayed": "true"})
        records[idempotency_key] = {"fingerprint": fingerprint, "state": "in_progress", "expires": now + KEY_TTL_S}

    try:
        ref = await charge(payment.amount, payment.currency)
    except Exception:
        records.pop(idempotency_key, None)  # definitely not charged: let the client retry
        raise HTTPException(502, "payment processor unavailable")
    body = {"id": f"pay_{uuid.uuid4().hex}", **payment.model_dump(), "status": "succeeded", "processor_ref": ref}
    records[idempotency_key] = {"fingerprint": fingerprint, "state": "done", "status": 201, "body": body, "expires": now + KEY_TTL_S}
    return body
