from solution import retry

slept = []
calls = {"n": 0}


@retry(times=4, on=(ConnectionError,), base_delay=0.1, sleep=slept.append)
def flaky(x):
    """docs"""
    calls["n"] += 1
    if calls["n"] < 3:
        raise ConnectionError("down")
    return x * 2


assert flaky(21) == 42 and calls["n"] == 3
assert len(slept) == 2 and slept[0] <= 0.1 and slept[1] <= 0.2
assert flaky.__name__ == "flaky" and flaky.__doc__ == "docs"


@retry(times=3, on=(ConnectionError,), sleep=lambda s: None)
def wrong_kind():
    calls["n"] += 1
    raise KeyError("not retried")


calls["n"] = 0
try:
    wrong_kind()
except KeyError:
    pass
assert calls["n"] == 1


@retry(times=3, sleep=lambda s: None)
def always():
    calls["n"] += 1
    raise RuntimeError("still down")


calls["n"] = 0
try:
    always()
    raise AssertionError
except RuntimeError as e:
    assert str(e) == "still down" and calls["n"] == 3
print("ok")
