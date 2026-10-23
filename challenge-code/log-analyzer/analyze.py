import heapq
import math
import re
import sys
from collections import Counter, defaultdict
from typing import Iterable

# 203.0.113.9 - - [10/Oct/2026:13:55:36 +0000] "GET /api/users/42?x=1 HTTP/1.1" 200 512 0.123
LINE = re.compile(r'^(?P<ip>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] "(?P<method>[A-Z]+) (?P<path>\S+) [^"]*" (?P<status>\d{3}) (?P<bytes>\d+|-) (?P<secs>\d+(?:\.\d+)?)$')
ID_SEGMENT = re.compile(r"/(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27})(?=/|$)")


def endpoint(method: str, path: str) -> str:
    """GET /api/users/42?x=1 -> GET /api/users/:id, so per-user URLs group together."""
    return f"{method} {ID_SEGMENT.sub('/:id', path.split('?', 1)[0])}"


def percentile(sorted_values: list[float], p: float) -> float:
    """Nearest-rank percentile of an already sorted list."""
    return sorted_values[max(0, math.ceil(p / 100 * len(sorted_values)) - 1)]


def analyze(lines: Iterable[str], k: int = 3) -> dict:
    """One pass over the lines, so it works on a file far bigger than memory
    (only per-endpoint latencies are kept; swap in a t-digest if even those are too many)."""
    total = malformed = errors = 0
    hits: Counter[str] = Counter()
    by_ip: Counter[str] = Counter()
    latencies: dict[str, list[float]] = defaultdict(list)
    for line in lines:
        m = LINE.match(line.strip())
        if not m:
            malformed += 1
            continue
        total += 1
        ep = endpoint(m["method"], m["path"])
        hits[ep] += 1
        by_ip[m["ip"]] += 1
        latencies[ep].append(float(m["secs"]))
        errors += m["status"].startswith("5")
    top = heapq.nlargest(k, hits.items(), key=lambda kv: (kv[1], kv[0]))  # O(n log k)
    return {
        "requests": total,
        "malformed": malformed,
        "error_rate": round(errors / total, 4) if total else 0.0,
        "top_endpoints": [{"endpoint": ep, "count": n, "p95_ms": round(percentile(sorted(latencies[ep]), 95) * 1000)} for ep, n in top],
        "top_ips": [ip for ip, _ in by_ip.most_common(k)],
    }


if __name__ == "__main__" and len(sys.argv) > 1:
    with open(sys.argv[1], encoding="utf-8", errors="replace") as f:  # streams line by line
        print(analyze(f))
