from collections import Counter


class TransactionalKV:
    """In-memory key-value store with nested transactions.

    Each open transaction keeps an undo log: the value every key had *before* the transaction
    first touched it (None = absent). ROLLBACK replays that log; COMMIT discards all logs.
    A value-count index makes COUNT O(1).
    """

    def __init__(self):
        self.data: dict[str, str] = {}
        self.counts: Counter[str] = Counter()
        self.undo: list[dict[str, str | None]] = []

    def _write(self, key: str, value: str | None, log: bool = True) -> None:
        if log and self.undo and key not in self.undo[-1]:
            self.undo[-1][key] = self.data.get(key)
        old = self.data.get(key)
        if old is not None:
            self.counts[old] -= 1
        if value is None:
            self.data.pop(key, None)
        else:
            self.data[key] = value
            self.counts[value] += 1

    def set(self, key: str, value: str) -> None:
        self._write(key, value)

    def get(self, key: str) -> str | None:
        return self.data.get(key)

    def delete(self, key: str) -> bool:
        if key not in self.data:
            return False
        self._write(key, None)
        return True

    def count(self, value: str) -> int:
        return self.counts[value]

    def begin(self) -> None:
        self.undo.append({})

    def rollback(self) -> bool:
        if not self.undo:
            return False
        for key, value in self.undo.pop().items():
            # Don't log the undo itself: the parent transaction already holds (or never needed)
            # this key's earlier value, and logging here would record the child's value instead.
            self._write(key, value, log=False)
        return True

    def commit(self) -> bool:
        if not self.undo:
            return False
        self.undo.clear()  # changes are already applied; just forget how to undo them
        return True


def run(commands: list[str]) -> list[str]:
    """Drive the store with the classic text protocol: SET k v, GET k, DELETE k, COUNT v, BEGIN, ROLLBACK, COMMIT."""
    db, out = TransactionalKV(), []
    for line in commands:
        cmd, *args = line.split()
        match cmd.upper(), args:
            case "SET", [k, v]:
                db.set(k, v)
            case "GET", [k]:
                out.append(db.get(k) or "NULL")
            case "DELETE", [k]:
                db.delete(k)
            case "COUNT", [v]:
                out.append(str(db.count(v)))
            case "BEGIN", []:
                db.begin()
            case "ROLLBACK", []:
                if not db.rollback():
                    out.append("NO TRANSACTION")
            case "COMMIT", []:
                if not db.commit():
                    out.append("NO TRANSACTION")
            case _:
                out.append(f"ERR unknown command: {line}")
    return out
