import type { Lesson } from "../types";

// Go track, part 4: Ecosystem.

export const goEcosystem: Lesson[] = [
  // ------------------------------------------------------------------ LIBRARIES
  {
    id: "go-libraries",
    stage: "Ecosystem",
    title: "Modules, tooling and the library ecosystem",
    tagline: "Managing dependencies with Go modules, the everyday toolchain (vet, staticcheck, golangci-lint, govulncheck), and a curated map of the libraries Go teams actually use.",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## Stdlib first
Go's culture prefers the standard library and small, focused dependencies over big frameworks. Before adding a module, check whether \`net/http\`, \`encoding/json\`, \`log/slog\`, \`database/sql\`, \`testing\` or \`slices\`/\`maps\` already covers it. Every dependency is code you ship, update and audit.

When you do need one, judge it on [pkg.go.dev](https://pkg.go.dev): the "Imported by" count, recent releases, license, a tagged v1+ version and how small its own dependency tree is.

## Go modules in practice
A **module** is a tree of packages with a \`go.mod\` at its root:
\`\`\`text
module github.com/you/notes        // the import path prefix
go 1.24                            // minimum language version
require (
    github.com/go-chi/chi/v5 v5.2.5
    github.com/jackc/pgx/v5 v5.9.1
)
tool golang.org/x/tools/cmd/stringer   // Go 1.24: tool dependencies, run with "go tool stringer"
\`\`\`
- \`go.sum\` holds cryptographic hashes of every dependency; commit both files.
- **Minimal version selection**: Go picks the *minimum* version that satisfies every requirement, so builds are reproducible without a lock file.
- **Semantic import versioning**: v2+ of a module has a different path (\`.../v5\`), so two major versions can coexist.
- Downloads go through the module proxy (\`proxy.golang.org\`) and are verified against the checksum database (\`sum.golang.org\`). Private code: set \`GOPRIVATE=github.com/yourorg/*\`.
- \`replace\` points a dependency at a local fork; \`go work\` (workspaces) develops several modules together.

## The everyday toolchain
| Command | Does |
|---|---|
| \`gofmt\` / \`goimports\` | Formats code; there's one style and nobody argues about it |
| \`go vet\` | Finds suspicious code: wrong Printf verbs, copied locks, unreachable code |
| \`staticcheck\` | Deeper static analysis: bugs, simplifications, deprecated APIs |
| \`golangci-lint\` | Runs dozens of linters (errcheck, gosec, revive...) in one fast pass |
| \`govulncheck\` | Reports known vulnerabilities **that your code actually calls** |
| \`go test -race -cover\` | Tests with the race detector and coverage |
| \`go build -ldflags="-s -w"\` | Smaller binaries (strip debug info); \`-X main.version=1.2.3\` injects a version |
| \`GOOS=linux GOARCH=arm64 go build\` | Cross-compile with no extra toolchain |

The **Toolbox** tab maps the libraries worth knowing, grouped by job, with when to choose each. The two samples below run three popular ones: cobra for CLIs, and golang-jwt, google/uuid and zerolog for a typical API's auth, IDs and logs.
`,
    keyPoints: [
      "Prefer the standard library; add dependencies deliberately",
      "go.mod declares the module and requirements; commit go.sum too",
      "Minimal version selection gives reproducible builds without a lock file",
      "Major versions v2+ live at a different import path (/v5)",
      "Go 1.24's tool directive tracks developer tools in go.mod",
      "gofmt, go vet, staticcheck/golangci-lint and govulncheck in every CI",
      "Cross-compile with GOOS and GOARCH",
    ],
    code: [
      {
        title: "Module commands you'll use every day",
        variants: [
          {
            lang: "bash",
            code: `go mod init github.com/you/notes       # start a module
go get github.com/go-chi/chi/v5@latest  # add or upgrade a dependency
go get github.com/jackc/pgx/v5@v5.9.1   # pin an exact version
go get -u ./...                         # upgrade all direct and indirect dependencies (minor/patch)
go mod tidy                             # add missing and remove unused requirements
go list -m all                          # every module in the build, with versions
go mod why -m golang.org/x/text         # why is this dependency here?
go get -tool golang.org/x/tools/cmd/stringer && go tool stringer -type=Status   # Go 1.24 tools

# Quality gates for CI
gofmt -l . && go vet ./... && go test -race -cover ./...
go install honnef.co/go/tools/cmd/staticcheck@latest && staticcheck ./...
go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...

# Release builds
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w -X main.version=1.4.0" -o bin/notes ./cmd/notes`,
          },
        ],
        explain: `- \`go mod tidy\` should leave \`go.mod\` unchanged in CI; failing the build if it changes catches forgotten dependency updates.
- \`CGO_ENABLED=0\` produces a fully static binary that runs in a \`scratch\` or distroless container.
- \`-trimpath\` removes your local file paths from the binary, making builds reproducible.`,
      },
      {
        title: "A CLI with cobra: subcommands, flags and arguments",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "os"
    "strings"

    "github.com/spf13/cobra"
)

func newRootCmd() *cobra.Command {
    var verbose bool
    root := &cobra.Command{
        Use:          "notes",
        Short:        "A tiny notes CLI",
        SilenceUsage: true, // print just the error on mistakes, not the whole help text
    }
    root.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "print extra details") // inherited by subcommands

    var name string
    var shout bool
    greet := &cobra.Command{
        Use:   "greet",
        Short: "Say hello",
        RunE: func(cmd *cobra.Command, args []string) error {
            msg := "hello, " + name
            if shout {
                msg = strings.ToUpper(msg)
            }
            if verbose {
                fmt.Fprintln(cmd.OutOrStdout(), "[verbose] greeting", name)
            }
            fmt.Fprintln(cmd.OutOrStdout(), msg)
            return nil
        },
    }
    greet.Flags().StringVarP(&name, "name", "n", "world", "who to greet")
    greet.Flags().BoolVar(&shout, "shout", false, "use capital letters")

    add := &cobra.Command{
        Use:   "add <title> [tags...]",
        Short: "Add a note",
        Args:  cobra.MinimumNArgs(1), // cobra validates arguments for you
        RunE: func(cmd *cobra.Command, args []string) error {
            fmt.Fprintf(cmd.OutOrStdout(), "added %q with tags %v\\n", args[0], args[1:])
            return nil
        },
    }
    root.AddCommand(greet, add)
    return root
}

// run simulates typing a command line. A real main is just:
//   if err := newRootCmd().Execute(); err != nil { os.Exit(1) }
func run(args ...string) {
    fmt.Println("$ notes", strings.Join(args, " "))
    cmd := newRootCmd() // a fresh tree, so flags start from their defaults
    cmd.SetArgs(args)
    cmd.SetOut(os.Stdout)
    cmd.SetErr(os.Stdout)
    if err := cmd.Execute(); err != nil {
        fmt.Println("(exit status 1)")
    }
}

func main() {
    run("greet")
    run("greet", "--name", "Ada", "--shout")
    run("-v", "greet", "-n", "Grace")
    run("add", "Buy milk", "home", "errands")
    run("add")
    run("greet", "--nme", "typo")
    run("add", "--help")
}`,
          },
        ],
        output: `$ notes greet
hello, world
$ notes greet --name Ada --shout
HELLO, ADA
$ notes -v greet -n Grace
[verbose] greeting Grace
hello, Grace
$ notes add Buy milk home errands
added "Buy milk" with tags [home errands]
$ notes add
Error: requires at least 1 arg(s), only received 0
(exit status 1)
$ notes greet --nme typo
Error: unknown flag: --nme
(exit status 1)
$ notes add --help
Add a note

Usage:
  notes add <title> [tags...] [flags]

Flags:
  -h, --help   help for add

Global Flags:
  -v, --verbose   print extra details`,
        explain: `- Cobra (used by kubectl, Docker, Hugo and the GitHub CLI) gives you subcommands, POSIX-style flags (\`-n\` / \`--name\`), argument validation, generated help and shell completion.
- \`PersistentFlags\` are inherited by every subcommand; \`Flags\` belong to one command.
- Writing to \`cmd.OutOrStdout()\` instead of \`os.Stdout\` lets tests capture output with \`cmd.SetOut(&buf)\`.
- "Buy milk" arrives as one argument because the shell quoting is simulated by passing a separate slice element.
- For a CLI with only a few flags, the standard \`flag\` package is enough.`,
      },
      {
        title: "Auth tokens, IDs and JSON logs: golang-jwt, google/uuid and zerolog",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "encoding/base64"
    "encoding/json"
    "errors"
    "fmt"
    "os"
    "strings"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "github.com/rs/zerolog"
)

type Claims struct {
    Role string \`json:"role"\`
    jwt.RegisteredClaims // sub, iss, exp, iat...
}

var secret = []byte("demo-secret-change-me") // real services load 32+ random bytes from a secret store

func issue(userID, role string, now time.Time, ttl time.Duration) (string, error) {
    claims := Claims{
        Role: role,
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   userID,
            Issuer:    "notes-api",
            IssuedAt:  jwt.NewNumericDate(now),
            ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
        },
    }
    return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func verify(token string, now time.Time) (*Claims, error) {
    claims := &Claims{}
    _, err := jwt.ParseWithClaims(token, claims,
        func(*jwt.Token) (any, error) { return secret, nil },
        jwt.WithValidMethods([]string{"HS256"}), // reject "none" and algorithm-swap attacks
        jwt.WithIssuer("notes-api"),
        jwt.WithTimeFunc(func() time.Time { return now })) // a fixed clock for this demo
    return claims, err
}

func main() {
    now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
    token, _ := issue("user-42", "admin", now, 15*time.Minute)
    parts := strings.Split(token, ".") // header.payload.signature
    payload, _ := base64.RawURLEncoding.DecodeString(parts[1])
    fmt.Println("anyone can read the payload:", string(payload))

    c, err := verify(token, now.Add(5*time.Minute))
    fmt.Println("valid:", err == nil, "| subject:", c.Subject, "| role:", c.Role)

    _, err = verify(token, now.Add(time.Hour))
    fmt.Println("an hour later:", errors.Is(err, jwt.ErrTokenExpired))

    forged, _ := json.Marshal(map[string]any{"role": "superadmin", "sub": "user-42", "iss": "notes-api"})
    parts[1] = base64.RawURLEncoding.EncodeToString(forged) // edit the payload, keep the old signature
    _, err = verify(strings.Join(parts, "."), now)
    fmt.Println("forged payload rejected:", errors.Is(err, jwt.ErrTokenSignatureInvalid))

    id := uuid.New() // random, version 4
    a, _ := uuid.NewV7()
    b, _ := uuid.NewV7() // version 7 starts with a timestamp: index-friendly primary keys
    fmt.Println("v4:", id.Version(), len(id.String()), "chars | v7:", a.Version(), "| v7 sorts by time:", a.String() < b.String())
    fmt.Println("name-based v5 is deterministic:", uuid.NewSHA1(uuid.NameSpaceURL, []byte("https://go.dev")))
    _, err = uuid.Parse("not-a-uuid")
    fmt.Println("parse error:", err)

    log := zerolog.New(os.Stdout).With().Str("service", "notes-api").Logger() // add .Timestamp() in real code
    log.Info().Str("user", c.Subject).Int("status", 200).Dur("took", 1500*time.Microsecond).Msg("request done")
    log.Error().Err(errors.New("db timeout")).Str("route", "/notes").Msg("request failed")
}`,
          },
        ],
        output: `anyone can read the payload: {"role":"admin","iss":"notes-api","sub":"user-42","exp":1793708100,"iat":1793707200}
valid: true | subject: user-42 | role: admin
an hour later: true
forged payload rejected: true
v4: VERSION_4 36 chars | v7: VERSION_7 | v7 sorts by time: true
name-based v5 is deterministic: 76d71d1b-203b-51c3-b17d-c090cb0e4e32
parse error: invalid UUID length: 10
{"level":"info","service":"notes-api","user":"user-42","status":200,"took":1.5,"message":"request done"}
{"level":"error","service":"notes-api","error":"db timeout","route":"/notes","message":"request failed"}`,
        explain: `- A JWT is **signed, not encrypted**: anyone can base64-decode the payload, so never put secrets in it. The signature only proves it wasn't changed, which is why the forged "superadmin" token fails.
- Always restrict accepted algorithms (\`WithValidMethods\`). Libraries that trusted the token's own \`alg\` header have been tricked into accepting unsigned tokens.
- Keep access tokens short-lived (minutes) and use refresh tokens or server-side sessions for long logins.
- UUID v7 values start with a millisecond timestamp, so new rows land at the end of a B-tree index instead of at random places (v4), which keeps database inserts fast.
- zerolog writes JSON with zero allocations per log line. With Go 1.21+, \`log/slog\` covers most needs; zerolog and zap remain popular where every nanosecond counts.`,
      },
    ],
    toolbox: [
      {
        category: "Web frameworks and routers",
        blurb: "Go 1.22's net/http routing covers most APIs. Frameworks add binding, validation and middleware ecosystems.",
        libs: [
          { name: "net/http", what: "The standard HTTP server and client, with method and wildcard routing since Go 1.22.", when: "Default choice for APIs and services; everything else builds on its Handler interface.", tag: "standard" },
          {
            name: "chi",
            what: "A lightweight, idiomatic router: route groups, subrouters, URL params and a middleware collection, 100% net/http compatible.",
            when: "When you want nicer routing and middleware without leaving net/http's types.",
            tag: "essential",
            snippet: {
              lang: "go",
              code: `r := chi.NewRouter()
r.Use(middleware.RequestID, middleware.Recoverer)
r.Route("/books", func(r chi.Router) {
    r.Get("/", listBooks)
    r.Get("/{id}", getBook) // chi.URLParam(r, "id")
})
http.ListenAndServe(":8080", r)`,
            },
          },
          {
            name: "Gin",
            what: "The most popular Go web framework: fast radix-tree router, JSON binding and validation, a large middleware ecosystem.",
            when: "Teams that want batteries included and a big community. Its gin.Context replaces http.ResponseWriter/Request.",
            tag: "popular",
            snippet: {
              lang: "go",
              code: `r := gin.Default() // logger + recovery
r.GET("/books/:id", func(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"id": c.Param("id")})
})
r.Run(":8080")`,
            },
          },
          { name: "Echo", what: "A minimalist, high-performance framework with data binding, validation hooks, groups and centralized error handling.", when: "Similar niche to Gin; handlers return errors, which many find cleaner.", tag: "popular" },
          { name: "Fiber", what: "An Express.js-inspired framework built on fasthttp instead of net/http.", when: "Very high throughput and an Express-like API; note it's not compatible with net/http middleware and its contexts are reused (copy values you keep).", tag: "popular" },
          { name: "gorilla/mux", what: "The classic regexp-capable router (the Gorilla toolkit also has websocket, sessions, csrf).", when: "Existing codebases; for new code net/http or chi cover the same ground.", tag: "popular" },
        ],
      },
      {
        category: "Databases",
        libs: [
          { name: "database/sql", what: "The standard interface to SQL databases, with connection pooling and prepared statements; drivers plug in.", when: "The base layer for every SQL driver. Use QueryContext/ExecContext with contexts, and always close rows.", tag: "standard" },
          {
            name: "pgx",
            what: "The PostgreSQL driver and toolkit: native protocol, connection pool (pgxpool), COPY, LISTEN/NOTIFY, rich type support.",
            when: "Any Go service on PostgreSQL. Use its native API for speed, or its stdlib adapter with database/sql.",
            tag: "essential",
            snippet: {
              lang: "go",
              code: `pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
var title string
err = pool.QueryRow(ctx, "SELECT title FROM books WHERE id = $1", 42).Scan(&title)`,
            },
          },
          { name: "sqlc", what: "Generates type-safe Go code from your SQL queries and schema.", when: "You like writing real SQL but want compile-time checked functions and structs instead of manual Scan calls. Very popular for new services.", tag: "rising" },
          { name: "GORM", what: "A full-featured ORM: associations, hooks, migrations, preloading.", when: "CRUD-heavy apps where productivity beats control; watch generated queries and N+1 problems.", tag: "popular" },
          { name: "sqlx", what: "Extensions to database/sql: scan rows into structs and slices, named parameters.", when: "A thin convenience layer when you don't want codegen or an ORM.", tag: "popular" },
          { name: "ent", what: "An entity framework from Meta: schema as Go code, generated type-safe graph queries.", when: "Complex data models with many relations.", tag: "rising" },
          { name: "goose / golang-migrate", what: "Database migration tools (SQL or Go migrations, up/down, versions).", when: "Every service with a schema: run migrations in CI/CD or at startup.", tag: "essential" },
          { name: "go-redis", what: "The Redis client: commands, pipelines, pub/sub, cluster and sentinel support.", when: "Caching, rate limiting, queues and sessions with Redis or Valkey.", tag: "essential" },
          { name: "mongo-go-driver", what: "The official MongoDB driver.", when: "Services built on MongoDB.", tag: "popular" },
        ],
      },
      {
        category: "Configuration and CLI",
        libs: [
          { name: "flag", what: "Standard command-line flag parsing.", when: "Small tools and services with a handful of flags.", tag: "standard" },
          { name: "cobra", what: "Subcommand-based CLIs with flags, help, completion and docs generation.", when: "Any multi-command CLI (kubectl-style).", tag: "essential" },
          { name: "viper", what: "Configuration from files (YAML/TOML/JSON), env vars, flags and remote stores, with live reload.", when: "Apps with layered configuration; often paired with cobra. For simpler needs, prefer an env-to-struct library.", tag: "popular" },
          { name: "caarlos0/env / kelseyhightower/envconfig", what: "Parse environment variables into a typed struct using tags.", when: "Twelve-factor services configured purely through env vars.", tag: "popular" },
          { name: "urfave/cli / kong", what: "Alternative CLI frameworks (kong builds the CLI from a struct).", when: "When cobra feels heavy or you prefer declarative structs.", tag: "popular" },
          { name: "Bubble Tea + Lip Gloss", what: "A framework (Elm architecture) and styling library for terminal UIs.", when: "Interactive TUIs: dashboards, pickers, forms in the terminal.", tag: "rising" },
        ],
      },
      {
        category: "Logging and observability",
        libs: [
          { name: "log/slog", what: "Structured, leveled logging in the standard library (Go 1.21).", when: "The default for new code; other loggers can plug in as handlers.", tag: "standard" },
          { name: "zap", what: "Uber's high-performance structured logger.", when: "Hot paths where logging cost matters; large existing ecosystems.", tag: "popular" },
          { name: "zerolog", what: "A zero-allocation JSON logger with a fluent API.", when: "Same niche as zap with a chainable API.", tag: "popular" },
          {
            name: "prometheus/client_golang",
            what: "Prometheus metrics: counters, gauges, histograms and an HTTP handler to expose them.",
            when: "Every service that's monitored with Prometheus/Grafana.",
            tag: "essential",
            snippet: {
              lang: "go",
              code: `var requests = promauto.NewCounterVec(prometheus.CounterOpts{
    Name: "http_requests_total", Help: "HTTP requests by route and status.",
}, []string{"route", "status"})

requests.WithLabelValues("/books", "200").Inc()
http.Handle("/metrics", promhttp.Handler())`,
            },
          },
          { name: "OpenTelemetry Go", what: "Vendor-neutral tracing, metrics and logs; otelhttp and otelgrpc instrument servers and clients.", when: "Distributed tracing across microservices (Jaeger, Tempo, Honeycomb, Datadog).", tag: "essential" },
          { name: "net/http/pprof", what: "Live CPU, heap, goroutine and mutex profiles over HTTP.", when: "Always available on an internal port in production services.", tag: "standard" },
        ],
      },
      {
        category: "Testing",
        libs: [
          { name: "testing + httptest", what: "Built-in tests, benchmarks, fuzzing, examples and HTTP test servers.", when: "Always the foundation.", tag: "standard" },
          {
            name: "testify",
            what: "assert and require helpers, plus mock and suite packages.",
            when: "Shorter assertions with readable diffs; require stops the test on failure.",
            tag: "popular",
            snippet: {
              lang: "go",
              code: `func TestSlugify(t *testing.T) {
    require.NoError(t, err)
    assert.Equal(t, "hello-world", Slugify("Hello, World!"))
    assert.Len(t, items, 3)
}`,
            },
          },
          { name: "go-cmp", what: "Google's deep comparison with readable diffs (cmp.Diff) and options to ignore fields.", when: "Comparing structs in tests; cleaner than reflect.DeepEqual.", tag: "essential" },
          { name: "gomock / mockery", what: "Generate mocks from interfaces.", when: "When you need to assert call sequences; otherwise hand-written fakes are simpler.", tag: "popular" },
          { name: "testcontainers-go", what: "Start real Postgres, Redis, Kafka... in Docker from your tests.", when: "Integration tests against real dependencies instead of mocks.", tag: "rising" },
          { name: "goleak", what: "Fails a test if goroutines are still running at the end.", when: "Packages that start goroutines: catches leaks early.", tag: "popular" },
        ],
      },
      {
        category: "Concurrency and resilience",
        libs: [
          { name: "golang.org/x/sync", what: "errgroup (group + first error + cancel + limit), semaphore (weighted) and singleflight (deduplicate concurrent calls).", when: "Fan-out work that can fail; preventing cache stampedes with singleflight.", tag: "essential" },
          { name: "golang.org/x/time/rate", what: "A token-bucket rate limiter with Allow, Wait(ctx) and Reserve.", when: "Throttling outgoing calls or per-client request limits.", tag: "essential" },
          { name: "cenkalti/backoff", what: "Exponential backoff with jitter and retry helpers.", when: "Retrying flaky network calls safely.", tag: "popular" },
          { name: "sony/gobreaker", what: "The circuit breaker pattern.", when: "Stop hammering a failing dependency and fail fast instead.", tag: "popular" },
        ],
      },
      {
        category: "Auth and security",
        libs: [
          { name: "golang-jwt/jwt", what: "Create and verify JSON Web Tokens (HMAC, RSA, ECDSA, EdDSA).", when: "Stateless API auth; always restrict accepted algorithms.", tag: "essential" },
          { name: "golang.org/x/crypto", what: "bcrypt, argon2, scrypt, chacha20poly1305, ssh, acme/autocert...", when: "Password hashing (bcrypt or argon2id) and crypto not in the stdlib.", tag: "essential" },
          { name: "coreos/go-oidc + x/oauth2", what: "OpenID Connect token verification and OAuth 2.0 flows.", when: "Login with Google, Okta, Auth0, Keycloak...", tag: "popular" },
          { name: "casbin", what: "Authorization library supporting ACL, RBAC and ABAC models.", when: "Complex permission rules beyond simple roles.", tag: "popular" },
        ],
      },
      {
        category: "RPC and messaging",
        libs: [
          { name: "grpc-go + protobuf", what: "gRPC: contract-first RPC with Protocol Buffers, streaming, deadlines and interceptors.", when: "Service-to-service APIs in a microservice architecture.", tag: "essential" },
          { name: "connect-go", what: "Buf's gRPC-compatible RPC that also speaks plain HTTP/JSON and works with net/http.", when: "gRPC benefits plus browser-friendly APIs and simpler debugging.", tag: "rising" },
          { name: "franz-go / segmentio/kafka-go", what: "Kafka clients written in pure Go.", when: "Event streaming with Kafka; franz-go is the most complete and fastest.", tag: "popular" },
          { name: "nats.go", what: "The NATS client: pub/sub, request/reply, JetStream persistence.", when: "Lightweight messaging between services.", tag: "popular" },
          { name: "amqp091-go", what: "The RabbitMQ (AMQP 0.9.1) client maintained by the RabbitMQ team.", when: "Task queues and routing with RabbitMQ.", tag: "popular" },
          { name: "gorilla/websocket / coder/websocket", what: "WebSocket servers and clients.", when: "Real-time features: chat, live dashboards, notifications.", tag: "popular" },
        ],
      },
      {
        category: "Utilities",
        libs: [
          { name: "google/uuid", what: "UUID generation and parsing (v1, v4, v5, v6, v7).", when: "IDs; prefer v7 for database keys.", tag: "essential" },
          { name: "go-playground/validator", what: "Struct validation with tags: required, email, min, max, oneof...", when: "Validating request payloads (Gin uses it built in).", tag: "popular" },
          { name: "shopspring/decimal", what: "Arbitrary-precision decimals.", when: "Money and anything where float rounding is unacceptable.", tag: "popular" },
          { name: "samber/lo", what: "Lodash-style generic helpers: Map, Filter, GroupBy, Uniq...", when: "Convenience; check slices and maps in the stdlib first.", tag: "popular" },
        ],
      },
      {
        category: "Cloud and infrastructure",
        blurb: "Much of the cloud-native world (Docker, Kubernetes, Terraform, Prometheus) is written in Go.",
        libs: [
          { name: "aws-sdk-go-v2", what: "The official AWS SDK.", when: "S3, DynamoDB, SQS, Lambda and every other AWS API.", tag: "essential" },
          { name: "cloud.google.com/go / Azure SDK", what: "Official Google Cloud and Azure SDKs.", when: "Services on GCP or Azure.", tag: "popular" },
          { name: "client-go / controller-runtime", what: "The Kubernetes API client and the framework for writing operators.", when: "Kubernetes controllers, operators and tooling.", tag: "popular" },
          { name: "Terraform Plugin Framework", what: "Build Terraform providers in Go.", when: "Infrastructure-as-code integrations.", tag: "popular" },
        ],
      },
    ],
    interview: [
      {
        q: "How does Go dependency management work?",
        a: "Through modules: go.mod declares the module path, Go version and required modules; go.sum stores cryptographic checksums. Go uses minimal version selection: for each module it picks the minimum version satisfying all requirements in the graph, making builds deterministic without a separate lock file. Major versions v2+ use a distinct import path (semantic import versioning), so incompatible versions can coexist. Modules are fetched via a proxy (proxy.golang.org) and verified against the checksum database; GOPRIVATE skips those for private code. go mod tidy syncs requirements with imports.",
        freq: "common",
      },
      {
        q: "Would you use a framework like Gin or just net/http?",
        a: "Since Go 1.22, net/http's ServeMux supports method matching and path wildcards, so many APIs need no framework at all; adding chi gives route groups and middleware while staying net/http-compatible, so any standard middleware and test tooling works. Gin or Echo make sense when a team wants integrated binding, validation and a large plugin ecosystem, accepting a custom context type. Fiber trades net/http compatibility for fasthttp performance. The key considerations are compatibility with the standard Handler interface, team familiarity and long-term maintenance.",
        freq: "common",
      },
      {
        q: "How do you keep a Go codebase healthy in CI?",
        a: "gofmt/goimports check, go vet, a linter suite (golangci-lint with staticcheck, errcheck, gosec, revive), go test -race with coverage, go mod tidy diff check, govulncheck for known vulnerabilities in called code, and building for every target platform. Optionally benchmarks with benchstat comparisons for performance-sensitive packages, and fuzzing on parsers.",
      },
    ],
    quiz: [
      {
        q: "Which file stores dependency checksums?",
        options: ["go.mod", "go.sum", "go.lock", "vendor.json"],
        answer: 1,
        explain: "Commit both go.mod and go.sum.",
      },
      {
        q: "How does Go import major version 5 of a module?",
        options: ["@v5 suffix in the import", "A /v5 path suffix", "A version comment", "It can't"],
        answer: 1,
        explain: "e.g. github.com/jackc/pgx/v5.",
      },
      {
        q: "Which tool reports vulnerabilities only in code you actually call?",
        options: ["go vet", "govulncheck", "gofmt", "go mod why"],
        answer: 1,
        explain: "It analyzes call graphs, reducing noise.",
      },
      {
        q: "Anyone holding a JWT can...",
        options: ["Change its claims", "Read its payload", "Extend its expiry", "Nothing at all"],
        answer: 1,
        explain: "JWTs are signed, not encrypted.",
      },
    ],
  },

  // ------------------------------------------------------------------ WEB
  {
    id: "go-web",
    stage: "Ecosystem",
    title: "Building HTTP APIs: net/http, chi, Gin, Echo and Fiber",
    tagline: "How a Go HTTP server handles requests, Go 1.22 routing, middleware, JSON helpers and validation, resilient HTTP clients, databases with database/sql and pgx, and the same API in the popular frameworks.",
    difficulty: "intermediate",
    minutes: 50,
    diagram: {
      title: "A request through a Go HTTP service",
      nodes: [
        { id: "client", label: "Client", kind: "client", x: 80, y: 280, sub: "browser, app, service" },
        { id: "lb", label: "Load balancer", kind: "lb", x: 220, y: 280, sub: "TLS, health checks" },
        { id: "server", label: "http.Server", kind: "gateway", x: 370, y: 280, sub: "accept loop + timeouts" },
        { id: "conn", label: "Conn goroutine", kind: "worker", x: 520, y: 130, sub: "one per connection" },
        { id: "mw", label: "Middleware", kind: "gateway", x: 680, y: 130, sub: "log, recover, auth, CORS" },
        { id: "mux", label: "Router", kind: "control", x: 850, y: 130, sub: "ServeMux / chi / Gin" },
        { id: "handler", label: "Handler", kind: "service", x: 850, y: 300, sub: "decode, validate, encode" },
        { id: "svc", label: "Service layer", kind: "service", x: 680, y: 430, sub: "business rules" },
        { id: "cache", label: "Redis", kind: "cache", x: 500, y: 480, sub: "go-redis" },
        { id: "db", label: "PostgreSQL", kind: "db", x: 880, y: 480, sub: "pgx pool / database/sql" },
        { id: "netpoll", label: "Netpoller", kind: "control", x: 370, y: 470, sub: "epoll / kqueue" },
      ],
      edges: [
        { from: "client", to: "lb", label: "HTTPS" },
        { from: "lb", to: "server", label: "HTTP/1.1 or h2" },
        { from: "server", to: "conn", label: "go c.serve()" },
        { from: "conn", to: "mw", label: "*http.Request" },
        { from: "mw", to: "mux" },
        { from: "mux", to: "handler", label: "r.PathValue" },
        { from: "handler", to: "svc" },
        { from: "svc", to: "cache", label: "GET / SET" },
        { from: "svc", to: "db", label: "QueryContext(ctx)" },
        { from: "conn", to: "netpoll", label: "park on read", dashed: true },
      ],
      flows: [
        {
          name: "GET /books/42 (cache hit)",
          path: ["client", "lb", "server", "conn", "mw", "mux", "handler", "svc", "cache"],
          steps: [
            "The client sends an HTTPS request; the load balancer terminates TLS (or passes it through).",
            "The request reaches one of several instances of the Go binary.",
            "http.Server's accept loop starts one goroutine per connection: cheap, so thousands of clients are fine.",
            "The connection goroutine parses the request and calls the root handler: the outermost middleware.",
            "Middleware runs in order (request ID, logging, panic recovery, auth), then calls the router.",
            "The router matches 'GET /books/{id}' and calls the handler; r.PathValue(\"id\") is \"42\".",
            "The handler decodes and validates input, then calls the service layer with r.Context().",
            "The service checks Redis first: a hit returns in well under a millisecond.",
          ],
        },
        {
          name: "Cache miss and the response",
          path: ["handler", "svc", "cache", "svc", "db", "svc", "handler", "mux", "mw", "conn", "server", "lb", "client"],
          steps: [
            "The handler asks the service for book 42.",
            "The service looks in Redis...",
            "...and misses.",
            "It queries PostgreSQL through the connection pool, passing the request's context.",
            "The row comes back; the service stores it in Redis with a TTL for next time.",
            "The service returns a domain struct to the handler.",
            "The handler encodes JSON and sets the status, then returns through the router...",
            "...to the middleware, which sees the status for logs and metrics.",
            "The response is written to the connection's buffered writer.",
            "The connection stays open for keep-alive, ready for the next request.",
            "The load balancer forwards the response...",
            "...and the client receives 200 OK with the book.",
          ],
        },
        {
          name: "Waiting for a slow client",
          path: ["client", "lb", "server", "conn", "netpoll", "conn", "mw"],
          steps: [
            "A mobile client on a bad network sends its request slowly.",
            "The load balancer forwards bytes as they arrive.",
            "The server has accepted the connection and started its goroutine.",
            "The goroutine tries to read the rest of the request, but no data is available yet.",
            "It parks on the netpoller: no OS thread is blocked while it waits (ReadHeaderTimeout caps how long).",
            "When bytes arrive, the netpoller makes the goroutine runnable and it resumes parsing, then runs the middleware chain.",
          ],
        },
        {
          name: "Client disconnects mid-request",
          path: ["client", "lb", "server", "conn", "mw", "mux", "handler", "svc", "db"],
          steps: [
            "The user closes the tab while a slow report is being generated.",
            "The load balancer closes its upstream connection.",
            "The connection goroutine's background read notices the closed connection...",
            "...and cancels the request's context: r.Context().Done() closes.",
            "The middleware passed the request (and its context) down the chain...",
            "...through the router to the handler...",
            "...which passes r.Context() to the service layer...",
            "...so the database driver cancels the running query instead of finishing work nobody will read.",
          ],
        },
      ],
    },
    concept: `
## The model: everything is an http.Handler
\`\`\`go
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}
\`\`\`
A router is a Handler that dispatches to other Handlers. A **middleware** is a function \`func(http.Handler) http.Handler\` that wraps one: it can run code before and after, change the request, short-circuit with an error, or record the status. \`http.HandlerFunc\` turns an ordinary function into a Handler. Because chi, most middleware and testing tools speak this one interface, they all compose.

\`http.Server\` runs **one goroutine per connection**, so handlers can block on I/O freely; the scheduler and netpoller (previous chapter) make that cheap. It also means **handlers run concurrently**: shared state needs a mutex.

## Routing in Go 1.22+
\`\`\`go
mux := http.NewServeMux()
mux.HandleFunc("GET /books", listBooks)          // method + path
mux.HandleFunc("POST /books", createBook)
mux.HandleFunc("GET /books/{id}", getBook)       // r.PathValue("id")
mux.HandleFunc("GET /files/{path...}", serveFile) // wildcard for the rest of the path
\`\`\`
The most specific pattern wins, wrong methods get **405 with an Allow header**, and unknown paths 404.

## Production checklist for handlers
- **Limit and validate input**: \`http.MaxBytesReader\` caps body size, \`DisallowUnknownFields\` rejects typos, then check business rules. Return 400 for malformed input, 422 for invalid values.
- **Consistent JSON errors**: one \`writeJSON\`/\`writeError\` helper, set \`Content-Type\` before \`WriteHeader\`.
- **Timeouts on the server**: \`ReadHeaderTimeout\`, \`ReadTimeout\`, \`WriteTimeout\`, \`IdleTimeout\`. The zero-value server has none.
- **Pass r.Context()** to every database and outgoing call, so a disconnected client cancels the work.
- **Middleware**: request IDs, structured access logs, panic recovery, CORS, auth, rate limiting, metrics.
- **Graceful shutdown** on SIGTERM (see the concurrency patterns chapter).

## Clients need care too
\`http.DefaultClient\` has **no timeout**: one hung server can block your goroutines forever. Create one \`http.Client{Timeout: ...}\` and **reuse** it (it pools connections), build requests with \`http.NewRequestWithContext\`, always \`defer res.Body.Close()\`, check the status code, cap what you read, and retry only idempotent requests, with exponential backoff and jitter.

## Data access
\`database/sql\` is a **pool** of connections, not a connection: create it once at startup, set \`SetMaxOpenConns\`, \`SetMaxIdleConns\` and \`SetConnMaxLifetime\`, and pass contexts. Use placeholders (\`$1\`) for every value, never string concatenation (SQL injection). For PostgreSQL, **pgx** is the go-to driver; **sqlc** generates type-safe code from SQL; GORM and ent are the ORM options.

## Choosing a framework
| | Based on | Style | Pick it for |
|---|---|---|---|
| **net/http** | stdlib | \`func(w, r)\` | No dependencies; most APIs since Go 1.22 |
| **chi** | net/http | \`func(w, r)\` + groups | Nicer routing, stays 100% standard |
| **Gin** | net/http | \`func(c *gin.Context)\` | Binding, validation, huge ecosystem |
| **Echo** | net/http | \`func(c echo.Context) error\` | Error-returning handlers, clean API |
| **Fiber** | fasthttp | Express-like | Raw throughput, Express familiarity |
`,
    keyPoints: [
      "Everything is an http.Handler; middleware wraps handlers",
      "One goroutine per connection: handlers run concurrently",
      "Go 1.22 ServeMux: method patterns, {wildcards}, automatic 405",
      "Cap bodies, reject unknown fields, validate, return consistent JSON errors",
      "Set server timeouts; the zero-value server has none",
      "Reuse one http.Client with a Timeout; always close response bodies",
      "database/sql is a pool: create once, pass contexts, use placeholders",
    ],
    code: [
      {
        title: "A REST API with only the standard library (Go 1.22 routing)",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "encoding/json"
    "fmt"
    "log/slog"
    "net/http"
    "net/http/httptest"
    "os"
    "slices"
    "strconv"
    "strings"
    "sync"
)

type Book struct {
    ID     int    \`json:"id"\`
    Title  string \`json:"title"\`
    Author string \`json:"author"\`
}

type Store struct { // in-memory storage; handlers run concurrently, so it needs a lock
    mu     sync.RWMutex
    books  map[int]Book
    nextID int
}

func NewStore() *Store { return &Store{books: map[int]Book{}, nextID: 1} }

func (s *Store) Create(b Book) Book {
    s.mu.Lock()
    defer s.mu.Unlock()
    b.ID = s.nextID
    s.nextID++
    s.books[b.ID] = b
    return b
}

func (s *Store) Get(id int) (Book, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    b, ok := s.books[id]
    return b, ok
}

func (s *Store) List() []Book {
    s.mu.RLock()
    defer s.mu.RUnlock()
    out := make([]Book, 0, len(s.books))
    for _, b := range s.books {
        out = append(out, b)
    }
    slices.SortFunc(out, func(a, b Book) int { return a.ID - b.ID })
    return out
}

func (s *Store) Delete(id int) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    _, ok := s.books[id]
    delete(s.books, id)
    return ok
}

// ---- JSON helpers: one place decides how responses and errors look ----

func writeJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json") // headers before WriteHeader
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
    writeJSON(w, status, map[string]string{"error": msg})
}

// ---- Handlers ----

type API struct {
    store *Store
    log   *slog.Logger
}

func (a *API) Routes() http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /books", a.list)
    mux.HandleFunc("POST /books", a.create)
    mux.HandleFunc("GET /books/{id}", a.get)
    mux.HandleFunc("DELETE /books/{id}", a.remove)
    mux.HandleFunc("GET /panic", func(http.ResponseWriter, *http.Request) { panic("something broke") })
    return a.recoverPanics(a.logRequests(mux)) // middleware wraps the whole router
}

func (a *API) list(w http.ResponseWriter, r *http.Request) {
    writeJSON(w, http.StatusOK, a.store.List())
}

func (a *API) create(w http.ResponseWriter, r *http.Request) {
    r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // reject bodies over 1 MB
    dec := json.NewDecoder(r.Body)
    dec.DisallowUnknownFields()
    var in struct {
        Title  string \`json:"title"\`
        Author string \`json:"author"\`
    }
    if err := dec.Decode(&in); err != nil {
        writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
        return
    }
    if strings.TrimSpace(in.Title) == "" {
        writeError(w, http.StatusUnprocessableEntity, "title is required")
        return
    }
    b := a.store.Create(Book{Title: in.Title, Author: in.Author})
    w.Header().Set("Location", "/books/"+strconv.Itoa(b.ID))
    writeJSON(w, http.StatusCreated, b)
}

func bookID(w http.ResponseWriter, r *http.Request) (int, bool) {
    id, err := strconv.Atoi(r.PathValue("id")) // the {id} wildcard
    if err != nil || id < 1 {
        writeError(w, http.StatusBadRequest, "id must be a positive number")
        return 0, false
    }
    return id, true
}

func (a *API) get(w http.ResponseWriter, r *http.Request) {
    id, ok := bookID(w, r)
    if !ok {
        return
    }
    b, found := a.store.Get(id)
    if !found {
        writeError(w, http.StatusNotFound, "book not found")
        return
    }
    writeJSON(w, http.StatusOK, b)
}

func (a *API) remove(w http.ResponseWriter, r *http.Request) {
    id, ok := bookID(w, r)
    if !ok {
        return
    }
    if !a.store.Delete(id) {
        writeError(w, http.StatusNotFound, "book not found")
        return
    }
    w.WriteHeader(http.StatusNoContent)
}

// ---- Middleware: func(http.Handler) http.Handler ----

type statusRecorder struct {
    http.ResponseWriter
    status int
}

func (s *statusRecorder) WriteHeader(code int) {
    s.status = code
    s.ResponseWriter.WriteHeader(code)
}

func (a *API) logRequests(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
        next.ServeHTTP(rec, r)
        a.log.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status)
    })
}

func (a *API) recoverPanics(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                a.log.Error("panic", "err", err, "path", r.URL.Path)
                writeError(w, http.StatusInternalServerError, "internal error")
            }
        }()
        next.ServeHTTP(w, r)
    })
}

// ---- Exercise the API in-process ----

func main() {
    noTime := func(_ []string, a slog.Attr) slog.Attr {
        if a.Key == slog.TimeKey {
            return slog.Attr{}
        }
        return a
    }
    logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{ReplaceAttr: noTime}))
    handler := (&API{store: NewStore(), log: logger}).Routes()

    call := func(method, path, body string) {
        rec := httptest.NewRecorder()
        handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
        extra := ""
        if allow := rec.Header().Get("Allow"); allow != "" {
            extra = " (Allow: " + allow + ")"
        }
        fmt.Printf("%s %s -> %d%s %s\\n", method, path, rec.Code, extra, strings.TrimSpace(rec.Body.String()))
    }

    call("POST", "/books", \`{"title": "The Go Programming Language", "author": "Donovan & Kernighan"}\`)
    call("POST", "/books", \`{"title": "Concurrency in Go", "author": "Katherine Cox-Buday"}\`)
    call("GET", "/books", "")
    call("GET", "/books/2", "")
    call("POST", "/books", \`{"title": "  "}\`)
    call("POST", "/books", \`{"title": "Typo", "auther": "x"}\`)
    call("GET", "/books/abc", "")
    call("DELETE", "/books/1", "")
    call("GET", "/books/1", "")
    call("PUT", "/books/2", "")
    call("GET", "/authors", "")
    call("GET", "/panic", "")
}`,
          },
        ],
        output: `level=INFO msg=request method=POST path=/books status=201
POST /books -> 201 {"id":1,"title":"The Go Programming Language","author":"Donovan \\u0026 Kernighan"}
level=INFO msg=request method=POST path=/books status=201
POST /books -> 201 {"id":2,"title":"Concurrency in Go","author":"Katherine Cox-Buday"}
level=INFO msg=request method=GET path=/books status=200
GET /books -> 200 [{"id":1,"title":"The Go Programming Language","author":"Donovan \\u0026 Kernighan"},{"id":2,"title":"Concurrency in Go","author":"Katherine Cox-Buday"}]
level=INFO msg=request method=GET path=/books/2 status=200
GET /books/2 -> 200 {"id":2,"title":"Concurrency in Go","author":"Katherine Cox-Buday"}
level=INFO msg=request method=POST path=/books status=422
POST /books -> 422 {"error":"title is required"}
level=INFO msg=request method=POST path=/books status=400
POST /books -> 400 {"error":"invalid JSON: json: unknown field \\"auther\\""}
level=INFO msg=request method=GET path=/books/abc status=400
GET /books/abc -> 400 {"error":"id must be a positive number"}
level=INFO msg=request method=DELETE path=/books/1 status=204
DELETE /books/1 -> 204
level=INFO msg=request method=GET path=/books/1 status=404
GET /books/1 -> 404 {"error":"book not found"}
level=INFO msg=request method=PUT path=/books/2 status=405
PUT /books/2 -> 405 (Allow: DELETE, GET, HEAD) Method Not Allowed
level=INFO msg=request method=GET path=/authors status=404
GET /authors -> 404 404 page not found
level=ERROR msg=panic err="something broke" path=/panic
GET /panic -> 500 {"error":"internal error"}`,
        explain: `- No framework: \`"GET /books/{id}"\` patterns and \`r.PathValue\` are standard since Go 1.22. \`PUT /books/2\` gets a **405 with an Allow header** automatically, and unknown paths get 404.
- Notice \`Donovan \\u0026 Kernighan\`: \`json.Encoder\` escapes \`<\`, \`>\` and \`&\` by default so the JSON is safe to embed in HTML. Any JSON client decodes it back to \`&\`; call \`enc.SetEscapeHTML(false)\` if you want the characters as-is.
- The panic in \`/panic\` is logged and turned into a clean 500; no stack trace reaches the client, and the server keeps serving. (\`net/http\` would also recover it, but by dropping the connection.)
- \`statusRecorder\` embeds the \`ResponseWriter\` and overrides one method: the standard trick for capturing the status in logging and metrics middleware.
- In \`main\` we call the handler directly with \`httptest.NewRecorder\`. To serve for real: \`srv := &http.Server{Addr: ":8080", Handler: handler, ReadHeaderTimeout: 5 * time.Second}\` and \`srv.ListenAndServe()\`.`,
      },
      {
        title: "The same ideas with chi: route groups, subrouters and per-route middleware",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "context"
    "encoding/json"
    "fmt"
    "maps"
    "net/http"
    "net/http/httptest"
    "slices"
    "strconv"
    "strings"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

type Article struct {
    ID    int    \`json:"id"\`
    Title string \`json:"title"\`
    Draft bool   \`json:"draft"\`
}

var articles = map[int]Article{1: {1, "Hello chi", false}, 2: {2, "Middleware deep dive", true}}

func render(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(v)
}

type articleKey struct{} // context key type

// articleCtx loads the article once for every route under /articles/{id}.
func articleCtx(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.Atoi(chi.URLParam(r, "id"))
        a, ok := articles[id]
        if err != nil || !ok {
            render(w, http.StatusNotFound, map[string]string{"error": "article not found"})
            return
        }
        next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), articleKey{}, a)))
    })
}

func requireAPIKey(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Header.Get("X-API-Key") != "s3cret" {
            render(w, http.StatusUnauthorized, map[string]string{"error": "missing or bad API key"})
            return
        }
        next.ServeHTTP(w, r)
    })
}

func v2Router() http.Handler { // a separate sub-application, mounted under /v2
    r := chi.NewRouter()
    r.With(articleCtx).Get("/articles/{id}", func(w http.ResponseWriter, r *http.Request) {
        render(w, http.StatusOK, map[string]any{"data": r.Context().Value(articleKey{}), "version": 2})
    })
    return r
}

func newRouter() http.Handler {
    r := chi.NewRouter()
    r.Use(middleware.RequestID)    // generates an ID per request, stored in the context
    r.Use(middleware.Recoverer)    // panics become 500s
    r.Use(middleware.StripSlashes) // /articles/1/ is treated as /articles/1

    r.Get("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "welcome (request id assigned: %v)", middleware.GetReqID(r.Context()) != "")
    })

    r.Route("/articles", func(r chi.Router) {
        r.Get("/", func(w http.ResponseWriter, r *http.Request) {
            list := []Article{}
            for _, id := range slices.Sorted(maps.Keys(articles)) {
                list = append(list, articles[id])
            }
            render(w, http.StatusOK, list)
        })
        r.Route("/{id}", func(r chi.Router) {
            r.Use(articleCtx) // runs only for /articles/{id}/...
            r.Get("/", func(w http.ResponseWriter, r *http.Request) {
                render(w, http.StatusOK, r.Context().Value(articleKey{}))
            })
            r.With(requireAPIKey).Delete("/", func(w http.ResponseWriter, r *http.Request) { // one route only
                delete(articles, r.Context().Value(articleKey{}).(Article).ID)
                w.WriteHeader(http.StatusNoContent)
            })
        })
    })

    r.Group(func(r chi.Router) { // no URL prefix, just extra middleware for these routes
        r.Use(requireAPIKey)
        r.Get("/admin/stats", func(w http.ResponseWriter, r *http.Request) {
            render(w, http.StatusOK, map[string]int{"articles": len(articles)})
        })
    })

    r.Mount("/v2", v2Router())
    return r
}

func main() {
    router := newRouter()
    call := func(method, path string, apiKey string) {
        req := httptest.NewRequest(method, path, nil)
        if apiKey != "" {
            req.Header.Set("X-API-Key", apiKey)
        }
        rec := httptest.NewRecorder()
        router.ServeHTTP(rec, req)
        fmt.Printf("%-6s %-16s -> %d %s\\n", method, path, rec.Code, strings.TrimSpace(rec.Body.String()))
    }
    call("GET", "/", "")
    call("GET", "/articles", "")
    call("GET", "/articles/2/", "")
    call("GET", "/articles/9", "")
    call("DELETE", "/articles/1", "")
    call("DELETE", "/articles/1", "s3cret")
    call("GET", "/admin/stats", "")
    call("GET", "/admin/stats", "s3cret")
    call("GET", "/v2/articles/2", "")
    call("PATCH", "/articles/2", "")
}`,
          },
        ],
        output: `GET    /                -> 200 welcome (request id assigned: true)
GET    /articles        -> 200 [{"id":1,"title":"Hello chi","draft":false},{"id":2,"title":"Middleware deep dive","draft":true}]
GET    /articles/2/     -> 200 {"id":2,"title":"Middleware deep dive","draft":true}
GET    /articles/9      -> 404 {"error":"article not found"}
DELETE /articles/1      -> 401 {"error":"missing or bad API key"}
DELETE /articles/1      -> 204
GET    /admin/stats     -> 401 {"error":"missing or bad API key"}
GET    /admin/stats     -> 200 {"articles":1}
GET    /v2/articles/2   -> 200 {"data":{"id":2,"title":"Middleware deep dive","draft":true},"version":2}
PATCH  /articles/2      -> 405`,
        explain: `- chi handlers are plain \`http.HandlerFunc\`s and its router is an \`http.Handler\`, so everything from the standard-library example (helpers, middleware, httptest) carries over unchanged.
- \`r.Route\` nests a URL prefix, \`r.Group\` adds middleware without a prefix, \`r.With(mw)\` applies middleware to a single route, and \`r.Mount\` attaches a whole separate router. That's how large APIs stay organized: one file per resource, mounted in \`main\`.
- \`articleCtx\` is a common chi idiom: load the resource once in middleware, return 404 early, and pass it to handlers through the request context.
- chi's \`middleware\` package includes RequestID, RealIP, Logger, Recoverer, Timeout, Throttle, Compress, StripSlashes and more.`,
      },
      {
        title: "A resilient HTTP client: timeouts, status checks and retries with backoff",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "math/rand/v2"
    "net/http"
    "net/http/httptest"
    "net/url"
    "strings"
    "sync/atomic"
    "time"
)

