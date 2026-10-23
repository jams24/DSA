from solution import SlidingWindowLimiter, TokenBucket

now = [0.0]
clock = lambda: now[0]

# The classic prompt: allow at most K=3 requests per T=10 seconds per client.
rl = SlidingWindowLimiter(3, 10, clock)
results = []
for t in [0, 1, 2, 3, 9.9, 10, 11, 12.5]:
    now[0] = t
    results.append(rl.allow("alice"))
assert results == [True, True, True, False, False, True, True, True], results
now[0] = 12.5
assert rl.allow("bob")  # clients are independent
assert rl.retry_after("alice") == 7.5  # window holds t=10, 11, 12.5; t=10 expires at 20

tb = TokenBucket(capacity=2, rate=0.5, clock=clock)  # burst of 2, then one every 2s
now[0] = 0
assert [tb.allow("a") for _ in range(3)] == [True, True, False]
now[0] = 1
assert not tb.allow("a")
now[0] = 2
assert tb.allow("a") and not tb.allow("a")
now[0] = 100
assert [tb.allow("a") for _ in range(3)] == [True, True, False]  # capped at capacity
print("ok")
