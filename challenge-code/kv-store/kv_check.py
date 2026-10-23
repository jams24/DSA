from solution import TransactionalKV, run

assert run(["SET a 10", "GET a", "DELETE a", "GET a"]) == ["10", "NULL"]
assert run(["SET a 10", "SET b 10", "COUNT 10", "COUNT 20", "DELETE a", "COUNT 10", "SET b 30", "COUNT 10"]) == ["2", "0", "1", "0"]
assert run(["BEGIN", "SET a 10", "GET a", "BEGIN", "SET a 20", "GET a", "ROLLBACK", "GET a", "ROLLBACK", "GET a"]) == ["10", "20", "10", "NULL"]
assert run(["BEGIN", "SET a 30", "BEGIN", "SET a 40", "COMMIT", "GET a", "ROLLBACK"]) == ["40", "NO TRANSACTION"]
assert run(["SET a 50", "BEGIN", "GET a", "SET a 60", "BEGIN", "DELETE a", "GET a", "ROLLBACK", "GET a", "COMMIT", "GET a"]) == ["50", "NULL", "60", "60"]
assert run(["SET a 10", "BEGIN", "COUNT 10", "BEGIN", "DELETE a", "COUNT 10", "ROLLBACK", "COUNT 10"]) == ["1", "0", "1"]
# the nested-rollback trap: a key the parent never touched
assert run(["SET a 1", "BEGIN", "BEGIN", "SET a 2", "ROLLBACK", "ROLLBACK", "GET a", "COUNT 2"]) == ["1", "0"]
assert run(["ROLLBACK", "FLY"]) == ["NO TRANSACTION", "ERR unknown command: FLY"]
db = TransactionalKV()
assert db.delete("missing") is False
print("ok")