type StatusError struct{ Code int }

func (e *StatusError) Error() string { return fmt.Sprintf("unexpected status %d", e.Code) }

func isTimeout(err error) bool {
    var ue *url.Error
    return errors.As(err, &ue) && ue.Timeout()
}

func retryable(err error) bool { // retry only what might succeed next time
    var se *StatusError
    if errors.As(err, &se) {
        return se.Code == http.StatusTooManyRequests || se.Code >= 500
    }
    return isTimeout(err)
}

func short(err error) string { // URL errors include the random test port: keep the output stable
    if isTimeout(err) {
        return "timeout"
    }
    return err.Error()
}

func retry(ctx context.Context, attempts int, base time.Duration, f func() error) error {
    var err error
    for i := range attempts {
        if err = f(); err == nil || !retryable(err) {
            return err
        }
        if i == attempts-1 {
            break
        }
        backoff := base << i                                     // 10ms, 20ms, 40ms...
        jitter := time.Duration(rand.Int64N(int64(backoff)/2 + 1)) // spreads out retries from many clients
        fmt.Printf("  attempt %d: %s; retrying in ~%v\\n", i+1, short(err), backoff)
        select {
        case <-time.After(backoff + jitter):
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    return fmt.Errorf("after %d attempts: %w", attempts, err)
}

type Weather struct {
    City string  \`json:"city"\`
    Temp float64 \`json:"temp_c"\`
}

type WeatherClient struct {
    base string
    http *http.Client // create once and reuse: it pools connections
}

func NewWeatherClient(base string) *WeatherClient {
    return &WeatherClient{base: base, http: &http.Client{Timeout: 100 * time.Millisecond}}
}

func (c *WeatherClient) get(ctx context.Context, path string, out any) error {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+path, nil)
    if err != nil {
        return err
    }
    req.Header.Set("Accept", "application/json")
    res, err := c.http.Do(req)
    if err != nil {
        return err
    }
    defer res.Body.Close() // always, or the connection leaks
    if res.StatusCode != http.StatusOK {
        io.Copy(io.Discard, io.LimitReader(res.Body, 64<<10)) // drain so the connection can be reused
        return &StatusError{res.StatusCode}
    }
    return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out) // never trust the size
}

func (c *WeatherClient) Current(ctx context.Context, city string) (Weather, error) {
    var w Weather
    err := retry(ctx, 4, 10*time.Millisecond, func() error {
        return c.get(ctx, "/weather?city="+url.QueryEscape(city), &w)
    })
    return w, err
}

func main() {
    var calls atomic.Int32
    mux := http.NewServeMux()
    mux.HandleFunc("GET /weather", func(w http.ResponseWriter, r *http.Request) {
        city := r.URL.Query().Get("city")
        switch {
        case city == "Atlantis":
            http.Error(w, "unknown city", http.StatusNotFound)
        case city == "Slowtown":
            time.Sleep(300 * time.Millisecond) // slower than the client's 100ms timeout
        case calls.Add(1) <= 2: // the first two requests fail: a flaky upstream
            w.WriteHeader(http.StatusServiceUnavailable)
        default:
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(Weather{City: city, Temp: 21.5})
        }
    })
    srv := httptest.NewServer(mux) // a real server on a random local port
    defer srv.Close()

    client := NewWeatherClient(srv.URL)
    ctx := context.Background()

    fmt.Println("Lisbon (flaky upstream):")
    w, err := client.Current(ctx, "Lisbon")
    fmt.Printf("  got %+v, err %v\\n", w, err)

    fmt.Println("Atlantis (a 404 is not retried):")
    _, err = client.Current(ctx, "Atlantis")
    fmt.Println("  err:", err)

    fmt.Println("Slowtown (every attempt times out):")
    _, err = client.Current(ctx, "Slowtown")
    prefix, _, _ := strings.Cut(err.Error(), ":")
    fmt.Printf("  gave up %s | the cause is still a timeout: %v\\n", prefix, isTimeout(err))
}`,
          },
        ],
        output: `Lisbon (flaky upstream):
  attempt 1: unexpected status 503; retrying in ~10ms
  attempt 2: unexpected status 503; retrying in ~20ms
  got {City:Lisbon Temp:21.5}, err <nil>
Atlantis (a 404 is not retried):
  err: unexpected status 404
Slowtown (every attempt times out):
  attempt 1: timeout; retrying in ~10ms
  attempt 2: timeout; retrying in ~20ms
  attempt 3: timeout; retrying in ~40ms
  gave up after 4 attempts | the cause is still a timeout: true`,
        explain: `- **Timeouts**: \`http.Client{Timeout}\` bounds the whole exchange (connect, headers, body). The request's context can impose an overall deadline across all retries too.
- **Status codes**: a non-2xx response is *not* an error to \`client.Do\`, so you must check \`StatusCode\` yourself.
- **Only retry what can succeed**: 429, 5xx and timeouts, never 400 or 404. Only retry **idempotent** operations (GET, PUT, DELETE, or POSTs with an idempotency key), or you may charge a card twice.
- **Backoff with jitter** prevents thousands of clients from retrying in lockstep and knocking the recovering server over again. Honor a \`Retry-After\` header when the server sends one.
- Wrapping with \`%w\` keeps the cause inspectable: after four attempts, \`isTimeout(err)\` still sees the \`*url.Error\` inside.`,
      },
      {
        title: "Data access with database/sql and pgx: pools, queries and transactions",
        noCheck: "needs a running PostgreSQL server and the pgx driver",
        variants: [
          {
            lang: "go",
            code: `package store

import (
    "context"
    "database/sql"
    "errors"
    "fmt"
    "time"

    _ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" driver for database/sql
)

var ErrNotFound = errors.New("not found")

type Book struct {
    ID        int64
    Title     string
    Author    string
    CreatedAt time.Time
}

// Open creates the pool once at startup and checks the database is reachable.
func Open(ctx context.Context, dsn string) (*sql.DB, error) {
    db, err := sql.Open("pgx", dsn) // validates arguments only; doesn't connect yet
    if err != nil {
        return nil, err
    }
    db.SetMaxOpenConns(25) // stay below the database's max_connections across all instances
    db.SetMaxIdleConns(25)
    db.SetConnMaxLifetime(30 * time.Minute)
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    if err := db.PingContext(ctx); err != nil {
        db.Close()
        return nil, fmt.Errorf("connect to database: %w", err)
    }
    return db, nil
}

type BookStore struct{ db *sql.DB }

func NewBookStore(db *sql.DB) *BookStore { return &BookStore{db: db} }

func (s *BookStore) Get(ctx context.Context, id int64) (Book, error) {
    var b Book
    err := s.db.QueryRowContext(ctx,
        \`SELECT id, title, author, created_at FROM books WHERE id = $1\`, id, // $1: a placeholder, never string concatenation
    ).Scan(&b.ID, &b.Title, &b.Author, &b.CreatedAt)
    if errors.Is(err, sql.ErrNoRows) {
        return Book{}, ErrNotFound // translate driver errors into domain errors
    }
    if err != nil {
        return Book{}, fmt.Errorf("get book %d: %w", id, err)
    }
    return b, nil
}

func (s *BookStore) ListByAuthor(ctx context.Context, author string, limit int) ([]Book, error) {
    rows, err := s.db.QueryContext(ctx,
        \`SELECT id, title, author, created_at FROM books WHERE author = $1 ORDER BY created_at DESC LIMIT $2\`,
        author, limit)
    if err != nil {
        return nil, fmt.Errorf("list books: %w", err)
    }
    defer rows.Close() // returns the connection to the pool
    var out []Book
    for rows.Next() {
        var b Book
        if err := rows.Scan(&b.ID, &b.Title, &b.Author, &b.CreatedAt); err != nil {
            return nil, err
        }
        out = append(out, b)
    }
    return out, rows.Err() // errors that happened during iteration surface here
}

// CreateWithTags writes a book and its tags atomically.
func (s *BookStore) CreateWithTags(ctx context.Context, b Book, tags []string) (int64, error) {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return 0, err
    }
    defer tx.Rollback() // a no-op after a successful Commit

    var id int64
    err = tx.QueryRowContext(ctx,
        \`INSERT INTO books (title, author) VALUES ($1, $2) RETURNING id\`, b.Title, b.Author).Scan(&id)
    if err != nil {
        return 0, fmt.Errorf("insert book: %w", err)
    }
    for _, tag := range tags {
        if _, err := tx.ExecContext(ctx,
            \`INSERT INTO book_tags (book_id, tag) VALUES ($1, $2)\`, id, tag); err != nil {
            return 0, fmt.Errorf("insert tag %q: %w", tag, err)
        }
    }
    return id, tx.Commit()
}`,
          },
        ],
        explain: `- \`sql.DB\` is a **pool**: open it once in \`main\`, share it, and never open one per request.
- Every query takes the request's \`ctx\`: if the client disconnects or a deadline passes, the driver cancels the query in PostgreSQL.
- **Always** \`defer rows.Close()\` and check \`rows.Err()\`; forgetting \`Close\` leaks pooled connections until the app hangs.
- \`defer tx.Rollback()\` right after \`BeginTx\` guarantees no half-finished transaction on any early return.
- With **sqlc**, you'd write only the SQL in \`.sql\` files and it generates exactly these functions and structs for you.`,
      },
      {
        title: "The same API in Gin",
        noCheck: "needs the github.com/gin-gonic/gin module, which the offline test environment doesn't have",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "net/http"
    "strconv"
    "sync"

    "github.com/gin-gonic/gin"
)

