from solution import flatten, flatten_dict

assert list(flatten([1, [2, (3, [4])], "ab", 5])) == [1, 2, 3, 4, "ab", 5]
assert list(flatten([1, [2, [3]]], depth=1)) == [1, 2, [3]]
assert flatten_dict({"a": {"b": 1, "c": {"d": 2}}, "e": {}, "f": 3}) == {"a.b": 1, "a.c.d": 2, "e": {}, "f": 3}
print("ok")
