import time

from solution import Timer, suppress_and_log, transaction

log: list[str] = []
with Timer("sleep", log) as t:
    time.sleep(0.02)
assert t.elapsed >= 0.02 and log[0].startswith("sleep ok in")

try:
    with Timer("boom", log):
        raise ValueError("x")
except ValueError:
    pass
assert log[1].startswith("boom failed")

db = {"alice": 100, "bob": 50}
with transaction(db) as tx:
    tx["alice"] -= 30
    tx["bob"] += 30
assert db == {"alice": 70, "bob": 80}
try:
    with transaction(db) as tx:
        tx["alice"] -= 500
        raise RuntimeError("insufficient funds")
except RuntimeError:
    pass
assert db == {"alice": 70, "bob": 80}, "a failed block must not change the db"

with suppress_and_log(KeyError, log=log):
    {}["missing"]
assert log[-1] == "suppressed KeyError: 'missing'"
try:
    with suppress_and_log(KeyError, log=log):
        raise TypeError("not suppressed")
    raise AssertionError
except TypeError:
    pass
print("ok")