type Book struct {
    ID     int    \`json:"id"\`
    Title  string \`json:"title" binding:"required,max=200"\` // validated by go-playground/validator
    Author string \`json:"author" binding:"required"\`
}

type store struct {
    mu     sync.Mutex
    books  map[int]Book
    nextID int
}

func main() {
    s := &store{books: map[int]Book{}, nextID: 1}
    r := gin.Default() // Logger + Recovery middleware

    api := r.Group("/api/v1")
    api.GET("/books/:id", func(c *gin.Context) {
        id, err := strconv.Atoi(c.Param("id"))
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a number"})
            return
        }
        s.mu.Lock()
        b, ok := s.books[id]
        s.mu.Unlock()
        if !ok {
            c.JSON(http.StatusNotFound, gin.H{"error": "book not found"})
            return
        }
        c.JSON(http.StatusOK, b)
    })
    api.POST("/books", func(c *gin.Context) {
        var in Book
        if err := c.ShouldBindJSON(&in); err != nil { // decode + validate in one call
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        s.mu.Lock()
        in.ID = s.nextID
        s.nextID++
        s.books[in.ID] = in
        s.mu.Unlock()
        c.JSON(http.StatusCreated, in)
    })
    r.Run(":8080")
}`,
          },
        ],
        explain: `- \`gin.Context\` wraps the request and response, with helpers for params (\`c.Param\`), queries (\`c.Query\`), binding (\`ShouldBindJSON\`) and responses (\`c.JSON\`).
- \`binding:"required"\` tags give validation for free; the error message lists which fields failed.
- Middleware: \`r.Use(myMiddleware)\` where a middleware is a \`gin.HandlerFunc\` that calls \`c.Next()\` (or \`c.AbortWithStatusJSON\` to stop).
- Testing still works with \`httptest\`: \`r.ServeHTTP(rec, req)\`, because the Gin engine is an \`http.Handler\`.`,
      },
      {
        title: "The same API in Echo",
        noCheck: "needs the github.com/labstack/echo/v4 module, which the offline test environment doesn't have",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "net/http"
    "strconv"
    "sync"

    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
)

