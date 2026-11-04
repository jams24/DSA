import type { Lesson } from "../types";

// Python track, part 4: Ecosystem.

export const pyEcosystem: Lesson[] = [
  // ------------------------------------------------------------------ LIBRARIES
  {
    id: "py-libraries",
    stage: "Ecosystem",
    title: "The library toolbox",
    tagline: "uv and virtual environments, then the go-to library in every category: testing, HTTP, validation, databases, data science, CLIs, logging, background jobs, security and performance.",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## The ecosystem is Python's superpower
PyPI hosts over half a million packages, and for almost any task there's a mature, well-documented library. The skill isn't knowing all of them: it's knowing the **standard choice** in each category, when the standard library is enough, and how to evaluate a dependency before adding it.

## Managing dependencies
- **Virtual environments** isolate each project's packages: \`python -m venv .venv\`, or let a tool create one for you. Never \`pip install\` into the system Python.
- **uv** (written in Rust) has become the default modern tool: it installs Python versions, creates environments, resolves and **locks** dependencies (\`uv.lock\`), and runs commands, 10–100× faster than pip. \`uv init\`, \`uv add httpx\`, \`uv run pytest\`, \`uv sync --frozen\` in CI and Docker.
- Alternatives: **pip + pip-tools** (\`requirements.in\` → pinned \`requirements.txt\`), **Poetry** and **PDM** (all-in-one project managers), **conda/pixi** for scientific stacks with non-Python binaries (CUDA, GDAL).
- Pin exact versions for **applications** (a lock file, so every deploy installs the same thing). Use version ranges for **libraries** (so they can coexist with other libraries).
- \`uvx ruff check .\` / \`pipx run\` runs command-line tools in throwaway environments.

## Choosing a library
Before adding a dependency, check: is it actively maintained (recent releases, issues answered)? Does it have type hints? How many transitive dependencies does it pull in? Is the license compatible? Could 20 lines of standard-library code do the job? Every dependency is code you ship and must keep updated, so audit them (\`pip-audit\`, Dependabot or Renovate) and pin them.

## The standard library goes a long way
Before reaching for PyPI, remember what's built in: \`pathlib\`, \`json\`, \`csv\`, \`sqlite3\`, \`tomllib\`, \`logging\`, \`argparse\`, \`datetime\`/\`zoneinfo\`, \`dataclasses\`, \`enum\`, \`collections\`, \`itertools\`, \`functools\`, \`concurrent.futures\`, \`asyncio\`, \`subprocess\`, \`shutil\`, \`tempfile\`, \`urllib.request\`, \`http.server\`, \`unittest.mock\`, \`statistics\`, \`decimal\`, \`secrets\`, \`hashlib\`, \`uuid\`, \`zipfile\`, \`re\`. Many scripts and even small services need nothing else.

## The libraries you'll meet everywhere
The toolbox below lists the go-to choice in each category, what it's for, and what to compare it with. The ones marked **essential** show up in most professional Python codebases: pytest, ruff, mypy or pyright, pydantic, httpx or requests, SQLAlchemy, FastAPI or Django, and, for data work, NumPy and pandas (or Polars).

The samples show four of them in action: an HTTP client with automatic retries, a command-line app with its tests, and a first data analysis with NumPy and pandas.
`,
    keyPoints: [
      "One virtual environment per project; uv to create, lock and sync it",
      "Lock exact versions for apps, use ranges for libraries",
      "Check the standard library first; audit every dependency you add",
      "Essentials: pytest, ruff, mypy, pydantic, httpx, SQLAlchemy, FastAPI/Django",
      "Retry only transient failures, with backoff and a limit",
      "NumPy/pandas/Polars move loops into compiled code",
    ],
    code: [
      {
        title: "A project with uv, from zero to tested",
        variants: [
          {
            lang: "bash",
            code: `# install uv once (see docs.astral.sh/uv), then:
uv python install 3.14          # download a Python if you don't have it
uv init weather --package        # src layout + pyproject.toml + .python-version
cd weather
uv add httpx pydantic            # runtime dependencies -> pyproject.toml + uv.lock
uv add --dev pytest ruff mypy    # development-only tools
uv run pytest                    # runs inside .venv (created and synced automatically)
uv run ruff check --fix . && uv run ruff format .
uv tree                          # the dependency tree
uv lock --upgrade-package httpx  # upgrade one package deliberately
uv sync --frozen --no-dev        # CI / Docker: exactly what uv.lock says, no dev tools
uvx pip-audit                    # run a tool without installing it into the project`,
          },
        ],
        explain: `- \`uv init --package\` creates a \`src/\` layout with a \`pyproject.toml\` that's ready to build.
- \`uv add\` edits \`pyproject.toml\` **and** updates \`uv.lock\`, the lock file listing the exact version and hash of every package (including transitive ones). Commit both.
- \`uv run\` makes sure \`.venv\` matches the lock file, then runs the command inside it, so there's no "activate" step to forget.
- \`--frozen\` fails if the lock file is out of date instead of re-resolving: what you want for reproducible CI builds and Docker images.
- The pip equivalent is \`python -m venv .venv\`, \`source .venv/bin/activate\`, \`pip install -r requirements.txt\`, with \`pip-tools\` (\`pip-compile\`) producing the pinned requirements file.`,
      },
      {
        title: "HTTP with httpx, and retries with tenacity",
        note: "Needs httpx and tenacity. The API is mocked, so it runs offline.",
        variants: [{ lang: "python", code: `import json

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

attempts = {"/items": 0}


# A fake API (no network needed): /items fails with 503 twice, then succeeds.
def fake_api(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/items":
        attempts["/items"] += 1
        if attempts["/items"] < 3:
            return httpx.Response(503, json={"detail": "busy"})
        page = int(request.url.params["page"])
        return httpx.Response(200, json={"page": page, "items": ["a", "b"], "auth": request.headers["authorization"]})
    if request.url.path == "/orders" and request.method == "POST":
        return httpx.Response(201, json={"id": 42, **json.loads(request.content)})
    return httpx.Response(404, json={"detail": "not found"})


def is_transient(exc: BaseException) -> bool:
    """Retry network errors and 5xx responses; never retry 4xx (the request itself is wrong)."""
    if isinstance(exc, httpx.TransportError):
        return True
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500


def log_retry(state) -> None:
    exc = state.outcome.exception()
    print(f"  attempt {state.attempt_number} failed with {exc.response.status_code}, retrying")


@retry(
    retry=retry_if_exception(is_transient),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=0.01, max=0.1),  # 10 ms, 20 ms, 40 ms... (use seconds in real code)
    before_sleep=log_retry,
    reraise=True,  # after the last attempt, raise the original exception
)
def get_items(client: httpx.Client, page: int) -> dict:
    response = client.get("/items", params={"page": page})
    response.raise_for_status()
    return response.json()


with httpx.Client(
    base_url="https://api.example.com",
    headers={"Authorization": "Bearer test-token"},  # sent with every request
    timeout=httpx.Timeout(5.0, connect=2.0),
    transport=httpx.MockTransport(fake_api),
) as client:
    print("GET /items:")
    print(" ", get_items(client, page=2))

    created = client.post("/orders", json={"sku": "BOOK-1", "qty": 2})
    print("POST /orders:", created.status_code, created.json())

    try:
        client.get("/nope").raise_for_status()
    except httpx.HTTPStatusError as e:
        print("GET /nope:", e.response.status_code, e.response.json()["detail"], "(not retried)")` }],
        explain: `- The \`httpx.Client\` is created once with a \`base_url\`, default headers (the auth token) and **timeouts**; requests reuse its connection pool.
- \`params=\` builds the query string and \`json=\` serializes the body and sets \`Content-Type\`.
- \`@retry\` re-runs \`get_items\` when \`is_transient\` says the failure is worth retrying: network errors and 5xx responses. The first two attempts get 503, the third succeeds.
- \`wait_exponential\` doubles the delay after each failure (scaled down to milliseconds here). In production add **jitter** (\`wait_random_exponential\`) so many clients don't retry in lockstep, and keep \`stop_after_attempt\` small.
- 4xx errors like the 404 are **not** retried: repeating a bad request can't fix it. Only retry operations that are safe to repeat (GETs, or writes with an idempotency key).
- \`requests\` has an almost identical synchronous API; httpx adds async support, HTTP/2 and the mock transport used for testing.`,
        output: `GET /items:
  attempt 1 failed with 503, retrying
  attempt 2 failed with 503, retrying
  {'page': 2, 'items': ['a', 'b'], 'auth': 'Bearer test-token'}
POST /orders: 201 {'id': 42, 'sku': 'BOOK-1', 'qty': 2}
GET /nope: 404 not found (not retried)`,
      },
      {
        title: "A command-line app with click, tested with CliRunner",
        note: "Needs click.",
        variants: [{ lang: "python", code: `import json
from pathlib import Path

import click
from click.testing import CliRunner


@click.group()
@click.option("--db", type=click.Path(path_type=Path), default="todos.json", show_default=True, help="Where todos are stored.")
@click.pass_context
def cli(ctx: click.Context, db: Path) -> None:
    """A tiny todo manager."""
    ctx.obj = db


def load(db: Path) -> list[dict]:
    return json.loads(db.read_text(encoding="utf-8")) if db.exists() else []


def save(db: Path, todos: list[dict]) -> None:
    db.write_text(json.dumps(todos, indent=2), encoding="utf-8")


@cli.command()
@click.argument("title")
@click.option("--priority", "-p", type=click.IntRange(1, 5), default=3, show_default=True)
@click.pass_obj
def add(db: Path, title: str, priority: int) -> None:
    """Add a todo."""
    todos = load(db)
    todos.append({"id": len(todos) + 1, "title": title, "priority": priority, "done": False})
    save(db, todos)
    click.echo(f"added #{len(todos)}: {title}")


@cli.command("list")
@click.option("--all", "show_all", is_flag=True, help="Include finished todos.")
@click.pass_obj
def list_todos(db: Path, show_all: bool) -> None:
    """List todos, highest priority first."""
    for t in sorted(load(db), key=lambda t: (-t["priority"], t["id"])):
        if show_all or not t["done"]:
            click.echo(f"[{'x' if t['done'] else ' '}] #{t['id']} p{t['priority']} {t['title']}")


@cli.command()
@click.argument("todo_id", type=int)
@click.pass_obj
def done(db: Path, todo_id: int) -> None:
    """Mark a todo as done."""
    todos = load(db)
    for t in todos:
        if t["id"] == todo_id:
            t["done"] = True
            save(db, todos)
            click.echo(f"finished #{todo_id}")
            return
    raise click.ClickException(f"no todo #{todo_id}")  # message on stderr, exit code 1


# CliRunner invokes the CLI in-process: how you test command-line apps.
runner = CliRunner()
with runner.isolated_filesystem():  # a temporary working directory
    for args in (
        ["add", "write tests"],
        ["add", "ship v1", "-p", "5"],
        ["add", "refactor", "--priority", "1"],
        ["done", "1"],
        ["list"],
        ["list", "--all"],
        ["done", "9"],
        ["add", "x", "-p", "7"],
    ):
        result = runner.invoke(cli, args)
        print(f"$ todo {' '.join(args)}  (exit {result.exit_code})")
        print("  " + result.output.strip().replace("\\n", "\\n  "))` }],
        explain: `- \`@click.group()\` makes \`cli\` a command with sub-commands (\`add\`, \`list\`, \`done\`), like \`git\`. The group's \`--db\` option is stored in \`ctx.obj\` and passed to each sub-command by \`@click.pass_obj\`.
- Arguments and options are declared with decorators; click converts and validates them (\`type=int\`, \`IntRange(1, 5)\`, \`is_flag=True\`) and generates \`--help\` from the docstrings.
- \`ClickException\` prints \`Error: ...\` and exits with code 1; invalid input exits with code 2 and a usage message, as the last command shows.
- \`CliRunner.invoke\` runs the CLI in-process and captures the output and exit code, inside \`isolated_filesystem()\` so the JSON file doesn't touch your real directory. That's how you write pytest tests for a CLI.
- In a real package, \`[project.scripts] todo = "todo.cli:cli"\` in pyproject.toml installs a \`todo\` command. **Typer** builds the same kind of CLI from type hints instead of decorators.`,
        output: `$ todo add write tests  (exit 0)
  added #1: write tests
$ todo add ship v1 -p 5  (exit 0)
  added #2: ship v1
$ todo add refactor --priority 1  (exit 0)
  added #3: refactor
$ todo done 1  (exit 0)
  finished #1
$ todo list  (exit 0)
  [ ] #2 p5 ship v1
  [ ] #3 p1 refactor
$ todo list --all  (exit 0)
  [ ] #2 p5 ship v1
  [x] #1 p3 write tests
  [ ] #3 p1 refactor
$ todo done 9  (exit 1)
  Error: no todo #9
$ todo add x -p 7  (exit 2)
  Usage: cli add [OPTIONS] TITLE
  Try 'cli add --help' for help.
  
  Error: Invalid value for '--priority' / '-p': 7 is not in the range 1<=x<=5.`,
      },
      {
        title: "First steps with NumPy and pandas",
        note: "Needs numpy and pandas.",
        variants: [{ lang: "python", code: `import numpy as np
import pandas as pd

# NumPy: typed arrays and vectorized math (loops run in C, not in Python).
prices = np.array([19.99, 5.49, 3.75, 12.00, 7.25])
quantities = np.array([2, 10, 4, 1, 6])
totals = prices * quantities  # element-wise, no Python loop
print(totals.round(2), "sum:", round(float(totals.sum()), 2))
print("orders over 30:", totals[totals > 30].round(2))  # boolean mask
print("mean, std:", round(float(totals.mean()), 2), round(float(totals.std()), 2))
grid = np.arange(12).reshape(3, 4)
print("column sums:", grid.sum(axis=0), "| row max:", grid.max(axis=1))

# pandas: labelled tables (DataFrames) for analysis.
orders = pd.DataFrame(
    {
        "date": pd.to_datetime(["2026-01-03", "2026-01-03", "2026-01-10", "2026-02-01", "2026-02-07", "2026-02-07"]),
        "region": ["EU", "US", "EU", "US", "EU", "APAC"],
        "product": ["book", "pen", "pen", "book", "book", "pen"],
        "qty": [2, 10, 4, 1, 6, 3],
        "price": [19.99, 1.50, 1.50, 19.99, 18.50, 1.75],
    }
)
orders["total"] = (orders["qty"] * orders["price"]).round(2)  # a new column, vectorized
print(orders.head(3).to_string(index=False))

by_region = orders.groupby("region")["total"].agg(["count", "sum"]).sort_values("sum", ascending=False)
print(by_region.round(2).to_string())

big_books = orders[(orders["product"] == "book") & (orders["qty"] >= 2)]  # filtering
print("big book orders:", big_books["total"].tolist())

monthly = orders.pivot_table(index=orders["date"].dt.strftime("%Y-%m"), columns="product", values="total", aggfunc="sum", fill_value=0)
print(monthly.round(2).to_string())

regions = pd.DataFrame({"region": ["EU", "US", "APAC"], "manager": ["Ana", "Bo", "Chen"]})
merged = by_region.reset_index().merge(regions, on="region", how="left")  # SQL-style join
print(merged[["region", "manager", "sum"]].round(2).to_string(index=False))` }],
        explain: `- NumPy arrays hold values of one type in contiguous memory. \`prices * quantities\` multiplies element by element in C: no Python loop, typically 10–100× faster.
- \`totals[totals > 30]\` filters with a **boolean mask**; \`axis=0\` aggregates down the columns, \`axis=1\` across the rows.
- A pandas **DataFrame** is a table of named columns (each a NumPy-backed series). New columns are computed from whole columns at once.
- \`groupby("region")["total"].agg(["count", "sum"])\` is SQL's \`GROUP BY\`; \`pivot_table\` spreads one column's values into columns (a spreadsheet pivot); \`merge\` is a SQL join.
- Combine filter conditions with \`&\` and \`|\` and parentheses, not \`and\`/\`or\`.
- For bigger data or more speed, **Polars** offers a similar DataFrame with a lazy, multi-threaded query engine, and **DuckDB** runs SQL directly on DataFrames and Parquet files.`,
        output: `[39.98 54.9  15.   12.   43.5 ] sum: 165.38
orders over 30: [39.98 54.9  43.5 ]
mean, std: 33.08 16.75
column sums: [12 15 18 21] | row max: [ 3  7 11]
      date region product  qty  price  total
2026-01-03     EU    book    2  19.99  39.98
2026-01-03     US     pen   10   1.50  15.00
2026-01-10     EU     pen    4   1.50   6.00
        count     sum
region               
EU          3  156.98
US          2   34.99
APAC        1    5.25
big book orders: [39.98, 111.0]
product    book    pen
date                  
2026-01   39.98  21.00
2026-02  130.99   5.25
region manager    sum
    EU     Ana 156.98
    US      Bo  34.99
  APAC    Chen   5.25`,
      },
    ],
    toolbox: [
      {
        category: "Packaging and environments",
        blurb: "One isolated environment per project, with locked dependencies.",
        libs: [
          { name: "uv", what: "Extremely fast installer, resolver, lock-file manager, Python-version manager and tool runner, written in Rust.", when: "The default for new projects: replaces pip, venv, pip-tools, pipx and pyenv with one tool.", tag: "essential" },
          { name: "pip + venv", what: "The installer and environment module that ship with Python.", when: "Always available; pair with pip-tools for pinned requirements files.", tag: "standard" },
          { name: "Poetry", what: "Project manager with dependency resolution, a lock file and publishing.", when: "Common in existing projects; uv and PDM are the newer alternatives.", tag: "popular" },
          { name: "pipx", what: "Installs command-line tools, each in its own environment.", when: "Global tools like ruff, black or httpie; `uvx` does the same on the fly.", tag: "popular" },
          { name: "conda / pixi", what: "Package managers for Python plus non-Python binaries (CUDA, GDAL, compilers).", when: "Scientific and ML stacks with native dependencies.", tag: "popular" },
        ],
      },
      {
        category: "Code quality",
        blurb: "Format, lint and type-check automatically, locally and in CI.",
        libs: [
          { name: "ruff", what: "Linter and formatter in Rust, implementing hundreds of rules (flake8, isort, pyupgrade, bugbear...) and a Black-compatible formatter.", when: "Every project: `ruff check --fix` and `ruff format`.", tag: "essential" },
          { name: "mypy", what: "The reference static type checker.", when: "Type-check in CI; enable `strict` gradually.", tag: "essential" },
          { name: "pyright / basedpyright", what: "Fast type checker that also powers VS Code's Pylance.", when: "Editor integration and large codebases. Astral's ty and Meta's pyrefly are new Rust-based checkers to watch.", tag: "popular" },
          { name: "pre-commit", what: "Runs hooks (ruff, mypy, secret scanners) before each commit.", when: "Catch problems before they reach review.", tag: "essential" },
          { name: "Black", what: "The opinionated formatter that ended style debates.", when: "Still common; ruff format produces nearly identical output much faster.", tag: "popular" },
        ],
      },
      {
        category: "Testing",
        libs: [
          { name: "pytest", what: "The test framework: plain asserts, fixtures, parametrize, plugins.", when: "Always. unittest is in the standard library but more verbose.", tag: "essential" },
          { name: "coverage.py / pytest-cov", what: "Measures which lines and branches your tests execute.", when: "CI coverage reports; aim for meaningful coverage of logic, not 100%.", tag: "essential" },
          {
            name: "Hypothesis",
            what: "Property-based testing: generates hundreds of inputs and shrinks failures to a minimal example.",
            when: "Parsers, serializers, algorithms: anything with invariants.",
            tag: "popular",
            snippet: {
              lang: "python",
              code: `from hypothesis import given, strategies as st

@given(st.lists(st.integers()))
def test_sorting_is_idempotent(xs):
    assert sorted(sorted(xs)) == sorted(xs)`,
            },
          },
          { name: "pytest-asyncio / anyio", what: "Run `async def` tests and fixtures.", when: "Testing asyncio code (FastAPI apps, async clients).", tag: "popular" },
          { name: "respx / pytest-httpx / responses", what: "Mock HTTP calls made with httpx or requests.", when: "Unit-testing API clients without a network.", tag: "popular" },
          { name: "nox / tox", what: "Run test sessions across several Python versions and environments.", when: "Libraries supporting multiple Python versions.", tag: "popular" },
        ],
      },
      {
        category: "HTTP clients and resilience",
        libs: [
          { name: "httpx", what: "Modern HTTP client with sync and async APIs, HTTP/2, timeouts and mock transports.", when: "New code, especially async. Nearly the same API as requests.", tag: "essential" },
          { name: "requests", what: "The classic synchronous HTTP client.", when: "Scripts and synchronous apps; enormous ecosystem.", tag: "essential" },
          { name: "aiohttp", what: "Async HTTP client and server.", when: "High-throughput async clients, websockets.", tag: "popular" },
          { name: "tenacity", what: "Retry decorator with stop, wait (exponential, jitter) and retry conditions.", when: "Calls to flaky networks and services.", tag: "popular" },
        ],
      },
      {
        category: "Web frameworks",
        blurb: "See the next chapter for all three in action.",
        libs: [
          { name: "FastAPI", what: "Async API framework driven by type hints: pydantic validation, dependency injection, automatic OpenAPI docs.", when: "JSON APIs, microservices, ML model serving.", tag: "essential" },
          { name: "Django", what: "Full-stack framework: ORM, migrations, admin, auth, templates, forms.", when: "Database-backed products, back offices, content sites.", tag: "essential" },
          { name: "Django REST framework", what: "Serializers, viewsets, routers, auth and browsable APIs for Django.", when: "REST APIs on top of a Django project. Django Ninja is a FastAPI-style alternative.", tag: "popular" },
          { name: "Flask", what: "Minimal WSGI micro-framework with a large extension ecosystem.", when: "Small services and apps where you choose every piece.", tag: "essential" },
          { name: "Starlette / Litestar", what: "Lightweight ASGI toolkit (FastAPI's foundation) / a batteries-included FastAPI alternative.", when: "Fine-grained control or a different opinionated stack.", tag: "rising" },
        ],
      },
      {
        category: "Servers",
        libs: [
          { name: "uvicorn", what: "The standard ASGI server, built on uvloop and httptools.", when: "Serving FastAPI/Starlette/Django ASGI apps; `--workers N` for multiple processes.", tag: "essential" },
          { name: "gunicorn", what: "Pre-fork WSGI server with process management.", when: "Flask and Django in production; can also manage uvicorn workers.", tag: "essential" },
          { name: "granian", what: "Rust-based server for ASGI, WSGI and RSGI.", when: "When you want one fast server for both interfaces.", tag: "rising" },
        ],
      },
      {
        category: "Validation, serialization and settings",
        libs: [
          { name: "pydantic", what: "Data validation and serialization from type hints, with a Rust core.", when: "Request bodies, configs, external data, LLM structured output.", tag: "essential" },
          { name: "pydantic-settings", what: "Typed settings loaded from environment variables and .env files.", when: "Twelve-factor configuration for services.", tag: "popular" },
          { name: "attrs", what: "The library that inspired dataclasses, with validators and converters.", when: "Rich classes without pydantic's parsing semantics.", tag: "popular" },
          { name: "msgspec", what: "Very fast JSON/MessagePack serialization with typed structs.", when: "Hot paths where pydantic's overhead shows up.", tag: "rising" },
          { name: "orjson", what: "The fastest JSON library, with native dataclass, datetime and NumPy support.", when: "Large JSON payloads; FastAPI can use it via ORJSONResponse.", tag: "popular" },
        ],
      },
      {
        category: "Databases",
        libs: [
          { name: "SQLAlchemy", what: "SQL toolkit and ORM: Core expressions, a typed ORM, sessions, sync and async.", when: "The default for relational databases outside Django.", tag: "essential" },
          { name: "Alembic", what: "Schema migrations for SQLAlchemy, autogenerated from model changes.", when: "Every SQLAlchemy project that evolves its schema.", tag: "essential" },
          { name: "psycopg 3 / asyncpg", what: "PostgreSQL drivers; psycopg supports sync and async, asyncpg is async-only and very fast.", when: "Talking to PostgreSQL (directly or under SQLAlchemy).", tag: "essential" },
          { name: "SQLModel", what: "SQLAlchemy + pydantic models in one class, by FastAPI's author.", when: "Small FastAPI projects that want one model for API and table.", tag: "rising" },
          { name: "redis-py", what: "Redis client with asyncio support.", when: "Caching, rate limiting, queues, distributed locks.", tag: "essential" },
          { name: "sqlite3", what: "SQLite in the standard library.", when: "Local tools, tests, embedded storage; surprisingly capable in production for read-heavy apps.", tag: "standard" },
        ],
      },
      {
        category: "Background jobs and scheduling",
        libs: [
          {
            name: "Celery",
            what: "Distributed task queue with retries, scheduling (beat), routing and result backends over Redis or RabbitMQ.",
            when: "Emails, reports, webhooks: anything that shouldn't run inside a web request.",
            tag: "popular",
            snippet: {
              lang: "python",
              code: `from celery import Celery

app = Celery("tasks", broker="redis://localhost:6379/0")

@app.task(bind=True, max_retries=3, default_retry_delay=10)
def send_welcome_email(self, user_id: int) -> None:
    try:
        mailer.send_welcome(user_id)
    except TemporaryMailError as exc:
        raise self.retry(exc=exc)

send_welcome_email.delay(42)  # enqueue; \`celery -A tasks worker\` runs it`,
            },
          },
          { name: "RQ / Dramatiq / arq", what: "Simpler queues: RQ (Redis, sync), Dramatiq (reliable defaults), arq (asyncio).", when: "When Celery feels heavy.", tag: "popular" },
          { name: "APScheduler", what: "In-process cron-like and interval scheduling.", when: "Periodic jobs inside a single service.", tag: "popular" },
        ],
      },
      {
        category: "Data and science",
        libs: [
          { name: "NumPy", what: "N-dimensional arrays and vectorized math; the foundation of scientific Python.", when: "Any numeric computation.", tag: "essential" },
          { name: "pandas", what: "DataFrames: load, clean, join, group and reshape tabular data.", when: "Data analysis, ETL, notebooks.", tag: "essential" },
          {
            name: "Polars",
            what: "Fast DataFrame library in Rust with a lazy, multi-threaded query engine.",
            when: "Larger data or performance-sensitive pipelines.",
            tag: "rising",
            snippet: {
              lang: "python",
              code: `import polars as pl

revenue = (
    pl.scan_csv("orders.csv")          # lazy: builds a query plan
    .filter(pl.col("qty") > 0)
    .group_by("region")
    .agg(pl.col("total").sum().alias("revenue"), pl.len().alias("orders"))
    .sort("revenue", descending=True)
    .collect()                          # optimizes and runs in parallel
)`,
            },
          },
          { name: "DuckDB", what: "In-process analytical SQL database that queries CSV, Parquet and DataFrames directly.", when: "SQL analytics on local files without a server.", tag: "rising" },
          { name: "SciPy / statsmodels", what: "Scientific algorithms (optimization, signal, stats) and statistical models.", when: "Engineering and statistics beyond NumPy.", tag: "popular" },
          { name: "matplotlib / seaborn / Plotly", what: "Plotting: the classic, statistical charts on top of it, and interactive web charts.", when: "Visualizing data in notebooks, reports and dashboards.", tag: "popular" },
          { name: "Jupyter", what: "Interactive notebooks mixing code, output and prose.", when: "Exploration and teaching; move stable code into modules.", tag: "popular" },
        ],
      },
      {
        category: "Machine learning and AI",
        libs: [
          { name: "scikit-learn", what: "Classic machine learning: preprocessing, models, pipelines, evaluation.", when: "Tabular ML, baselines, feature engineering.", tag: "essential" },
          { name: "PyTorch", what: "The dominant deep-learning framework.", when: "Training and fine-tuning neural networks.", tag: "essential" },
          { name: "Hugging Face transformers", what: "Pre-trained models and tokenizers for text, vision and audio.", when: "Using or fine-tuning open models.", tag: "popular" },
          { name: "LLM provider SDKs", what: "Official clients for model APIs (anthropic, openai...), with streaming and tool use.", when: "Building LLM features; validate structured output with pydantic.", tag: "rising" },
        ],
      },
      {
        category: "Command-line apps and terminal output",
        libs: [
          { name: "argparse", what: "The standard library's argument parser.", when: "Scripts without dependencies.", tag: "standard" },
          { name: "click", what: "Composable CLIs with decorators, groups and a test runner.", when: "Multi-command tools.", tag: "popular" },
          {
            name: "Typer",
            what: "CLIs from type hints, built on click.",
            when: "The fastest way to a polished CLI.",
            tag: "popular",
            snippet: {
              lang: "python",
              code: `import typer

app = typer.Typer()

@app.command()
def greet(name: str, count: int = 1, shout: bool = False) -> None:
    for _ in range(count):
        typer.echo(name.upper() if shout else f"Hello {name}")

if __name__ == "__main__":
    app()  # python greet.py Ada --count 2 --shout`,
            },
          },
          {
            name: "Rich / Textual",
            what: "Colours, tables, progress bars and tracebacks in the terminal / full terminal UIs.",
            when: "Any tool humans read the output of.",
            tag: "popular",
            snippet: {
              lang: "python",
              code: `from rich.console import Console
from rich.table import Table

table = Table("Service", "Status")
table.add_row("api", "[green]up")
table.add_row("worker", "[red]down")
Console().print(table)`,
            },
          },
          { name: "tqdm", what: "Progress bars for any iterable.", when: "Long loops in scripts and notebooks.", tag: "popular" },
        ],
      },
      {
        category: "Logging and observability",
        libs: [
          { name: "logging", what: "The standard logging framework every library uses.", when: "Always; configure handlers and format once at startup.", tag: "standard" },
          {
            name: "structlog",
            what: "Structured logging: key-value events, JSON output, context binding.",
            when: "Services whose logs are searched in Loki, Elasticsearch or Datadog.",
            tag: "popular",
            snippet: {
              lang: "python",
              code: `import structlog

log = structlog.get_logger().bind(request_id="r-81f")
log.info("order_placed", order_id=42, total=99.5)
# dev:  ... [info] order_placed  order_id=42 request_id=r-81f total=99.5
# prod: {"event": "order_placed", "order_id": 42, ...} with a JSONRenderer`,
            },
          },
          { name: "loguru", what: "Logging with zero configuration and nice defaults.", when: "Scripts and small apps.", tag: "popular" },
          { name: "OpenTelemetry", what: "Vendor-neutral traces, metrics and logs, with auto-instrumentation for frameworks and clients.", when: "Distributed tracing across services.", tag: "essential" },
          { name: "sentry-sdk / prometheus-client", what: "Error tracking with context / metrics exposed for Prometheus.", when: "Production services.", tag: "popular" },
        ],
      },
      {
        category: "Files, text and formats",
        libs: [
          { name: "Jinja2", what: "The template engine behind Flask, Ansible and many generators.", when: "HTML, emails, config files from templates.", tag: "essential" },
          { name: "PyYAML / tomli-w", what: "YAML reading and writing / writing TOML (reading is built in via tomllib).", when: "Config files.", tag: "popular" },
          { name: "Pillow", what: "Image opening, resizing, conversion and drawing.", when: "Thumbnails, image processing.", tag: "popular" },
          { name: "openpyxl / python-docx / pypdf", what: "Read and write Excel, Word and PDF files.", when: "Office automation and reports.", tag: "popular" },
          { name: "Beautiful Soup / lxml / Playwright", what: "HTML parsing / fast XML and HTML / browser automation.", when: "Scraping (respect robots.txt and terms) and end-to-end tests.", tag: "popular" },
        ],
      },
      {
        category: "Security",
        libs: [
          { name: "secrets / hashlib / hmac", what: "Secure tokens, hashing (including scrypt) and message authentication in the standard library.", when: "Tokens, signatures, password hashing with hashlib.scrypt.", tag: "standard" },
          { name: "cryptography", what: "Modern cryptographic recipes (Fernet) and primitives.", when: "Encryption, certificates, key handling.", tag: "essential" },
          { name: "argon2-cffi / bcrypt", what: "Password hashing with memory-hard algorithms.", when: "Storing user passwords.", tag: "popular" },
          { name: "PyJWT", what: "Encode and verify JSON Web Tokens.", when: "Token-based API authentication.", tag: "popular" },
          { name: "pip-audit / bandit", what: "Known-vulnerability scanning of dependencies / security linting of code.", when: "CI security checks.", tag: "popular" },
        ],
      },
      {
        category: "Performance",
        libs: [
          { name: "py-spy / Scalene / memray", what: "Sampling CPU profiler for live processes / CPU+memory profiler / memory allocation tracker.", when: "Finding real bottlenecks and leaks.", tag: "popular" },
          { name: "Cython / mypyc", what: "Compile Python (with type hints) to C extensions.", when: "Hot loops that must stay in Python syntax.", tag: "popular" },
          { name: "PyO3 + maturin", what: "Write Python extensions in Rust and build wheels.", when: "Performance-critical cores; how ruff, pydantic-core and Polars are built.", tag: "rising" },
          { name: "Numba", what: "JIT-compiles numeric Python functions with a decorator.", when: "NumPy-heavy loops that can't be vectorized.", tag: "popular" },
        ],
      },
    ],
    interview: [
      {
        q: "How do you manage dependencies in a Python project?",
        a: `One **virtual environment** per project, never the system Python. Declare dependencies in \`pyproject.toml\` and **lock** the full resolved set (\`uv.lock\`, \`poetry.lock\`, or \`pip-compile\` output) so every machine and deploy installs identical versions. Separate dev dependencies (pytest, ruff) from runtime ones. Applications pin exact versions; libraries declare compatible ranges. Keep dependencies updated with Dependabot or Renovate, scan them with \`pip-audit\`, and install from the lock file in CI and Docker (\`uv sync --frozen\`).`,
        freq: "very-common",
      },
      {
        q: "requests or httpx?",
        a: `Both are excellent with nearly the same API. **requests** is synchronous, ubiquitous and stable. **httpx** adds an async client (\`AsyncClient\`), optional HTTP/2, strict default timeouts, and transports for testing; it's the natural choice in async code (FastAPI uses it in its \`TestClient\`). Whichever you use: create one client/session and reuse it for connection pooling, always set timeouts, and handle retries for transient failures explicitly.`,
        freq: "common",
      },
      {
        q: "When would you use pandas, Polars or plain Python?",
        a: `Plain Python (lists, dicts, \`csv\`, \`collections.Counter\`) for small data or record-by-record logic. **pandas** for interactive analysis and tabular transformations on data that fits in memory, with its huge ecosystem (plotting, IO formats, scikit-learn). **Polars** when data is larger or speed matters: a lazy query optimizer and multi-threaded execution often make it many times faster with less memory. **DuckDB** when SQL is the most natural language for the question. For data larger than one machine: Spark, Dask or a data warehouse.`,
        freq: "occasional",
      },
      {
        q: "How would you retry a failing HTTP call safely?",
        a: `Retry only **transient** failures (timeouts, connection errors, 429 and 5xx), never other 4xx. Use **exponential backoff with jitter**, a small maximum number of attempts, and an overall deadline; honour \`Retry-After\` headers. Only retry **idempotent** operations, or send an idempotency key with writes so the server can deduplicate. Log each retry, and consider a circuit breaker so a dead dependency isn't hammered. Libraries: tenacity, or the retry options of httpx transports and urllib3.`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What's the main purpose of a lock file like uv.lock?",
        options: ["Faster imports", "Recording the exact versions of every dependency so installs are reproducible", "Preventing other users from editing pyproject.toml", "Encrypting dependencies"],
        answer: 1,
        explain: "A lock file pins the whole resolved dependency tree, including transitive packages and hashes.",
      },
      {
        q: "Which tool both lints and formats Python code, written in Rust?",
        options: ["pylint", "ruff", "mypy", "isort"],
        answer: 1,
        explain: "ruff implements most flake8-family rules, isort and a Black-compatible formatter.",
      },
      {
        q: "An API returns 400 Bad Request. Should your client retry?",
        options: ["Yes, with exponential backoff", "No, the request itself is invalid; retrying won't help", "Yes, immediately, 10 times", "Only on Mondays"],
        answer: 1,
        explain: "Retry transient errors (timeouts, 429, 5xx), not client errors.",
      },
      {
        q: "In pandas, how do you filter rows where qty > 2 AND region == \"EU\"?",
        options: ["df[df.qty > 2 and df.region == \"EU\"]", "df[(df.qty > 2) & (df.region == \"EU\")]", "df.filter(qty > 2, region=\"EU\")", "df[df.qty > 2][df.region == \"EU\"] only"],
        answer: 1,
        explain: "Element-wise conditions combine with & and |, each wrapped in parentheses; `and` raises an error on Series.",
      },
      {
        q: "Which is the right place for a 30-second report generation triggered by a web request?",
        options: ["Inside the request handler", "A background job queue such as Celery or RQ", "A daemon thread started per request", "The browser"],
        answer: 1,
        explain: "Long work goes to a queue processed by workers; the request returns immediately (202 Accepted plus a status URL).",
      },
    ],
  },

  // ------------------------------------------------------------------ WEB
  {
    id: "py-web",
    stage: "Ecosystem",
    title: "Web services: WSGI, ASGI, FastAPI, Django and Flask",
    tagline: "How Python web apps are served, WSGI and ASGI from scratch, a FastAPI CRUD API, SQLAlchemy 2.0, Flask's app factory and blueprints, and Django with REST framework.",
    difficulty: "advanced",
    minutes: 50,
    diagram: {
      title: "A request through a production Python web service",
      nodes: [
        { id: "client", label: "Client", kind: "client", x: 90, y: 280, sub: "browser, mobile app, other service" },
        { id: "lb", label: "nginx / load balancer", kind: "lb", x: 250, y: 280, sub: "TLS, static files, routing" },
        { id: "server", label: "uvicorn / gunicorn", kind: "worker", x: 430, y: 280, sub: "N worker processes" },
        { id: "app", label: "ASGI / WSGI app", kind: "service", x: 620, y: 280, sub: "FastAPI · Django · Flask" },
        { id: "db", label: "PostgreSQL", kind: "db", x: 850, y: 150, sub: "via SQLAlchemy or the Django ORM" },
        { id: "cache", label: "Redis", kind: "cache", x: 850, y: 320, sub: "cache, sessions, rate limits" },
        { id: "queue", label: "Task broker", kind: "queue", x: 620, y: 470, sub: "Redis / RabbitMQ" },
        { id: "worker", label: "Celery workers", kind: "worker", x: 850, y: 470, sub: "emails, reports, webhooks" },
        { id: "ext", label: "Third-party APIs", kind: "external", x: 430, y: 90, sub: "payments, email, LLMs (httpx)" },
      ],
      edges: [
        { from: "client", to: "lb", label: "HTTPS" },
        { from: "lb", to: "server", label: "HTTP" },
        { from: "server", to: "app", label: "ASGI / WSGI call" },
        { from: "app", to: "cache", label: "GET / SET" },
        { from: "app", to: "db", label: "SQL (pooled)" },
        { from: "app", to: "queue", label: "enqueue job" },
        { from: "queue", to: "worker", label: "deliver" },
        { from: "worker", to: "db", label: "read / write", dashed: true },
        { from: "app", to: "ext", label: "httpx + timeouts", dashed: true },
      ],
      flows: [
        {
          name: "GET /books/42 (cache miss)",
          path: ["client", "lb", "server", "app", "cache", "app", "db", "app", "server", "lb", "client"],
          steps: [
            "The client sends an HTTPS request. The load balancer terminates TLS and picks a healthy server.",
            "nginx forwards plain HTTP to one of the server's worker processes (one per CPU core, to get past the GIL).",
            "uvicorn parses the HTTP request, builds an ASGI scope and awaits the app. FastAPI routes it to get_book, validating book_id as an int.",
            "The handler first checks Redis for a cached copy of book 42.",
            "Cache miss: nothing stored yet (or it expired).",
            "The service queries PostgreSQL through a pooled connection. In an async app the event loop serves other requests while it waits.",
            "The row comes back; the handler stores it in Redis with a TTL and converts it to the response schema.",
            "FastAPI serializes the pydantic model to JSON and sends the ASGI response messages.",
            "uvicorn writes the HTTP response to the connection.",
            "The load balancer returns it to the client: 200 OK with the book as JSON.",
          ],
        },
        {
          name: "POST /signup (background work)",
          path: ["client", "lb", "server", "app", "db", "app", "queue", "worker", "db"],
          steps: [
            "The client posts a sign-up form.",
            "The request reaches a worker process.",
            "The app validates the body with a pydantic schema (422 with field errors if it's invalid).",
            "The user is inserted in a transaction; a unique constraint on email rejects duplicates.",
            "The transaction commits.",
            "Instead of sending the welcome email inside the request (slow, and failure-prone), the app enqueues a job and immediately returns 201.",
            "A Celery worker picks the job up, sends the email, and retries with backoff if the email provider is down.",
            "The worker records that the email was sent.",
          ],
        },
      ],
    },
    concept: `
## How a Python web app is served
Python web frameworks don't listen on sockets themselves. A **server** process accepts connections, parses HTTP, and calls your **application** through a standard interface:
- **WSGI** (PEP 3333, synchronous): the app is \`app(environ, start_response)\` and returns the body. One request occupies one worker thread or process until it's done. Servers: **gunicorn**, uWSGI, mod_wsgi. Frameworks: **Flask**, **Django**, Pyramid, Bottle.
- **ASGI** (asynchronous): the app is \`async app(scope, receive, send)\` and exchanges messages. One worker handles thousands of concurrent connections, plus websockets and streaming. Servers: **uvicorn**, hypercorn, granian. Frameworks: **FastAPI**, **Starlette**, Django (via \`asgi.py\`), Litestar, Quart.

In production you typically run several **worker processes** (one per CPU core, to get around the GIL) behind a reverse proxy or load balancer (nginx, a cloud LB) that terminates TLS and serves static files: for example \`uvicorn app:app --workers 4\`, or gunicorn managing uvicorn workers (\`gunicorn -k uvicorn_worker.UvicornWorker -w 4 app:app\`).

## The three big frameworks
| | **FastAPI** | **Django** | **Flask** |
|---|---|---|---|
| Style | API-first, async, type-hint driven | batteries-included full stack | minimal micro-framework |
| Validation | pydantic models from type hints | forms, DRF serializers | add marshmallow or pydantic |
| Database | bring your own (SQLAlchemy, SQLModel) | built-in ORM + migrations | Flask-SQLAlchemy |
| Extras | automatic OpenAPI docs, dependency injection | admin site, auth, sessions, templates | huge extension ecosystem |
| Best for | JSON APIs, microservices, ML model serving | content sites, back offices, SaaS products | small services, prototypes, full control |

All three are excellent and widely used. FastAPI is the most common choice for new APIs; Django dominates when you need users, an admin and a database-backed site quickly; Flask is the simplest to understand end to end.

## Layering a service
Whatever the framework, keep the HTTP layer thin:
1. **Routes / views** parse the request, call the service, and map results and errors to HTTP status codes.
2. **Schemas** (pydantic models, DRF serializers) validate input and shape output. Never return ORM objects or internal fields directly.
3. **Services** hold the business rules, independent of HTTP, so they're easy to test.
4. **Repositories** (or the ORM) talk to the database.

Configuration comes from environment variables (pydantic-settings, django-environ), database schemas change through migrations (**Alembic** for SQLAlchemy, Django's built-in \`makemigrations\`), and slow work (emails, reports) goes to a background queue (**Celery**, RQ, Dramatiq, arq) rather than running inside the request.

## Databases from Python
- **SQLAlchemy 2.0**: the standard toolkit. Core builds SQL with Python expressions; the ORM maps classes to tables with \`Mapped[...]\` type hints, and a \`Session\` tracks changes and commits them as one transaction. Works with PostgreSQL, MySQL, SQLite and more, synchronously or with \`asyncio\`.
- **The N+1 problem**: loading a list and then touching a relationship on each item issues one query per item. Use eager loading (\`selectinload\`, \`joinedload\` in SQLAlchemy; \`select_related\`, \`prefetch_related\` in Django). Count queries in tests.
- Always use **parameterized queries** (the ORM does it for you; with raw SQL pass parameters separately, never f-strings), use a **connection pool**, keep transactions short, and add indexes for the columns you filter and sort by.

The diagram above follows a request through a typical production deployment.
`,
    keyPoints: [
      "Servers (uvicorn, gunicorn) call apps through WSGI (sync) or ASGI (async)",
      "Run several worker processes behind a reverse proxy",
      "FastAPI for APIs, Django for full products, Flask for small services",
      "Thin routes, pydantic schemas, service layer, repositories",
      "SQLAlchemy 2.0: typed models, sessions as units of work, eager loading against N+1",
      "Slow work goes to a task queue, configuration comes from the environment",
    ],
    code: [
      {
        title: "WSGI from scratch: what Flask and Django really are",
        variants: [{ lang: "python", code: `import io
import json
import time
from wsgiref.util import setup_testing_defaults


# WSGI (PEP 3333): an app is a callable(environ, start_response) returning an iterable of bytes.
# Flask and Django are WSGI apps; gunicorn, uWSGI and mod_wsgi are WSGI servers.
def app(environ, start_response):
    method, path = environ["REQUEST_METHOD"], environ["PATH_INFO"]
    if method == "GET" and path == "/health":
        status, body = "200 OK", {"status": "ok"}
    elif method == "POST" and path == "/echo":
        size = int(environ.get("CONTENT_LENGTH") or 0)
        data = json.loads(environ["wsgi.input"].read(size) or b"{}")
        status, body = "200 OK", {"you_sent": data}
    else:
        status, body = "404 Not Found", {"error": f"no route for {method} {path}"}
    payload = json.dumps(body).encode()
    start_response(status, [("Content-Type", "application/json"), ("Content-Length", str(len(payload)))])
    return [payload]


# Middleware is just an app that wraps another app.
def timing_middleware(inner):
    def wrapped(environ, start_response):
        start = time.perf_counter()

        def start_response_with_timing(status, headers):
            elapsed_ms = (time.perf_counter() - start) * 1000
            return start_response(status, headers + [("Server-Timing", f"app;dur={elapsed_ms:.1f}")])

        return inner(environ, start_response_with_timing)

    return wrapped


wrapped_app = timing_middleware(app)


# What a WSGI server does for each request: build environ, call the app, send the response.
def call(method: str, path: str, body: dict | None = None):
    environ: dict = {}
    setup_testing_defaults(environ)
    raw = json.dumps(body).encode() if body is not None else b""
    environ.update(REQUEST_METHOD=method, PATH_INFO=path, CONTENT_LENGTH=str(len(raw)))
    environ["wsgi.input"] = io.BytesIO(raw)
    response = {}

    def start_response(status, headers):
        response["status"], response["headers"] = status, dict(headers)

    chunks = wrapped_app(environ, start_response)
    return response["status"], response["headers"], b"".join(chunks).decode()


for method, path, body in [("GET", "/health", None), ("POST", "/echo", {"n": 1}), ("DELETE", "/users/7", None)]:
    status, headers, text = call(method, path, body)
    print(f"{method} {path} -> {status} {text} | timed: {'Server-Timing' in headers}")

# To serve it for real (one request at a time, development only):
#   from wsgiref.simple_server import make_server
#   make_server("127.0.0.1", 8000, wrapped_app).serve_forever()
# In production:  gunicorn --workers 4 myapp:wrapped_app` }],
        explain: `- A WSGI application is any callable taking \`environ\` (a dict with the method, path, headers and an input stream) and \`start_response\` (a callback for the status and headers), returning the body as an iterable of bytes.
- Routing is just looking at \`REQUEST_METHOD\` and \`PATH_INFO\`. Reading the body uses \`CONTENT_LENGTH\` and \`wsgi.input\`.
- **Middleware** wraps an app in another app with the same signature: here it intercepts \`start_response\` to add a \`Server-Timing\` header. Django and Flask middleware, Sentry and WhiteNoise all work this way.
- \`call\` plays the role of the server: build \`environ\`, call the app, collect status, headers and body. gunicorn does exactly this for every request, in each of its worker processes.`,
        output: `GET /health -> 200 OK {"status": "ok"} | timed: True
POST /echo -> 200 OK {"you_sent": {"n": 1}} | timed: True
DELETE /users/7 -> 404 Not Found {"error": "no route for DELETE /users/7"} | timed: True`,
      },
      {
        title: "ASGI from scratch: streaming and concurrency",
        variants: [{ lang: "python", code: `import asyncio
import json
import time


# ASGI: an app is an async callable(scope, receive, send). FastAPI, Starlette, Django (asgi.py)
# and Quart are ASGI apps; uvicorn, hypercorn and granian are ASGI servers.
async def app(scope, receive, send):
    assert scope["type"] == "http"  # (websocket and lifespan scopes exist too)
    path = scope["path"]
    if path == "/slow":
        await asyncio.sleep(0.1)  # e.g. a database query: the server handles other requests meanwhile
        await respond(send, 200, {"done": True})
    elif path == "/stream":
        # Streaming: send the body in chunks as they're produced (server-sent events, big downloads).
        await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"text/plain")]})
        for i in range(3):
            await send({"type": "http.response.body", "body": f"chunk {i}\\n".encode(), "more_body": True})
        await send({"type": "http.response.body", "body": b"", "more_body": False})
    elif path == "/echo":
        body = b""
        while True:  # the request body may arrive in several messages
            message = await receive()
            body += message.get("body", b"")
            if not message.get("more_body"):
                break
        await respond(send, 200, {"you_sent": json.loads(body)})
    else:
        await respond(send, 404, {"error": "not found"})


async def respond(send, status: int, data: dict) -> None:
    payload = json.dumps(data).encode()
    await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": payload})


# What an ASGI server does for each request (here, without any sockets).
async def call(method: str, path: str, body: bytes = b"") -> tuple[int, list[bytes]]:
    scope = {"type": "http", "method": method, "path": path, "headers": [], "query_string": b""}
    chunks_in = [{"type": "http.request", "body": body[:4], "more_body": True}, {"type": "http.request", "body": body[4:]}]
    sent: list[dict] = []

    async def receive():
        return chunks_in.pop(0)

    async def send(message):
        sent.append(message)

    await app(scope, receive, send)
    status = sent[0]["status"]
    return status, [m["body"] for m in sent[1:] if m["body"]]


async def main() -> None:
    print(await call("POST", "/echo", b'{"hello": "asgi"}'))
    print(await call("GET", "/stream"))
    print(await call("GET", "/missing"))
    start = time.perf_counter()
    results = await asyncio.gather(*(call("GET", "/slow") for _ in range(10)))
    elapsed = time.perf_counter() - start
    print(f"10 slow requests: {[r[0] for r in results].count(200)} OK, concurrently: {elapsed < 0.3}")


asyncio.run(main())
# Serve it for real:  uvicorn myapp:app --port 8000` }],
        explain: `- An ASGI app is an \`async\` callable receiving a \`scope\` (connection info), a \`receive\` function (incoming messages such as body chunks) and a \`send\` function (outgoing messages).
- A response is two kinds of messages: \`http.response.start\` with the status and headers, then one or more \`http.response.body\` messages. \`more_body: True\` keeps the response open, which makes streaming natural (\`/stream\` sends three chunks).
- The request body can arrive in pieces too: the fake server splits it after 4 bytes, and \`/echo\` loops until \`more_body\` is false.
- Ten \`/slow\` requests each await 0.1 s of "database time", but run concurrently on one thread: ~0.1 s in total. A synchronous WSGI worker would need ten threads or processes for that.
- FastAPI and Starlette build routing, validation and dependency injection on top of exactly this interface.`,
        output: `(200, [b'{"you_sent": {"hello": "asgi"}}'])
(200, [b'chunk 0\\n', b'chunk 1\\n', b'chunk 2\\n'])
(404, [b'{"error": "not found"}'])
10 slow requests: 10 OK, concurrently: True`,
      },
      {
        title: "A CRUD API with FastAPI",
        note: "Needs fastapi (pip install \"fastapi[standard]\"). Not run by this site's test runner.",
        variants: [{ lang: "python", code: `from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field


# Schemas: pydantic models validate requests and shape responses (and document them in OpenAPI).
class BookIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1)
    year: int | None = Field(default=None, ge=1450, le=2100)


class Book(BookIn):
    id: int


# A repository behind a dependency, so tests can swap it out.
class BookRepo:
    def __init__(self) -> None:
        self._books: dict[int, Book] = {}
        self._next_id = 1

    def add(self, data: BookIn) -> Book:
        book = Book(id=self._next_id, **data.model_dump())
        self._books[book.id] = book
        self._next_id += 1
        return book

    def get(self, book_id: int) -> Book | None:
        return self._books.get(book_id)

    def search(self, author: str | None, limit: int) -> list[Book]:
        books = [b for b in self._books.values() if author is None or b.author == author]
        return books[:limit]

    def delete(self, book_id: int) -> bool:
        return self._books.pop(book_id, None) is not None


repo = BookRepo()


def get_repo() -> BookRepo:
    return repo


Repo = Annotated[BookRepo, Depends(get_repo)]
app = FastAPI(title="Books API", version="1.0.0")


@app.post("/books", status_code=status.HTTP_201_CREATED)
def create_book(data: BookIn, books: Repo) -> Book:  # body parsed and validated from JSON
    return books.add(data)


@app.get("/books")
def list_books(
    books: Repo,
    author: str | None = None,  # query parameter: /books?author=...
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[Book]:
    return books.search(author, limit)


@app.get("/books/{book_id}")
def get_book(book_id: int, books: Repo) -> Book:  # path parameter, converted to int
    book = books.get(book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, books: Repo) -> None:
    if not books.delete(book_id):
        raise HTTPException(status_code=404, detail="Book not found")


if __name__ == "__main__":
    client = TestClient(app)
    r = client.post("/books", json={"title": "Dune", "author": "Frank Herbert", "year": 1965})
    print(r.status_code, r.json())
    client.post("/books", json={"title": "Children of Dune", "author": "Frank Herbert"})
    print(client.get("/books", params={"author": "Frank Herbert", "limit": 1}).json())
    print(client.get("/books/99").status_code, client.get("/books/99").json())
    bad = client.post("/books", json={"title": "", "author": "X", "year": 3000})
    print(bad.status_code, [error["loc"] for error in bad.json()["detail"]])
    print(client.delete("/books/1").status_code, client.get("/books/1").status_code)
    print(sorted(client.get("/openapi.json").json()["paths"]))
    # Serve it:  fastapi dev fastapi_app.py   or   uvicorn fastapi_app:app --reload` }],
        explain: `- \`BookIn\` describes what clients send; \`Book\` adds the server-generated \`id\`. FastAPI reads the type hints: a pydantic parameter is the JSON **body**, a name in the path is a **path parameter**, other simple types are **query parameters**.
- \`Annotated[BookRepo, Depends(get_repo)]\` is **dependency injection**: FastAPI calls \`get_repo()\` per request and passes the result. Dependencies can themselves depend on others (a DB session, the current user) and tests replace them with \`app.dependency_overrides[get_repo] = lambda: FakeRepo()\`.
- The return annotation (\`-> Book\`, \`-> list[Book]\`) validates and **filters** the response, so internal fields can't leak.
- \`HTTPException(404)\` becomes a JSON error. Invalid input never reaches your function: FastAPI answers **422** with every problem listed.
- The handlers are plain \`def\`, so FastAPI runs them in a thread pool; write \`async def\` only when the body awaits async libraries (an async DB driver, httpx.AsyncClient), and never call blocking code inside \`async def\`.
- \`/docs\` serves interactive Swagger UI generated from \`/openapi.json\`.

Running it prints:
\`\`\`text
201 {'title': 'Dune', 'author': 'Frank Herbert', 'year': 1965, 'id': 1}
[{'title': 'Dune', 'author': 'Frank Herbert', 'year': 1965, 'id': 1}]
404 {'detail': 'Book not found'}
422 [['body', 'title'], ['body', 'year']]
204 404
['/books', '/books/{book_id}']
\`\`\``,
      },
      {
        title: "SQLAlchemy 2.0: models, sessions, queries and the N+1 problem",
        note: "Needs sqlalchemy. Uses an in-memory SQLite database.",
        variants: [{ lang: "python", code: `from sqlalchemy import ForeignKey, String, create_engine, event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, selectinload


class Base(DeclarativeBase):
    pass


class Author(Base):
    __tablename__ = "authors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    books: Mapped[list["Book"]] = relationship(back_populates="author", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Author({self.name!r})"


class Book(Base):
    __tablename__ = "books"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    year: Mapped[int | None]  # nullable because of the Optional type
    author_id: Mapped[int] = mapped_column(ForeignKey("authors.id"))
    author: Mapped[Author] = relationship(back_populates="books")


engine = create_engine("sqlite:///:memory:")  # e.g. "postgresql+psycopg://user:pass@host/db"
Base.metadata.create_all(engine)  # in real projects, Alembic migrations create the tables

statements = 0


@event.listens_for(engine, "before_cursor_execute")
def count_sql(*args) -> None:
    global statements
    statements += 1


# A unit of work: commits at the end of the block, rolls back if it raises.
with Session(engine) as session, session.begin():
    session.add_all(
        [
            Author(name="Ursula K. Le Guin", books=[Book(title="A Wizard of Earthsea", year=1968), Book(title="The Dispossessed", year=1974)]),
            Author(name="Frank Herbert", books=[Book(title="Dune", year=1965)]),
            Author(name="Octavia E. Butler", books=[Book(title="Kindred", year=1979), Book(title="Parable of the Sower", year=1993)]),
        ]
    )

with Session(engine) as session:
    # 2.0-style queries: select() + session.scalars / session.execute
    old = session.scalars(select(Book).where(Book.year < 1970).order_by(Book.year)).all()
    print("before 1970:", [(b.year, b.title) for b in old])

    counts = session.execute(
        select(Author.name, func.count(Book.id)).join(Author.books).group_by(Author.name).order_by(func.count(Book.id).desc(), Author.name)
    ).all()
    print("books per author:", counts)

    dune = session.scalars(select(Book).filter_by(title="Dune")).one()
    print("lazy-loaded relationship:", dune.author)

with Session(engine) as session:
    statements = 0
    for author in session.scalars(select(Author)):  # 1 query...
        len(author.books)  # ...plus 1 per author when .books is first touched: the N+1 problem
    print("N+1 pattern, statements:", statements)

    session.expunge_all()
    statements = 0
    for author in session.scalars(select(Author).options(selectinload(Author.books))):
        len(author.books)  # already loaded by a single extra IN query
    print("with selectinload, statements:", statements)

# Constraint violations roll the transaction back.
try:
    with Session(engine) as session, session.begin():
        session.add(Author(name="Frank Herbert"))
except IntegrityError:
    print("duplicate author rejected, transaction rolled back")

with Session(engine) as session, session.begin():
    butler = session.scalars(select(Author).filter_by(name="Octavia E. Butler")).one()
    session.delete(butler)  # cascade deletes her books too
with Session(engine) as session:
    print("books left:", session.scalar(select(func.count()).select_from(Book)))` }],
        explain: `- Models subclass \`DeclarativeBase\`; \`Mapped[int]\` and \`mapped_column(...)\` declare typed columns (\`Mapped[int | None]\` is nullable). \`relationship(back_populates=...)\` links both sides, and \`cascade="all, delete-orphan"\` deletes an author's books with the author.
- \`with Session(engine) as session, session.begin():\` is a **unit of work**: everything added in the block is flushed and committed at the end, or rolled back if an exception escapes.
- 2.0-style queries are built with \`select()\` and run with \`session.scalars()\` (one entity per row) or \`session.execute()\` (tuples). The join + \`group_by\` + \`func.count\` compiles to the SQL you'd expect.
- Touching \`dune.author\` triggers a **lazy load**: a query at attribute access. In a loop over authors, that becomes **N+1** queries (1 + 3 here). \`selectinload(Author.books)\` loads all the books in one extra \`IN\` query: 2 statements, whatever the number of authors.
- The unique constraint on \`name\` raises \`IntegrityError\`, and the transaction is rolled back automatically.
- For async apps, \`create_async_engine\` and \`AsyncSession\` offer the same API with \`await\`. Schema changes in real projects go through **Alembic** migrations, not \`create_all\`.`,
        output: `before 1970: [(1965, 'Dune'), (1968, 'A Wizard of Earthsea')]
books per author: [('Octavia E. Butler', 2), ('Ursula K. Le Guin', 2), ('Frank Herbert', 1)]
lazy-loaded relationship: Author('Frank Herbert')
N+1 pattern, statements: 4
with selectinload, statements: 2
duplicate author rejected, transaction rolled back
books left: 3`,
      },
      {
        title: "Flask: application factory, blueprints and the test client",
        note: "Needs Flask (pip install flask).",
        variants: [{ lang: "python", code: `from flask import Blueprint, Flask, abort, jsonify, request


def create_app(config: dict | None = None) -> Flask:
    """Application factory: build a fresh app (with its own config) for each test or process."""
    app = Flask(__name__)
    app.config.update(config or {})
    todos: dict[int, dict] = {}  # in a real app: a database through Flask-SQLAlchemy

    bp = Blueprint("todos", __name__, url_prefix="/todos")

    @bp.get("")
    def list_todos():
        done = request.args.get("done")  # query string: /todos?done=true
        items = [t for t in todos.values() if done is None or t["done"] == (done == "true")]
        return jsonify(items)

    @bp.post("")
    def create_todo():
        data = request.get_json(silent=True) or {}
        title = str(data.get("title", "")).strip()
        if not title:
            abort(400, description="title is required")
        todo = {"id": len(todos) + 1, "title": title, "done": False}
        todos[todo["id"]] = todo
        return jsonify(todo), 201, {"Location": f"/todos/{todo['id']}"}

    @bp.patch("/<int:todo_id>")  # the int converter rejects /todos/abc with a 404
    def update_todo(todo_id: int):
        todo = todos.get(todo_id) or abort(404, description=f"todo {todo_id} not found")
        todo["done"] = bool((request.get_json(silent=True) or {}).get("done", todo["done"]))
        return jsonify(todo)

    app.register_blueprint(bp)

    @app.errorhandler(400)
    @app.errorhandler(404)
    def json_error(error):  # JSON errors instead of Flask's default HTML pages
        return jsonify(error=error.description), error.code

    return app


app = create_app({"TESTING": True})
client = app.test_client()  # sends requests to the app without a server

r = client.post("/todos", json={"title": "learn Flask"})
print(r.status_code, r.get_json(), r.headers["Location"])
client.post("/todos", json={"title": "deploy"})
bad = client.post("/todos", json={})
print(bad.status_code, bad.get_json())
print(client.patch("/todos/1", json={"done": True}).get_json())
print(client.get("/todos?done=false").get_json())
print(client.patch("/todos/99", json={}).get_json(), client.get("/todos/abc").status_code)
# Run for real:  flask --app flask_app run --debug    (production: gunicorn "flask_app:create_app()")` }],
        explain: `- The **application factory** \`create_app(config)\` builds a new app each time it's called, so tests get isolated apps with their own configuration, and the production server calls it once per process.
- A **Blueprint** groups related routes (\`/todos\`) and is registered on the app; large Flask apps are a set of blueprints.
- \`request.get_json(silent=True)\` parses the body (returning \`None\` instead of failing on bad JSON); \`request.args\` holds the query string. Returning a tuple \`(body, status, headers)\` sets the status and a \`Location\` header.
- \`abort(404, description=...)\` raises an HTTP error; the \`errorhandler\`s turn errors into JSON instead of HTML pages.
- \`<int:todo_id>\` is a URL converter: \`/todos/abc\` doesn't match the route at all.
- Flask's JSON provider sorts keys by default, hence \`done, id, title\` in the output.`,
        output: `201 {'done': False, 'id': 1, 'title': 'learn Flask'} /todos/1
400 {'error': 'title is required'}
{'done': True, 'id': 1, 'title': 'learn Flask'}
[{'done': False, 'id': 2, 'title': 'deploy'}]
{'error': 'todo 99 not found'} 404`,
      },
      {
        title: "Django and Django REST framework",
        note: "Fragments of a Django project, shown file by file.",
        noCheck: "Fragments of a multi-file Django project",
        variants: [{ lang: "python", code: `# Fragments of a Django project: \`django-admin startproject library\` + \`python manage.py startapp books\`

# books/models.py: tables defined as classes; migrations are generated from them
from django.db import models


class Author(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self) -> str:
        return self.name


class Book(models.Model):
    title = models.CharField(max_length=200)
    year = models.PositiveIntegerField(null=True, blank=True)
    author = models.ForeignKey(Author, on_delete=models.CASCADE, related_name="books")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["year"])]


# books/admin.py: a full CRUD back office in four lines
from django.contrib import admin


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "year"]
    search_fields = ["title", "author__name"]


# books/serializers.py: Django REST framework converts models <-> JSON and validates input
from rest_framework import serializers


class BookSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.name", read_only=True)

    class Meta:
        model = Book
        fields = ["id", "title", "year", "author", "author_name", "created_at"]
        read_only_fields = ["created_at"]

    def validate_year(self, value):
        if value is not None and value > 2100:
            raise serializers.ValidationError("year is in the future")
        return value


# books/views.py: a ViewSet gives list, create, retrieve, update and destroy
from rest_framework import filters, permissions, viewsets


class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.select_related("author")  # one JOIN instead of N+1 queries
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "author__name"]
    ordering_fields = ["year", "created_at"]


# books/urls.py (included from library/urls.py with path("api/", include("books.urls")))
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("books", BookViewSet)  # /api/books/ and /api/books/<pk>/
urlpatterns = router.urls

# The ORM, e.g. in \`python manage.py shell\`:
#   Book.objects.filter(year__lt=1970).order_by("year")
#   Author.objects.annotate(n=models.Count("books")).filter(n__gte=2)
#   Book.objects.filter(author__name__icontains="herbert").update(year=1965)` }],
        explain: `- **Models** define tables. \`makemigrations\` compares them with the existing migrations and generates a new migration file; \`migrate\` applies it. \`ForeignKey(..., related_name="books")\` gives \`author.books.all()\`.
- Registering a model with the **admin** produces a complete back-office UI with search and filters.
- A DRF **ModelSerializer** generates fields and validation from the model; \`validate_<field>\` adds rules, and \`source="author.name"\` flattens a related field into the output.
- A **ModelViewSet** implements list, create, retrieve, update, partial update and destroy; the **router** generates the URLs. Permissions, search and ordering are declared as class attributes.
- \`select_related("author")\` makes the ORM fetch authors with a JOIN, avoiding N+1 queries when the serializer reads \`author.name\`.

The workflow:
\`\`\`bash
django-admin startproject library . && python manage.py startapp books
python manage.py makemigrations && python manage.py migrate
python manage.py createsuperuser
python manage.py runserver          # http://127.0.0.1:8000/admin and /api/books/
python manage.py test               # or pytest with pytest-django
\`\`\``,
      },
    ],
    interview: [
      {
        q: "What's the difference between WSGI and ASGI?",
        a: `Both are interfaces between Python web servers and applications. **WSGI** (PEP 3333) is synchronous: the server calls \`app(environ, start_response)\` and the app returns the full response; each in-flight request occupies a worker thread or process. **ASGI** is its async successor: \`await app(scope, receive, send)\` exchanges messages, so one process can handle thousands of concurrent connections, plus websockets, server-sent events and streaming bodies. Flask and classic Django use WSGI (gunicorn); FastAPI, Starlette and Django's async views use ASGI (uvicorn).`,
        freq: "common",
      },
      {
        q: "FastAPI, Django or Flask: how do you choose?",
        a: `**FastAPI** for API-first services: type-hint-driven validation with pydantic, async support, dependency injection and generated OpenAPI docs, but you assemble the database layer, auth and admin yourself. **Django** when you need a full product quickly: ORM, migrations, admin, auth, forms and a mature ecosystem (DRF for APIs); its conventions help large teams. **Flask** for small services and maximum flexibility, choosing each extension. Also weigh the team's experience and the existing codebase.`,
        freq: "very-common",
      },
      {
        q: "What is the N+1 query problem and how do you fix it?",
        a: `Loading N parent rows with one query, then lazily loading a relationship for each one, issues N more queries: 1 + N round-trips instead of 1 or 2. It's invisible in development with 5 rows and slow in production with 5,000. Fix it with **eager loading**: \`selectinload\`/\`joinedload\` in SQLAlchemy, \`select_related\` (JOIN for foreign keys) and \`prefetch_related\` (separate IN query for many-to-many and reverse relations) in Django. Detect it by logging or counting queries in tests (\`django-debug-toolbar\`, \`assertNumQueries\`, SQLAlchemy event listeners).`,
        freq: "very-common",
      },
      {
        q: "How do you deploy a Python web app to production?",
        a: `Build a Docker image from a slim Python base, installing dependencies from the lock file (multi-stage build, non-root user). Run an ASGI/WSGI server with several worker processes (\`uvicorn --workers N\` or gunicorn) behind a reverse proxy or load balancer handling TLS. Configure everything through environment variables, run database migrations as a separate release step, serve static files from a CDN or WhiteNoise, add health-check endpoints, structured logs, metrics and tracing (OpenTelemetry), error tracking (Sentry), and scale horizontally behind the load balancer. Background work goes to Celery or another queue with its own workers.`,
        freq: "common",
      },
      {
        q: "Should FastAPI endpoints be def or async def?",
        a: `Use \`async def\` only if everything slow inside it is awaited (async DB driver, \`httpx.AsyncClient\`, \`asyncio.sleep\`); then it runs directly on the event loop. Use plain \`def\` if it calls blocking libraries (\`requests\`, a sync DB driver, heavy CPU work): FastAPI runs \`def\` endpoints in a thread pool so they don't block the loop. The worst option is \`async def\` calling blocking code, which stalls every other request on that worker.`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which interface lets one Python process serve thousands of concurrent websocket connections?",
        options: ["WSGI", "ASGI", "CGI", "FastCGI"],
        answer: 1,
        explain: "ASGI is asynchronous and message-based, supporting long-lived connections like websockets.",
      },
      {
        q: "Why run several uvicorn or gunicorn worker processes on one machine?",
        options: ["To use multiple CPU cores despite the GIL, and survive a worker crash", "Because one process can't open sockets", "To save memory", "It's required by HTTP/1.1"],
        answer: 0,
        explain: "Each process has its own interpreter and GIL, so N workers can use N cores.",
      },
      {
        q: "In FastAPI, a handler parameter typed with a pydantic model is read from:",
        options: ["The query string", "The JSON request body", "A cookie", "The path"],
        answer: 1,
        explain: "Pydantic models are body parameters; simple types are path parameters if they appear in the path, query parameters otherwise.",
      },
      {
        q: "What status does FastAPI return when the request body fails validation?",
        options: ["400", "404", "422", "500"],
        answer: 2,
        explain: "422 Unprocessable Content, with a detail list giving each error's location and message.",
      },
      {
        q: "for author in authors: print(author.books) with lazy loading and 100 authors issues how many queries?",
        options: ["1", "2", "101", "100 × 100"],
        answer: 2,
        explain: "One for the authors plus one per author: the N+1 problem. selectinload makes it 2.",
      },
      {
        q: "Where should you send a welcome email triggered by sign-up?",
        options: ["Synchronously in the request handler", "To a background task queue, after the user row is committed", "From the browser", "In a database trigger"],
        answer: 1,
        explain: "Queue it after commit so the request stays fast and failures can be retried independently.",
      },
    ],
  },
];
