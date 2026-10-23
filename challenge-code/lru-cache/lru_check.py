from solution import LRUCache

now = [0.0]
c = LRUCache(2, clock=lambda: now[0])
c.put("a", 1)
c.put("b", 2)
assert c.get("a") == 1  # a is now most recent
c.put("c", 3)  # evicts b
assert c.get("b") is None and c.get("a") == 1 and c.get("c") == 3
c.put("a", 10)  # update keeps size and refreshes recency
c.put("d", 4)  # evicts c
assert c.get("c") is None and c.get("a") == 10 and len(c) == 2

t = LRUCache(10, ttl=5, clock=lambda: now[0])
t.put("x", 1)
t.put("y", 2, ttl=100)
now[0] = 4.9
assert t.get("x") == 1
now[0] = 5.0
assert t.get("x") is None and t.get("y") == 2 and len(t) == 1
assert (t.hits, t.misses) == (2, 1)
try:
    LRUCache(0)
    raise AssertionError
except ValueError:
    pass
print("ok")
