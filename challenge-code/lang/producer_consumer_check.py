from solution import run_pipeline

out = run_pipeline([range(0, 300), range(300, 600)], consumers=3, work=lambda n: n * 2, capacity=4)
assert sorted(out) == [n * 2 for n in range(600)]
assert run_pipeline([], consumers=2, work=lambda n: n) == []
print("ok")
