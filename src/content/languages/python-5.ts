import type { Lesson } from "../types";

// Python track, part 5: guided projects and interview prep.
// The project files were developed and verified as real packages (pytest on Python 3.12 and 3.14).

const logscopeTree = `logscope/
├── pyproject.toml              metadata, the logscope command, pytest / ruff / mypy settings
├── .github/workflows/ci.yml    format, lint, type-check and test on 3.12, 3.13 and 3.14
├── samples/
│   └── access.log              20 requests and one malformed line to try it on
├── src/logscope/
│   ├── __init__.py             the version
│   ├── __main__.py             python -m logscope
│   ├── parser.py               LogRecord, parse_line, parse_lines, ParseStats
│   ├── reader.py               read_lines: plain files, .gz and stdin, lazily
│   ├── stats.py                filter_records, summarize, percentile, top_values
│   ├── report.py               aligned text tables with bars, JSON
│   └── cli.py                  argparse sub-commands and exit codes
└── tests/
    ├── conftest.py             sample lines and temporary log files
    ├── test_parser.py
    ├── test_reader.py
    ├── test_stats.py
    └── test_cli.py`;

const shelfTree = `shelf/
├── pyproject.toml              dependencies, pytest / ruff / mypy settings
├── Dockerfile                  uv + python:3.14-slim, non-root user, health check
├── .github/workflows/ci.yml    lint, types, tests, PostgreSQL smoke test, image build
├── app/
│   ├── __init__.py
│   ├── config.py               Settings from environment variables
│   ├── db.py                   engine, sessions, Base, UTCDateTime
│   ├── models.py               User and Book tables
│   ├── schemas.py              pydantic request and response models
│   ├── security.py             scrypt password hashing, JWT access tokens
│   ├── errors.py               domain errors carrying HTTP status codes
│   ├── repository.py           every SQL query
│   ├── services.py             AuthService and ShelfService: the business rules
│   ├── api.py                  FastAPI routes, dependencies, error handler, create_app
│   └── main.py                 app = create_app(), for uvicorn
└── tests/
    ├── conftest.py             in-memory database, users, a fake clock
    ├── test_security.py
    ├── test_services.py
    └── test_api.py             end-to-end HTTP tests (run when FastAPI is installed)`;