type Book struct {
    ID     int    \`json:"id"\`
    Title  string \`json:"title"\`
    Author string \`json:"author"\`
}

func main() {
    var mu sync.Mutex
    books := map[int]Book{}
    nextID := 1

    e := echo.New()
    e.Use(middleware.Logger(), middleware.Recover())

    g := e.Group("/api/v1")
    g.GET("/books/:id", func(c echo.Context) error { // handlers return errors
        id, err := strconv.Atoi(c.Param("id"))
        if err != nil {
            return echo.NewHTTPError(http.StatusBadRequest, "id must be a number")
        }
        mu.Lock()
        defer mu.Unlock()
        b, ok := books[id]
        if !ok {
            return echo.NewHTTPError(http.StatusNotFound, "book not found")
        }
        return c.JSON(http.StatusOK, b)
    })
    g.POST("/books", func(c echo.Context) error {
        var in Book
        if err := c.Bind(&in); err != nil {
            return echo.NewHTTPError(http.StatusBadRequest, err.Error())
        }
        if in.Title == "" {
            return echo.NewHTTPError(http.StatusUnprocessableEntity, "title is required")
        }
        mu.Lock()
        in.ID = nextID
        nextID++
        books[in.ID] = in
        mu.Unlock()
        return c.JSON(http.StatusCreated, in)
    })
    e.Logger.Fatal(e.Start(":8080"))
}`,
          },
        ],
        explain: `- Echo handlers **return an error**; a central \`HTTPErrorHandler\` turns it into a response. Many find this cleaner than writing the error and remembering to \`return\`.
- \`echo.NewHTTPError(status, message)\` produces \`{"message": "..."}\` by default; customize the format with \`e.HTTPErrorHandler\`.
- Validation is pluggable: set \`e.Validator\` (often go-playground/validator) and call \`c.Validate(&in)\`.`,
      },
      {
        title: "The same API in Fiber",
        noCheck: "needs the github.com/gofiber/fiber/v2 module, which the offline test environment doesn't have",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "sync"

    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/logger"
    "github.com/gofiber/fiber/v2/middleware/recover"
)

