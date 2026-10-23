from solution import batched, only_errors, parse_json, read_lines, take, top_services

chunks = ['{"level":"error","service":"api"}\n{"level":"info","ser', 'vice":"api"}\nnot json\n', '{"level":"error","service":"db"}\n\n{"level":"error","service":"api"}']
errors: list[str] = []
assert top_services(only_errors(parse_json(read_lines(chunks), errors)), 2) == [("api", 2), ("db", 1)]
assert errors == ["line 3: invalid JSON"]

assert list(batched(range(7), 3)) == [[0, 1, 2], [3, 4, 5], [6]]

pulled = []


def numbers():
    for i in range(10**9):  # effectively infinite
        pulled.append(i)
        yield i


assert take((x * x for x in numbers() if x % 2), 3) == [1, 9, 25]
assert len(pulled) == 6, "laziness: only as much input as needed was read"
print("ok")