export const pyProjects: Lesson[] = [
  // ------------------------------------------------------------------ PROJECT: CLI
  {
    id: "py-project-cli",
    stage: "Projects",
    title: "Project: logscope, a log-analytics CLI",
    tagline: "Build a standard-library command-line tool that streams gigabytes of access logs through a generator pipeline into text or JSON reports, with argparse sub-commands, gzip and stdin support, and 36 pytest tests.",
    difficulty: "intermediate",
    minutes: 90,
    diagram: {
      title: "logscope's lazy pipeline",
      nodes: [
        { id: "cli", label: "cli.main()", kind: "control", x: 400, y: 90, sub: "parses arguments, wires the pipeline" },
        { id: "files", label: "access.log / .gz / stdin", kind: "storage", x: 100, y: 280, sub: "any size" },
        { id: "reader", label: "read_lines", kind: "worker", x: 260, y: 280, sub: "one line at a time" },
        { id: "parser", label: "parse_lines", kind: "service", x: 420, y: 280, sub: "regex → LogRecord" },
        { id: "bad", label: "ParseStats", kind: "monitor", x: 420, y: 470, sub: "malformed lines counted" },
        { id: "filter", label: "filter_records", kind: "service", x: 580, y: 280, sub: "--since --until --status" },
        { id: "stats", label: "summarize", kind: "service", x: 740, y: 280, sub: "Counters, percentiles" },
        { id: "report", label: "render_text / json", kind: "service", x: 740, y: 470, sub: "tables with bars" },
        { id: "term", label: "Terminal", kind: "client", x: 900, y: 470, sub: "stdout + exit code" },
      ],
      edges: [
        { from: "cli", to: "reader", label: "build generators", dashed: true },
        { from: "files", to: "reader", label: "bytes → text" },
        { from: "reader", to: "parser", label: "str" },
        { from: "parser", to: "bad", label: "bad line" },
        { from: "parser", to: "filter", label: "LogRecord" },
        { from: "filter", to: "stats", label: "LogRecord" },
        { from: "stats", to: "report", label: "Summary" },
        { from: "report", to: "term", label: "print" },
      ],
      flows: [
        {
          name: "logscope summary access.log",
          path: ["cli", "reader", "parser", "filter", "stats", "report", "term"],
          steps: [
            "main() parses the arguments and chains the generators: read_lines → parse_lines → filter_records. Nothing is read yet. When summarize() starts iterating, read_lines opens the first file.",
            "Each line is handed on as soon as it's read, so only one line is in memory at a time, whatever the file size.",
            "The regex splits the line into fields, strptime builds a timezone-aware datetime, and a frozen LogRecord comes out.",
            "Records outside --since/--until, or not matching --status, are dropped here; the rest flow on.",
            "summarize() updates its Counters and the latency list in one pass. When the input ends, it computes percentiles, top paths, top clients and the busiest minute.",
            "render_text formats aligned tables with bars (render_json for --json). main() prints the result and returns exit code 0.",
          ],
        },
        {
          name: "A malformed line",
          path: ["files", "reader", "parser", "bad"],
          steps: [
            "A line in an unexpected format (or with invalid UTF-8, which is replaced rather than crashing) is read like any other.",
            "read_lines passes it on unchanged.",
            "The regex doesn't match, parse_line raises ParseError, and parse_lines catches it: it counts the line, keeps it as an example, and continues with the next one. The report then says how many lines were skipped.",
          ],
        },
      ],
    },
    concept: `
## What you'll build
**logscope** is a command-line tool that turns web-server access logs into a traffic report: request counts, status codes, error rate, latency percentiles, the busiest minute, top paths and top clients, as aligned text or JSON. It reads plain and gzip-compressed files or standard input, filters by time window and status, and survives malformed lines and bad bytes.

It uses **only the standard library**, so it runs anywhere Python 3.12+ is installed, and it's covered by 36 pytest tests.

## Design decisions
- **A lazy pipeline.** \`read_lines → parse_lines → filter_records → summarize\` are generators chained together, so only one line is in memory at a time. A 20 GB log uses as much memory as a 20 KB one (apart from the latency list and counters).
- **A \`src/\` layout.** The package lives in \`src/logscope/\`, so tests run against the package as installed rather than whatever happens to be in the current directory. \`pyproject.toml\` declares the \`logscope\` command.
- **Frozen, slotted dataclasses** for records: immutable, compact, comparable in tests, with computed properties (\`endpoint\`, \`status_class\`).
- **Errors are data, not crashes.** Malformed lines are counted and reported, invalid UTF-8 is replaced, and a missing file is a clean one-line error with exit code 1.
- **\`main(argv, stdout, stderr, stdin) -> int\`.** Passing the streams in makes the CLI testable without subprocesses; \`__main__.py\` and the console script just call it.
- **Exit codes**: 0 for success, 1 for errors, 2 for usage errors (argparse's convention). Scripts and CI can act on them.
- **Timezone-aware datetimes everywhere**, since logs carry offsets and comparing naive with aware datetimes raises \`TypeError\`.

The diagram above follows a line through the pipeline. Work through the steps on the **Build** tab: each one adds a module and its tests. You need Python 3.12+ and [uv](https://docs.astral.sh/uv/) (or \`pip install pytest\` in a virtual environment).
`,
    keyPoints: [
      "Generators chained into a pipeline process any file size in constant memory",
      "src layout + pyproject.toml + [project.scripts] give an installable command",
      "Frozen, slotted dataclasses for records; aware datetimes for timestamps",
      "Count and report bad input instead of crashing",
      "main(argv, stdout, stderr, stdin) -> int makes the CLI testable in-process",
      "Exit codes 0 / 1 / 2 make the tool scriptable",
    ],
    project: {
      summary: `**logscope**: a log-analytics command-line tool using only the standard library. It reads access logs in the Common or Combined Log Format (optionally with request times), from files, **gzip** archives or **standard input**, through a **lazy generator pipeline**. It reports traffic, status classes, error rate, **latency percentiles**, the busiest minute, top paths and top clients as aligned text or **JSON**, filters by time window and status, and turns malformed lines, bad bytes and missing files into clear messages and **exit codes**. **36 pytest tests** cover every module.`,
      skills: ["src layout & pyproject.toml", "regular expressions", "dataclasses (frozen, slots)", "aware datetimes", "generators & pipelines", "gzip & text I/O", "collections.Counter", "percentiles", "argparse sub-commands", "exit codes", "pytest fixtures & parametrize", "tmp_path & capsys", "GitHub Actions"],
      tree: logscopeTree,
      steps: [
        {
          title: "Create the project: pyproject.toml, the src layout and sample data",
          explain: `Start with the packaging, so the code is importable and testable from the first step.

- **\`[project]\`** declares the name, version and minimum Python. There are no runtime dependencies: everything comes from the standard library.
- **\`[project.scripts]\`** creates a \`logscope\` command that calls \`logscope.cli:main\` once the package is installed (\`uv sync\` installs it in editable mode).
- **\`[dependency-groups]\`** lists development tools; **\`[build-system]\`** names the build backend (hatchling).
- **\`[tool.pytest.ini_options]\`** adds \`src\` to the import path, so the tests work even without installing.
- The **src layout** (\`src/logscope/\`) stops Python from importing the package straight out of the working directory, so the tests exercise the package the way users will get it.

\`samples/access.log\` holds 20 realistic requests (a browser, \`curl\`, an API client, a vulnerability scanner, a Kubernetes probe) plus one malformed line. Each line ends with the request duration in seconds, as nginx's \`$request_time\` adds.`,
          files: [
            { path: "pyproject.toml", lang: "toml", code: `[project]
name = "logscope"
version = "0.1.0"
description = "Summarize web server access logs from the command line"
requires-python = ">=3.12"
dependencies = []  # standard library only

[project.scripts]
logscope = "logscope.cli:main"

[dependency-groups]
dev = ["pytest>=8", "ruff>=0.8", "mypy>=1.13"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]

[tool.ruff]
line-length = 110

[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "I", "B", "UP", "SIM"]  # ruff format handles line length

[tool.mypy]
strict = true
files = ["src"]` },
            { path: "src/logscope/__init__.py", lang: "python", code: `"""logscope: summarize web server access logs."""

__version__ = "0.1.0"` },
            { path: "samples/access.log", lang: "text", code: `203.0.113.7 - - [04/Nov/2026:09:15:02 +0000] "GET / HTTP/1.1" 200 5120 "-" "Mozilla/5.0" 0.004
203.0.113.7 - - [04/Nov/2026:09:15:03 +0000] "GET /static/app.css HTTP/1.1" 200 18210 "https://shop.example/" "Mozilla/5.0" 0.001
198.51.100.23 - - [04/Nov/2026:09:15:40 +0000] "GET /api/books?page=1 HTTP/1.1" 200 2048 "-" "curl/8.5.0" 0.031
198.51.100.23 - - [04/Nov/2026:09:15:41 +0000] "GET /api/books?page=2 HTTP/1.1" 200 1980 "-" "curl/8.5.0" 0.028
192.0.2.44 - - [04/Nov/2026:09:16:05 +0000] "POST /api/login HTTP/1.1" 401 64 "-" "python-httpx/0.28.1" 0.090
192.0.2.44 - - [04/Nov/2026:09:16:06 +0000] "POST /api/login HTTP/1.1" 200 312 "-" "python-httpx/0.28.1" 0.095
192.0.2.44 - - [04/Nov/2026:09:16:07 +0000] "GET /api/books/42 HTTP/1.1" 200 812 "-" "python-httpx/0.28.1" 0.012
203.0.113.7 - - [04/Nov/2026:09:17:00 +0000] "GET /api/books HTTP/1.1" 200 2048 "https://shop.example/" "Mozilla/5.0" 0.027
203.0.113.7 - - [04/Nov/2026:09:17:01 +0000] "GET /api/books/7 HTTP/1.1" 200 790 "https://shop.example/" "Mozilla/5.0" 0.010
203.0.113.7 - - [04/Nov/2026:09:17:02 +0000] "POST /api/cart HTTP/1.1" 201 128 "https://shop.example/" "Mozilla/5.0" 0.140
203.0.113.7 - - [04/Nov/2026:09:17:05 +0000] "POST /api/checkout HTTP/1.1" 502 0 "https://shop.example/" "Mozilla/5.0" 1.204
203.0.113.7 - - [04/Nov/2026:09:17:09 +0000] "POST /api/checkout HTTP/1.1" 200 256 "https://shop.example/" "Mozilla/5.0" 0.842
198.51.100.23 - - [04/Nov/2026:09:17:30 +0000] "GET /api/books?page=3 HTTP/1.1" 200 1720 "-" "curl/8.5.0" 0.025
198.51.100.99 - - [04/Nov/2026:09:17:31 +0000] "GET /wp-login.php HTTP/1.1" 404 153 "-" "Mozilla/5.0 (scanner)" 0.002
198.51.100.99 - - [04/Nov/2026:09:17:31 +0000] "GET /.env HTTP/1.1" 404 153 "-" "Mozilla/5.0 (scanner)" 0.002
this line is not in the combined log format
192.0.2.44 - - [04/Nov/2026:09:18:12 +0000] "GET /api/books/42 HTTP/1.1" 304 0 "-" "python-httpx/0.28.1" 0.003
192.0.2.44 - - [04/Nov/2026:09:19:45 +0000] "DELETE /api/books/42 HTTP/1.1" 204 0 "-" "python-httpx/0.28.1" 0.018
203.0.113.7 - - [04/Nov/2026:09:20:10 +0000] "GET /api/orders HTTP/1.1" 500 87 "https://shop.example/" "Mozilla/5.0" 0.377
203.0.113.7 - - [04/Nov/2026:09:20:11 +0000] "GET /api/orders HTTP/1.1" 200 4410 "https://shop.example/" "Mozilla/5.0" 0.051
10.0.0.5 - - [04/Nov/2026:09:21:40 +0000] "GET /healthz HTTP/1.1" 200 2 "-" "kube-probe/1.31" 0.001` },
          ],
          run: `uv sync
uv run python -c "import logscope; print(logscope.__version__)"`,
          output: `0.1.0`,
        },
        {
          title: "Parse one line into a LogRecord",
          explain: `\`parser.py\` turns text into data.

- **One regex with named groups** handles both formats: the Combined format's referrer and user agent, and the trailing duration, are optional groups (\`(?: ...)?\`). The pattern is compiled once, at import time.
- \`strptime\` with \`%z\` returns a **timezone-aware** datetime. An impossible date like 31 February raises \`ValueError\`, which becomes a \`ParseError\` (a \`ValueError\` subclass, so callers can catch either).
- **\`LogRecord\`** is \`frozen\` (immutable and hashable) and uses \`slots\` (compact: there may be millions of them). \`endpoint\` drops the query string so \`/api/books?page=2\` counts as \`/api/books\`; \`status_class\` maps 404 to \`"4xx"\`.
- **\`parse_lines\`** is a generator: it strips line endings, skips blank lines, and counts bad lines in a \`ParseStats\` object instead of crashing. Because the generator can't easily return extra data, the stats object is passed in and filled as it goes.

The tests in \`conftest.py\` provide shared sample lines, and \`test_parser.py\` checks the full record, the shorter Common format, four kinds of malformed input with \`parametrize\`, bad-line counting, and laziness: \`parse_lines\` over an **infinite** generator still returns its first record immediately.`,
          files: [
            { path: "src/logscope/parser.py", lang: "python", code: `"""Parse access-log lines in the Common / Combined Log Format into LogRecord objects."""

from __future__ import annotations

import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime

# 203.0.113.7 - - [04/Nov/2026:09:15:02 +0000] "GET / HTTP/1.1" 200 5120 "-" "Mozilla/5.0" 0.004
#  ip            time                           request           status size referrer agent  seconds
LINE_RE = re.compile(
    r"(?P<ip>\\S+) \\S+ \\S+ \\[(?P<time>[^\\]]+)\\] "
    r'"(?P<method>[A-Z]+) (?P<path>\\S+) [^"]*" '
    r"(?P<status>\\d{3}) (?P<size>\\d+|-)"
    r'(?: "(?P<referrer>[^"]*)" "(?P<agent>[^"]*)")?'  # combined format only
    r"(?: (?P<duration>\\d+(?:\\.\\d+)?))?"  # optional request time in seconds (nginx $request_time)
    r"\\s*$"
)
TIME_FORMAT = "%d/%b/%Y:%H:%M:%S %z"


class ParseError(ValueError):
    """A line that isn't in a supported log format."""


@dataclass(frozen=True, slots=True)
class LogRecord:
    ip: str
    time: datetime  # timezone-aware
    method: str
    path: str
    status: int
    size: int
    referrer: str | None = None
    agent: str | None = None
    duration: float | None = None  # seconds

    @property
    def endpoint(self) -> str:
        """The path without its query string: /api/books?page=2 -> /api/books."""
        return self.path.split("?", 1)[0]

    @property
    def status_class(self) -> str:
        return f"{self.status // 100}xx"


def parse_line(line: str) -> LogRecord:
    match = LINE_RE.match(line)
    if match is None:
        raise ParseError(f"unrecognized line: {line[:80]!r}")
    g = match.groupdict()
    try:
        time = datetime.strptime(g["time"], TIME_FORMAT)
    except ValueError as e:
        raise ParseError(f"bad timestamp {g['time']!r}") from e
    return LogRecord(
        ip=g["ip"],
        time=time,
        method=g["method"],
        path=g["path"],
        status=int(g["status"]),
        size=0 if g["size"] == "-" else int(g["size"]),
        referrer=None if g["referrer"] in (None, "-") else g["referrer"],
        agent=g["agent"] or None,
        duration=float(g["duration"]) if g["duration"] else None,
    )


@dataclass
class ParseStats:
    """Counts what parse_lines saw, so callers can report skipped lines."""

    lines: int = 0
    bad: int = 0
    examples: list[str] = field(default_factory=list)

    def record_bad(self, line: str) -> None:
        self.bad += 1
        if len(self.examples) < 3:
            self.examples.append(line[:120])


def parse_lines(lines: Iterable[str], stats: ParseStats | None = None) -> Iterator[LogRecord]:
    """Lazily parse lines, skipping blank and malformed ones (counted in stats)."""
    stats = stats if stats is not None else ParseStats()
    for raw in lines:
        line = raw.rstrip("\\r\\n")
        if not line.strip():
            continue
        stats.lines += 1
        try:
            yield parse_line(line)
        except ParseError:
            stats.record_bad(line)` },
            { path: "tests/conftest.py", lang: "python", code: `import gzip
from pathlib import Path

import pytest

LINES = [
    '203.0.113.7 - - [04/Nov/2026:09:15:02 +0000] "GET /api/books?page=1 HTTP/1.1" 200 2048 "-" "curl/8.5.0" 0.030',
    '203.0.113.7 - - [04/Nov/2026:09:15:30 +0000] "GET /api/books/1 HTTP/1.1" 404 120 "-" "curl/8.5.0" 0.010',
    '198.51.100.2 - - [04/Nov/2026:09:16:01 +0000] "POST /api/orders HTTP/1.1" 500 0 "https://shop.example/" "Mozilla/5.0" 1.500',
    "garbage that is not a log line",
    '198.51.100.2 - - [04/Nov/2026:09:16:20 +0000] "GET /api/books HTTP/1.1" 200 1024 "-" "Mozilla/5.0" 0.020',
    "",
    '192.0.2.9 - - [04/Nov/2026:10:00:00 +0000] "GET /healthz HTTP/1.1" 200 2',
]


@pytest.fixture
def lines() -> list[str]:
    return list(LINES)


@pytest.fixture
def log_file(tmp_path: Path) -> Path:
    path = tmp_path / "access.log"
    path.write_text("\\n".join(LINES) + "\\n", encoding="utf-8")
    return path


@pytest.fixture
def gz_file(tmp_path: Path) -> Path:
    path = tmp_path / "access.log.gz"
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write("\\n".join(LINES) + "\\n")
    return path` },
            { path: "tests/test_parser.py", lang: "python", code: `from datetime import UTC, datetime

import pytest

from logscope.parser import LogRecord, ParseError, ParseStats, parse_line, parse_lines

COMBINED = '203.0.113.7 - frank [04/Nov/2026:09:15:02 +0100] "GET /api/books?page=2 HTTP/1.1" 200 2048 "https://shop.example/" "Mozilla/5.0 (X11)" 0.031'


def test_parses_combined_format_with_duration() -> None:
    r = parse_line(COMBINED)
    assert r == LogRecord(
        ip="203.0.113.7",
        time=datetime(2026, 11, 4, 8, 15, 2, tzinfo=UTC),  # equal instants compare equal across zones
        method="GET",
        path="/api/books?page=2",
        status=200,
        size=2048,
        referrer="https://shop.example/",
        agent="Mozilla/5.0 (X11)",
        duration=0.031,
    )
    assert r.endpoint == "/api/books"
    assert r.status_class == "2xx"
    assert r.time.utcoffset() is not None  # always timezone-aware


def test_parses_common_format_without_extras() -> None:
    r = parse_line('10.0.0.1 - - [04/Nov/2026:10:00:00 +0000] "HEAD /healthz HTTP/1.0" 304 -')
    assert (r.method, r.status, r.size) == ("HEAD", 304, 0)
    assert r.referrer is None and r.agent is None and r.duration is None


@pytest.mark.parametrize(
    "line",
    [
        "",
        "not a log line",
        '1.2.3.4 - - [04/Nov/2026:09:15:02 +0000] "GET / HTTP/1.1" OK 12',  # status isn't a number
        '1.2.3.4 - - [31/Feb/2026:09:15:02 +0000] "GET / HTTP/1.1" 200 12',  # impossible date
    ],
)
def test_rejects_malformed_lines(line: str) -> None:
    with pytest.raises(ParseError):
        parse_line(line)


def test_parse_lines_skips_and_counts_bad_lines(lines: list[str]) -> None:
    stats = ParseStats()
    records = list(parse_lines(lines, stats))
    assert len(records) == 5
    assert (stats.lines, stats.bad) == (6, 1)  # the blank line isn't counted
    assert stats.examples == ["garbage that is not a log line"]


def test_parse_lines_is_lazy() -> None:
    def endless():
        while True:
            yield '1.2.3.4 - - [04/Nov/2026:09:15:02 +0000] "GET / HTTP/1.1" 200 12'

    stream = parse_lines(endless())
    assert next(stream).status == 200  # returns immediately: nothing is read ahead` },
          ],
          run: `uv run pytest tests/test_parser.py -q`,
          output: `........                                                         [100%]
8 passed`,
        },
        {
          title: "Read files lazily: plain text, gzip and standard input",
          explain: `\`reader.py\` hides where lines come from.

- **\`open_log\`** picks \`gzip.open(path, "rt")\` for \`.gz\` files (rotated logs are usually compressed) and a normal \`open\` otherwise. Both use **\`encoding="utf-8", errors="replace"\`**: a stray Latin-1 byte becomes \`�\` instead of aborting a 5 GB run.
- **\`read_lines\`** is a generator that walks through the sources in order. \`with\` closes each file as soon as it's exhausted, and \`yield from f\` streams its lines.
- \`"-"\` means standard input, so logscope works in pipelines: \`zcat old.log.gz | logscope summary -\`. The \`stdin\` parameter lets tests pass a \`StringIO\` instead.
- A missing file raises \`FileNotFoundError\` **only when iteration reaches it**, not when \`read_lines\` is called. The last test pins down that lazy behaviour, which the CLI relies on.

The \`log_file\` and \`gz_file\` fixtures write temporary files under pytest's \`tmp_path\`.`,
          files: [
            { path: "src/logscope/reader.py", lang: "python", code: `"""Read lines from log files (plain or gzip-compressed) and standard input, lazily."""

from __future__ import annotations

import gzip
import sys
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import TextIO


def open_log(path: Path) -> TextIO:
    """Open a log file as text. errors="replace" keeps one bad byte from aborting the run."""
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return path.open(encoding="utf-8", errors="replace")


def read_lines(sources: Iterable[str], stdin: TextIO | None = None) -> Iterator[str]:
    """Yield every line of every source in order; "-" means standard input.

    Only one line is in memory at a time, so multi-gigabyte logs are fine.
    """
    for source in sources:
        if source == "-":
            yield from stdin if stdin is not None else sys.stdin
            continue
        with open_log(Path(source)) as f:
            yield from f` },
            { path: "tests/test_reader.py", lang: "python", code: `import io
from pathlib import Path

import pytest

from logscope.reader import read_lines


def test_reads_plain_and_gzip_files_in_order(log_file: Path, gz_file: Path) -> None:
    lines = list(read_lines([str(log_file), str(gz_file)]))
    assert len(lines) == 14
    assert lines[0] == lines[7]  # same content, read from both files


def test_dash_reads_standard_input() -> None:
    fake_stdin = io.StringIO("first\\nsecond\\n")
    assert list(read_lines(["-"], stdin=fake_stdin)) == ["first\\n", "second\\n"]


def test_invalid_utf8_is_replaced_not_fatal(tmp_path: Path) -> None:
    path = tmp_path / "bad.log"
    path.write_bytes(b"caf\\xe9\\n")  # Latin-1 byte, invalid in UTF-8
    assert list(read_lines([str(path)])) == ["caf�\\n"]


def test_missing_file_raises_when_iterated(tmp_path: Path) -> None:
    lines = read_lines([str(tmp_path / "nope.log")])  # nothing happens yet: it's a generator
    with pytest.raises(FileNotFoundError):
        next(lines)` },
          ],
          run: `uv run pytest tests/test_reader.py -q`,
          output: `....                                                             [100%]
4 passed`,
        },
        {
          title: "Statistics in a single pass",
          explain: `\`stats.py\` computes everything while the records stream past.

- **\`filter_records\`** is another generator stage. \`--status\` accepts exact codes and classes (\`404\`, \`5xx\`); \`until\` is exclusive, so consecutive windows don't overlap.
- **\`summarize\`** makes one pass, updating several \`Counter\`s (status classes, paths, IPs, minutes), the byte total and the time range. It works on a generator, which can only be consumed once.
- **Latency percentiles** use the **nearest-rank** method on the sorted durations: p95 is the smallest value that at least 95% of requests are at or below. Lines without a duration are left out rather than counted as zero.
- \`most_common(n)\` breaks ties by first appearance, which keeps the output (and the tests) deterministic.
- \`error_rate\` is a property computed from the counts, so it can never disagree with them.
- **\`FIELDS\`** maps each \`top --by\` choice to a function that extracts it; adding a field is one line.

Keeping every duration in a list is the one thing that grows with the input (8 bytes per request). For truly huge logs you'd switch to a streaming quantile sketch like t-digest.`,
          files: [
            { path: "src/logscope/stats.py", lang: "python", code: `"""Filter records and compute statistics in a single pass."""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime

from logscope.parser import LogRecord

# The fields \`logscope top --by ...\` can count.
FIELDS: dict[str, Callable[[LogRecord], str]] = {
    "path": lambda r: r.endpoint,
    "ip": lambda r: r.ip,
    "status": lambda r: str(r.status),
    "method": lambda r: r.method,
    "agent": lambda r: r.agent or "-",
}


def matches_status(status: int, wanted: Iterable[str]) -> bool:
    """wanted holds exact codes ("404") and classes ("5xx")."""
    code, klass = str(status), f"{status // 100}xx"
    return any(w.lower() in (code, klass) for w in wanted)


def filter_records(
    records: Iterable[LogRecord],
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    statuses: list[str] | None = None,
) -> Iterator[LogRecord]:
    for r in records:
        if since is not None and r.time < since:
            continue
        if until is not None and r.time >= until:
            continue
        if statuses and not matches_status(r.status, statuses):
            continue
        yield r


def percentile(sorted_values: list[float], p: float) -> float:
    """Nearest-rank percentile of an already sorted list (p in 0..100)."""
    if not sorted_values:
        raise ValueError("percentile of empty data")
    rank = max(1, math.ceil(p / 100 * len(sorted_values)))
    return sorted_values[rank - 1]


@dataclass
class Summary:
    requests: int = 0
    bytes_sent: int = 0
    first: datetime | None = None
    last: datetime | None = None
    status_classes: dict[str, int] = field(default_factory=dict)
    top_paths: list[tuple[str, int]] = field(default_factory=list)
    top_ips: list[tuple[str, int]] = field(default_factory=list)
    latency_ms: dict[str, float] = field(default_factory=dict)  # p50, p95, p99, max
    busiest_minute: tuple[str, int] | None = None

    @property
    def error_rate(self) -> float:
        """Share of requests that failed on the server side (5xx)."""
        return self.status_classes.get("5xx", 0) / self.requests if self.requests else 0.0


def summarize(records: Iterable[LogRecord], top: int = 5) -> Summary:
    s = Summary()
    classes: Counter[str] = Counter()
    paths: Counter[str] = Counter()
    ips: Counter[str] = Counter()
    minutes: Counter[str] = Counter()
    durations: list[float] = []
    for r in records:  # one pass: works on a generator
        s.requests += 1
        s.bytes_sent += r.size
        s.first = r.time if s.first is None else min(s.first, r.time)
        s.last = r.time if s.last is None else max(s.last, r.time)
        classes[r.status_class] += 1
        paths[r.endpoint] += 1
        ips[r.ip] += 1
        minutes[r.time.strftime("%Y-%m-%d %H:%M")] += 1
        if r.duration is not None:
            durations.append(r.duration * 1000)
    s.status_classes = dict(sorted(classes.items()))
    s.top_paths = paths.most_common(top)
    s.top_ips = ips.most_common(top)
    if minutes:
        s.busiest_minute = minutes.most_common(1)[0]
    if durations:
        durations.sort()
        s.latency_ms = {
            "p50": percentile(durations, 50),
            "p95": percentile(durations, 95),
            "p99": percentile(durations, 99),
            "max": durations[-1],
        }
    return s


def top_values(records: Iterable[LogRecord], by: str, n: int = 10) -> list[tuple[str, int]]:
    """The n most frequent values of one field; ties keep first-seen order."""
    key = FIELDS[by]
    return Counter(key(r) for r in records).most_common(n)` },
            { path: "tests/test_stats.py", lang: "python", code: `from datetime import UTC, datetime

import pytest

from logscope.parser import parse_lines
from logscope.stats import filter_records, matches_status, percentile, summarize, top_values


@pytest.fixture
def records(lines: list[str]):
    return list(parse_lines(lines))


def test_summary_counts(records) -> None:
    s = summarize(records, top=2)
    assert s.requests == 5
    assert s.bytes_sent == 2048 + 120 + 0 + 1024 + 2
    assert s.status_classes == {"2xx": 3, "4xx": 1, "5xx": 1}
    assert s.error_rate == pytest.approx(0.2)
    assert s.top_paths == [("/api/books", 2), ("/api/books/1", 1)]  # query strings ignored
    assert s.top_ips == [("203.0.113.7", 2), ("198.51.100.2", 2)]  # ties: first seen first
    assert s.first == datetime(2026, 11, 4, 9, 15, 2, tzinfo=UTC)
    assert s.last == datetime(2026, 11, 4, 10, 0, tzinfo=UTC)
    assert s.busiest_minute == ("2026-11-04 09:15", 2)


def test_latency_percentiles_use_only_lines_with_durations(records) -> None:
    # durations in ms: 30, 10, 1500, 20 (the healthz line has none) -> sorted 10, 20, 30, 1500
    s = summarize(records)
    assert s.latency_ms == pytest.approx({"p50": 20.0, "p95": 1500.0, "p99": 1500.0, "max": 1500.0})


def test_empty_input() -> None:
    s = summarize([])
    assert s.requests == 0 and s.error_rate == 0.0 and s.latency_ms == {} and s.busiest_minute is None


@pytest.mark.parametrize(
    ("p", "expected"),
    [(0, 10), (25, 10), (50, 20), (75, 30), (100, 40)],
)
def test_nearest_rank_percentile(p: float, expected: float) -> None:
    assert percentile([10, 20, 30, 40], p) == expected


def test_percentile_of_nothing_is_an_error() -> None:
    with pytest.raises(ValueError):
        percentile([], 50)


@pytest.mark.parametrize(
    ("status", "wanted", "expected"),
    [(404, ["404"], True), (404, ["4xx"], True), (404, ["5XX"], False), (503, ["404", "5xx"], True)],
)
def test_matches_status(status: int, wanted: list[str], expected: bool) -> None:
    assert matches_status(status, wanted) is expected


def test_filters_by_time_window_and_status(records) -> None:
    since = datetime(2026, 11, 4, 9, 15, 30, tzinfo=UTC)
    until = datetime(2026, 11, 4, 10, 0, tzinfo=UTC)  # exclusive
    kept = list(filter_records(records, since=since, until=until))
    assert [r.status for r in kept] == [404, 500, 200]
    assert [r.status for r in filter_records(records, statuses=["4xx", "5xx"])] == [404, 500]


def test_top_values_by_field(records) -> None:
    assert top_values(records, "status") == [("200", 3), ("404", 1), ("500", 1)]
    assert top_values(records, "agent", n=1) == [("curl/8.5.0", 2)]` },
          ],
          run: `uv run pytest tests/test_stats.py -q`,
          output: `...............                                                  [100%]
15 passed`,
        },
        {
          title: "Reports for humans and for machines",
          explain: `\`report.py\` turns a \`Summary\` into output, and nothing else: no I/O, so it's trivially testable.

- **\`table\`** aligns labels and counts with format specs (\`{label:<{width}}\`, \`{count:>{width}}\`) and draws a bar proportional to the largest count. **\`human_bytes\`** prints sizes as \`37.4 KB\`.
- **\`render_text\`** builds the report line by line; percentages use the \`%\` format (\`{rate:.1%}\` prints \`10.0%\`).
- **\`render_json\`** starts from \`dataclasses.asdict\`, reshapes the tuples into objects that are friendlier to consume (\`{"path": ..., "count": ...}\`), and uses \`default=str\` so datetimes serialize as text.

Separating computing (\`stats.py\`) from presenting (\`report.py\`) means a future HTML or Prometheus output is one more function, without touching the statistics.`,
          files: [{ path: "src/logscope/report.py", lang: "python", code: `"""Turn statistics into text for humans or JSON for machines."""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any

from logscope.parser import ParseStats
from logscope.stats import Summary


def human_bytes(n: int) -> str:
    size = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    raise AssertionError("unreachable")


def bar(count: int, biggest: int, width: int = 20) -> str:
    return "█" * max(1, round(count / biggest * width)) if biggest else ""


def table(rows: list[tuple[str, int]], indent: str = "  ") -> list[str]:
    if not rows:
        return [f"{indent}(none)"]
    label_width = max(len(label) for label, _ in rows)
    count_width = max(len(str(count)) for _, count in rows)
    biggest = rows[0][1]
    return [
        f"{indent}{label:<{label_width}}  {count:>{count_width}}  {bar(count, biggest)}"
        for label, count in rows
    ]


def render_text(summary: Summary, parse: ParseStats) -> str:
    lines = ["logscope report"]
    plural = "s" if parse.bad != 1 else ""
    skipped = f"  ({parse.bad} malformed line{plural} skipped)" if parse.bad else ""
    lines.append(f"  requests    {summary.requests}{skipped}")
    if summary.requests == 0:
        return "\\n".join(lines)
    assert summary.first is not None and summary.last is not None  # for the type checker
    first, last = summary.first, summary.last
    lines.append(f"  period      {first:%Y-%m-%d %H:%M:%S} -> {last:%H:%M:%S} {first:%z}")
    lines.append(f"  data sent   {human_bytes(summary.bytes_sent)}")
    lines.append("  status      " + " · ".join(f"{k} {v}" for k, v in summary.status_classes.items()))
    lines.append(f"  errors      {summary.error_rate:.1%} server errors (5xx)")
    if summary.latency_ms:
        latency = " · ".join(f"{name} {ms:.0f} ms" for name, ms in summary.latency_ms.items())
        lines.append(f"  latency     {latency}")
    if summary.busiest_minute:
        minute, count = summary.busiest_minute
        lines.append(f"  busiest     {minute} ({count} requests)")
    lines += ["", "top paths", *table(summary.top_paths), "", "top clients", *table(summary.top_ips)]
    return "\\n".join(lines)


def render_json(summary: Summary, parse: ParseStats) -> str:
    data: dict[str, Any] = asdict(summary)
    data["error_rate"] = round(summary.error_rate, 4)
    data["malformed_lines"] = parse.bad
    data["top_paths"] = [{"path": p, "count": c} for p, c in summary.top_paths]
    data["top_ips"] = [{"ip": ip, "count": c} for ip, c in summary.top_ips]
    if summary.busiest_minute:
        minute, count = summary.busiest_minute
        data["busiest_minute"] = {"minute": minute, "count": count}
    return json.dumps(data, indent=2, default=str)  # default=str turns datetimes into text


def render_top(rows: list[tuple[str, int]], by: str) -> str:
    return "\\n".join([f"top {by}", *table(rows)])` }],
        },
        {
          title: "The command line: argparse, sub-commands and exit codes",
          explain: `\`cli.py\` connects the pieces.

- **Sub-commands** (\`summary\`, \`top\`) share options through a **parent parser** (\`add_help=False\`, passed as \`parents=[common]\`).
- **Custom \`type=\` functions** (\`timestamp\`, \`status_filter\`, \`positive_int\`) validate and convert arguments; raising \`ArgumentTypeError\` gives a clean usage error with exit code 2.
- **\`main(argv, stdout, stderr, stdin) -> int\`**: everything the function touches is a parameter, so tests call it directly with \`StringIO\` objects; no subprocess needed. It **returns** an exit code instead of calling \`sys.exit\`.
- The pipeline is built first and consumed inside the \`try\`, because that's where files are actually opened: \`OSError\` (missing file, permission denied) becomes \`logscope: error: ...\` and exit code 1. A file where no line parses also exits with 1 and a hint.
- \`__main__.py\` makes \`python -m logscope\` work; the installed \`logscope\` command calls the same \`main\`.

Running it on the sample:`,
          files: [
            { path: "src/logscope/cli.py", lang: "python", code: `"""The command-line interface: argument parsing, wiring the pipeline, exit codes."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from typing import TextIO

from logscope import __version__
from logscope.parser import ParseStats, parse_lines
from logscope.reader import read_lines
from logscope.report import render_json, render_text, render_top
from logscope.stats import FIELDS, filter_records, summarize, top_values

EXIT_OK, EXIT_ERROR = 0, 1  # argparse itself exits with 2 on usage errors


def timestamp(text: str) -> datetime:
    """--since/--until: ISO 8601; naive times are taken as UTC."""
    try:
        value = datetime.fromisoformat(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not an ISO 8601 time: {text!r}") from None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def status_filter(text: str) -> str:
    if len(text) == 3 and (text.isdigit() or (text[0] in "12345" and text[1:].lower() == "xx")):
        return text.lower()
    raise argparse.ArgumentTypeError(f"expected a status like 404 or 5xx, got {text!r}")


def positive_int(text: str) -> int:
    if text.isdigit() and int(text) > 0:
        return int(text)
    raise argparse.ArgumentTypeError(f"expected a positive integer, got {text!r}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="logscope", description="Summarize web server access logs.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    common = argparse.ArgumentParser(add_help=False)  # options shared by every sub-command
    common.add_argument("files", nargs="+", help="log files (.log or .gz); - reads standard input")
    common.add_argument("--since", type=timestamp, help="ignore requests before this time (ISO 8601)")
    common.add_argument("--until", type=timestamp, help="ignore requests from this time on")
    common.add_argument(
        "--status",
        type=status_filter,
        action="append",
        help="keep only this status or class, e.g. 404 or 5xx (repeatable)",
    )
    common.add_argument("--json", action="store_true", help="print JSON instead of text")

    commands = parser.add_subparsers(dest="command", required=True, metavar="COMMAND")
    summary = commands.add_parser("summary", parents=[common], help="overall traffic report")
    summary.add_argument("--top", type=positive_int, default=5, help="rows per table (default: 5)")
    top = commands.add_parser("top", parents=[common], help="most frequent values of one field")
    top.add_argument("--by", choices=sorted(FIELDS), default="path", help="field to count")
    top.add_argument("-n", type=positive_int, default=10, help="number of rows (default: 10)")
    return parser


def main(
    argv: list[str] | None = None,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
    stdin: TextIO | None = None,
) -> int:
    """Run the CLI and return the exit code. The streams are parameters so tests can capture them."""
    stdout, stderr = stdout or sys.stdout, stderr or sys.stderr
    args = build_parser().parse_args(argv)
    parse = ParseStats()
    records = filter_records(
        parse_lines(read_lines(args.files, stdin), parse),
        since=args.since,
        until=args.until,
        statuses=args.status,
    )
    try:  # nothing is read until here: the whole pipeline is lazy
        if args.command == "summary":
            summary = summarize(records, top=args.top)
            output = render_json(summary, parse) if args.json else render_text(summary, parse)
        else:
            rows = top_values(records, args.by, args.n)
            if args.json:
                output = json.dumps([{args.by: value, "count": count} for value, count in rows], indent=2)
            else:
                output = render_top(rows, args.by)
    except OSError as e:
        print(f"logscope: error: {e.filename or ''}: {e.strerror}", file=stderr)
        return EXIT_ERROR
    print(output, file=stdout)
    if parse.lines and parse.bad == parse.lines:
        print("logscope: warning: no line could be parsed; is this an access log?", file=stderr)
        return EXIT_ERROR
    return EXIT_OK` },
            { path: "src/logscope/__main__.py", lang: "python", code: `"""Allows \`python -m logscope ...\`."""

from logscope.cli import main

raise SystemExit(main())` },
            { path: "tests/test_cli.py", lang: "python", code: `import io
import json
from pathlib import Path

import pytest

from logscope.cli import main


def run(*args: str, stdin: str = "") -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    code = main(list(args), stdout=out, stderr=err, stdin=io.StringIO(stdin))
    return code, out.getvalue(), err.getvalue()


def test_summary_text(log_file: Path) -> None:
    code, out, err = run("summary", str(log_file))
    assert code == 0 and err == ""
    assert "requests    5  (1 malformed line skipped)" in out
    assert "status      2xx 3 · 4xx 1 · 5xx 1" in out
    assert "errors      20.0% server errors (5xx)" in out
    assert "/api/books" in out.split("top paths")[1]


def test_summary_json_with_filters(log_file: Path) -> None:
    code, out, _ = run("summary", str(log_file), "--json", "--since", "2026-11-04T09:16:00", "--status", "2xx")
    data = json.loads(out)
    assert code == 0
    assert data["requests"] == 2  # 09:16:20 and 10:00:00
    assert data["status_classes"] == {"2xx": 2}
    assert data["top_paths"][0] == {"path": "/api/books", "count": 1}
    assert data["first"] == "2026-11-04 09:16:20+00:00"


def test_top_by_ip_reads_stdin(lines: list[str]) -> None:
    code, out, _ = run("top", "-", "--by", "ip", "-n", "1", stdin="\\n".join(lines))
    assert code == 0
    assert out.splitlines()[:2] == ["top ip", "  203.0.113.7  2  ████████████████████"]


def test_missing_file_is_a_clean_error(tmp_path: Path) -> None:
    code, out, err = run("summary", str(tmp_path / "missing.log"))
    assert code == 1 and out == ""
    assert err.startswith("logscope: error: ") and "No such file or directory" in err


def test_file_with_no_valid_lines_warns(tmp_path: Path) -> None:
    path = tmp_path / "notes.txt"
    path.write_text("hello\\nworld\\n", encoding="utf-8")
    code, _, err = run("summary", str(path))
    assert code == 1 and "no line could be parsed" in err


@pytest.mark.parametrize("args", [[], ["summary"], ["summary", "x.log", "--status", "6xx"], ["top", "x.log", "--by", "color"]])
def test_usage_errors_exit_with_2(args: list[str], capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(args)
    assert exc.value.code == 2
    assert "usage: logscope" in capsys.readouterr().err` },
          ],
          run: `uv run logscope summary samples/access.log`,
          output: `logscope report
  requests    20  (1 malformed line skipped)
  period      2026-11-04 09:15:02 -> 09:21:40 +0000
  data sent   37.4 KB
  status      2xx 14 · 3xx 1 · 4xx 3 · 5xx 2
  errors      10.0% server errors (5xx)
  latency     p50 25 ms · p95 842 ms · p99 1204 ms · max 1204 ms
  busiest     2026-11-04 09:17 (8 requests)

top paths
  /api/books     4  ████████████████████
  /api/books/42  3  ███████████████
  /api/login     2  ██████████
  /api/checkout  2  ██████████
  /api/orders    2  ██████████

top clients
  203.0.113.7    9  ████████████████████
  192.0.2.44     5  ███████████
  198.51.100.23  3  ███████
  198.51.100.99  2  ████
  10.0.0.5       1  ██`,
        },
        {
          title: "More commands to try",
          explain: `The same pipeline answers other questions. Count status codes:
\`\`\`text
$ uv run logscope top samples/access.log --by status
top status
  200  12  ████████████████████
  404   2  ███
  401   1  ██
  201   1  ██
  502   1  ██
  304   1  ██
  204   1  ██
  500   1  ██
\`\`\`
Only the server errors, as JSON for another program:
\`\`\`text
$ uv run logscope summary samples/access.log --status 5xx --json
{
  "requests": 2,
  "bytes_sent": 87,
  "first": "2026-11-04 09:17:05+00:00",
  "last": "2026-11-04 09:20:10+00:00",
  "status_classes": {
    "5xx": 2
  },
  "top_paths": [
    {
      "path": "/api/checkout",
      "count": 1
    },
    {
      "path": "/api/orders",
      "count": 1
    }
  ],
  "top_ips": [
    {
      "ip": "203.0.113.7",
      "count": 2
    }
  ],
  "latency_ms": {
    "p50": 377.0,
    "p95": 1204.0,
    "p99": 1204.0,
    "max": 1204.0
  },
  "busiest_minute": {
    "minute": "2026-11-04 09:17",
    "count": 1
  },
  "error_rate": 1.0,
  "malformed_lines": 1
}
\`\`\`
argparse generates the help from the parser definitions:
\`\`\`text
$ uv run logscope top --help
usage: logscope top [-h] [--since SINCE] [--until UNTIL] [--status STATUS]
                    [--json] [--by {agent,ip,method,path,status}] [-n N]
                    files [files ...]

positional arguments:
  files                 log files (.log or .gz); - reads standard input

options:
  -h, --help            show this help message and exit
  --since SINCE         ignore requests before this time (ISO 8601)
  --until UNTIL         ignore requests from this time on
  --status STATUS       keep only this status or class, e.g. 404 or 5xx
                        (repeatable)
  --json                print JSON instead of text
  --by {agent,ip,method,path,status}
                        field to count
  -n N                  number of rows (default: 10)
\`\`\`
Some more: \`logscope summary *.log.gz --since 2026-11-04T09:00 --until 2026-11-04T10:00\`, \`kubectl logs deploy/web | logscope top - --by ip -n 20\`, or \`logscope summary missing.log; echo $?\` (prints the error, then \`1\`).`,
          files: [],
        },
        {
          title: "Continuous integration",
          explain: `The workflow runs on every push and pull request, on Python **3.12, 3.13 and 3.14** (a matrix): it installs exactly what \`uv.lock\` pins, checks formatting and lint rules with ruff, type-checks \`src\` with mypy in strict mode, runs the tests, and finally runs the tool on the sample as a smoke test.

Before your first push, run \`uv lock\` (and commit \`uv.lock\`), then \`uv run ruff format .\` and \`uv run ruff check --fix .\` once, so the code matches the formatter.

Run the whole suite locally:`,
          files: [{ path: ".github/workflows/ci.yml", lang: "yaml", code: `name: ci
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ["3.12", "3.13", "3.14"]
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6
        with:
          python-version: \${{ matrix.python }}
      - run: uv sync --locked
      - run: uv run ruff format --check .
      - run: uv run ruff check .
      - run: uv run mypy
      - run: uv run pytest -q
      - run: uv run logscope summary samples/access.log` }],
          run: `uv run pytest -q`,
          output: `....................................                             [100%]
36 passed`,
        },
      ],
      extensions: [
        "Add a `--format csv` output and a `slow` sub-command listing the slowest endpoints by p95 latency.",
        "Support JSON-lines logs (one JSON object per line) through a parser registry chosen with `--log-format`.",
        "Add `--follow` to keep reading a growing file like `tail -f`, printing a refreshed summary every few seconds.",
        "Replace the latency list with a streaming quantile sketch (t-digest) and process files in parallel with ProcessPoolExecutor, merging the partial Summaries.",
        "Package and publish it: `uv build`, then upload to TestPyPI and install it with `uvx logscope`.",
      ],
      verify: `$PY_CMD -m pytest -q -p no:cacheprovider && PYTHONPATH=src $PY_CMD -m logscope summary samples/access.log > out.txt && grep -q 'requests    20  (1 malformed line skipped)' out.txt && grep -q '2xx 14 · 3xx 1 · 4xx 3 · 5xx 2' out.txt && PYTHONPATH=src $PY_CMD -m logscope top samples/access.log --by status --json > top.json && $PY_CMD -c "import json; rows = json.load(open('top.json')); assert rows[0] == {'status': '200', 'count': 12}, rows" && { PYTHONPATH=src $PY_CMD -m logscope summary missing.log 2> err.txt; [ $? -eq 1 ]; } && grep -q 'No such file' err.txt`,
      requires: ["pytest"],
    },
    interview: [
      {
        q: "Why use generators for a log processor instead of reading the file into a list?",
        a: `Memory and latency. A list holds every line (and every parsed record) at once, so memory grows with the file and a 20 GB log can exhaust RAM. A generator pipeline holds one line at a time: memory is constant, processing starts immediately, and stages compose (read → parse → filter → aggregate) without intermediate lists. The trade-off is that a generator can be consumed only once, so aggregation must happen in a single pass (or you re-read the source).`,
        freq: "common",
      },
      {
        q: "How do you make a command-line tool testable?",
        a: `Keep logic out of the entry point: \`main(argv, stdout, stderr, stdin) -> int\` takes everything it touches as parameters and returns an exit code. Tests call it in-process with \`StringIO\` streams and argument lists, which is fast and lets you assert on output and codes. Pure functions (parsing, statistics, rendering) get their own unit tests; a couple of end-to-end tests (or \`subprocess.run\`) cover the wiring. With click, \`CliRunner\` does the same job.`,
        freq: "common",
      },
      {
        q: "What's the point of the src layout?",
        a: `With the package at the project root, \`import mypackage\` in tests silently imports the source directory because the current directory is on \`sys.path\`, even if packaging is broken (missing files, wrong metadata). Putting the code under \`src/\` means it's importable only once installed (or added to the path explicitly), so tests exercise the package as users get it. It also prevents accidental imports of helper scripts at the root.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Why does read_lines raise FileNotFoundError only when iteration starts, not when it's called?",
        options: ["Python checks files lazily", "It's a generator: its body doesn't run until the first next()", "open() is asynchronous", "Because of errors=\"replace\""],
        answer: 1,
        explain: "Calling a generator function only creates the generator; the open() inside runs on the first next().",
      },
      {
        q: "For sorted durations [10, 20, 30, 1500] ms, what's the nearest-rank p50?",
        options: ["15", "20", "25", "30"],
        answer: 1,
        explain: "rank = ceil(0.5 × 4) = 2, so the 2nd smallest value: 20.",
      },
      {
        q: "Which exit code does argparse use for invalid arguments?",
        options: ["0", "1", "2", "127"],
        answer: 2,
        explain: "argparse prints the usage and exits with status 2, the Unix convention for usage errors.",
      },
      {
        q: "Why open logs with errors=\"replace\"?",
        options: ["It's faster", "One invalid byte would otherwise raise UnicodeDecodeError and abort the run", "To compress the output", "To support gzip"],
        answer: 1,
        explain: "Real logs contain stray bytes; replacing them with U+FFFD keeps processing going.",
      },
    ],
  },

  // ------------------------------------------------------------------ PROJECT: API
  {
    id: "py-project-api",
    stage: "Projects",
    title: "Project: shelf, a production-style REST API",
    tagline: "Build a reading-list API with FastAPI, SQLAlchemy 2.0, pydantic and JWT auth: layered design, domain errors, per-request transactions, secure password storage, pagination and search, tests, Docker and CI.",
    difficulty: "advanced",
    minutes: 120,
    diagram: {
      title: "shelf's layers",
      nodes: [
        { id: "client", label: "HTTP client", kind: "client", x: 90, y: 280, sub: "curl, a SPA, /docs" },
        { id: "api", label: "FastAPI routes", kind: "gateway", x: 260, y: 280, sub: "api.py: validation, status codes" },
        { id: "deps", label: "Dependencies", kind: "control", x: 260, y: 90, sub: "session + transaction, current user" },
        { id: "auth", label: "AuthService", kind: "service", x: 480, y: 90, sub: "register, login, tokens" },
        { id: "sec", label: "security.py", kind: "control", x: 700, y: 90, sub: "scrypt, JWT (HS256)" },
        { id: "shelf", label: "ShelfService", kind: "service", x: 480, y: 280, sub: "business rules, per user" },
        { id: "repo", label: "Repositories", kind: "service", x: 700, y: 280, sub: "all SQL lives here" },
        { id: "db", label: "SQLite / PostgreSQL", kind: "db", x: 890, y: 280, sub: "SQLAlchemy 2.0" },
        { id: "errors", label: "Error handler", kind: "monitor", x: 480, y: 470, sub: "ShelfError → JSON + status" },
      ],
      edges: [
        { from: "client", to: "api", label: "JSON over HTTP" },
        { from: "api", to: "deps", label: "Depends(...)" },
        { from: "api", to: "auth", label: "register / login" },
        { from: "deps", to: "auth", label: "user_from_token" },
        { from: "deps", to: "shelf", label: "ShelfService(user)" },
        { from: "auth", to: "sec", label: "hash / verify / sign" },
        { from: "auth", to: "repo", label: "users" },
        { from: "api", to: "shelf", label: "calls" },
        { from: "shelf", to: "repo", label: "books" },
        { from: "repo", to: "db", label: "SQL" },
        { from: "shelf", to: "errors", label: "raises", dashed: true },
        { from: "errors", to: "api", label: "JSONResponse" },
      ],
      flows: [
        {
          name: "POST /auth/token (log in)",
          path: ["client", "api", "auth", "repo", "db", "repo", "auth", "sec", "auth", "api", "client"],
          steps: [
            "The client posts {email, password}. FastAPI validates the body into a Login model (422 if fields are missing).",
            "The route builds an AuthService with this request's session and calls login().",
            "login() asks the UserRepository for the user by normalized email.",
            "SELECT ... FROM users WHERE email = ? (a parameterized query: no SQL injection).",
            "The row comes back, or nothing.",
            "The repository returns a User object, or None.",
            "verify_password recomputes scrypt with the stored salt and compares in constant time. An unknown email still runs a dummy hash, so both failures take the same time.",
            "On success, create_access_token signs {sub, iat, exp} with HS256 and the server's secret.",
            "login() returns a Token model with the JWT and its lifetime.",
            "200 {\"access_token\": \"eyJ...\", \"token_type\": \"bearer\", \"expires_in\": 3600}. The client sends it as Authorization: Bearer ... from now on.",
          ],
        },
        {
          name: "PATCH /books/7 (authenticated)",
          path: ["client", "api", "deps", "auth", "sec", "auth", "deps", "shelf", "repo", "db"],
          steps: [
            "The client sends the bearer token and a partial JSON body. FastAPI validates it into BookUpdate.",
            "The route needs a ShelfService, so FastAPI resolves the dependency chain: get_session opens a session and a transaction, HTTPBearer extracts the token.",
            "get_current_user asks AuthService for the user behind the token.",
            "decode_access_token checks the signature, the algorithm and the expiry.",
            "The user id comes from the sub claim, and the user is loaded (401 if anything fails).",
            "The current user is handed back to the dependency chain.",
            "get_shelf builds a ShelfService scoped to that user: every query it makes filters on owner_id.",
            "update() loads book 7 for this owner, checks the rules (nulls, rating only when done, duplicates) and only then changes the object.",
            "When the request finishes, get_session's transaction commits and SQLAlchemy sends the UPDATE. Any exception would roll it back instead.",
          ],
        },
        {
          name: "Breaking a rule",
          path: ["client", "api", "shelf", "errors", "api", "client"],
          steps: [
            "The client asks to rate a book that isn't finished: PATCH /books/7 {\"rating\": 5}.",
            "The route calls shelf.update(7, changes).",
            "The service raises RuleViolation(\"only finished books (status 'done') can be rated\"), before changing anything. The transaction rolls back.",
            "The single ShelfError handler builds a JSONResponse from the exception's status_code (422) and message.",
            "FastAPI sends that response instead of the route's: 422 {\"detail\": \"only finished books (status 'done') can be rated\"}.",
          ],
        },
      ],
    },
    concept: `
## What you'll build
**shelf** is a production-style REST API for tracking the books you want to read, are reading and have finished. Users register and log in to get a **JWT**; every book operation is scoped to the logged-in user. It supports filtering, case-insensitive search, sorting and pagination, rating rules, per-user duplicate detection and reading statistics. It ships with a Dockerfile and a CI workflow that also tests against PostgreSQL.

Stack: **FastAPI**, **SQLAlchemy 2.0**, **pydantic v2**, **PyJWT**, password hashing with the standard library's **scrypt**, and **pytest**.

## Design decisions
- **Layers with one job each.**
  - \`schemas.py\` (pydantic) is the public contract: what clients send and receive.
  - \`services.py\` holds the business rules ("only finished books can be rated", "no duplicate books per user").
  - \`repository.py\` holds all the SQL.
  - \`api.py\` only translates between HTTP and services.

  The rules can be tested without HTTP, and the HTTP layer stays thin.
- **Domain errors, mapped once.** Services raise \`NotFoundError\`, \`ConflictError\`, \`AuthError\` or \`RuleViolation\`, each carrying its HTTP status code; a single exception handler turns them into JSON responses.
- **One transaction per request.** The \`get_session\` dependency opens a session and a transaction: it commits when the request succeeds and rolls back on any error.
- **Security basics done right.** Passwords are hashed with salted scrypt and compared in constant time. "Unknown email" and "wrong password" give the same answer in the same time. Tokens expire, and the decoder rejects unsigned (\`alg: none\`) and tampered tokens. Other users' books return 404 rather than 403, so their existence isn't revealed. Search input is escaped before it goes into \`LIKE\`.
- **Configuration from the environment**, with a hard failure in production if the JWT secret is missing or short.
- **An application factory** (\`create_app(settings)\`) gives every test its own app and in-memory database.
- **Testable time.** The service takes a clock function, so tests can control \`finished_at\` and the yearly statistics.

The diagram above follows a request through these layers. The steps on the **Build** tab create the files in order. Everything below the HTTP layer (33 tests) runs with just SQLAlchemy, pydantic, PyJWT and pytest; \`tests/test_api.py\` adds end-to-end HTTP tests once FastAPI is installed.
`,
    keyPoints: [
      "Schemas, services, repositories and routes: one responsibility each",
      "Domain errors carry their HTTP status; one handler maps them",
      "A yield dependency gives one transaction per request",
      "Salted scrypt + constant-time comparison; JWTs that expire and verify the algorithm",
      "Scope every query to the current user; answer 404 for others' data",
      "Application factory + in-memory SQLite + a fake clock make tests fast and deterministic",
    ],
    project: {
      summary: `**shelf**: a REST API for tracking books you want to read, are reading and have finished. Users **register and log in for a JWT**; every book operation is **scoped to the user**. Features: create, read, **partial update** and delete books, filters, **case-insensitive search** with escaped wildcards, sorting, **pagination**, rating rules, per-user duplicate detection and reading statistics. It's built in clean layers (**pydantic schemas → services → repositories → SQLAlchemy 2.0**) with **domain errors** mapped to HTTP codes, **per-request transactions**, salted **scrypt** password hashing, environment-based configuration, **33 service and security tests plus end-to-end HTTP tests**, a **Dockerfile** and a **CI pipeline** that smoke-tests against PostgreSQL.`,
      skills: ["FastAPI routing & dependencies", "pydantic v2 models & validators", "SQLAlchemy 2.0 ORM", "custom column types", "repository & service layers", "domain errors", "JWT (PyJWT)", "password hashing (scrypt)", "transactions per request", "pagination & search", "pytest fixtures & fakes", "TestClient", "Docker", "GitHub Actions"],
      tree: shelfTree,
      steps: [
        {
          title: "Create the project and its configuration",
          explain: `- **\`pyproject.toml\`** lists the runtime dependencies (\`fastapi[standard]\` brings uvicorn and httpx; \`psycopg\` is the PostgreSQL driver) and dev tools. There's no \`[build-system]\`: it's an application, not a library, so uv just manages its environment.
- \`pythonpath = ["."]\` lets the tests \`import app\`.
- **\`config.py\`** reads settings from environment variables (\`SHELF_DATABASE_URL\`, \`SHELF_JWT_SECRET\`, \`SHELF_TOKEN_TTL_MINUTES\`, \`SHELF_ENV\`) into a frozen dataclass.
- In production a missing or short secret is a **startup error**: better to crash on deploy than to sign tokens with a guessable key.
- In development, a random secret is generated on each start (tokens stop working after a restart, which is fine locally).
- \`from_env\` takes the environment as a parameter, so tests pass a plain dict.

Never commit secrets. Locally, export them in your shell or use a \`.env\` file that is listed in \`.gitignore\`.`,
          files: [
            { path: "pyproject.toml", lang: "toml", code: `[project]
name = "shelf"
version = "1.0.0"
description = "A reading-list REST API: FastAPI, SQLAlchemy 2.0 and JWT auth"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115",  # includes uvicorn and httpx
    "sqlalchemy>=2.0.36",
    "pydantic>=2.9",
    "pyjwt>=2.9",
    "psycopg[binary]>=3.2",  # PostgreSQL driver for production
]

[dependency-groups]
dev = ["pytest>=8", "ruff>=0.8", "mypy>=1.13"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[tool.ruff]
line-length = 110

[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "I", "B", "UP", "SIM"]  # ruff format handles line length

[tool.mypy]
strict = true
plugins = ["pydantic.mypy"]
files = ["app"]` },
            { path: "app/__init__.py", lang: "python", code: `"""shelf: a reading-list API."""` },
            { path: "app/config.py", lang: "python", code: `"""Settings from environment variables (twelve-factor style)."""

from __future__ import annotations

import os
import secrets
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///./shelf.db"
    jwt_secret: str = ""
    token_ttl_minutes: int = 60
    environment: str = "development"

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> Settings:
        environment = env.get("SHELF_ENV", "development")
        secret = env.get("SHELF_JWT_SECRET", "")
        if len(secret) < 32:
            if environment == "production":
                raise ValueError("SHELF_JWT_SECRET must be set to at least 32 random characters")
            secret = secrets.token_urlsafe(32)  # development: a new random secret on every start
        try:
            ttl = int(env.get("SHELF_TOKEN_TTL_MINUTES", "60"))
        except ValueError:
            raise ValueError("SHELF_TOKEN_TTL_MINUTES must be an integer") from None
        return cls(
            database_url=env.get("SHELF_DATABASE_URL", cls.database_url),
            jwt_secret=secret,
            token_ttl_minutes=ttl,
            environment=environment,
        )` },
          ],
          run: `uv sync`,
        },
        {
          title: "The database: engine, sessions and models",
          explain: `**\`db.py\`**

- \`make_engine\` configures a **connection pool** for real databases (with \`pool_pre_ping\` to drop dead connections). For SQLite it allows use across threads, turns **foreign keys on** (SQLite ignores them by default), and uses a \`StaticPool\` for in-memory databases (otherwise every connection would get its own empty database).
- \`expire_on_commit=False\` keeps loaded objects usable after a commit.
- **\`UTCDateTime\`** is a \`TypeDecorator\`. It refuses naive datetimes, stores UTC, and re-attaches UTC when reading. SQLite has no time zones, and without this the same field would come back with a zone right after an insert and without one when loaded later.

**\`models.py\`**

- Two tables with typed SQLAlchemy 2.0 mappings: \`Mapped[int | None]\` is a nullable column, and \`Mapped[ReadingStatus]\` stores the enum.
- \`UniqueConstraint("owner_id", "title", "author")\` backs the duplicate rule at the database level.
- Deleting a user cascades to their books, in the ORM (\`cascade="all, delete-orphan"\`) and in SQL (\`ondelete="CASCADE"\`).
- \`StrEnum\` statuses serialize as plain strings in JSON.`,
          files: [
            { path: "app/db.py", lang: "python", code: `"""Engine, session factory and the declarative base."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, Dialect, Engine, TypeDecorator, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator[datetime]):
    """Stores UTC and always returns timezone-aware datetimes, even on SQLite (which drops zones)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("naive datetime: pass an aware datetime (e.g. datetime.now(UTC))")
            value = value.astimezone(UTC)
        return value

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value


def make_engine(url: str) -> Engine:
    if not url.startswith("sqlite"):
        # PostgreSQL etc.: a connection pool, with a liveness check before reusing a connection
        return create_engine(url, pool_size=5, max_overflow=10, pool_pre_ping=True)
    kwargs: dict[str, Any] = {"connect_args": {"check_same_thread": False}}
    if url in ("sqlite://", "sqlite:///:memory:"):
        kwargs["poolclass"] = StaticPool  # one shared connection, or each would see an empty database
    engine = create_engine(url, **kwargs)

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys = ON")  # SQLite leaves them off by default

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    # expire_on_commit=False: objects stay usable after commit (e.g. while building the response)
    return sessionmaker(bind=engine, expire_on_commit=False)` },
            { path: "app/models.py", lang: "python", code: `"""Database tables as SQLAlchemy 2.0 typed models."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime


def utcnow() -> datetime:
    return datetime.now(UTC)


class ReadingStatus(StrEnum):
    WANT_TO_READ = "want_to_read"
    READING = "reading"
    DONE = "done"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    books: Mapped[list[Book]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (UniqueConstraint("owner_id", "title", "author", name="uq_books_owner_book"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    author: Mapped[str] = mapped_column(String(120))
    status: Mapped[ReadingStatus] = mapped_column(default=ReadingStatus.WANT_TO_READ)
    rating: Mapped[int | None]
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    owner: Mapped[User] = relationship(back_populates="books")` },
          ],
        },
        {
          title: "Schemas: the API's contract",
          explain: `Pydantic models define exactly what clients may send and what they get back, separately from the database models.

- **\`UserCreate\`** normalizes the email in a \`mode="before"\` validator (trim, lowercase) before the pattern check runs. \`repr=False\` keeps passwords out of logs and error messages.
- **\`BookCreate\`** strips whitespace from every string (\`str_strip_whitespace\`), bounds lengths and the rating (1–5), and enforces a cross-field rule in a \`model_validator\`: only finished books can be rated.
- **\`BookUpdate\`** is for PATCH: every field is optional, and the service later uses \`model_dump(exclude_unset=True)\` to tell "not sent" apart from "sent as null".
- **Output models** use \`from_attributes=True\` to read straight from ORM objects. They decide what leaves the server: the password hash and \`owner_id\` never do.
- **\`BookPage\`** wraps a page of results with \`total\`, \`limit\` and \`offset\` so clients can paginate.`,
          files: [{ path: "app/schemas.py", lang: "python", code: `"""Request and response models: the API's public contract."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import ReadingStatus

EMAIL_PATTERN = r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"


class UserCreate(BaseModel):
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=8, max_length=128, repr=False)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        return value.strip().lower() if isinstance(value, str) else value


class Login(BaseModel):
    email: str
    password: str = Field(repr=False)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # build from ORM objects

    id: int
    email: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class BookCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=120)
    status: ReadingStatus = ReadingStatus.WANT_TO_READ
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def only_finished_books_have_ratings(self) -> Self:
        if self.rating is not None and self.status is not ReadingStatus.DONE:
            raise ValueError("only finished books (status 'done') can be rated")
        return self


class BookUpdate(BaseModel):
    """PATCH body: every field optional; only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    author: str | None = Field(default=None, min_length=1, max_length=120)
    status: ReadingStatus | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    author: str
    status: ReadingStatus
    rating: int | None
    notes: str
    created_at: datetime
    finished_at: datetime | None


class BookPage(BaseModel):
    items: list[BookOut]
    total: int
    limit: int
    offset: int


class ShelfStats(BaseModel):
    total: int
    by_status: dict[ReadingStatus, int]
    average_rating: float | None
    finished_this_year: int` }],
        },
        {
          title: "Passwords and tokens",
          explain: `**Passwords** are never stored, only a slow, salted hash of them.

- \`hashlib.scrypt\` (standard library) is **memory-hard**, which makes GPU brute force expensive. A random 16-byte salt per password means identical passwords get different hashes.
- The stored string records its own parameters (\`scrypt$16384$8$1$salt$digest\`), so they can be raised later without breaking old hashes.
- Verification recomputes the hash and compares with **\`hmac.compare_digest\`**, which takes constant time and leaks nothing through timing.
- Argon2id (\`argon2-cffi\`) is the other excellent choice.

**Tokens** are JWTs signed with HS256.

- They carry the user id in \`sub\`, plus the issue time and an **expiry**.
- \`decode_access_token\` pins \`algorithms=["HS256"]\` and requires \`exp\` and \`sub\`. The tests prove it rejects expired tokens, tokens signed with another key, tokens without a subject, and the classic **\`alg: none\`** forgery.
- Every failure becomes a single \`TokenError\`, so callers can't accidentally treat some failures differently.`,
          files: [
            { path: "app/security.py", lang: "python", code: `"""Password hashing (scrypt, standard library) and JWT access tokens (PyJWT)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

# scrypt is memory-hard: expensive to brute-force on GPUs. ~16 MB and ~50 ms per hash with these.
SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_LENGTH = 2**14, 8, 1, 32
ALGORITHM = "HS256"


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    """Return a self-describing hash: scrypt$n$r$p$salt$digest (a random salt per password)."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=KEY_LENGTH
    )
    return f"scrypt\${SCRYPT_N}\${SCRYPT_R}\${SCRYPT_P}\${salt.hex()}\${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, n, r, p, salt_hex, digest_hex = stored.split("$")
        if algorithm != "scrypt":
            return False
        salt, length = bytes.fromhex(salt_hex), len(digest_hex) // 2
        digest = hashlib.scrypt(password.encode(), salt=salt, n=int(n), r=int(r), p=int(p), dklen=length)
    except ValueError:  # malformed stored hash
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)  # constant time: no timing leaks


def create_access_token(user_id: int, secret: str, ttl: timedelta, now: datetime | None = None) -> str:
    issued = now or datetime.now(UTC)
    claims = {"sub": str(user_id), "iat": issued, "exp": issued + ttl}
    return jwt.encode(claims, secret, algorithm=ALGORITHM)


def decode_access_token(token: str, secret: str) -> int:
    """Return the user id, or raise TokenError for expired, tampered or malformed tokens."""
    try:
        claims = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
        return int(claims["sub"])
    except jwt.ExpiredSignatureError:
        raise TokenError("token expired") from None
    except (jwt.InvalidTokenError, ValueError):
        raise TokenError("invalid token") from None` },
            { path: "tests/test_security.py", lang: "python", code: `from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.security import TokenError, create_access_token, decode_access_token, hash_password, verify_password

SECRET = "x" * 40


def test_hash_and_verify() -> None:
    stored = hash_password("s3cret-password")
    assert stored.startswith("scrypt$16384$8$1$")
    assert verify_password("s3cret-password", stored)
    assert not verify_password("wrong-password", stored)


def test_same_password_gets_different_salts() -> None:
    assert hash_password("same") != hash_password("same")


@pytest.mark.parametrize("stored", ["", "plain-text", "bcrypt$1$2$3$aa$bb", "scrypt$x$8$1$00$00"])
def test_malformed_hashes_never_verify(stored: str) -> None:
    assert verify_password("anything", stored) is False


def test_token_round_trip() -> None:
    token = create_access_token(42, SECRET, timedelta(minutes=5))
    assert decode_access_token(token, SECRET) == 42


def test_expired_token() -> None:
    long_ago = datetime.now(UTC) - timedelta(hours=2)
    token = create_access_token(42, SECRET, timedelta(minutes=5), now=long_ago)
    with pytest.raises(TokenError, match="expired"):
        decode_access_token(token, SECRET)


def test_token_signed_with_another_secret_is_rejected() -> None:
    token = create_access_token(42, "y" * 40, timedelta(minutes=5))
    with pytest.raises(TokenError, match="invalid"):
        decode_access_token(token, SECRET)


def test_token_without_subject_is_rejected() -> None:
    token = jwt.encode({"exp": datetime.now(UTC) + timedelta(minutes=5)}, SECRET, algorithm="HS256")
    with pytest.raises(TokenError):
        decode_access_token(token, SECRET)


def test_alg_none_is_rejected() -> None:
    claims = {"sub": "1", "exp": datetime.now(UTC) + timedelta(minutes=5)}
    unsigned = jwt.encode(claims, None, algorithm="none")  # the classic JWT attack
    with pytest.raises(TokenError):
        decode_access_token(unsigned, SECRET)` },
          ],
          run: `uv run pytest tests/test_security.py -q`,
          output: `...........                                                      [100%]
11 passed`,
        },
        {
          title: "Repositories and services: the business rules",
          explain: `This is the heart of the application, and none of it knows about HTTP.

**\`errors.py\`**: each domain error carries the HTTP status it should become.

**\`repository.py\`** holds every query:

- \`get_owned\` always filters on \`owner_id\`, so one user can never load another's book.
- The search escapes \`%\`, \`_\` and \`\\\` in user input before building the \`LIKE\` pattern.
- The total is counted from the same filtered query wrapped in a subquery, so it can't drift from the items.
- Sorting always ends with a unique column (\`id\`), which keeps pages stable.

**\`services.py\`** holds the rules:

- \`AuthService\` registers users (duplicate emails are a conflict) and logs them in. An unknown email and a wrong password produce the **same message in the same time** (the dummy hash), so attackers can't probe which emails have accounts.
- \`ShelfService\` is created for one user. It blocks duplicates case-insensitively, records \`finished_at\` when a book becomes \`done\`, and clears the rating when it's un-finished.
- Every check runs **before** the object is modified, so a rejected update changes nothing.
- Returning 404 for other users' books hides their existence.
- The **clock is injected**, so the tests can freeze time. \`conftest.py\` builds a fresh in-memory database per test, two users and a \`FakeClock\`.`,
          files: [
            { path: "app/errors.py", lang: "python", code: `"""Domain errors. The API layer maps each one to an HTTP status code."""


class ShelfError(Exception):
    status_code = 400


class NotFoundError(ShelfError):
    status_code = 404


class ConflictError(ShelfError):
    status_code = 409


class AuthError(ShelfError):
    status_code = 401


class RuleViolation(ShelfError):
    status_code = 422` },
            { path: "app/repository.py", lang: "python", code: `"""All SQL lives here. Services call these methods instead of building queries."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Book, ReadingStatus, User

SortKey = Literal["recent", "title", "rating"]


def like_pattern(text: str) -> str:
    """Escape LIKE wildcards in user input, so a search for "100%" is literal."""
    escaped = text.lower().replace("\\\\", "\\\\\\\\").replace("%", "\\\\%").replace("_", "\\\\_")
    return f"%{escaped}%"


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, user_id: int) -> User | None:
        return self.session.get(User, user_id)

    def by_email(self, email: str) -> User | None:
        return self.session.scalar(select(User).where(User.email == email))

    def add(self, user: User) -> User:
        self.session.add(user)
        self.session.flush()  # send the INSERT now, so user.id is assigned
        return user


class BookRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_owned(self, owner_id: int, book_id: int) -> Book | None:
        return self.session.scalar(select(Book).where(Book.id == book_id, Book.owner_id == owner_id))

    def find(self, owner_id: int, title: str, author: str) -> Book | None:
        return self.session.scalar(
            select(Book).where(
                Book.owner_id == owner_id,
                func.lower(Book.title) == title.lower(),
                func.lower(Book.author) == author.lower(),
            )
        )

    def add(self, book: Book) -> Book:
        self.session.add(book)
        self.session.flush()
        return book

    def delete(self, book: Book) -> None:
        self.session.delete(book)
        self.session.flush()

    def search(
        self,
        owner_id: int,
        *,
        status: ReadingStatus | None = None,
        query: str | None = None,
        sort: SortKey = "recent",
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[Sequence[Book], int]:
        stmt = select(Book).where(Book.owner_id == owner_id)
        if status is not None:
            stmt = stmt.where(Book.status == status)
        if query:
            pattern = like_pattern(query)
            stmt = stmt.where(
                or_(
                    func.lower(Book.title).like(pattern, escape="\\\\"),
                    func.lower(Book.author).like(pattern, escape="\\\\"),
                )
            )
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        order = {
            "recent": (Book.created_at.desc(), Book.id.desc()),
            "title": (func.lower(Book.title), Book.id),
            "rating": (Book.rating.desc().nulls_last(), Book.id),
        }[sort]
        items = self.session.scalars(stmt.order_by(*order).limit(limit).offset(offset)).all()
        return items, total

    def count_by_status(self, owner_id: int) -> dict[ReadingStatus, int]:
        rows = self.session.execute(
            select(Book.status, func.count()).where(Book.owner_id == owner_id).group_by(Book.status)
        ).all()
        return {status: count for status, count in rows}

    def average_rating(self, owner_id: int) -> float | None:
        value = self.session.scalar(select(func.avg(Book.rating)).where(Book.owner_id == owner_id))
        return None if value is None else round(float(value), 2)

    def finished_between(self, owner_id: int, start: datetime, end: datetime) -> int:
        stmt = select(func.count()).where(
            Book.owner_id == owner_id, Book.finished_at >= start, Book.finished_at < end
        )
        return self.session.scalar(stmt) or 0` },
            { path: "app/services.py", lang: "python", code: `"""Business rules, independent of HTTP: easy to test and reuse (CLI, workers...)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import AuthError, ConflictError, NotFoundError, RuleViolation
from app.models import Book, ReadingStatus, User
from app.repository import BookRepository, SortKey, UserRepository
from app.schemas import BookCreate, BookOut, BookPage, BookUpdate, Login, ShelfStats, Token, UserCreate
from app.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

Clock = Callable[[], datetime]


def utc_clock() -> datetime:
    return datetime.now(UTC)


class AuthService:
    _dummy_hash: str | None = None  # used to equalize timing when the email doesn't exist

    def __init__(self, session: Session, settings: Settings) -> None:
        self.users = UserRepository(session)
        self.settings = settings

    def register(self, data: UserCreate) -> User:
        if self.users.by_email(data.email) is not None:
            raise ConflictError("email already registered")
        return self.users.add(User(email=data.email, password_hash=hash_password(data.password)))

    def login(self, data: Login) -> Token:
        user = self.users.by_email(data.email.strip().lower())
        if user is None:
            # Hash anyway, so "unknown email" takes as long as "wrong password" (no account probing).
            if AuthService._dummy_hash is None:
                AuthService._dummy_hash = hash_password("not-a-real-password")
            verify_password(data.password, AuthService._dummy_hash)
            raise AuthError("incorrect email or password")
        if not verify_password(data.password, user.password_hash):
            raise AuthError("incorrect email or password")
        ttl = timedelta(minutes=self.settings.token_ttl_minutes)
        token = create_access_token(user.id, self.settings.jwt_secret, ttl)
        return Token(access_token=token, expires_in=int(ttl.total_seconds()))

    def user_from_token(self, token: str) -> User:
        try:
            user_id = decode_access_token(token, self.settings.jwt_secret)
        except TokenError as e:
            raise AuthError(str(e)) from None
        user = self.users.get(user_id)
        if user is None:
            raise AuthError("user no longer exists")
        return user


class ShelfService:
    """Operations on one user's shelf. Every query is scoped to that user."""

    def __init__(self, session: Session, user: User, clock: Clock = utc_clock) -> None:
        self.books = BookRepository(session)
        self.user = user
        self.clock = clock

    def add(self, data: BookCreate) -> Book:
        if self.books.find(self.user.id, data.title, data.author) is not None:
            raise ConflictError(f"'{data.title}' by {data.author} is already on your shelf")
        book = Book(owner_id=self.user.id, **data.model_dump())
        if book.status is ReadingStatus.DONE:
            book.finished_at = self.clock()
        return self.books.add(book)

    def get(self, book_id: int) -> Book:
        book = self.books.get_owned(self.user.id, book_id)
        if book is None:  # also for other users' books: don't reveal that they exist
            raise NotFoundError(f"book {book_id} not found")
        return book

    def update(self, book_id: int, changes: BookUpdate) -> Book:
        book = self.get(book_id)
        fields = changes.model_dump(exclude_unset=True)  # only what the client actually sent
        if any(fields.get(name, "") is None for name in ("title", "author", "status", "notes")):
            raise RuleViolation("title, author, status and notes can't be null")
        status = fields.get("status", book.status)
        if status is not ReadingStatus.DONE and fields.get("rating") is not None:
            raise RuleViolation("only finished books (status 'done') can be rated")
        title, author = fields.get("title", book.title), fields.get("author", book.author)
        duplicate = self.books.find(self.user.id, title, author)
        if duplicate is not None and duplicate.id != book.id:
            raise ConflictError(f"'{title}' by {author} is already on your shelf")
        # All checks passed: now change the object (the session turns it into an UPDATE).
        if status is ReadingStatus.DONE and book.status is not ReadingStatus.DONE:
            book.finished_at = self.clock()
        elif status is not ReadingStatus.DONE:
            book.finished_at, book.rating = None, None  # un-finishing a book clears its rating
        for name, value in fields.items():
            setattr(book, name, value)
        return book

    def remove(self, book_id: int) -> None:
        self.books.delete(self.get(book_id))

    def list(
        self,
        *,
        status: ReadingStatus | None = None,
        query: str | None = None,
        sort: SortKey = "recent",
        limit: int = 20,
        offset: int = 0,
    ) -> BookPage:
        items, total = self.books.search(
            self.user.id, status=status, query=query, sort=sort, limit=limit, offset=offset
        )
        return BookPage(
            items=[BookOut.model_validate(b) for b in items], total=total, limit=limit, offset=offset
        )

    def stats(self) -> ShelfStats:
        counts = self.books.count_by_status(self.user.id)
        year = self.clock().year
        start, end = datetime(year, 1, 1, tzinfo=UTC), datetime(year + 1, 1, 1, tzinfo=UTC)
        return ShelfStats(
            total=sum(counts.values()),
            by_status={status: counts.get(status, 0) for status in ReadingStatus},
            average_rating=self.books.average_rating(self.user.id),
            finished_this_year=self.books.finished_between(self.user.id, start, end),
        )` },
            { path: "tests/conftest.py", lang: "python", code: `from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import Base, make_engine, make_session_factory
from app.models import User
from app.schemas import UserCreate
from app.services import AuthService, ShelfService

TEST_SECRET = "test-secret-that-is-at-least-32-characters-long"


@pytest.fixture
def settings() -> Settings:
    return Settings(database_url="sqlite://", jwt_secret=TEST_SECRET, token_ttl_minutes=5)


@pytest.fixture
def session(settings: Settings) -> Iterator[Session]:
    """A fresh in-memory database per test."""
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def auth(session: Session, settings: Settings) -> AuthService:
    return AuthService(session, settings)


@pytest.fixture
def alice(auth: AuthService) -> User:
    return auth.register(UserCreate(email="alice@example.com", password="correct horse"))


@pytest.fixture
def bob(auth: AuthService) -> User:
    return auth.register(UserCreate(email="bob@example.com", password="battery staple"))


class FakeClock:
    def __init__(self) -> None:
        self.now = datetime(2026, 3, 14, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def shelf(session: Session, alice: User, clock: FakeClock) -> ShelfService:
    return ShelfService(session, alice, clock=clock)` },
            { path: "tests/test_services.py", lang: "python", code: `from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import AuthError, ConflictError, NotFoundError, RuleViolation
from app.models import ReadingStatus, User
from app.schemas import BookCreate, BookUpdate, Login, UserCreate
from app.services import AuthService, ShelfService


# ---------------------------------------------------------------- auth
def test_register_normalizes_email_and_hashes_password(auth: AuthService) -> None:
    user = auth.register(UserCreate(email="  Carol@Example.COM ", password="long enough"))
    assert user.id is not None and user.email == "carol@example.com"
    assert user.password_hash.startswith("scrypt$") and "long enough" not in user.password_hash


def test_duplicate_email_is_a_conflict(auth: AuthService, alice: User) -> None:
    with pytest.raises(ConflictError):
        auth.register(UserCreate(email="ALICE@example.com", password="whatever123"))


@pytest.mark.parametrize("email", ["no-at-sign", "a@b", "two@at@example.com", "spaces in@example.com"])
def test_invalid_emails_are_rejected(email: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(email=email, password="long enough")


def test_login_returns_a_token_that_identifies_the_user(auth: AuthService, alice: User) -> None:
    token = auth.login(Login(email="Alice@example.com", password="correct horse"))
    assert token.token_type == "bearer" and token.expires_in == 300
    assert auth.user_from_token(token.access_token).id == alice.id


@pytest.mark.parametrize(("email", "password"), [("alice@example.com", "wrong"), ("nobody@example.com", "correct horse")])
def test_login_failures_look_identical(auth: AuthService, alice: User, email: str, password: str) -> None:
    with pytest.raises(AuthError, match="^incorrect email or password$"):
        auth.login(Login(email=email, password=password))


def test_tokens_for_deleted_users_are_rejected(session: Session, auth: AuthService, alice: User) -> None:
    token = auth.login(Login(email="alice@example.com", password="correct horse")).access_token
    session.delete(alice)
    session.flush()
    with pytest.raises(AuthError, match="no longer exists"):
        auth.user_from_token(token)


def test_settings_require_a_real_secret_in_production() -> None:
    with pytest.raises(ValueError, match="SHELF_JWT_SECRET"):
        Settings.from_env({"SHELF_ENV": "production"})
    dev = Settings.from_env({})
    assert len(dev.jwt_secret) >= 32 and dev.database_url == "sqlite:///./shelf.db"


# ---------------------------------------------------------------- books
def dune() -> BookCreate:
    return BookCreate(title="Dune", author="Frank Herbert")


def test_add_and_get(shelf: ShelfService) -> None:
    book = shelf.add(BookCreate(title="  Dune ", author="Frank Herbert", notes="desert planet"))
    assert book.id is not None and book.title == "Dune"  # whitespace stripped by the schema
    assert book.status is ReadingStatus.WANT_TO_READ and book.finished_at is None
    assert shelf.get(book.id) is book


def test_adding_a_finished_book_records_when(shelf: ShelfService, clock) -> None:
    book = shelf.add(BookCreate(title="Kindred", author="Octavia E. Butler", status="done", rating=5))
    assert book.finished_at == clock.now and book.rating == 5


def test_rating_requires_a_finished_book() -> None:
    with pytest.raises(ValidationError, match="only finished books"):
        BookCreate(title="Dune", author="Frank Herbert", rating=4)
    with pytest.raises(ValidationError):
        BookCreate(title="Dune", author="Frank Herbert", status="done", rating=6)


def test_duplicates_are_per_user_and_case_insensitive(session: Session, shelf: ShelfService, bob: User) -> None:
    shelf.add(dune())
    with pytest.raises(ConflictError):
        shelf.add(BookCreate(title="DUNE", author="frank herbert"))
    ShelfService(session, bob).add(dune())  # Bob can have his own copy


def test_users_cannot_see_each_others_books(session: Session, shelf: ShelfService, bob: User) -> None:
    book = shelf.add(dune())
    bobs_shelf = ShelfService(session, bob)
    with pytest.raises(NotFoundError):
        bobs_shelf.get(book.id)
    with pytest.raises(NotFoundError):
        bobs_shelf.remove(book.id)
    assert bobs_shelf.list().total == 0


def test_finishing_and_unfinishing_a_book(shelf: ShelfService, clock) -> None:
    book = shelf.add(dune())
    shelf.update(book.id, BookUpdate(status="reading"))
    assert book.finished_at is None
    clock.now = datetime(2026, 4, 1, tzinfo=UTC)
    shelf.update(book.id, BookUpdate(status="done", rating=4))
    assert (book.status, book.rating, book.finished_at) == (ReadingStatus.DONE, 4, clock.now)
    shelf.update(book.id, BookUpdate(notes="re-reading"))  # unrelated change keeps the rating
    assert book.rating == 4 and book.notes == "re-reading"
    shelf.update(book.id, BookUpdate(status="reading"))
    assert book.rating is None and book.finished_at is None


def test_update_rules(shelf: ShelfService) -> None:
    book = shelf.add(dune())
    shelf.add(BookCreate(title="Children of Dune", author="Frank Herbert"))
    with pytest.raises(RuleViolation, match="only finished books"):
        shelf.update(book.id, BookUpdate(rating=3))
    with pytest.raises(RuleViolation, match="can't be null"):
        shelf.update(book.id, BookUpdate(title=None))
    with pytest.raises(ConflictError):
        shelf.update(book.id, BookUpdate(title="children of dune"))
    assert book.title == "Dune"  # failed updates change nothing


def test_remove(shelf: ShelfService) -> None:
    book = shelf.add(dune())
    shelf.remove(book.id)
    with pytest.raises(NotFoundError):
        shelf.get(book.id)


@pytest.fixture
def library(shelf: ShelfService, clock) -> ShelfService:
    for i, (title, author, status, rating) in enumerate(
        [
            ("Dune", "Frank Herbert", "done", 5),
            ("The Dispossessed", "Ursula K. Le Guin", "done", 4),
            ("A Wizard of Earthsea", "Ursula K. Le Guin", "reading", None),
            ("Kindred", "Octavia E. Butler", "want_to_read", None),
            ("Parable of the Sower", "Octavia E. Butler", "done", 3),
            ("100% Python", "Some Author", "want_to_read", None),
        ]
    ):
        clock.now = datetime(2026, 1, 1 + i, tzinfo=UTC)
        shelf.add(BookCreate(title=title, author=author, status=status, rating=rating))
    return shelf


def test_times_come_back_timezone_aware(session: Session, library: ShelfService) -> None:
    session.expire_all()  # force a reload from the database
    page = library.list(status=ReadingStatus.DONE)
    assert all(b.created_at.tzinfo is not None and b.finished_at is not None for b in page.items)
    assert page.items[0].finished_at is not None and page.items[0].finished_at.utcoffset() is not None


def test_list_filters_search_sort_and_paginate(library: ShelfService) -> None:
    page = library.list(status=ReadingStatus.DONE, sort="rating")
    assert [b.title for b in page.items] == ["Dune", "The Dispossessed", "Parable of the Sower"]
    assert library.list(query="le guin").total == 2  # matches the author, case-insensitively
    assert [b.title for b in library.list(query="100%").items] == ["100% Python"]  # % is literal
    assert library.list(query="1_0").total == 0  # so is _
    first = library.list(sort="title", limit=2)
    second = library.list(sort="title", limit=2, offset=2)
    assert first.total == second.total == 6
    assert [b.title for b in first.items + second.items] == ["100% Python", "A Wizard of Earthsea", "Dune", "Kindred"]


def test_stats(library: ShelfService, clock) -> None:
    clock.now = datetime(2026, 6, 1, tzinfo=UTC)
    stats = library.stats()
    assert stats.total == 6
    assert stats.by_status == {ReadingStatus.WANT_TO_READ: 2, ReadingStatus.READING: 1, ReadingStatus.DONE: 3}
    assert stats.average_rating == 4.0
    assert stats.finished_this_year == 3
    clock.now = datetime(2027, 1, 1, tzinfo=UTC)
    assert library.stats().finished_this_year == 0` },
          ],
          run: `uv run pytest tests/test_services.py -q`,
          output: `......................                                           [100%]
22 passed`,
        },
        {
          title: "The HTTP layer with FastAPI",
          explain: `\`api.py\` is deliberately thin: each route is a few lines that call a service.

**Dependencies**

- **\`get_session\`** is a \`yield\` dependency: one session and one transaction per request. It commits when the request succeeds and rolls back when anything raises.
- **\`get_current_user\`** reads the bearer token through \`HTTPBearer\`, which also adds an **Authorize** button to \`/docs\`.
- **\`get_shelf\`** builds the user's \`ShelfService\`. FastAPI caches dependencies within a request, so all of them share the same session.

**Routes**

- The \`status\` query parameter is named \`status_\` in Python (to avoid shadowing the imported module) and aliased with \`Query(alias="status")\`.
- \`limit\` and \`offset\` are bounded; out-of-range values get a 422 automatically.
- Creating a book returns **201** with a \`Location\` header; deleting returns **204** with no body.

**Errors**

- One handler covers every \`ShelfError\` and adds \`WWW-Authenticate: Bearer\` to 401s.
- **\`create_app(settings)\`** is an application factory: \`main.py\` calls it with settings from the environment, and the tests call it with an in-memory database.
- \`test_api.py\` exercises the full HTTP flow. It starts with \`pytest.importorskip("fastapi")\`, so the rest of the suite still runs where FastAPI isn't installed.

Start the server and try it:
\`\`\`bash
uv run fastapi dev app/main.py        # http://127.0.0.1:8000/docs
curl -s localhost:8000/auth/register -H 'content-type: application/json' \\
  -d '{"email": "ada@example.com", "password": "analytical engine"}'
TOKEN=$(curl -s localhost:8000/auth/token -H 'content-type: application/json' \\
  -d '{"email": "ada@example.com", "password": "analytical engine"}' | jq -r .access_token)
curl -s localhost:8000/books -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \\
  -d '{"title": "Dune", "author": "Frank Herbert", "status": "done", "rating": 5}'
curl -s "localhost:8000/books?status=done&sort=rating" -H "Authorization: Bearer $TOKEN"
\`\`\``,
          files: [
            { path: "app/api.py", lang: "python", code: `"""The HTTP layer: routes, dependencies and error mapping. Thin on purpose."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Query, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import Base, make_engine, make_session_factory
from app.errors import AuthError, ShelfError
from app.models import ReadingStatus, User
from app.repository import SortKey
from app.schemas import (
    BookCreate,
    BookOut,
    BookPage,
    BookUpdate,
    Login,
    ShelfStats,
    Token,
    UserCreate,
    UserOut,
)
from app.services import AuthService, ShelfService


# ---------------------------------------------------------------- dependencies
def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_session(request: Request) -> Iterator[Session]:
    """One session and transaction per request: commit on success, roll back on any error."""
    with request.app.state.sessions() as session, session.begin():
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
bearer = HTTPBearer(auto_error=False)  # adds the "Authorize" button to /docs


def get_current_user(
    session: SessionDep,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None:
        raise AuthError("not authenticated")
    return AuthService(session, settings).user_from_token(credentials.credentials)


def get_shelf(session: SessionDep, user: Annotated[User, Depends(get_current_user)]) -> ShelfService:
    return ShelfService(session, user)


Shelf = Annotated[ShelfService, Depends(get_shelf)]

# ---------------------------------------------------------------- routes
auth = APIRouter(prefix="/auth", tags=["auth"])
books = APIRouter(prefix="/books", tags=["books"])
misc = APIRouter(tags=["misc"])


@auth.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, session: SessionDep, settings: SettingsDep) -> UserOut:
    return UserOut.model_validate(AuthService(session, settings).register(data))


@auth.post("/token")
def login(data: Login, session: SessionDep, settings: SettingsDep) -> Token:
    return AuthService(session, settings).login(data)


@misc.get("/me")
def me(user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return UserOut.model_validate(user)


@books.get("")
def list_books(
    shelf: Shelf,
    status_: Annotated[ReadingStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: SortKey = "recent",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BookPage:
    return shelf.list(status=status_, query=q, sort=sort, limit=limit, offset=offset)


@books.post("", status_code=status.HTTP_201_CREATED)
def add_book(data: BookCreate, shelf: Shelf, response: Response) -> BookOut:
    book = shelf.add(data)
    response.headers["Location"] = f"/books/{book.id}"
    return BookOut.model_validate(book)


@books.get("/{book_id}")
def get_book(book_id: int, shelf: Shelf) -> BookOut:
    return BookOut.model_validate(shelf.get(book_id))


@books.patch("/{book_id}")
def update_book(book_id: int, changes: BookUpdate, shelf: Shelf) -> BookOut:
    return BookOut.model_validate(shelf.update(book_id, changes))


@books.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, shelf: Shelf) -> None:
    shelf.remove(book_id)


@misc.get("/stats")
def stats(shelf: Shelf) -> ShelfStats:
    return shelf.stats()


@misc.get("/healthz")
def healthz(session: SessionDep) -> dict[str, str]:
    session.execute(text("SELECT 1"))  # fails (500) if the database is unreachable
    return {"status": "ok"}


# ---------------------------------------------------------------- the app
async def handle_shelf_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ShelfError)
    headers = {"WWW-Authenticate": "Bearer"} if isinstance(exc, AuthError) else None
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)}, headers=headers)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory: tests pass their own settings (e.g. an in-memory database)."""
    settings = settings or Settings.from_env()
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)  # fine for a demo; use Alembic migrations in real deployments
    app = FastAPI(title="Shelf", version="1.0.0", description="Track the books you want to read and have read.")
    app.state.settings = settings
    app.state.sessions = make_session_factory(engine)
    app.add_exception_handler(ShelfError, handle_shelf_error)
    for router in (auth, books, misc):
        app.include_router(router)
    return app` },
            { path: "app/main.py", lang: "python", code: `"""ASGI entry point: uvicorn app.main:app"""

from app.api import create_app

app = create_app()` },
            { path: "tests/test_api.py", lang: "python", code: `"""End-to-end tests through HTTP. Skipped when FastAPI isn't installed."""

import pytest

pytest.importorskip("fastapi")

from fastapi.testclient import TestClient  # noqa: E402

from app.api import create_app  # noqa: E402
from app.config import Settings  # noqa: E402

TEST_SECRET = "test-secret-that-is-at-least-32-characters-long"


@pytest.fixture
def client() -> TestClient:
    app = create_app(Settings(database_url="sqlite://", jwt_secret=TEST_SECRET))
    return TestClient(app)


def sign_up(client: TestClient, email: str = "ada@example.com", password: str = "analytical engine") -> dict[str, str]:
    assert client.post("/auth/register", json={"email": email, "password": password}).status_code == 201
    token = client.post("/auth/token", json={"email": email, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_full_flow(client: TestClient) -> None:
    headers = sign_up(client)
    assert client.get("/me", headers=headers).json()["email"] == "ada@example.com"

    created = client.post("/books", headers=headers, json={"title": "Dune", "author": "Frank Herbert"})
    assert created.status_code == 201
    book = created.json()
    assert created.headers["Location"] == f"/books/{book['id']}"
    assert book["status"] == "want_to_read" and book["rating"] is None

    updated = client.patch(f"/books/{book['id']}", headers=headers, json={"status": "done", "rating": 5})
    assert updated.status_code == 200 and updated.json()["finished_at"] is not None

    page = client.get("/books", headers=headers, params={"status": "done"}).json()
    assert page["total"] == 1 and page["items"][0]["title"] == "Dune"

    stats = client.get("/stats", headers=headers).json()
    assert stats["by_status"] == {"want_to_read": 0, "reading": 0, "done": 1}

    assert client.delete(f"/books/{book['id']}", headers=headers).status_code == 204
    assert client.get(f"/books/{book['id']}", headers=headers).status_code == 404


def test_auth_is_required(client: TestClient) -> None:
    response = client.get("/books")
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    bad = client.get("/books", headers={"Authorization": "Bearer not-a-jwt"})
    assert bad.status_code == 401 and bad.json() == {"detail": "invalid token"}


def test_wrong_password(client: TestClient) -> None:
    sign_up(client)
    response = client.post("/auth/token", json={"email": "ada@example.com", "password": "nope"})
    assert response.status_code == 401


def test_errors_map_to_status_codes(client: TestClient) -> None:
    headers = sign_up(client)
    body = {"title": "Dune", "author": "Frank Herbert"}
    assert client.post("/books", headers=headers, json=body).status_code == 201
    assert client.post("/books", headers=headers, json=body).status_code == 409
    invalid = client.post("/books", headers=headers, json={"title": "", "author": "X", "rating": 9})
    assert invalid.status_code == 422
    assert {tuple(e["loc"]) for e in invalid.json()["detail"]} == {("body", "title"), ("body", "rating")}
    assert client.get("/books", headers=headers, params={"limit": 0}).status_code == 422
    assert client.post("/auth/register", json={"email": "ada@example.com", "password": "another one"}).status_code == 409


def test_users_are_isolated(client: TestClient) -> None:
    ada = sign_up(client)
    grace = sign_up(client, "grace@example.com", "cobol forever")
    book_id = client.post("/books", headers=ada, json={"title": "Dune", "author": "Frank Herbert"}).json()["id"]
    assert client.get(f"/books/{book_id}", headers=grace).status_code == 404
    assert client.get("/books", headers=grace).json()["total"] == 0


def test_health_and_docs(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}
    paths = client.get("/openapi.json").json()["paths"]
    assert {"/auth/register", "/auth/token", "/books", "/books/{book_id}", "/stats"} <= set(paths)` },
          ],
          run: `uv run pytest -q`,
          output: `.......................................                          [100%]
39 passed`,
        },
        {
          title: "Ship it: Docker and CI",
          explain: `**Dockerfile**

- It copies the \`uv\` binary from its official image and installs dependencies **from the lock file** before copying the code, so code changes don't invalidate the dependency layer.
- It runs as a **non-root** user, with \`SHELF_ENV=production\` (which forces a real secret), a health check against \`/healthz\`, and two uvicorn worker processes. \`--proxy-headers\` trusts \`X-Forwarded-*\` from the load balancer in front.
- Run \`uv lock\` first and commit \`uv.lock\`. Then:
  \`docker build -t shelf . && docker run -p 8000:8000 -e SHELF_JWT_SECRET=$(openssl rand -hex 32) shelf\`

**CI**

- The workflow runs the formatter check, lint, mypy and the tests.
- It then starts the app against a real **PostgreSQL** service container and hits \`/healthz\`, which catches differences between SQLite and Postgres.
- Finally it builds the image.

For a real deployment you'd add Alembic migrations instead of \`create_all\`, structured logging, and rate limiting on \`/auth/token\`.`,
          files: [
            { path: "Dockerfile", lang: "dockerfile", code: `# syntax=docker/dockerfile:1
FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1

WORKDIR /srv
# Dependencies first: this layer is cached until pyproject.toml or uv.lock change.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY app ./app
RUN useradd --system --no-create-home shelf
USER shelf

ENV PATH="/srv/.venv/bin:$PATH" SHELF_ENV=production
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers"]` },
            { path: ".github/workflows/ci.yml", lang: "yaml", code: `name: ci
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: shelf
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6
        with:
          python-version: "3.14"
      - run: uv sync --locked
      - run: uv run ruff format --check . && uv run ruff check .
      - run: uv run mypy
      - run: uv run pytest -q
      - name: smoke test against PostgreSQL
        env:
          SHELF_DATABASE_URL: postgresql+psycopg://postgres:postgres@localhost:5432/shelf
          SHELF_JWT_SECRET: ci-only-secret-that-is-long-enough-123456
        run: |
          uv run uvicorn app.main:app --port 8000 &
          sleep 3
          curl --fail http://127.0.0.1:8000/healthz
      - run: docker build -t shelf .` },
          ],
        },
      ],
      extensions: [
        "Replace create_all with Alembic: `alembic init`, autogenerate the first migration, and run `alembic upgrade head` as a release step.",
        "Add refresh tokens (long-lived, stored hashed in a table, rotated on use) and a logout endpoint that revokes them.",
        "Rate-limit /auth/token per IP and per email with Redis (a token bucket), returning 429 with Retry-After.",
        "Switch to async: create_async_engine with asyncpg, AsyncSession, and async def routes. Compare throughput with a load test (locust or k6).",
        "Import books from Open Library by ISBN with httpx, with a timeout, retries and a cache.",
        "Add OpenTelemetry tracing and structured JSON logs with a request id, and export them to a local Jaeger.",
      ],
      verify: `$PY_CMD -m compileall -q app tests && $PY_CMD -m pytest -q -p no:cacheprovider`,
      requires: ["sqlalchemy", "jwt", "pydantic", "pytest"],
    },
    interview: [
      {
        q: "How do you structure a FastAPI (or Flask) application as it grows?",
        a: `Separate concerns into layers: **routers** (HTTP only: parse input, call a service, map results and errors to status codes), **schemas** (pydantic request/response models, the public contract), **services** (business rules, independent of HTTP), **repositories** or the ORM (data access), plus **config** from the environment and **dependencies** for sessions and auth. Group routers by feature (\`auth\`, \`books\`), use an application factory, and keep domain errors in one place with a single handler. Services can then be tested without HTTP and reused from CLIs or background workers.`,
        freq: "very-common",
      },
      {
        q: "How should passwords be stored?",
        a: `Never in plain text and never with a fast hash (MD5, SHA-256), which GPUs can try billions of times per second. Use a slow, salted, **memory-hard** password hash: **Argon2id** (argon2-cffi), **scrypt** (\`hashlib.scrypt\`) or bcrypt, with a unique random salt per password stored next to the hash along with the parameters. Verify with constant-time comparison, give identical errors for unknown users and wrong passwords, rate-limit login attempts, and rehash with stronger parameters when users log in.`,
        freq: "very-common",
      },
      {
        q: "What are the pitfalls of JWT authentication?",
        a: `Tokens can't be revoked before they expire, so keep access tokens short-lived and use refresh tokens (stored server-side, rotated) for long sessions. Always **pin the algorithm** when decoding (reject \`none\`, and never let the token choose between HMAC and RSA), use a long random secret or asymmetric keys, require and check \`exp\` (and \`aud\`/\`iss\` across services), and don't put sensitive data in the payload: it's only base64-encoded, not encrypted. In browsers, store tokens where XSS can't steal them (HttpOnly cookies, with CSRF protection) rather than in localStorage.`,
        freq: "common",
      },
      {
        q: "How do you test code that uses a database?",
        a: `Layer it: unit-test pure business rules with fakes, and test repositories and services against a **real database engine**. An in-memory SQLite database per test is fast and isolated (as in this project); for PostgreSQL-specific behaviour use a throwaway Postgres in Docker or CI (testcontainers), resetting state by wrapping each test in a transaction that's rolled back or by recreating the schema. Inject the session (and the clock) so tests control them, and add a few end-to-end tests through the HTTP layer.`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Why does ShelfService.get return 404 (not 403) for another user's book?",
        options: ["404 is faster", "403 would reveal that the book id exists", "FastAPI can't return 403", "It's a bug"],
        answer: 1,
        explain: "Answering 404 avoids leaking information about other users' resources.",
      },
      {
        q: "What does model_dump(exclude_unset=True) give you in a PATCH handler?",
        options: ["All fields with defaults", "Only the fields the client actually sent", "Only non-null fields", "The database row"],
        answer: 1,
        explain: "It distinguishes \"not sent\" (leave unchanged) from \"sent as null\".",
      },
      {
        q: "Why compare password hashes with hmac.compare_digest?",
        options: ["It's faster than ==", "It takes constant time, so response timing doesn't reveal how many characters matched", "It decrypts the hash", "It's required by scrypt"],
        answer: 1,
        explain: "== can stop at the first differing byte; constant-time comparison avoids that timing side channel.",
      },
      {
        q: "In the get_session yield dependency, what happens if the route raises an exception?",
        options: ["The transaction commits anyway", "The exception propagates into the dependency, and session.begin() rolls back", "The session stays open", "FastAPI retries the request"],
        answer: 1,
        explain: "The exception exits the with session.begin() block, which rolls back the transaction.",
      },
    ],
  },

  // ------------------------------------------------------------------ INTERVIEW
  {
    id: "py-interview",
    stage: "Interview",
    title: "Python interview prep",
    tagline: "How Python interviews work, a four-week plan, idiomatic patterns for coding rounds, the complexity of the built-ins, an LRU cache two ways, the classic gotchas, and the language questions interviewers ask most.",
    difficulty: "advanced",
    minutes: 60,
    visualizers: ["hashtable"],
    concept: `
## How Python interviews work
| Round | What it tests | Where to practise here |
|---|---|---|
| **Coding (1 or 2 rounds)** | Data structures and algorithms, written in Python | The DSA worlds, LeetCode 150, the arena |
| **Python deep dive** | Mutability, the data model, generators, decorators, the GIL, async, memory | Every chapter of this track and its Interview tab |
| **System design** (mid/senior) | Designing scalable services | The System Design worlds |
| **Behavioral** | Ownership, conflict, failure, impact | The Interview Practice STAR story bank and mock interviews |
| **Take-home** (sometimes) | Code quality, tests, structure | The two projects in this track |

## A four-week plan
1. **Week 1: language core.** Names and mutability, collections and their complexity, functions, closures and decorators, classes and the data model. Daily: two easy/medium problems in Python.
2. **Week 2: idioms and internals.** Iterators and generators, exceptions and context managers, typing, memory, \`is\` vs \`==\`, the gotchas below. Daily: two medium problems using \`collections\`, \`heapq\` and \`bisect\`.
3. **Week 3: concurrency and the ecosystem.** Threads vs processes vs asyncio and the GIL, FastAPI/Django basics, SQLAlchemy and the N+1 problem, pytest. Build or extend one of the projects.
4. **Week 4: mock interviews.** Timed problems out loud, the questions on this page without notes, two system-design sessions, and your STAR stories.

## Writing Pythonic interview code
Interviewers notice when you know the language. Reach for:
- \`collections.Counter\`, \`defaultdict\`, \`deque\`, \`heapq\`, \`bisect\`, \`functools.cache\`, \`itertools\`: each replaces 5–15 lines of hand-written code. Say why you chose it ("deque because popleft is O(1)").
- \`enumerate\`, \`zip\`, unpacking (\`a, b = b, a\`), comprehensions, \`sorted(..., key=...)\`, \`any\`/\`all\`, \`min\`/\`max\` with \`key\` and \`default\`.
- \`float("inf")\` for sentinels, tuples as dict keys or heap entries (\`(priority, counter, item)\`), \`sys.setrecursionlimit\` or an explicit stack for deep recursion (the default limit is 1000).
- Type hints on the function signature: they document your intent quickly.

Avoid: index-based loops when you don't need the index, \`list.pop(0)\` in a loop (O(n) each), string concatenation in a loop (use \`"".join\`), and catching every exception.

## Complexity of the built-ins
Know these cold. They're the table below, and they decide whether your solution is O(n) or accidentally O(n²).

## Talking through a problem
1. Restate the problem and ask about input sizes, edge cases (empty, duplicates, negatives) and the expected output format.
2. Describe a brute-force approach and its complexity, then improve it. Name the pattern (hash map, two pointers, sliding window, BFS, heap, DP).
3. Write clean code with meaningful names, and talk while you write.
4. Test it by hand with a small example and the edge cases; state the final time and space complexity.

The samples below cover a design favourite (LRU cache), the core algorithm patterns in idiomatic Python, and the "what does this print?" gotchas that come up again and again.
`,
    keyPoints: [
      "Use the standard library: Counter, defaultdict, deque, heapq, bisect, cache",
      "Know the built-ins' complexity: list.pop(0) and x in list are O(n)",
      "Mutable defaults, late-binding closures and [[0]*n]*m are the classic traps",
      "Explain the GIL, generators, decorators and the data model concisely",
      "Restate, brute force, optimize, code, test, state complexity",
      "Practise out loud and under time pressure",
    ],
    complexity: [
      { op: "list: index, len, append, pop()", time: "O(1)", note: "append amortized" },
      { op: "list: insert(0), pop(0), remove, x in list", time: "O(n)", note: "use deque for queues" },
      { op: "list.sort / sorted", time: "O(n log n)", note: "Timsort, stable" },
      { op: "dict / set: get, set, in, delete", time: "O(1) average", note: "O(n) worst case" },
      { op: "deque: append / popleft, both ends", time: "O(1)", note: "indexing the middle is O(n)" },
      { op: "heapq.heappush / heappop", time: "O(log n)", note: "heapify is O(n)" },
      { op: "bisect / insort", time: "O(log n) / O(n)", note: "insort shifts elements" },
      { op: "str concatenation in a loop", time: "O(n²) total", note: "use \"\".join(parts)" },
      { op: "Counter(iterable), most_common(k)", time: "O(n), O(n log k)" },
      { op: "slicing xs[a:b], copying", time: "O(b − a)" },
    ],
    code: [
      {
        title: "Design: an LRU cache, two ways",
        variants: [{ lang: "python", code: `from collections import OrderedDict


class LRUCache:
    """LeetCode 146 with OrderedDict: get and put in O(1)."""

    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.data: OrderedDict[int, int] = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.data:
            return -1
        self.data.move_to_end(key)  # mark as most recently used
        return self.data[key]

    def put(self, key: int, value: int) -> None:
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.capacity:
            self.data.popitem(last=False)  # evict the least recently used (the front)


class Node:
    __slots__ = ("key", "value", "prev", "next")

    def __init__(self, key: int = 0, value: int = 0) -> None:
        self.key, self.value = key, value
        self.prev: Node | None = None
        self.next: Node | None = None


class LRUCacheFromScratch:
    """The version interviewers often ask for: a dict of nodes + a doubly linked list."""

    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.nodes: dict[int, Node] = {}
        self.head, self.tail = Node(), Node()  # sentinels: no None checks at the ends
        self.head.next, self.tail.prev = self.tail, self.head

    def _unlink(self, node: Node) -> None:
        node.prev.next, node.next.prev = node.next, node.prev

    def _push_front(self, node: Node) -> None:
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        node = self.nodes.get(key)
        if node is None:
            return -1
        self._unlink(node)
        self._push_front(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        if key in self.nodes:
            self._unlink(self.nodes[key])
        node = self.nodes[key] = Node(key, value)
        self._push_front(node)
        if len(self.nodes) > self.capacity:
            lru = self.tail.prev
            self._unlink(lru)
            del self.nodes[lru.key]


for cls in (LRUCache, LRUCacheFromScratch):
    cache = cls(2)
    results = []
    cache.put(1, 1)
    cache.put(2, 2)
    results.append(cache.get(1))  # 1, and key 1 becomes most recent
    cache.put(3, 3)  # evicts key 2
    results.append(cache.get(2))  # -1
    cache.put(4, 4)  # evicts key 1
    results += [cache.get(1), cache.get(3), cache.get(4)]
    print(cls.__name__, results)

# For memoizing a function, you don't write any of this: functools.lru_cache does it.
from functools import lru_cache


@lru_cache(maxsize=2)
def square(n: int) -> int:
    return n * n


for n in (1, 2, 1, 3, 2):
    square(n)
print(square.cache_info())` }],
        explain: `LeetCode 146 is one of the most-asked design questions. Both versions run \`get\` and \`put\` in O(1).

**With \`OrderedDict\`**

- The dict remembers order, \`move_to_end\` marks a key as recently used, and \`popitem(last=False)\` evicts the oldest.
- In an interview, mention it first, then offer to build it from scratch.

**From scratch**

- A dict maps keys to nodes of a **doubly linked list** ordered from most to least recently used.
- **Sentinel** head and tail nodes remove all the edge cases at the ends.
- \`_unlink\` and \`_push_front\` are O(1) pointer updates, and eviction removes \`tail.prev\`.
- \`__slots__\` on \`Node\` saves memory when there are many entries.

In real code you rarely write either: \`functools.lru_cache\` memoizes a function, and \`cache_info()\` reports hits and misses.`,
        output: `LRUCache [1, -1, -1, 3, 4]
LRUCacheFromScratch [1, -1, -1, 3, 4]
CacheInfo(hits=1, misses=4, maxsize=2, currsize=2)`,
      },
      {
        title: "Algorithm patterns, the Pythonic way",
        variants: [{ lang: "python", code: `# The standard library turns most interview patterns into a few lines.
import bisect
import heapq
from collections import Counter, defaultdict, deque
from functools import cache


def two_sum(nums: list[int], target: int) -> list[int]:
    seen: dict[int, int] = {}  # value -> index
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []


def longest_unique_substring(s: str) -> int:
    last: dict[str, int] = {}
    start = best = 0
    for i, ch in enumerate(s):  # sliding window
        if last.get(ch, -1) >= start:
            start = last[ch] + 1
        last[ch] = i
        best = max(best, i - start + 1)
    return best


def top_k_frequent(words: list[str], k: int) -> list[str]:
    counts = Counter(words)
    return heapq.nsmallest(k, counts, key=lambda w: (-counts[w], w))  # by count, then alphabetically


def shortest_path(grid: list[str]) -> int:
    """BFS on a grid from S to E; # is a wall. Returns the number of steps, or -1."""
    rows, cols = len(grid), len(grid[0])
    start = next((r, c) for r in range(rows) for c in range(cols) if grid[r][c] == "S")
    queue, seen = deque([(start, 0)]), {start}
    while queue:
        (r, c), dist = queue.popleft()
        if grid[r][c] == "E":
            return dist
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != "#" and (nr, nc) not in seen:
                seen.add((nr, nc))
                queue.append(((nr, nc), dist + 1))
    return -1


def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    merged: list[list[int]] = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def coin_change(coins: list[int], amount: int) -> int:
    @cache  # top-down DP: memoized recursion
    def fewest(rest: int) -> float:
        if rest == 0:
            return 0
        return min((fewest(rest - c) + 1 for c in coins if c <= rest), default=float("inf"))

    result = fewest(amount)
    return -1 if result == float("inf") else int(result)


def course_order(n: int, prerequisites: list[tuple[int, int]]) -> list[int]:
    """Topological sort (Kahn's algorithm). Each pair is (course, required_first)."""
    graph: defaultdict[int, list[int]] = defaultdict(list)
    indegree = [0] * n
    for course, required in prerequisites:
        graph[required].append(course)
        indegree[course] += 1
    ready = deque(i for i in range(n) if indegree[i] == 0)
    order = []
    while ready:
        node = ready.popleft()
        order.append(node)
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                ready.append(nxt)
    return order if len(order) == n else []  # [] means there's a cycle


print(two_sum([2, 7, 11, 15], 9))
print(longest_unique_substring("abcabcbb"), longest_unique_substring("pwwkew"))
print(top_k_frequent("the day is sunny the the the sunny is is".split(), 4))
print(shortest_path(["S.#.", "..#E", "...."]))
print(merge_intervals([[8, 10], [1, 3], [2, 6], [15, 18], [17, 20]]))
print(coin_change([1, 2, 5], 11), coin_change([2], 3))
print(course_order(4, [(1, 0), (2, 0), (3, 1), (3, 2)]), course_order(2, [(0, 1), (1, 0)]))

scores = [12, 25, 37, 48, 60]  # sorted
print(bisect.bisect_left(scores, 37), bisect.bisect_right(scores, 37))  # binary search
bisect.insort(scores, 30)
print(scores)

tasks = []  # a priority queue: (priority, insertion order, item)
for order, (priority, name) in enumerate([(2, "write"), (1, "fix bug"), (3, "lunch"), (1, "review")]):
    heapq.heappush(tasks, (priority, order, name))
print([heapq.heappop(tasks)[2] for _ in range(len(tasks))])` }],
        explain: `- **Hash map**: two-sum stores each value's index and looks up its complement in O(1).
- **Sliding window**: \`last\` remembers where each character was seen; the window start jumps past a repeat.
- **Counting + heap**: \`Counter\` counts, and \`heapq.nsmallest\` with the key \`(-count, word)\` takes the k most frequent, alphabetical on ties.
- **BFS** with a \`deque\` finds the shortest path in a grid. Mark cells as seen when you **enqueue** them, not when you pop them, or they get queued many times.
- **Sorting + sweep** merges intervals.
- **DP with \`@cache\`**: memoized recursion for coin change; \`min(..., default=inf)\` handles amounts no coin fits.
- **Topological sort** (Kahn's algorithm) with in-degrees and a queue. If not every course gets ordered, there's a cycle.
- **\`bisect\`** finds insertion points in a sorted list in O(log n).
- A **priority queue** stores \`(priority, insertion order, item)\` tuples: the counter breaks ties, so items are never compared and equal priorities stay first-in, first-out.`,
        output: `[0, 1]
3 3
['the', 'is', 'sunny', 'day']
6
[[1, 6], [8, 10], [15, 20]]
3 -1
[0, 1, 2, 3] []
2 3
[12, 25, 30, 37, 48, 60]
['fix bug', 'review', 'write', 'lunch']`,
      },
      {
        title: "The gotchas: what does this print?",
        variants: [{ lang: "python", code: `# Classic "what does this print?" questions.

# 1. Mutable default arguments are created once, at definition time.
def append_to(item, target=[]):
    target.append(item)
    return target


print(append_to(1), append_to(2))  # both names point at the SAME list

# 2. Closures see variables, not values (late binding).
print([f() for f in [lambda: i for i in range(3)]])
print([f() for f in [lambda i=i: i for i in range(3)]])  # fix: bind now with a default

# 3. Multiplying a list of lists copies references.
grid = [[0] * 3] * 2
grid[0][0] = 1
print(grid)
grid = [[0] * 3 for _ in range(2)]  # fix: a new inner list per row
grid[0][0] = 1
print(grid)

# 4. += on a list inside a tuple: the list changes, THEN the tuple assignment fails.
t = ([1, 2], "x")
try:
    t[0] += [3]
except TypeError as e:
    print("TypeError:", e, "| but t is now", t)

# 5. Numbers: banker's rounding, floor division and floats.
print(round(2.5), round(3.5), -7 // 2, -7 % 2, 0.1 + 0.2 == 0.3)
import math

print(math.isclose(0.1 + 0.2, 0.3), int(-3.9), math.floor(-3.9))

# 6. Truthiness and short-circuit operators return operands, not booleans.
print(bool("False"), bool([]), [] or "default", 0 and 1 / 0, "a" and "b")

# 7. Equal keys collapse: 1, 1.0 and True are equal and hash the same.
print({1: "int", 1.0: "float", True: "bool"})

# 8. sort() works in place and returns None; sorted() returns a new list.
nums = [3, 1, 2]
print(nums.sort(), nums, sorted("cab"))

# 9. Removing items from a list while iterating over it skips elements.
items = [1, 2, 2, 3]
for x in items:
    if x == 2:
        items.remove(x)
print(items)
items = [1, 2, 2, 3]
print([x for x in items if x != 2])  # fix: build a new list

# 10. Chained comparisons and identity.
x = 5
print(1 < x < 10, 1 < x > 3, [] == [], [] is [])

# 11. dict.fromkeys with a mutable value shares it between keys.
d = dict.fromkeys(["a", "b"], [])
d["a"].append(1)
print(d)

# 12. A variable assigned anywhere in a function is local everywhere in it.
counter = 0


def increment():
    try:
        counter += 1  # noqa: F823 (deliberate)
    except UnboundLocalError as e:
        return type(e).__name__


print(increment())` }],
        explain: `1. The default list is created **once**, when \`def\` runs, and shared by every call. Use \`None\` and create the list inside.
2. Each lambda looks \`i\` up when it's **called**, after the loop ended with \`i == 2\`. A default argument (\`i=i\`) captures the value at definition time.
3. \`[[0] * 3] * 2\` repeats a reference to **one** inner list. Build rows with a comprehension.
4. \`t[0] += [3]\` first calls \`list.__iadd__\`, which extends the list in place and succeeds, then tries to assign the result back into the tuple, which fails. The list changed anyway.
5. \`round\` uses **banker's rounding** (to the nearest even number). \`//\` floors towards negative infinity (\`-7 // 2 == -4\`), and \`%\` takes the sign of the divisor. Floats are binary approximations, so compare them with \`math.isclose\`. \`int()\` truncates towards zero, while \`floor\` rounds down.
6. Any non-empty string is truthy, including \`"False"\`. \`or\` and \`and\` return one of their **operands**, and short-circuit: \`1 / 0\` never runs.
7. \`1 == 1.0 == True\` and they hash the same, so they're one key. The first key object is kept, with the last value.
8. \`list.sort()\` returns \`None\`: \`nums = nums.sort()\` is a classic bug.
9. Removing during iteration shifts the elements, so the loop skips the one after each removal.
10. \`1 < x > 3\` means \`1 < x and x > 3\`. Two empty lists are equal but not the same object.
11. \`dict.fromkeys(keys, [])\` uses the same list object for every key.
12. The assignment makes \`counter\` local to the whole function, so reading it before assigning fails. Declare \`global counter\`, or better, avoid mutable globals.`,
        output: `[1, 2] [1, 2]
[2, 2, 2]
[0, 1, 2]
[[1, 0, 0], [1, 0, 0]]
[[1, 0, 0], [0, 0, 0]]
TypeError: 'tuple' object does not support item assignment | but t is now ([1, 2, 3], 'x')
2 4 -4 1 False
True -3 -4
True False default 0 b
{1: 'bool'}
None [1, 2, 3] ['a', 'b', 'c']
[1, 2, 3]
[1, 3]
True True True False
{'a': [1], 'b': [1]}
UnboundLocalError`,
      },
    ],
    interview: [
      {
        q: "What's the difference between mutable and immutable types, and why does it matter?",
        a: `Immutable objects (\`int\`, \`float\`, \`str\`, \`bytes\`, \`tuple\`, \`frozenset\`) can't change after creation; "modifying" them creates a new object. Mutable ones (\`list\`, \`dict\`, \`set\`, most class instances) change in place, and every name referring to them sees the change. It matters for: **dict keys and set members** (must be hashable, which in practice means immutable), **default arguments** (a mutable default is shared between calls), **function arguments** (a function can mutate a list you pass in), and thread safety (immutable data can be shared freely).`,
        freq: "very-common",
      },
      {
        q: "Is Python pass-by-value or pass-by-reference?",
        a: `Neither exactly: it's **pass by object reference** (call by sharing). The function's parameter is a new name bound to the same object the caller passed. Mutating that object (\`items.append(x)\`) is visible to the caller; **rebinding** the parameter (\`items = [...]\`) only changes the local name. So an \`int\` argument looks like pass-by-value (ints are immutable) and a \`list\` looks like pass-by-reference (unless you reassign it).`,
        freq: "very-common",
      },
      {
        q: "Explain *args and **kwargs, and positional-only and keyword-only parameters.",
        a: `\`*args\` collects extra positional arguments into a tuple, and \`**kwargs\` collects extra keyword arguments into a dict. At a call site, \`*\` and \`**\` unpack sequences and mappings into arguments. In a signature, parameters after \`*\` (or after \`*args\`) are **keyword-only**, and parameters before \`/\` are **positional-only**:
\`\`\`python
def f(a, b, /, c, *, d): ...   # a, b positional-only; c either; d keyword-only
\`\`\`
They're used for flexible wrappers (decorators forwarding \`*args, **kwargs\`), clear APIs (keyword-only flags like \`sorted(key=..., reverse=...)\`), and freedom to rename positional-only parameters later.`,
        freq: "very-common",
      },
      {
        q: "Write a decorator that retries a function, with the number of attempts as a parameter.",
        a: `A decorator with arguments is a function that returns a decorator:
\`\`\`python
import functools, time

def retry(times=3, delay=0.1, exceptions=(Exception,)):
    def decorator(func):
        @functools.wraps(func)             # keep __name__, __doc__...
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions:
                    if attempt == times:
                        raise
                    time.sleep(delay * 2 ** (attempt - 1))
        return wrapper
    return decorator

@retry(times=5, exceptions=(ConnectionError,))
def fetch(url): ...
\`\`\`
Mention \`functools.wraps\`, catching only specific exceptions, exponential backoff, and that \`@retry\` without parentheses wouldn't work with this design.`,
        freq: "very-common",
      },
      {
        q: "What's the difference between a shallow and a deep copy?",
        a: `A **shallow** copy (\`list(xs)\`, \`xs[:]\`, \`dict.copy()\`, \`copy.copy\`) creates a new container holding the **same** element objects: changing a nested list through the copy changes the original's too. A **deep** copy (\`copy.deepcopy\`) recursively copies nested objects, so the copy is fully independent; it handles cycles with a memo dict and can be customized with \`__deepcopy__\`. Deep copies are slower and copy everything, so for nested immutable data a shallow copy is enough.`,
        freq: "very-common",
      },
      {
        q: "How does a Python dict work internally?",
        a: `It's a **hash table**. \`hash(key)\` picks a slot; collisions are resolved by **open addressing** (probing other slots with a perturbation of the hash). Since 3.6 the layout is **compact**: a sparse index array points into a dense array of (hash, key, value) entries, which saves memory and preserves **insertion order** (guaranteed since 3.7). The table resizes when it's about two-thirds full, so insertions are amortized O(1). Lookups compare hashes first, then identity, then \`==\`, which is why keys must be hashable and their hash must not change while they're in the dict.`,
        freq: "common",
      },
      {
        q: "What's the difference between __new__ and __init__?",
        a: `\`__new__\` is a static method that **creates** and returns the instance (it receives the class); \`__init__\` **initializes** the already-created instance (it receives \`self\` and returns \`None\`). You rarely override \`__new__\`: it's needed for subclassing immutable types (\`class Celsius(float)\`, where the value must be set at creation), for controlling instance creation (caching, singletons, returning a subclass), and in metaclasses. If \`__new__\` returns an instance of another class, \`__init__\` isn't called.`,
        freq: "common",
      },
      {
        q: "What happens when you import a module?",
        a: `Python first checks the \`sys.modules\` cache; if the module is already there, it's reused (modules run **once** per process). Otherwise finders search \`sys.path\` (the script's directory, \`PYTHONPATH\`, the standard library, site-packages), a loader creates a module object, inserts it into \`sys.modules\`, and **executes** the module's code top to bottom, using cached bytecode from \`__pycache__\` when the source hasn't changed. This explains \`if __name__ == "__main__":\` (code that runs only when the file is executed directly) and circular-import errors: a module that is half-executed is already in \`sys.modules\`, so another module importing a name from it may not find that name yet.`,
        freq: "common",
      },
      {
        q: "What are Python's scope rules?",
        a: `**LEGB**: a name is looked up in the **L**ocal scope, then the **E**nclosing functions' scopes, then the module's **G**lobal scope, then **B**uilt-ins. Scope is decided at compile time: assigning to a name anywhere in a function makes it local everywhere in that function (hence \`UnboundLocalError\` when reading it before the assignment). \`global x\` and \`nonlocal x\` let a function rebind a module-level or enclosing variable. Comprehensions have their own scope, and loops and \`if\` blocks don't.`,
        freq: "common",
      },
      {
        q: "How does @property work under the hood?",
        a: `Through the **descriptor protocol**. An object defining \`__get__\` (and optionally \`__set__\`/\`__delete__\`) stored as a **class** attribute intercepts attribute access on instances. \`property\` is such a descriptor: \`obj.area\` finds \`area\` on the class, sees a data descriptor, and calls \`property.__get__(obj, type)\`, which calls your getter. Methods work the same way: functions are descriptors whose \`__get__\` returns a bound method, which is how \`self\` gets passed. \`classmethod\`, \`staticmethod\`, \`functools.cached_property\`, \`__slots__\` and ORM columns are all descriptors.`,
        freq: "occasional",
      },
      {
        q: "What is a metaclass, and do you need one?",
        a: `A metaclass is the class of a class: \`type\` by default. When a \`class\` statement runs, the metaclass creates the class object, so it can modify or register classes (Django models and SQLAlchemy's declarative base use one). Usually you don't need one: **\`__init_subclass__\`** (to validate or register subclasses), **class decorators**, and \`__set_name__\` on descriptors cover most use cases with far less magic. Mentioning those alternatives is the senior answer.`,
        freq: "occasional",
      },
      {
        q: "How does sorting work in Python?",
        a: `\`list.sort()\` (in place, returns \`None\`) and \`sorted()\` (new list, any iterable) use **Timsort**, a hybrid of merge sort and insertion sort that finds existing ordered runs: O(n log n) worst case, O(n) on already-sorted data, and **stable** (equal elements keep their relative order). That stability lets you sort by several keys in passes, though a tuple key (\`key=lambda p: (p.age, p.name)\`) is usually simpler. Use \`reverse=True\` rather than negating keys for strings, and \`operator.attrgetter\`/\`itemgetter\` for fast key functions.`,
        freq: "common",
      },
      {
        q: "Is Python interpreted or compiled? Dynamically or statically typed?",
        a: `CPython **compiles** source to bytecode (cached in \`.pyc\` files), and a virtual machine **interprets** that bytecode, specializing hot instructions since 3.11 with an experimental JIT since 3.13. Python is **dynamically** typed (types belong to objects, not variables, and are checked at runtime) and **strongly** typed (\`"1" + 1\` raises \`TypeError\` instead of converting silently). Type hints add optional **static** checking through tools like mypy, without changing runtime behaviour.`,
        freq: "common",
      },
      {
        q: "How do you debug a Python program?",
        a: `Read the full traceback first (3.11+ points at the exact expression). Reproduce the bug with a failing test. Then use \`breakpoint()\` to drop into **pdb** (or the IDE debugger): step with \`n\`/\`s\`, inspect with \`p\`/\`pp\`, walk the stack with \`u\`/\`d\`; \`python -m pdb -c continue script.py\` stops on the crash. Add logging around the suspicious code rather than prints. For hangs and performance, \`py-spy dump --pid\` shows what every thread is doing in a live process without stopping it; \`faulthandler\` prints tracebacks on crashes or deadlocks; \`tracemalloc\` finds memory growth.`,
        freq: "common",
      },
      {
        q: "Explain list comprehensions vs map/filter vs generator expressions.",
        a: `They express the same transformations. **List comprehensions** (\`[f(x) for x in xs if p(x)]\`) are the idiomatic default: readable, fast, and they build a list. \`map\`/\`filter\` return **lazy iterators**; they're concise with an existing function (\`map(str.strip, lines)\`) but awkward with lambdas. **Generator expressions** (\`(f(x) for x in xs)\`) are lazy like map/filter with comprehension syntax: use them when consuming once, especially inside \`sum\`, \`any\`, \`max\` or \`"".join\`. Avoid comprehensions used only for side effects, and nesting deeper than two levels.`,
        freq: "common",
      },
      {
        q: "How would you find the most common words in a 50 GB text file?",
        a: `Stream it: read line by line (never \`read()\` the whole file), normalize and tokenize each line, and update a \`Counter\`. Memory is bounded by the number of **distinct** words, not the file size. If distinct words don't fit in memory either, use a count-min sketch for approximate top-k, or hash-partition words into N temporary files (each word always lands in the same file), count each file separately and merge the per-file top-k. To speed it up, split the file into byte ranges aligned on line boundaries and count them in a \`ProcessPoolExecutor\`, then sum the Counters. At larger scale, this is exactly MapReduce or a Spark job.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "x = [1, 2, 3]; y = x; y += [4]. What is x?",
        options: ["[1, 2, 3]", "[1, 2, 3, 4]", "TypeError", "[4]"],
        answer: 1,
        explain: "x and y name the same list, and += on a list extends it in place.",
      },
      {
        q: "What does print(round(2.5), round(3.5)) print?",
        options: ["3 4", "2 4", "2 3", "3 3"],
        answer: 1,
        explain: "Python rounds halves to the nearest even integer (banker's rounding).",
      },
      {
        q: "What's -7 // 2?",
        options: ["-3", "-4", "-3.5", "3"],
        answer: 1,
        explain: "Floor division rounds towards negative infinity.",
      },
      {
        q: "grid = [[0] * 2] * 2; grid[0][0] = 1. What's grid?",
        options: ["[[1, 0], [0, 0]]", "[[1, 0], [1, 0]]", "[[1, 1], [0, 0]]", "Error"],
        answer: 1,
        explain: "Both rows are the same list object.",
      },
      {
        q: "t = ([1], 2); t[0] += [3]. What happens?",
        options: ["t becomes ([1, 3], 2), no error", "TypeError, and t[0] is still [1]", "TypeError, but t[0] is now [1, 3]", "SyntaxError"],
        answer: 2,
        explain: "list.__iadd__ mutates the list first, then the tuple item assignment raises.",
      },
      {
        q: "What does {1: \"a\", True: \"b\", 1.0: \"c\"} evaluate to?",
        options: ["Three keys", "{1: 'c'}", "{True: 'c'}", "{1.0: 'a'}"],
        answer: 1,
        explain: "1, True and 1.0 are equal with equal hashes: one key, the first key object kept, the last value stored.",
      },
      {
        q: "Which data structure gives O(1) appends and pops at both ends?",
        options: ["list", "collections.deque", "heapq", "tuple"],
        answer: 1,
        explain: "deque is a doubly linked list of blocks; list.pop(0) and insert(0, x) are O(n).",
      },
      {
        q: "print([f() for f in [lambda: i for i in range(3)]]) prints:",
        options: ["[0, 1, 2]", "[2, 2, 2]", "[0, 0, 0]", "NameError"],
        answer: 1,
        explain: "The lambdas look up i when called, after the comprehension finished with i == 2.",
      },
    ],
    problems: [
      { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "Medium", note: "OrderedDict, or dict + doubly linked list" },
      { title: "Min Stack", url: "https://leetcode.com/problems/min-stack/", difficulty: "Medium", note: "store (value, current_min) pairs" },
      { title: "Insert Delete GetRandom O(1)", url: "https://leetcode.com/problems/insert-delete-getrandom-o1/", difficulty: "Medium", note: "list + dict of indexes, swap with last to delete" },
      { title: "Time Based Key-Value Store", url: "https://leetcode.com/problems/time-based-key-value-store/", difficulty: "Medium", note: "defaultdict(list) + bisect" },
      { title: "Find Median from Data Stream", url: "https://leetcode.com/problems/find-median-from-data-stream/", difficulty: "Hard", note: "two heaps (negate values for a max-heap)" },
      { title: "Implement Trie (Prefix Tree)", url: "https://leetcode.com/problems/implement-trie-prefix-tree/", difficulty: "Medium", note: "nested dicts or a Node class with __slots__" },
    ],
  },
];