type Book struct {
    ID     int    \`json:"id"\`
    Title  string \`json:"title"\`
    Author string \`json:"author"\`
}

func main() {
    var mu sync.Mutex
    books := map[int]Book{}
    nextID := 1

    app := fiber.New()
    app.Use(recover.New(), logger.New())

    api := app.Group("/api/v1")
    api.Get("/books/:id", func(c *fiber.Ctx) error {
        id, err := c.ParamsInt("id")
        if err != nil {
            return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id must be a number"})
        }
        mu.Lock()
        defer mu.Unlock()
        b, ok := books[id]
        if !ok {
            return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "book not found"})
        }
        return c.JSON(b)
    })
    api.Post("/books", func(c *fiber.Ctx) error {
        var in Book
        if err := c.BodyParser(&in); err != nil {
            return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
        }
        mu.Lock()
        in.ID = nextID
        nextID++
        books[in.ID] = in
        mu.Unlock()
        return c.Status(fiber.StatusCreated).JSON(in)
    })
    app.Listen(":8080")
}`,
          },
        ],
        explain: `- Fiber's API mirrors Express.js (\`app.Get\`, \`c.Params\`, \`c.Status(...).JSON(...)\`), which makes it popular with Node developers.
- It runs on **fasthttp**, not net/http: standard middleware and \`http.Handler\` code don't plug in directly (there's an adaptor package), and \`httptest\` is replaced by \`app.Test(req)\`.
- fasthttp **reuses** request contexts: strings from \`c.Params\` or the body are only valid during the handler. Copy them (\`utils.CopyString\`) if you keep them in a goroutine or a map. Fiber v3 modernizes the API; check the version a project uses.`,
      },
    ],
    interview: [
      {
        q: "What is http.Handler, and how does middleware work in Go?",
        a: "http.Handler is the one-method interface ServeHTTP(ResponseWriter, *Request) that every server component implements; http.HandlerFunc adapts plain functions to it. Middleware is a function func(http.Handler) http.Handler that returns a new handler wrapping the next one: it can run logic before (auth, request IDs, rate limits), call next.ServeHTTP, run logic after (logging, metrics, using a wrapped ResponseWriter to capture the status), or short-circuit with an error. Chaining them composes cross-cutting concerns, and because routers like chi are Handlers too, everything interoperates.",
        freq: "very-common",
      },
      {
        q: "How does net/http handle concurrent requests? What does that mean for your handlers?",
        a: "http.Server accepts connections in a loop and serves each connection in its own goroutine (HTTP/2 additionally runs each stream's handler in its own goroutine). So handlers execute concurrently: any shared state (maps, counters, caches, in-memory stores) must be protected with mutexes or atomics, or confined to a goroutine. Per-request data should stay in local variables or the request context. Handlers can block on I/O freely because goroutines are cheap and network waits park on the netpoller.",
        freq: "very-common",
      },
      {
        q: "What are common mistakes when using http.Client?",
        a: "Using http.DefaultClient or a client without Timeout (requests can hang forever); creating a new client or Transport per request (no connection reuse, socket exhaustion); forgetting res.Body.Close() (leaks connections) or not draining the body (prevents keep-alive reuse); treating non-2xx statuses as success (Do only errors on transport failures); reading unbounded bodies (use io.LimitReader); not passing a context (can't cancel); retrying non-idempotent requests; and not tuning MaxIdleConnsPerHost for high-throughput calls to one host.",
        freq: "common",
      },
      {
        q: "How would you structure a Go REST API project?",
        a: "A common layout: cmd/api/main.go wires dependencies (config, logger, DB pool, stores, services, router) and starts the server; internal/ holds application packages not importable by others, often split by domain (internal/books with handler.go, service.go, store.go) or by layer (http, service, storage). Handlers deal with HTTP concerns (decode, validate, status codes), services hold business rules and depend on small interfaces, stores implement persistence. Dependencies are injected via struct fields/constructors rather than globals, which makes httptest and fake-based tests easy. Keep it flat until size demands more.",
        freq: "common",
      },
      {
        q: "How do you prevent SQL injection and manage database connections in Go?",
        a: "Always pass values as query arguments with placeholders ($1 in PostgreSQL, ? in MySQL) so the driver sends them separately from the SQL text; never build SQL with fmt.Sprintf or concatenation of user input (for dynamic identifiers like column names, whitelist them). sql.DB is a concurrency-safe connection pool: create it once, configure SetMaxOpenConns/SetMaxIdleConns/SetConnMaxLifetime to fit the database's limits, pass contexts to every query, close Rows, and use transactions with deferred Rollback.",
      },
    ],
    quiz: [
      {
        q: "What signature does a typical Go HTTP middleware have?",
        options: ["func(w, r) error", "func(http.Handler) http.Handler", "func(ctx) ctx", "func(*http.Server)"],
        answer: 1,
        explain: "It wraps a handler and returns a new one.",
      },
      {
        q: "In Go 1.22's ServeMux, how do you read {id} from \"GET /books/{id}\"?",
        options: ["r.URL.Query().Get(\"id\")", "r.PathValue(\"id\")", "mux.Vars(r)[\"id\"]", "r.Form[\"id\"]"],
        answer: 1,
        explain: "chi uses chi.URLParam, Gin c.Param.",
      },
      {
        q: "What timeout does http.DefaultClient have?",
        options: ["30 seconds", "None", "10 seconds", "Depends on the OS"],
        answer: 1,
        explain: "Create your own client with a Timeout.",
      },
      {
        q: "Does client.Do return an error for a 500 response?",
        options: ["Yes", "No: check res.StatusCode yourself", "Only for 5xx", "Only with CheckRedirect"],
        answer: 1,
        explain: "Errors are for transport failures only.",
      },
      {
        q: "Which framework is NOT built on net/http?",
        options: ["chi", "Gin", "Echo", "Fiber"],
        answer: 3,
        explain: "Fiber uses fasthttp.",
      },
      {
        q: "What does sql.Open return?",
        options: ["A single connection", "A connection pool handle", "A transaction", "A cursor"],
        answer: 1,
        explain: "Create one at startup and share it.",
      },
    ],
  },
];
