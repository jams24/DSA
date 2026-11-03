import type { Lesson } from "../types";

// Go track, part 5: guided projects and interview prep.
// The project files were developed and verified as real modules (gofmt, go vet, go test -race).

const urlcheckTree = `urlcheck/
├── go.mod
├── .github/workflows/ci.yml      format, vet, race-checked tests on every push
├── cmd/
│   ├── urlcheck/
│   │   ├── main.go               flags, input sources, output, exit codes
│   │   └── main_test.go          end-to-end tests of run()
│   └── demoserver/
│       └── main.go               a local site with good, broken, slow and redirecting links
└── internal/
    ├── checker/
    │   ├── checker.go            Check (HEAD → GET fallback) and CheckAll (worker pool)
    │   ├── checker_test.go       httptest servers for every scenario
    │   ├── links.go              find and resolve the links on a page
    │   └── links_test.go
    └── report/
        ├── report.go             aligned table and JSON output
        └── report_test.go`;

const snipTree = `snip/
├── go.mod
├── Dockerfile                    multi-stage: build with Go, run on distroless as non-root
├── cmd/snip/
│   └── main.go                   config from env, wiring, graceful shutdown
└── internal/
    ├── links/
    │   ├── links.go              Link, validation, slugs, Service, MemoryStore
    │   └── links_test.go
    ├── ratelimit/
    │   ├── limiter.go            per-client token buckets
    │   └── limiter_test.go       a fake clock: no sleeping in tests
    └── httpapi/
        ├── json.go               decode with friendly errors, encode responses
        ├── server.go             routes, handlers, error mapping
        ├── middleware.go         request IDs, logging, recovery, rate limits, API keys
        └── server_test.go        table-driven tests with httptest`;

export const goProjects: Lesson[] = [
  // ------------------------------------------------------------------ PROJECT 1: URLCHECK
  {
    id: "go-project-cli",
    stage: "Projects",
    title: "Project: urlcheck, a concurrent link checker",
    tagline: "Build a fast CLI that checks hundreds of links at once: a worker pool, HTTP clients with timeouts, HTML link extraction, table and JSON reports, exit codes for CI, and tests with httptest.",
    difficulty: "intermediate",
    minutes: 70,
    visualizers: ["gochan"],
    concept: `
## What you'll build
A command-line tool that finds broken links, quickly:
\`\`\`text
$ urlcheck -page http://127.0.0.1:8090/ -timeout 1s
RESULT  STATUS  TIME    URL
ok      200     <1ms    http://127.0.0.1:8090/about
ok      200     <1ms    http://127.0.0.1:8090/old-blog -> http://127.0.0.1:8090/blog
BROKEN  404     <1ms    http://127.0.0.1:8090/missing
BROKEN  -       1.001s  http://127.0.0.1:8090/slow  (timeout)

7 checked, 4 ok, 3 broken
\`\`\`
It's the kind of tool Go is famous for: one static binary, no runtime to install, concurrency that's easy to get right, and a standard library that already has an HTTP client, HTML-friendly regexps, JSON and a table writer.

## Design decisions (and why)
- **A worker pool, not a goroutine per URL.** Checking 10,000 links with 10,000 goroutines would open 10,000 connections at once and get you rate-limited or blocked. A fixed pool (\`-c 8\`) bounds the load.
- **Results in input order.** Workers write into \`results[i]\`, so no sorting and no mutex: each index has exactly one writer.
- **HEAD first, GET as a fallback.** HEAD skips the body, but some servers reject it with 405.
- **Every request has a timeout and a context.** One hung server can't stall the run, and Ctrl-C cancels everything in flight.
- **\`run()\` returns an exit code.** \`main\` stays two lines, and tests call \`run\` with fake stdin/stdout. Exit codes (0 ok, 1 broken links, 2 usage error) make it usable in CI.
- **\`internal/\` packages.** The checker and report packages can't be imported by other modules, so you can change them freely.
- **A demo server in the repo.** Reproducible manual testing without depending on the internet.

Work through the steps on the **Build** tab. Running the steps needs only Go 1.24+: there are no third-party dependencies.
`,
    keyPoints: [
      "A fixed worker pool bounds concurrency; a channel of indexes feeds it",
      "Writing to results[i] keeps input order without locks",
      "http.Client with Timeout + NewRequestWithContext for every request",
      "Resolve relative links with url.ResolveReference",
      "run(ctx, args, stdin, stdout, stderr) int makes main testable",
      "Exit codes turn a CLI into a CI building block",
      "httptest servers test the network code without the internet",
    ],
    project: {
      summary: `**urlcheck**: a concurrent link checker CLI in pure Go. It reads URLs from arguments, a file, standard input or **every link on a web page**, checks them with a bounded **worker pool**, follows redirects, falls back from HEAD to GET, applies **timeouts and Ctrl-C cancellation**, prints an aligned table or **JSON**, and exits with a status code CI can act on. Tests use **httptest** servers for every scenario and run under the **race detector**.`,
      skills: ["goroutines & worker pools", "channels", "sync.WaitGroup", "context & signals", "net/http client", "net/url", "regexp", "flag", "text/tabwriter", "encoding/json", "httptest", "table-driven tests", "go test -race"],
      tree: urlcheckTree,
      steps: [
        {
          title: "Create the module and a local site to test against",
          explain: `Start with a playground. \`demoserver\` serves a home page linking to pages that work, one that's missing, one that's slow, one that redirects and one served by a server that refuses \`HEAD\` requests. It also links to a port where nothing is listening.

Things to notice:
- \`"GET /{$}"\` matches **only** \`/\`; without \`{$}\`, \`"GET /"\` would match every path.
- A \`GET\` pattern also matches \`HEAD\` requests, so \`/no-head\` checks the method itself to simulate a picky server.
- \`http.RedirectHandler\` gives a permanent redirect in one line.
- The \`home\` HTML mixes relative (\`blog\`), root-relative (\`/about\`), fragment-only (\`#top\`), \`mailto:\` and absolute links: everything the link extractor will need to handle.

Leave it running in its own terminal for the rest of the project.`,
          files: [
            { path: "go.mod", lang: "text", code: `module github.com/you/urlcheck

go 1.24` },
            { path: "cmd/demoserver/main.go", lang: "go", code: `// Command demoserver serves a small local site with working, broken, slow and
// redirecting links, so you can try urlcheck without the internet.
package main

import (
    "flag"
    "fmt"
    "log"
    "net/http"
    "time"
)

const home = \`<!doctype html>
<html><body>
  <h1>Demo site</h1>
  <a href="/about">About</a>
  <a href="blog">Blog</a>
  <a href="/old-blog">Old blog URL</a>
  <a href="/missing">A page that doesn't exist</a>
  <a href="/slow">A very slow page</a>
  <a href="/no-head">A server that refuses HEAD</a>
  <a href="/about#team">About (same page, other anchor)</a>
  <a href="#top">Back to top</a>
  <a href="mailto:hi@example.com">Email us</a>
  <A HREF='http://127.0.0.1:1/'>A server that isn't running</A>
</body></html>\`

func main() {
    addr := flag.String("addr", "127.0.0.1:8090", "listen address")
    flag.Parse()

    ok := func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "<h1>%s</h1>", r.URL.Path) }
    mux := http.NewServeMux()
    mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, _ *http.Request) { fmt.Fprint(w, home) })
    mux.HandleFunc("GET /about", ok)
    mux.HandleFunc("GET /blog", ok)
    mux.Handle("GET /old-blog", http.RedirectHandler("/blog", http.StatusMovedPermanently))
    mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
        time.Sleep(3 * time.Second)
        ok(w, r)
    })
    mux.HandleFunc("GET /no-head", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodHead { // "GET" patterns also match HEAD requests
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        ok(w, r)
    })

    log.Printf("demo site on http://%s/", *addr)
    log.Fatal(http.ListenAndServe(*addr, mux))
}` },
          ],
          run: `mkdir urlcheck && cd urlcheck
go mod init github.com/you/urlcheck
go run ./cmd/demoserver          # keep this running in its own terminal`,
          output: `2026/11/03 23:08:10 demo site on http://127.0.0.1:8090/`,
        },
        {
          title: "Check one URL properly",
          explain: `The \`checker\` package does the real work. \`Check\` returns a \`Result\` value rather than an error, because a broken link is an expected outcome, not a failure of the program.

- **One \`http.Client\`, created once.** It holds a pool of keep-alive connections; creating one per request would throw that away. \`Timeout\` bounds the whole request, and \`CheckRedirect\` stops redirect loops after 5 hops.
- **\`NewRequestWithContext\`** ties each request to a context, so cancellation reaches the network.
- **HEAD, then GET** when the server answers 405 or 501.
- **Always close the body**, and drain a little of it, so the connection can be reused.
- \`resp.Request.URL\` is the URL of the **last** request after redirects: that's how we know where a redirect ended.
- \`describe\` converts \`*url.Error\` values into short messages (\`timeout\`, \`connection refused\`) using \`errors.As\` and the \`Timeout()\` method.

The first \`main.go\` is deliberately naive: it checks URLs **one after another**. Run it and look at the total time.`,
          files: [
            { path: "internal/checker/checker.go", lang: "go", code: `// Package checker checks URLs concurrently.
package checker

import (
    "context"
    "errors"
    "io"
    "net/http"
    "net/url"
    "time"
)

// Result is the outcome of checking one URL.
type Result struct {
    URL      string
    Status   int           // HTTP status of the final response (0 if the request failed)
    FinalURL string        // where redirects ended up, if different from URL
    Latency  time.Duration // time to get the response headers
    Err      string        // a short description of what went wrong, or ""
}

// OK reports whether the link works: no error and a 2xx status.
func (r Result) OK() bool { return r.Err == "" && r.Status >= 200 && r.Status < 300 }

// Options configure a Checker. Zero values get sensible defaults.
type Options struct {
    Concurrency int           // checks in flight at once (default 8)
    Timeout     time.Duration // per request (default 10s)
    UserAgent   string
}

// Checker checks links. It's safe for concurrent use.
type Checker struct {
    client *http.Client
    opts   Options
}

func New(opts Options) *Checker {
    if opts.Concurrency < 1 {
        opts.Concurrency = 8
    }
    if opts.Timeout <= 0 {
        opts.Timeout = 10 * time.Second
    }
    if opts.UserAgent == "" {
        opts.UserAgent = "urlcheck/1.0"
    }
    client := &http.Client{
        Timeout: opts.Timeout,
        CheckRedirect: func(_ *http.Request, via []*http.Request) error {
            if len(via) >= 5 {
                return errors.New("stopped after 5 redirects")
            }
            return nil
        },
    }
    return &Checker{client: client, opts: opts}
}

// Check checks one URL. It tries HEAD first (no body to download) and falls back
// to GET for servers that don't support HEAD.
func (c *Checker) Check(ctx context.Context, rawURL string) Result {
    res := Result{URL: rawURL}
    u, err := url.Parse(rawURL)
    if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
        res.Err = "invalid URL (want http:// or https://)"
        return res
    }

    start := time.Now()
    status, final, err := c.do(ctx, http.MethodHead, rawURL)
    if err == nil && (status == http.StatusMethodNotAllowed || status == http.StatusNotImplemented) {
        status, final, err = c.do(ctx, http.MethodGet, rawURL)
    }
    res.Latency = time.Since(start)
    if err != nil {
        res.Err = describe(err)
        return res
    }
    res.Status = status
    if final != rawURL {
        res.FinalURL = final
    }
    return res
}

func (c *Checker) do(ctx context.Context, method, rawURL string) (status int, finalURL string, err error) {
    req, err := http.NewRequestWithContext(ctx, method, rawURL, nil)
    if err != nil {
        return 0, "", err
    }
    req.Header.Set("User-Agent", c.opts.UserAgent)
    resp, err := c.client.Do(req)
    if err != nil {
        return 0, "", err
    }
    defer resp.Body.Close()
    _, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10)) // drain a little so the connection can be reused
    return resp.StatusCode, resp.Request.URL.String(), nil        // resp.Request is the last request after redirects
}

// describe turns transport errors into short, readable messages.
func describe(err error) string {
    var urlErr *url.Error
    switch {
    case errors.Is(err, context.Canceled):
        return "canceled"
    case errors.As(err, &urlErr) && urlErr.Timeout():
        return "timeout"
    case errors.As(err, &urlErr):
        return urlErr.Err.Error() // drop the \`Head "http://...":\` prefix: the URL is already in the report
    default:
        return err.Error()
    }
}` },
            { path: "cmd/urlcheck/main.go", lang: "go", code: `// Command urlcheck checks links. Version 1: one at a time.
package main

import (
    "context"
    "fmt"
    "os"
    "time"

    "github.com/you/urlcheck/internal/checker"
)

func main() {
    c := checker.New(checker.Options{Timeout: 5 * time.Second})
    start := time.Now()
    for _, u := range os.Args[1:] {
        r := c.Check(context.Background(), u)
        if r.OK() {
            fmt.Printf("ok      %d  %s\\n", r.Status, u)
        } else {
            fmt.Printf("BROKEN  %d  %s %s\\n", r.Status, u, r.Err)
        }
    }
    fmt.Printf("checked %d URLs in %v\\n", len(os.Args)-1, time.Since(start).Round(10*time.Millisecond))
}` },
          ],
          run: `go run ./cmd/urlcheck http://127.0.0.1:8090/about http://127.0.0.1:8090/missing \\
  http://127.0.0.1:8090/slow 'http://127.0.0.1:8090/slow?again' http://127.0.0.1:1/ ftp://example.com`,
          output: `ok      200  http://127.0.0.1:8090/about
BROKEN  404  http://127.0.0.1:8090/missing
ok      200  http://127.0.0.1:8090/slow
ok      200  http://127.0.0.1:8090/slow?again
BROKEN  0  http://127.0.0.1:1/ dial tcp 127.0.0.1:1: connect: connection refused
BROKEN  0  ftp://example.com invalid URL (want http:// or https://)
checked 6 URLs in 6.01s`,
        },
        {
          title: "Check many URLs at once with a worker pool",
          explain: `Two slow pages took 6 seconds because each waited for the previous one. \`CheckAll\` runs them concurrently:

1. **Start N workers** (\`min(Concurrency, len(urls))\`), each ranging over a \`jobs\` channel of **indexes**.
2. **Feed indexes** into \`jobs\`. The \`select\` also watches \`ctx.Done()\`, so after Ctrl-C we stop handing out work.
3. **\`close(jobs)\`** ends every worker's \`range\` loop once the queue is drained; \`wg.Wait()\` waits for them.
4. Each worker writes \`results[i]\` for the index it received. Different goroutines writing **different elements** of a slice is safe, and the results stay in input order for free.
5. URLs that never started because of cancellation are filled in as \`canceled\`.

The checker now has everything; \`main\` just calls \`CheckAll\`. Same command, half the time: the two slow pages now load at the same time.`,
          files: [
            { path: "internal/checker/checker.go", lang: "go", code: `// Package checker checks URLs concurrently.
package checker

import (
    "context"
    "errors"
    "io"
    "net/http"
    "net/url"
    "sync"
    "time"
)

// Result is the outcome of checking one URL.
type Result struct {
    URL      string
    Status   int           // HTTP status of the final response (0 if the request failed)
    FinalURL string        // where redirects ended up, if different from URL
    Latency  time.Duration // time to get the response headers
    Err      string        // a short description of what went wrong, or ""
}

// OK reports whether the link works: no error and a 2xx status.
func (r Result) OK() bool { return r.Err == "" && r.Status >= 200 && r.Status < 300 }

// Options configure a Checker. Zero values get sensible defaults.
type Options struct {
    Concurrency int           // checks in flight at once (default 8)
    Timeout     time.Duration // per request (default 10s)
    UserAgent   string
}

// Checker checks links. It's safe for concurrent use.
type Checker struct {
    client *http.Client
    opts   Options
}

func New(opts Options) *Checker {
    if opts.Concurrency < 1 {
        opts.Concurrency = 8
    }
    if opts.Timeout <= 0 {
        opts.Timeout = 10 * time.Second
    }
    if opts.UserAgent == "" {
        opts.UserAgent = "urlcheck/1.0"
    }
    client := &http.Client{
        Timeout: opts.Timeout,
        CheckRedirect: func(_ *http.Request, via []*http.Request) error {
            if len(via) >= 5 {
                return errors.New("stopped after 5 redirects")
            }
            return nil
        },
    }
    return &Checker{client: client, opts: opts}
}

// Check checks one URL. It tries HEAD first (no body to download) and falls back
// to GET for servers that don't support HEAD.
func (c *Checker) Check(ctx context.Context, rawURL string) Result {
    res := Result{URL: rawURL}
    u, err := url.Parse(rawURL)
    if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
        res.Err = "invalid URL (want http:// or https://)"
        return res
    }

    start := time.Now()
    status, final, err := c.do(ctx, http.MethodHead, rawURL)
    if err == nil && (status == http.StatusMethodNotAllowed || status == http.StatusNotImplemented) {
        status, final, err = c.do(ctx, http.MethodGet, rawURL)
    }
    res.Latency = time.Since(start)
    if err != nil {
        res.Err = describe(err)
        return res
    }
    res.Status = status
    if final != rawURL {
        res.FinalURL = final
    }
    return res
}

func (c *Checker) do(ctx context.Context, method, rawURL string) (status int, finalURL string, err error) {
    req, err := http.NewRequestWithContext(ctx, method, rawURL, nil)
    if err != nil {
        return 0, "", err
    }
    req.Header.Set("User-Agent", c.opts.UserAgent)
    resp, err := c.client.Do(req)
    if err != nil {
        return 0, "", err
    }
    defer resp.Body.Close()
    _, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10)) // drain a little so the connection can be reused
    return resp.StatusCode, resp.Request.URL.String(), nil        // resp.Request is the last request after redirects
}

// describe turns transport errors into short, readable messages.
func describe(err error) string {
    var urlErr *url.Error
    switch {
    case errors.Is(err, context.Canceled):
        return "canceled"
    case errors.As(err, &urlErr) && urlErr.Timeout():
        return "timeout"
    case errors.As(err, &urlErr):
        return urlErr.Err.Error() // drop the \`Head "http://...":\` prefix: the URL is already in the report
    default:
        return err.Error()
    }
}

// CheckAll checks every URL with at most Options.Concurrency requests in flight.
// Results are returned in the same order as urls. If ctx is canceled, URLs that
// never started are reported as "canceled".
func (c *Checker) CheckAll(ctx context.Context, urls []string) []Result {
    results := make([]Result, len(urls))
    jobs := make(chan int) // indexes into urls

    var wg sync.WaitGroup
    for range min(c.opts.Concurrency, len(urls)) {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for i := range jobs {
                results[i] = c.Check(ctx, urls[i]) // each index is written by exactly one worker
            }
        }()
    }

feed:
    for i := range urls {
        select {
        case jobs <- i:
        case <-ctx.Done():
            break feed
        }
    }
    close(jobs) // workers finish their current URL, then their range loops end
    wg.Wait()

    for i := range results {
        if results[i].URL == "" {
            results[i] = Result{URL: urls[i], Err: "canceled"}
        }
    }
    return results
}` },
            { path: "cmd/urlcheck/main.go", lang: "go", code: `// Command urlcheck checks links. Version 2: concurrently.
package main

import (
    "context"
    "fmt"
    "os"
    "time"

    "github.com/you/urlcheck/internal/checker"
)

func main() {
    c := checker.New(checker.Options{Concurrency: 8, Timeout: 5 * time.Second})
    start := time.Now()
    results := c.CheckAll(context.Background(), os.Args[1:]) // same order as the arguments
    for _, r := range results {
        if r.OK() {
            fmt.Printf("ok      %d  %s\\n", r.Status, r.URL)
        } else {
            fmt.Printf("BROKEN  %d  %s %s\\n", r.Status, r.URL, r.Err)
        }
    }
    fmt.Printf("checked %d URLs in %v\\n", len(results), time.Since(start).Round(10*time.Millisecond))
}` },
          ],
          run: `go run ./cmd/urlcheck http://127.0.0.1:8090/about http://127.0.0.1:8090/missing \\
  http://127.0.0.1:8090/slow 'http://127.0.0.1:8090/slow?again' http://127.0.0.1:1/ ftp://example.com`,
          output: `ok      200  http://127.0.0.1:8090/about
BROKEN  404  http://127.0.0.1:8090/missing
ok      200  http://127.0.0.1:8090/slow
ok      200  http://127.0.0.1:8090/slow?again
BROKEN  0  http://127.0.0.1:1/ dial tcp 127.0.0.1:1: connect: connection refused
BROKEN  0  ftp://example.com invalid URL (want http:// or https://)
checked 6 URLs in 3s`,
        },
        {
          title: "Find every link on a page",
          explain: `\`FetchLinks\` downloads a page (capped at 5 MB with \`io.LimitReader\`) and \`ExtractLinks\` pulls out the \`href\` of every \`<a>\` tag.

- The regular expression is case-insensitive (\`(?i)\`), accepts single or double quotes, and stops at \`#\`, so fragment-only links like \`#top\` don't match at all.
- **\`base.ResolveReference(ref)\`** turns \`blog\`, \`/about\` or \`../index.html\` into absolute URLs, exactly as a browser would. Resolving against \`resp.Request.URL\` (after redirects) matters: relative links are relative to where the page actually lives.
- \`mailto:\`, \`tel:\` and \`javascript:\` links are skipped by checking the scheme, fragments are removed, and a \`seen\` map drops duplicates while keeping first-seen order.

A regexp is a pragmatic choice for a link checker. For anything that must understand real-world HTML (scripts, comments, broken markup), use the tokenizer in \`golang.org/x/net/html\`.`,
          files: [
            { path: "internal/checker/links.go", lang: "go", code: `package checker

import (
    "context"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "regexp"
    "strings"
)

// hrefRE finds the href of <a> tags. A regular expression is fine for a link checker;
// for full HTML parsing use golang.org/x/net/html.
var hrefRE = regexp.MustCompile(\`(?i)<a\\s[^>]*?href\\s*=\\s*["']([^"'#]+)\`)

// ExtractLinks returns the absolute http(s) links in an HTML page, resolved against
// base, without duplicates, in the order they first appear.
func ExtractLinks(base *url.URL, html string) []string {
    seen := map[string]bool{}
    var links []string
    for _, m := range hrefRE.FindAllStringSubmatch(html, -1) {
        ref, err := url.Parse(strings.TrimSpace(m[1]))
        if err != nil {
            continue
        }
        abs := base.ResolveReference(ref) // "/about" on http://site/blog/ -> http://site/about
        if abs.Scheme != "http" && abs.Scheme != "https" {
            continue // mailto:, tel:, javascript:...
        }
        abs.Fragment = ""
        if s := abs.String(); !seen[s] {
            seen[s] = true
            links = append(links, s)
        }
    }
    return links
}

// FetchLinks downloads a page and returns the links on it.
func (c *Checker) FetchLinks(ctx context.Context, pageURL string) ([]string, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, pageURL, nil)
    if err != nil {
        return nil, fmt.Errorf("fetch page: %w", err)
    }
    req.Header.Set("User-Agent", c.opts.UserAgent)
    resp, err := c.client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("fetch page: %s", describe(err))
    }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("fetch page: status %d", resp.StatusCode)
    }
    body, err := io.ReadAll(io.LimitReader(resp.Body, 5<<20)) // cap at 5 MB
    if err != nil {
        return nil, fmt.Errorf("read page: %w", err)
    }
    return ExtractLinks(resp.Request.URL, string(body)), nil // resolve against the URL after redirects
}` },
          ],
        },
        {
          title: "Reports, flags and exit codes",
          explain: `Now the real CLI.

**\`report\`** formats results. \`text/tabwriter\` aligns columns: write cells separated by \`\\t\`, then \`Flush\`. JSON output uses its **own struct** with tags (\`latency_ms\`), so the JSON format is a stable contract that doesn't change when internal types do.

**\`main.go\`** follows a pattern worth copying for every CLI:
- \`main\` only sets up the signal context, calls \`run\`, and calls \`os.Exit\` with the result. (\`os.Exit\` skips deferred functions, which is why \`stop()\` is called explicitly first.)
- \`run\` receives \`args\`, \`stdin\`, \`stdout\` and \`stderr\` as parameters, so tests can drive it completely.
- A \`flag.FlagSet\` with \`ContinueOnError\` returns errors instead of exiting the process. \`-h\` returns \`flag.ErrHelp\`, which is a successful exit.
- URLs come from arguments, \`-f file\`, \`-page\`, or **standard input when it's a pipe** (\`isPiped\` checks whether stdin is a terminal), and duplicates are removed.
- Exit codes: \`0\` everything fine, \`1\` broken links, \`2\` usage or input errors. A CI job can now run \`urlcheck -f links.txt\` and fail the build on a broken link.`,
          files: [
            { path: "internal/report/report.go", lang: "go", code: `// Package report formats check results for people (a table) and programs (JSON).
package report

import (
    "encoding/json"
    "fmt"
    "io"
    "math"
    "strconv"
    "text/tabwriter"
    "time"

    "github.com/you/urlcheck/internal/checker"
)

// Count returns how many results are ok and how many are broken.
func Count(results []checker.Result) (ok, broken int) {
    for _, r := range results {
        if r.OK() {
            ok++
        } else {
            broken++
        }
    }
    return ok, broken
}

// Text writes an aligned table followed by a summary line.
func Text(w io.Writer, results []checker.Result, onlyBroken bool) error {
    tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0) // minwidth, tabwidth, padding, padchar, flags
    fmt.Fprintln(tw, "RESULT\\tSTATUS\\tTIME\\tURL")
    for _, r := range results {
        if onlyBroken && r.OK() {
            continue
        }
        fmt.Fprintf(tw, "%s\\t%s\\t%s\\t%s\\n", verdict(r), status(r), latency(r), target(r))
    }
    if err := tw.Flush(); err != nil {
        return err
    }
    ok, broken := Count(results)
    _, err := fmt.Fprintf(w, "\\n%d checked, %d ok, %d broken\\n", len(results), ok, broken)
    return err
}

func verdict(r checker.Result) string {
    if r.OK() {
        return "ok"
    }
    return "BROKEN"
}

func status(r checker.Result) string {
    if r.Status == 0 {
        return "-"
    }
    return strconv.Itoa(r.Status)
}

func latency(r checker.Result) string {
    switch {
    case r.Latency == 0:
        return "-"
    case r.Latency < time.Millisecond:
        return "<1ms"
    default:
        return r.Latency.Round(time.Millisecond).String()
    }
}

func target(r checker.Result) string {
    s := r.URL
    if r.FinalURL != "" {
        s += " -> " + r.FinalURL
    }
    if r.Err != "" {
        s += "  (" + r.Err + ")"
    }
    return s
}

type jsonResult struct {
    URL       string  \`json:"url"\`
    OK        bool    \`json:"ok"\`
    Status    int     \`json:"status,omitempty"\`
    FinalURL  string  \`json:"final_url,omitempty"\`
    LatencyMS float64 \`json:"latency_ms"\`
    Error     string  \`json:"error,omitempty"\`
}

type jsonReport struct {
    Checked int          \`json:"checked"\`
    OK      int          \`json:"ok"\`
    Broken  int          \`json:"broken"\`
    Results []jsonResult \`json:"results"\`
}

// JSON writes the results as one indented JSON document, for scripts and CI.
func JSON(w io.Writer, results []checker.Result) error {
    rep := jsonReport{Checked: len(results), Results: make([]jsonResult, 0, len(results))}
    rep.OK, rep.Broken = Count(results)
    for _, r := range results {
        rep.Results = append(rep.Results, jsonResult{
            URL:       r.URL,
            OK:        r.OK(),
            Status:    r.Status,
            FinalURL:  r.FinalURL,
            LatencyMS: math.Round(float64(r.Latency.Microseconds())/100) / 10, // one decimal place
            Error:     r.Err,
        })
    }
    enc := json.NewEncoder(w)
    enc.SetIndent("", "  ")
    return enc.Encode(rep)
}` },
            { path: "cmd/urlcheck/main.go", lang: "go", code: `// Command urlcheck checks links concurrently and reports the broken ones.
package main

import (
    "bufio"
    "context"
    "errors"
    "flag"
    "fmt"
    "io"
    "os"
    "os/signal"
    "strings"
    "time"

    "github.com/you/urlcheck/internal/checker"
    "github.com/you/urlcheck/internal/report"
)

func main() {
    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt) // Ctrl-C cancels in-flight checks
    defer stop()
    code := run(ctx, os.Args[1:], os.Stdin, os.Stdout, os.Stderr)
    stop()
    os.Exit(code) // os.Exit skips deferred calls, so stop() was called explicitly above
}

// run is main without the process-wide side effects, so tests can call it.
// It returns the exit code: 0 all ok, 1 some links broken, 2 usage or input error.
func run(ctx context.Context, args []string, stdin io.Reader, stdout, stderr io.Writer) int {
    fs := flag.NewFlagSet("urlcheck", flag.ContinueOnError)
    fs.SetOutput(stderr)
    concurrency := fs.Int("c", 8, "number of concurrent checks")
    timeout := fs.Duration("timeout", 10*time.Second, "timeout per request")
    file := fs.String("f", "", "read URLs from a file, one per line (# starts a comment)")
    page := fs.String("page", "", "check every link on this web page")
    asJSON := fs.Bool("json", false, "print results as JSON")
    onlyBroken := fs.Bool("broken", false, "only list broken links")
    fs.Usage = func() {
        fmt.Fprintln(stderr, "Usage: urlcheck [flags] [url ...]")
        fmt.Fprintln(stderr, "\\nChecks links concurrently. URLs come from arguments, -f, -page or standard input.")
        fmt.Fprintln(stderr, "Exit status: 0 all ok, 1 some links broken, 2 usage error.\\n\\nFlags:")
        fs.PrintDefaults()
    }
    if err := fs.Parse(args); err != nil {
        if errors.Is(err, flag.ErrHelp) {
            return 0
        }
        return 2 // the flag package already printed the problem and the usage
    }

    c := checker.New(checker.Options{Concurrency: *concurrency, Timeout: *timeout})
    urls, err := collectURLs(ctx, c, fs.Args(), *file, *page, stdin)
    if err != nil {
        fmt.Fprintln(stderr, "urlcheck:", err)
        return 2
    }
    if len(urls) == 0 {
        fs.Usage()
        return 2
    }

    results := c.CheckAll(ctx, urls)
    if *asJSON {
        err = report.JSON(stdout, results)
    } else {
        err = report.Text(stdout, results, *onlyBroken)
    }
    if err != nil {
        fmt.Fprintln(stderr, "urlcheck:", err)
        return 2
    }
    if _, broken := report.Count(results); broken > 0 {
        return 1
    }
    return 0
}

func collectURLs(ctx context.Context, c *checker.Checker, args []string, file, page string, stdin io.Reader) ([]string, error) {
    urls := append([]string(nil), args...)
    if file != "" {
        f, err := os.Open(file)
        if err != nil {
            return nil, err
        }
        defer f.Close()
        lines, err := readLines(f)
        if err != nil {
            return nil, fmt.Errorf("read %s: %w", file, err)
        }
        urls = append(urls, lines...)
    }
    if page != "" {
        links, err := c.FetchLinks(ctx, page)
        if err != nil {
            return nil, err
        }
        urls = append(urls, links...)
    }
    if len(urls) == 0 && isPiped(stdin) { // echo https://go.dev | urlcheck
        lines, err := readLines(stdin)
        if err != nil {
            return nil, fmt.Errorf("read stdin: %w", err)
        }
        urls = lines
    }
    return unique(urls), nil
}

// readLines returns the non-empty lines that aren't comments.
func readLines(r io.Reader) ([]string, error) {
    var lines []string
    sc := bufio.NewScanner(r)
    for sc.Scan() {
        line := strings.TrimSpace(sc.Text())
        if line != "" && !strings.HasPrefix(line, "#") {
            lines = append(lines, line)
        }
    }
    return lines, sc.Err()
}

// isPiped reports whether r is a pipe or file rather than an interactive terminal.
func isPiped(r io.Reader) bool {
    f, ok := r.(*os.File)
    if !ok {
        return true // a strings.Reader or bytes.Buffer in tests
    }
    info, err := f.Stat()
    return err == nil && info.Mode()&os.ModeCharDevice == 0
}

func unique(items []string) []string {
    seen := make(map[string]bool, len(items))
    out := items[:0:0] // a new, empty slice: don't overwrite the caller's array
    for _, it := range items {
        if !seen[it] {
            seen[it] = true
            out = append(out, it)
        }
    }
    return out
}` },
          ],
          run: `go build -o urlcheck ./cmd/urlcheck
./urlcheck -page http://127.0.0.1:8090/ -timeout 1s; echo "exit status $?"
./urlcheck -broken -c 2 -page http://127.0.0.1:8090/ -timeout 1s
printf 'http://127.0.0.1:8090/about\\n# comment\\nhttp://127.0.0.1:8090/blog\\n' | ./urlcheck; echo "exit status $?"
./urlcheck -json http://127.0.0.1:8090/old-blog http://127.0.0.1:1/`,
          output: `RESULT  STATUS  TIME    URL
ok      200     <1ms    http://127.0.0.1:8090/about
ok      200     <1ms    http://127.0.0.1:8090/blog
ok      200     <1ms    http://127.0.0.1:8090/old-blog -> http://127.0.0.1:8090/blog
BROKEN  404     <1ms    http://127.0.0.1:8090/missing
BROKEN  -       1.001s  http://127.0.0.1:8090/slow  (timeout)
ok      200     <1ms    http://127.0.0.1:8090/no-head
BROKEN  -       <1ms    http://127.0.0.1:1/  (dial tcp 127.0.0.1:1: connect: connection refused)

7 checked, 4 ok, 3 broken
exit status 1

RESULT  STATUS  TIME    URL
BROKEN  404     <1ms    http://127.0.0.1:8090/missing
BROKEN  -       1.001s  http://127.0.0.1:8090/slow  (timeout)
BROKEN  -       <1ms    http://127.0.0.1:1/  (dial tcp 127.0.0.1:1: connect: connection refused)

7 checked, 4 ok, 3 broken

RESULT  STATUS  TIME  URL
ok      200     1ms   http://127.0.0.1:8090/about
ok      200     1ms   http://127.0.0.1:8090/blog

2 checked, 2 ok, 0 broken
exit status 0

{
  "checked": 2,
  "ok": 1,
  "broken": 1,
  "results": [
    {
      "url": "http://127.0.0.1:8090/old-blog",
      "ok": true,
      "status": 200,
      "final_url": "http://127.0.0.1:8090/blog",
      "latency_ms": 0.8
    },
    {
      "url": "http://127.0.0.1:1/",
      "ok": false,
      "latency_ms": 0.4,
      "error": "dial tcp 127.0.0.1:1: connect: connection refused"
    }
  ]
}`,
        },
        {
          title: "Test everything with httptest",
          explain: `No test touches the internet: each starts its own server with \`httptest.NewServer\` on a random local port.

- **\`checker_test.go\`** is table-driven: OK, 404, redirects, the HEAD fallback, timeouts (the slow handler stops when the client gives up, via \`r.Context().Done()\`), redirect loops and invalid URLs. One test counts in-flight requests on the server with an atomic to prove \`CheckAll\` **never exceeds the concurrency limit** and keeps the order. Another passes an already-canceled context.
- **\`links_test.go\`** covers the tricky URL cases: relative paths, \`../\`, fragments, duplicates, \`mailto:\`, uppercase tags and single quotes.
- **\`report_test.go\`** compares the exact table text (a "golden" string) and round-trips the JSON.
- **\`main_test.go\`** calls \`run\` with a \`strings.Reader\` as stdin and \`strings.Builder\`s as stdout and stderr, checking exit codes end to end.

Always run with \`-race\`: \`CheckAll\` is concurrent, and the race detector would catch a worker writing to shared state without synchronization.`,
          files: [
            { path: "internal/checker/checker_test.go", lang: "go", code: `package checker

import (
    "context"
    "fmt"
    "net/http"
    "net/http/httptest"
    "sync/atomic"
    "testing"
    "time"
)

// newSite starts a local test server with one route per scenario.
func newSite(t *testing.T) *httptest.Server {
    t.Helper()
    mux := http.NewServeMux()
    mux.HandleFunc("GET /ok", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.Handle("GET /moved", http.RedirectHandler("/ok", http.StatusMovedPermanently))
    mux.HandleFunc("GET /no-head", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodHead {
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })
    mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
        select {
        case <-time.After(2 * time.Second):
        case <-r.Context().Done(): // stop as soon as the client gives up
        }
    })
    mux.HandleFunc("GET /loop", func(w http.ResponseWriter, r *http.Request) {
        http.Redirect(w, r, "/loop", http.StatusFound)
    })
    srv := httptest.NewServer(mux)
    t.Cleanup(srv.Close)
    return srv
}

func TestCheck(t *testing.T) {
    srv := newSite(t)
    c := New(Options{Timeout: 200 * time.Millisecond})

    tests := []struct {
        name       string
        url        string
        wantStatus int
        wantFinal  string
        wantErr    string
        wantOK     bool
    }{
        {name: "ok", url: srv.URL + "/ok", wantStatus: 200, wantOK: true},
        {name: "not found", url: srv.URL + "/nope", wantStatus: 404},
        {name: "redirect is followed", url: srv.URL + "/moved", wantStatus: 200, wantFinal: srv.URL + "/ok", wantOK: true},
        {name: "falls back to GET", url: srv.URL + "/no-head", wantStatus: 200, wantOK: true},
        {name: "timeout", url: srv.URL + "/slow", wantErr: "timeout"},
        {name: "redirect loop", url: srv.URL + "/loop", wantErr: "stopped after 5 redirects"},
        {name: "not http", url: "ftp://example.com/file", wantErr: "invalid URL (want http:// or https://)"},
        {name: "garbage", url: "::not a url", wantErr: "invalid URL (want http:// or https://)"},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            got := c.Check(context.Background(), tt.url)
            if got.Status != tt.wantStatus || got.FinalURL != tt.wantFinal || got.Err != tt.wantErr || got.OK() != tt.wantOK {
                t.Errorf("Check(%q) = %+v, want status %d final %q err %q ok %v",
                    tt.url, got, tt.wantStatus, tt.wantFinal, tt.wantErr, tt.wantOK)
            }
        })
    }
}

func TestCheckAllKeepsOrderAndLimitsConcurrency(t *testing.T) {
    var inFlight, peak atomic.Int32
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        n := inFlight.Add(1)
        defer inFlight.Add(-1)
        for old := peak.Load(); n > old && !peak.CompareAndSwap(old, n); old = peak.Load() {
        }
        time.Sleep(10 * time.Millisecond)
        if r.URL.Path == "/bad" {
            w.WriteHeader(http.StatusInternalServerError)
        }
    }))
    defer srv.Close()

    var urls []string
    for i := range 20 {
        path := fmt.Sprintf("/page/%d", i)
        if i%5 == 0 {
            path = "/bad"
        }
        urls = append(urls, srv.URL+path)
    }
    results := New(Options{Concurrency: 3}).CheckAll(context.Background(), urls)

    if len(results) != len(urls) {
        t.Fatalf("got %d results, want %d", len(results), len(urls))
    }
    for i, r := range results {
        if r.URL != urls[i] {
            t.Errorf("results[%d].URL = %q, want %q (order must match input)", i, r.URL, urls[i])
        }
        if wantOK := i%5 != 0; r.OK() != wantOK {
            t.Errorf("results[%d].OK() = %v, want %v", i, r.OK(), wantOK)
        }
    }
    if p := peak.Load(); p > 3 {
        t.Errorf("peak concurrency %d, want at most 3", p)
    }
}

func TestCheckAllCanceled(t *testing.T) {
    srv := newSite(t)
    ctx, cancel := context.WithCancel(context.Background())
    cancel() // already canceled: nothing should be fetched

    results := New(Options{}).CheckAll(ctx, []string{srv.URL + "/ok", srv.URL + "/slow"})
    for _, r := range results {
        if r.Err != "canceled" {
            t.Errorf("%s: err = %q, want canceled", r.URL, r.Err)
        }
    }
}` },
            { path: "internal/checker/links_test.go", lang: "go", code: `package checker

import (
    "context"
    "net/http"
    "net/http/httptest"
    "net/url"
    "slices"
    "testing"
)

func TestExtractLinks(t *testing.T) {
    base, _ := url.Parse("https://site.test/blog/post.html")
    tests := []struct {
        name string
        html string
        want []string
    }{
        {"absolute", \`<a href="https://go.dev/doc">x</a>\`, []string{"https://go.dev/doc"}},
        {"root-relative", \`<a href="/about">x</a>\`, []string{"https://site.test/about"}},
        {"relative", \`<a href="other.html">x</a>\`, []string{"https://site.test/blog/other.html"}},
        {"parent", \`<a href="../index.html">x</a>\`, []string{"https://site.test/index.html"}},
        {"fragment removed, duplicates dropped", \`<a href="/a#one">1</a> <a href="/a#two">2</a>\`, []string{"https://site.test/a"}},
        {"fragment-only skipped", \`<a href="#top">top</a>\`, nil},
        {"mailto skipped", \`<a href="mailto:x@y.z">mail</a>\`, nil},
        {"case and quotes", \`<A class="nav" HREF='/Docs'>docs</A>\`, []string{"https://site.test/Docs"}},
        {"not a link tag", \`<link href="/style.css"> <img src="/x.png">\`, nil},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := ExtractLinks(base, tt.html); !slices.Equal(got, tt.want) {
                t.Errorf("ExtractLinks() = %q, want %q", got, tt.want)
            }
        })
    }
}

func TestFetchLinks(t *testing.T) {
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/" {
            http.NotFound(w, r)
            return
        }
        w.Write([]byte(\`<a href="/a">a</a><a href="b">b</a>\`))
    }))
    defer srv.Close()
    c := New(Options{})

    got, err := c.FetchLinks(context.Background(), srv.URL+"/")
    want := []string{srv.URL + "/a", srv.URL + "/b"}
    if err != nil || !slices.Equal(got, want) {
        t.Errorf("FetchLinks() = %q, %v; want %q", got, err, want)
    }
    if _, err := c.FetchLinks(context.Background(), srv.URL+"/missing"); err == nil || err.Error() != "fetch page: status 404" {
        t.Errorf("missing page: err = %v, want status 404", err)
    }
}` },
            { path: "internal/report/report_test.go", lang: "go", code: `package report

import (
    "encoding/json"
    "strings"
    "testing"
    "time"

    "github.com/you/urlcheck/internal/checker"
)

var sample = []checker.Result{
    {URL: "https://a.test/", Status: 200, Latency: 12 * time.Millisecond},
    {URL: "https://a.test/old", Status: 200, FinalURL: "https://a.test/new", Latency: 31 * time.Millisecond},
    {URL: "https://a.test/gone", Status: 404, Latency: 9 * time.Millisecond},
    {URL: "https://down.test/", Err: "connection refused", Latency: 2 * time.Millisecond},
}

func TestText(t *testing.T) {
    var b strings.Builder
    if err := Text(&b, sample, false); err != nil {
        t.Fatal(err)
    }
    want := \`RESULT  STATUS  TIME  URL
ok      200     12ms  https://a.test/
ok      200     31ms  https://a.test/old -> https://a.test/new
BROKEN  404     9ms   https://a.test/gone
BROKEN  -       2ms   https://down.test/  (connection refused)

4 checked, 2 ok, 2 broken
\`
    if got := b.String(); got != want {
        t.Errorf("Text() output:\\n%s\\nwant:\\n%s", got, want)
    }
}

func TestTextOnlyBroken(t *testing.T) {
    var b strings.Builder
    _ = Text(&b, sample, true)
    if strings.Contains(b.String(), "ok      200") {
        t.Errorf("onlyBroken output still lists working links:\\n%s", b.String())
    }
    if !strings.HasSuffix(b.String(), "4 checked, 2 ok, 2 broken\\n") {
        t.Errorf("the summary should still count every link:\\n%s", b.String())
    }
}

func TestJSON(t *testing.T) {
    var b strings.Builder
    if err := JSON(&b, sample); err != nil {
        t.Fatal(err)
    }
    var got jsonReport
    if err := json.Unmarshal([]byte(b.String()), &got); err != nil {
        t.Fatalf("output is not valid JSON: %v\\n%s", err, b.String())
    }
    if got.Checked != 4 || got.OK != 2 || got.Broken != 2 || len(got.Results) != 4 {
        t.Errorf("summary = %+v", got)
    }
    if r := got.Results[3]; r.OK || r.Error != "connection refused" || r.LatencyMS != 2 {
        t.Errorf("results[3] = %+v", r)
    }
}` },
            { path: "cmd/urlcheck/main_test.go", lang: "go", code: `package main

import (
    "context"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
)

func TestRun(t *testing.T) {
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/":
            w.Write([]byte(\`<a href="/ok">ok</a> <a href="/gone">gone</a>\`))
        case "/ok":
        default:
            http.NotFound(w, r)
        }
    }))
    defer srv.Close()

    tests := []struct {
        name     string
        args     []string
        stdin    string
        wantCode int
        wantOut  []string // substrings expected in stdout
    }{
        {"all ok", []string{srv.URL + "/ok"}, "", 0, []string{"1 checked, 1 ok, 0 broken"}},
        {"broken link exits 1", []string{srv.URL + "/ok", srv.URL + "/gone"}, "", 1, []string{"BROKEN  404"}},
        {"urls from stdin", nil, srv.URL + "/ok\\n# a comment\\n\\n" + srv.URL + "/ok\\n", 0, []string{"1 checked"}},
        {"links on a page", []string{"-page", srv.URL + "/"}, "", 1, []string{"2 checked, 1 ok, 1 broken"}},
        {"json", []string{"-json", srv.URL + "/ok"}, "", 0, []string{\`"checked": 1\`, \`"ok": true\`}},
        {"no urls is a usage error", nil, "", 2, nil},
        {"unknown flag", []string{"-nope"}, "", 2, nil},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            var stdout, stderr strings.Builder
            code := run(context.Background(), tt.args, strings.NewReader(tt.stdin), &stdout, &stderr)
            if code != tt.wantCode {
                t.Errorf("exit code %d, want %d\\nstdout:\\n%s\\nstderr:\\n%s", code, tt.wantCode, stdout.String(), stderr.String())
            }
            for _, want := range tt.wantOut {
                if !strings.Contains(stdout.String(), want) {
                    t.Errorf("stdout missing %q:\\n%s", want, stdout.String())
                }
            }
        })
    }
}` },
          ],
          run: `go vet ./...
go test -race ./...
go test -cover ./...`,
          output: `?   	github.com/you/urlcheck/cmd/demoserver	[no test files]
ok  	github.com/you/urlcheck/cmd/urlcheck	2.186s
ok  	github.com/you/urlcheck/internal/checker	1.685s
ok  	github.com/you/urlcheck/internal/report	1.780s`,
        },
        {
          title: "Ship it: install, cross-compile and run in CI",
          explain: `A Go CLI ships as **one static binary**.
- \`go install\` builds it into \`$(go env GOPATH)/bin\`, and anyone can install a tagged version with \`go install github.com/you/urlcheck/cmd/urlcheck@latest\`.
- Cross-compiling needs no extra toolchains: set \`GOOS\` and \`GOARCH\`.
- \`-ldflags "-s -w"\` strips debug info; \`-trimpath\` removes your local paths from the binary.
- The GitHub Actions workflow checks formatting, vets, and runs the race-checked tests on every push. For releases with checksums, Homebrew taps and changelogs, look at **GoReleaser**.`,
          files: [
            {
              path: ".github/workflows/ci.yml",
              lang: "yaml",
              code: `name: ci
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - name: Formatting
        run: test -z "$(gofmt -l .)"
      - name: Vet
        run: go vet ./...
      - name: Test
        run: go test -race -cover ./...
      - name: Check links in the README
        run: go run ./cmd/urlcheck -broken -page https://github.com/you/urlcheck || true`,
            },
          ],
          run: `go install ./cmd/urlcheck && urlcheck -h
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o dist/urlcheck-linux-amd64 ./cmd/urlcheck
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o dist/urlcheck.exe ./cmd/urlcheck
GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o dist/urlcheck-macos ./cmd/urlcheck`,
          output: `Usage: urlcheck [flags] [url ...]

Checks links concurrently. URLs come from arguments, -f, -page or standard input.
Exit status: 0 all ok, 1 some links broken, 2 usage error.

Flags:
  -broken
    	only list broken links
  -c int
    	number of concurrent checks (default 8)
  -f string
    	read URLs from a file, one per line (# starts a comment)
  -json
    	print results as JSON
  -page string
    	check every link on this web page
  -timeout duration
    	timeout per request (default 10s)`,
        },
      ],
      extensions: [
        "Crawl a whole site: follow same-host links recursively with a depth limit and a visited set (protect it with a mutex, or funnel discoveries through one goroutine).",
        "Respect robots.txt and add per-host rate limiting with golang.org/x/time/rate so you're polite to servers.",
        "Retry 429 and 5xx responses with exponential backoff and jitter, honoring Retry-After.",
        "Stream results as they finish (a progress line or a channel of Results) instead of waiting for all of them.",
        "Parse HTML properly with golang.org/x/net/html and also check <img src>, <script src> and <link href>.",
        "Add a -format=markdown flag for posting reports as GitHub comments, and release binaries with GoReleaser.",
      ],
      verify: `$GO_CMD vet ./... && $GO_CMD test -race -count=1 ./... && $GO_CMD build -o urlcheck ./cmd/urlcheck && { ./urlcheck http://127.0.0.1:1/ > out.txt; [ $? -eq 1 ]; } && grep -q '1 checked, 0 ok, 1 broken' out.txt && grep -q 'connection refused' out.txt && ./urlcheck -h 2> help.txt && grep -q 'Usage: urlcheck' help.txt && { ./urlcheck < /dev/null 2> /dev/null; [ $? -eq 2 ]; }`,
    },
    interview: [
      {
        q: "Why use a worker pool instead of starting one goroutine per URL?",
        a: "Goroutines are cheap, but what they do isn't: each check opens a connection, uses a file descriptor and loads the remote server. With 50,000 URLs, one goroutine each would open 50,000 sockets at once, hit OS limits, and get you rate-limited or blocked. A fixed pool of N workers reading from a channel bounds concurrency, gives back-pressure (the feeder blocks when workers are busy), and makes resource usage predictable. Alternatives with the same effect: a semaphore channel or errgroup.SetLimit.",
        freq: "common",
      },
      {
        q: "How do you collect results from concurrent workers while preserving input order?",
        a: "Pre-allocate a results slice of the input's length and send indexes (or index + item) to workers; each worker writes results[i]. Different goroutines writing distinct slice elements don't race, so no mutex is needed, and wg.Wait() establishes happens-before for reading the results afterwards. Alternatively, send (index, result) pairs on a channel and place them, or sort afterwards. Avoid appending to a shared slice from several goroutines without a lock.",
        freq: "common",
      },
      {
        q: "How do you make a CLI's main function testable in Go?",
        a: "Keep main minimal and move logic into run(ctx, args, stdin, stdout, stderr) int (or returning error). Use a flag.FlagSet instead of the global flag set, write output to the passed-in io.Writers, read input from the io.Reader, and return an exit code instead of calling os.Exit. Tests then call run with strings.Reader/strings.Builder and assert on output and codes. Global state (os.Args, os.Stdout, os.Exit) stays in the two-line main.",
      },
      {
        q: "What can go wrong with Go's HTTP client in a tool like this?",
        a: "No timeout (http.DefaultClient can hang forever on an unresponsive server); creating a client per request (no connection reuse); not closing or draining bodies (connection leaks, no keep-alive); treating non-2xx as success (Do only errors on transport problems); unbounded reads of response bodies; redirect loops (set CheckRedirect); and too many concurrent connections to one host (bound concurrency, tune Transport.MaxConnsPerHost).",
      },
    ],
    quiz: [
      {
        q: "Why does each worker write results[i] instead of appending to a shared slice?",
        options: ["It's faster to type", "Distinct indexes avoid a data race and keep input order", "append is deprecated", "Slices can't be shared"],
        answer: 1,
        explain: "Concurrent appends to one slice race; distinct elements don't.",
      },
      {
        q: "What ends the workers' `for i := range jobs` loops?",
        options: ["wg.Wait()", "close(jobs) after the last send", "A nil send", "ctx.Done()"],
        answer: 1,
        explain: "range over a channel stops when it's closed and drained.",
      },
      {
        q: "How should relative links like \"../about\" be turned into absolute URLs?",
        options: ["String concatenation", "base.ResolveReference(ref)", "path.Join", "filepath.Abs"],
        answer: 1,
        explain: "It implements RFC 3986 resolution, like a browser.",
      },
      {
        q: "Why does main call stop() explicitly before os.Exit?",
        options: ["os.Exit skips deferred functions", "stop() sets the exit code", "It's required by flag", "It flushes stdout"],
        answer: 0,
        explain: "Deferred calls never run after os.Exit.",
      },
    ],
  },

  // ------------------------------------------------------------------ PROJECT 2: URL SHORTENER API
  {
    id: "go-project-api",
    stage: "Projects",
    title: "Project: snip, a production-style URL shortener API",
    tagline: "Build a REST API with only the standard library: layered packages, Go 1.22 routing, validation, consistent JSON errors, middleware, per-client rate limiting, API keys, structured logs, graceful shutdown, tests and a Docker image.",
    difficulty: "advanced",
    minutes: 90,
    visualizers: ["ratelimiter"],
    concept: `
## What you'll build
A URL shortener like bit.ly, as an API:
\`\`\`text
POST   /api/links          {"url": "...", "slug": "optional"}  → 201 with the short URL
GET    /{slug}             302 redirect to the target, counting the click
GET    /api/links/{slug}   stats: target, clicks, creation time
DELETE /api/links/{slug}   needs X-API-Key
GET    /healthz            for load balancers and Kubernetes probes
\`\`\`
No framework and no third-party modules: Go 1.22's router, \`encoding/json\`, \`log/slog\`, \`crypto/rand\` and \`net/http\` are enough for a service you could deploy.

## Architecture
\`\`\`text
cmd/snip/main.go      config + wiring + lifecycle (the only place that knows everything)
        │
internal/httpapi      HTTP: routing, JSON in/out, status codes, middleware
        │ calls
internal/links        the domain: validation, slugs, Service, Store interface
        │ uses
links.Store           MemoryStore today; PostgresStore tomorrow, same interface
\`\`\`
- **Dependencies point inward.** \`links\` knows nothing about HTTP, so the same service could sit behind gRPC or a CLI.
- **Errors are values with meaning.** The domain returns \`ErrNotFound\`, \`ErrSlugTaken\`, \`ErrInvalidURL\`; one \`fail\` function maps them to 404, 409 and 422, and hides everything unexpected behind a logged 500.
- **Explicit wiring, no globals.** \`main\` builds the store, service, limiter, logger and server and passes them down. Tests build their own.
- **Production details from the start**: server timeouts, body size limits, strict JSON decoding, request IDs, structured logs, rate limiting per client IP, constant-time API key checks, and graceful shutdown on SIGTERM.

Work through the steps on the **Build** tab.
`,
    keyPoints: [
      "Layers: cmd wires, httpapi translates HTTP, links holds the domain",
      "Small Store interface; in-memory implementation behind a RWMutex",
      "Domain errors mapped to status codes in one place",
      "Strict decoding: size limit, unknown fields, single object, friendly messages",
      "Middleware for request IDs, logs, panics, rate limits and auth",
      "crypto/rand for unguessable slugs; constant-time key comparison",
      "Server timeouts and graceful shutdown with signal.NotifyContext",
      "Tests: httptest + table-driven + a fake clock",
    ],
    project: {
      summary: `**snip**: a URL shortener REST API using only Go's standard library. Create short links (random or custom slugs), redirect and count clicks, read stats, delete with an API key. It has a clean **layered design** (domain service + storage interface + HTTP layer), **strict JSON validation** with friendly errors, **middleware** for request IDs, structured \`slog\` logs, panic recovery, **per-IP token-bucket rate limiting** and API-key auth, **server timeouts** and **graceful shutdown**, tests that run under the race detector, and a distroless **Docker** image.`,
      skills: ["project layout", "interfaces for storage", "sync.RWMutex", "Go 1.22 routing", "encoding/json", "error mapping", "middleware", "log/slog", "crypto/rand", "rate limiting", "context & graceful shutdown", "httptest", "fake clocks", "Docker"],
      tree: snipTree,
      steps: [
        {
          title: "The domain: links, validation, slugs and storage",
          explain: `Start in the middle, with no HTTP at all. \`internal/links\` defines what the application *is*:

- **Sentinel errors** (\`ErrNotFound\`, \`ErrSlugTaken\`...) let callers react with \`errors.Is\` without parsing strings. Their messages are written to be shown to API users.
- **\`Store\`** is a small interface: exactly the four operations the service needs. Every method takes a \`context.Context\` even though the memory store ignores it, because a database implementation will need it.
- **\`MemoryStore\`** guards its map with a \`sync.RWMutex\`: HTTP handlers run concurrently. Lookups take the read lock (many at once), changes take the write lock. Map values aren't addressable, so \`IncrementClicks\` copies, modifies and stores back.
- **\`NormalizeURL\`** uses \`url.ParseRequestURI\` (stricter than \`url.Parse\`) and allows only \`http\`/\`https\`. That blocks \`javascript:\` links, which would be a security hole in a redirect service.
- **\`RandomSlug\`** uses \`crypto/rand\` so slugs can't be predicted, and an alphabet without look-alike characters. With 56 symbols and 7 characters there are 1.7 trillion slugs; \`Shorten\` still retries on the rare collision.
- **\`Service\`** holds the business rules. Its clock is a field (\`now\`) so tests can freeze time.`,
          files: [
            { path: "go.mod", lang: "text", code: `module github.com/you/snip

go 1.24` },
            { path: "internal/links/links.go", lang: "go", code: `// Package links is the core of the shortener: the Link type, validation, slugs,
// storage and the operations the API offers. It knows nothing about HTTP.
package links

import (
    "context"
    "crypto/rand"
    "errors"
    "math/big"
    "net/url"
    "regexp"
    "strings"
    "sync"
    "time"
)

var (
    ErrNotFound    = errors.New("link not found")
    ErrSlugTaken   = errors.New("slug is already taken")
    ErrInvalidURL  = errors.New("url must be an absolute http or https URL of at most 2048 characters")
    ErrInvalidSlug = errors.New("slug must be 3-32 letters, digits, '-' or '_', and not a reserved word")
)

// Link is one short link.
type Link struct {
    Slug      string
    URL       string
    Clicks    int64
    CreatedAt time.Time
}

// Store persists links. MemoryStore implements it; a PostgreSQL version would too.
type Store interface {
    Create(ctx context.Context, l Link) error // ErrSlugTaken if the slug exists
    Get(ctx context.Context, slug string) (Link, error)
    IncrementClicks(ctx context.Context, slug string) error
    Delete(ctx context.Context, slug string) error
}

// ---- Validation and slugs ----

var slugRE = regexp.MustCompile(\`^[A-Za-z0-9_-]{3,32}$\`)

var reserved = map[string]bool{"api": true, "healthz": true, "admin": true, "static": true}

// NormalizeURL checks that raw is a usable absolute http(s) URL and returns it trimmed.
func NormalizeURL(raw string) (string, error) {
    raw = strings.TrimSpace(raw)
    if raw == "" || len(raw) > 2048 {
        return "", ErrInvalidURL
    }
    u, err := url.ParseRequestURI(raw)
    if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
        return "", ErrInvalidURL
    }
    return u.String(), nil
}

func ValidSlug(slug string) bool {
    return slugRE.MatchString(slug) && !reserved[strings.ToLower(slug)]
}

// No 0/O or 1/l/I: short links get read aloud and typed by hand.
const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// RandomSlug returns n characters from a cryptographically secure source,
// so slugs can't be guessed by enumerating them.
func RandomSlug(n int) string {
    b := make([]byte, n)
    max := big.NewInt(int64(len(alphabet)))
    for i := range b {
        k, err := rand.Int(rand.Reader, max)
        if err != nil {
            panic(err) // crypto/rand doesn't fail on supported platforms
        }
        b[i] = alphabet[k.Int64()]
    }
    return string(b)
}

// ---- The service: what the API can do ----

type Service struct {
    store Store
    now   func() time.Time // replaceable in tests
}

func NewService(store Store) *Service {
    return &Service{store: store, now: time.Now}
}

// Shorten stores a new link. With an empty slug, a random 7-character one is generated.
func (s *Service) Shorten(ctx context.Context, rawURL, slug string) (Link, error) {
    target, err := NormalizeURL(rawURL)
    if err != nil {
        return Link{}, err
    }
    if slug != "" {
        if !ValidSlug(slug) {
            return Link{}, ErrInvalidSlug
        }
        l := Link{Slug: slug, URL: target, CreatedAt: s.now().UTC()}
        return l, s.store.Create(ctx, l)
    }
    for range 5 { // 56^7 ≈ 1.7 trillion slugs: collisions are rare, but must be handled
        l := Link{Slug: RandomSlug(7), URL: target, CreatedAt: s.now().UTC()}
        err := s.store.Create(ctx, l)
        if errors.Is(err, ErrSlugTaken) {
            continue
        }
        return l, err
    }
    return Link{}, errors.New("could not generate a unique slug")
}

// Resolve returns the target URL for a slug and counts the click.
func (s *Service) Resolve(ctx context.Context, slug string) (string, error) {
    l, err := s.store.Get(ctx, slug)
    if err != nil {
        return "", err
    }
    if err := s.store.IncrementClicks(ctx, slug); err != nil {
        return "", err
    }
    return l.URL, nil
}

func (s *Service) Stats(ctx context.Context, slug string) (Link, error) {
    return s.store.Get(ctx, slug)
}

func (s *Service) Delete(ctx context.Context, slug string) error {
    return s.store.Delete(ctx, slug)
}

// ---- In-memory storage ----

// MemoryStore keeps links in a map. HTTP handlers run concurrently, so every
// access holds the lock: a read lock for lookups, the write lock for changes.
type MemoryStore struct {
    mu    sync.RWMutex
    links map[string]Link
}

func NewMemoryStore() *MemoryStore {
    return &MemoryStore{links: make(map[string]Link)}
}

func (m *MemoryStore) Create(_ context.Context, l Link) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    if _, exists := m.links[l.Slug]; exists {
        return ErrSlugTaken
    }
    m.links[l.Slug] = l
    return nil
}

func (m *MemoryStore) Get(_ context.Context, slug string) (Link, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()
    l, ok := m.links[slug]
    if !ok {
        return Link{}, ErrNotFound
    }
    return l, nil
}

func (m *MemoryStore) IncrementClicks(_ context.Context, slug string) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    l, ok := m.links[slug]
    if !ok {
        return ErrNotFound
    }
    l.Clicks++
    m.links[slug] = l // map values aren't addressable: copy, change, store back
    return nil
}

func (m *MemoryStore) Delete(_ context.Context, slug string) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    if _, ok := m.links[slug]; !ok {
        return ErrNotFound
    }
    delete(m.links, slug)
    return nil
}` },
          ],
          run: `mkdir snip && cd snip && go mod init github.com/you/snip
go vet ./...`,
        },
        {
          title: "A per-client rate limiter",
          explain: `Creating links is the expensive, abusable endpoint, so each client gets a **token bucket**: up to \`burst\` requests at once, refilled at a steady \`rate\`. (The visualizer compares this with fixed and sliding windows.)

- Buckets are created lazily per key (the client's IP) and **refilled from elapsed time** on each call: no background goroutine per client.
- When a request is rejected, \`Allow\` also returns **how long until the next token**, which becomes the \`Retry-After\` header so well-behaved clients know when to come back.
- \`Cleanup\` removes buckets idle for a while; otherwise every IP that ever called you stays in memory forever. Deleting from a map while ranging over it is allowed in Go.
- The clock is a field (\`now func() time.Time\`), so tests can move time forward instantly instead of sleeping.

This limiter is per process. With several replicas behind a load balancer, each enforces its own limit; a shared limit needs Redis or a gateway.`,
          files: [
            { path: "internal/ratelimit/limiter.go", lang: "go", code: `// Package ratelimit limits how often each client may call the API, using one
// token bucket per client key (usually the IP address).
package ratelimit

import (
    "sync"
    "time"
)

type bucket struct {
    tokens float64
    last   time.Time
}

// Limiter is safe for concurrent use.
type Limiter struct {
    mu      sync.Mutex
    buckets map[string]*bucket
    rate    float64 // tokens added per second
    burst   float64 // bucket capacity
    now     func() time.Time
}

// New allows each key bursts of up to burst requests, refilled at ratePerSecond.
func New(ratePerSecond float64, burst int) *Limiter {
    return &Limiter{buckets: make(map[string]*bucket), rate: ratePerSecond, burst: float64(burst), now: time.Now}
}

// Allow reports whether key may make a request now. If not, retryAfter says how
// long until the next token arrives.
func (l *Limiter) Allow(key string) (ok bool, retryAfter time.Duration) {
    l.mu.Lock()
    defer l.mu.Unlock()
    now := l.now()
    b, found := l.buckets[key]
    if !found {
        b = &bucket{tokens: l.burst, last: now}
        l.buckets[key] = b
    }
    b.tokens = min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate) // refill for the time that passed
    b.last = now
    if b.tokens >= 1 {
        b.tokens--
        return true, 0
    }
    wait := time.Duration((1 - b.tokens) / l.rate * float64(time.Second))
    return false, wait
}

// Cleanup forgets keys idle for longer than maxIdle, so memory doesn't grow with
// every client ever seen. It returns how many keys were removed.
func (l *Limiter) Cleanup(maxIdle time.Duration) int {
    l.mu.Lock()
    defer l.mu.Unlock()
    now := l.now()
    removed := 0
    for key, b := range l.buckets {
        if now.Sub(b.last) > maxIdle {
            delete(l.buckets, key) // deleting while ranging over a map is allowed
            removed++
        }
    }
    return removed
}` },
          ],
        },
        {
          title: "The HTTP layer: JSON helpers, routes and handlers",
          explain: `\`internal/httpapi\` translates between HTTP and the domain.

**\`json.go\`**: \`decodeJSON\` is where most APIs get sloppy. It checks the \`Content-Type\`, limits the body to 64 KB with \`http.MaxBytesReader\`, rejects unknown fields (a typo like \`"slgu"\` gets an error instead of being silently ignored), rejects trailing data with \`dec.More()\`, and turns every decoder error into a message that's safe to show clients.

**\`server.go\`**:
- Routes use Go 1.22 patterns. \`"GET /{$}"\` matches only the root, and the catch-all \`"GET /{slug}"\` doesn't conflict with \`"GET /healthz"\` because **the most specific pattern wins**.
- **\`linkView\`** is the response shape, separate from \`links.Link\`: the JSON contract stays stable when the domain type changes, and \`short_url\` is computed from the configured base URL.
- Redirects use **302**, not 301: browsers cache permanent redirects and would stop asking, so clicks wouldn't be counted.
- Handlers pass \`r.Context()\` to the service, and every error goes through **\`fail\`**, which maps domain errors to 404/409/422 and logs anything unexpected with the request ID while showing the client only "internal server error".

This package compiles once the middleware from the next step is in place.`,
          files: [
            { path: "internal/httpapi/json.go", lang: "go", code: `package httpapi

import (
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "net/http"
    "strings"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v) // the status is already sent; a failed write means the client left
}

func writeError(w http.ResponseWriter, status int, msg string) {
    writeJSON(w, status, map[string]string{"error": msg})
}

// decodeJSON reads exactly one JSON object into dst and turns decoder errors
// into messages that are safe and useful to show to API clients.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
    if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
        return errors.New("Content-Type must be application/json")
    }
    r.Body = http.MaxBytesReader(w, r.Body, 64<<10) // 64 KB is plenty for a link
    dec := json.NewDecoder(r.Body)
    dec.DisallowUnknownFields()

    if err := dec.Decode(dst); err != nil {
        var syntaxErr *json.SyntaxError
        var typeErr *json.UnmarshalTypeError
        var maxErr *http.MaxBytesError
        switch {
        case errors.Is(err, io.EOF):
            return errors.New("request body is empty")
        case errors.As(err, &syntaxErr):
            return fmt.Errorf("malformed JSON at byte %d", syntaxErr.Offset)
        case errors.Is(err, io.ErrUnexpectedEOF):
            return errors.New("malformed JSON")
        case errors.As(err, &typeErr):
            return fmt.Errorf("field %q must be a %s", typeErr.Field, typeErr.Type)
        case strings.HasPrefix(err.Error(), "json: unknown field "):
            return fmt.Errorf("unknown field %s", strings.TrimPrefix(err.Error(), "json: unknown field "))
        case errors.As(err, &maxErr):
            return fmt.Errorf("request body must be at most %d bytes", maxErr.Limit)
        default:
            return err
        }
    }
    if dec.More() {
        return errors.New("request body must contain a single JSON object")
    }
    return nil
}` },
            { path: "internal/httpapi/server.go", lang: "go", code: `// Package httpapi exposes the links service over HTTP.
package httpapi

import (
    "errors"
    "log/slog"
    "net/http"
    "time"

    "github.com/you/snip/internal/links"
    "github.com/you/snip/internal/ratelimit"
)

type Config struct {
    BaseURL string // e.g. https://sn.ip, used to build short URLs
    APIKey  string // required for DELETE; empty disables deleting
    Logger  *slog.Logger
    Limiter *ratelimit.Limiter // limits link creation per client IP
}

type Server struct {
    links *links.Service
    cfg   Config
    log   *slog.Logger
}

func New(svc *links.Service, cfg Config) *Server {
    if cfg.Logger == nil {
        cfg.Logger = slog.Default()
    }
    return &Server{links: svc, cfg: cfg, log: cfg.Logger}
}

// Handler returns the full HTTP handler: routes wrapped in middleware.
func (s *Server) Handler() http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /{$}", s.home)
    mux.HandleFunc("GET /healthz", s.health)
    mux.Handle("POST /api/links", s.rateLimit(http.HandlerFunc(s.createLink)))
    mux.HandleFunc("GET /api/links/{slug}", s.linkStats)
    mux.Handle("DELETE /api/links/{slug}", s.requireAPIKey(http.HandlerFunc(s.deleteLink)))
    mux.HandleFunc("GET /{slug}", s.redirect)

    // The outermost middleware runs first: request ID, then logging, then panic recovery.
    return s.requestID(s.logRequests(s.recoverPanics(mux)))
}

// linkView is the JSON shape clients see; it's separate from links.Link so the
// API can stay stable while the domain type changes.
type linkView struct {
    Slug      string    \`json:"slug"\`
    ShortURL  string    \`json:"short_url"\`
    URL       string    \`json:"url"\`
    Clicks    int64     \`json:"clicks"\`
    CreatedAt time.Time \`json:"created_at"\`
}

func (s *Server) view(l links.Link) linkView {
    return linkView{Slug: l.Slug, ShortURL: s.cfg.BaseURL + "/" + l.Slug, URL: l.URL, Clicks: l.Clicks, CreatedAt: l.CreatedAt}
}

func (s *Server) home(w http.ResponseWriter, _ *http.Request) {
    writeJSON(w, http.StatusOK, map[string]string{"service": "snip", "create": "POST /api/links"})
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
    writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) createLink(w http.ResponseWriter, r *http.Request) {
    var in struct {
        URL  string \`json:"url"\`
        Slug string \`json:"slug"\` // optional custom slug
    }
    if err := decodeJSON(w, r, &in); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    link, err := s.links.Shorten(r.Context(), in.URL, in.Slug)
    if err != nil {
        s.fail(w, r, err)
        return
    }
    w.Header().Set("Location", "/api/links/"+link.Slug)
    writeJSON(w, http.StatusCreated, s.view(link))
}

func (s *Server) redirect(w http.ResponseWriter, r *http.Request) {
    target, err := s.links.Resolve(r.Context(), r.PathValue("slug"))
    if err != nil {
        s.fail(w, r, err)
        return
    }
    // 302, not 301: browsers cache permanent redirects and would stop asking us, so clicks wouldn't be counted.
    http.Redirect(w, r, target, http.StatusFound)
}

func (s *Server) linkStats(w http.ResponseWriter, r *http.Request) {
    link, err := s.links.Stats(r.Context(), r.PathValue("slug"))
    if err != nil {
        s.fail(w, r, err)
        return
    }
    writeJSON(w, http.StatusOK, s.view(link))
}

func (s *Server) deleteLink(w http.ResponseWriter, r *http.Request) {
    if err := s.links.Delete(r.Context(), r.PathValue("slug")); err != nil {
        s.fail(w, r, err)
        return
    }
    w.WriteHeader(http.StatusNoContent)
}

// fail maps domain errors to HTTP responses in one place. Unknown errors are
// logged with the request ID and hidden from the client.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, err error) {
    switch {
    case errors.Is(err, links.ErrNotFound):
        writeError(w, http.StatusNotFound, err.Error())
    case errors.Is(err, links.ErrSlugTaken):
        writeError(w, http.StatusConflict, err.Error())
    case errors.Is(err, links.ErrInvalidURL), errors.Is(err, links.ErrInvalidSlug):
        writeError(w, http.StatusUnprocessableEntity, err.Error())
    default:
        s.log.ErrorContext(r.Context(), "internal error", "err", err, "request_id", RequestID(r.Context()))
        writeError(w, http.StatusInternalServerError, "internal server error")
    }
}` },
          ],
        },
        {
          title: "Middleware: request IDs, logs, recovery, rate limits and API keys",
          explain: `Each middleware is a \`func(http.Handler) http.Handler\` method on \`Server\`, so it can use the server's config and logger.

- **\`requestID\`** reuses an incoming \`X-Request-Id\` only if it looks safe (a strict regexp: no newlines that could forge log lines), otherwise generates 8 random bytes. The ID goes into the response header and the request **context**, so every log line for that request can include it.
- **\`logRequests\`** wraps the \`ResponseWriter\` in a \`statusRecorder\` to learn the status code, then logs method, path, status, duration and IP as structured fields. \`Unwrap\` keeps \`http.ResponseController\` features working through the wrapper.
- **\`recoverPanics\`** turns a panic into a logged 500 instead of a dropped connection. It re-panics \`http.ErrAbortHandler\`, which the server uses deliberately.
- **\`rateLimit\`** applies the limiter only to the routes it wraps (creating links), and sets \`Retry-After\` when rejecting.
- **\`requireAPIKey\`** uses \`subtle.ConstantTimeCompare\` so the time taken doesn't reveal how many leading bytes of a guess were right. An empty configured key disables the route entirely.

Order matters: \`requestID(logRequests(recoverPanics(mux)))\` means the ID exists before logging, and a recovered panic is still logged with status 500.`,
          files: [
            { path: "internal/httpapi/middleware.go", lang: "go", code: `package httpapi

import (
    "context"
    "crypto/rand"
    "crypto/subtle"
    "encoding/hex"
    "math"
    "net"
    "net/http"
    "regexp"
    "strconv"
    "time"
)

type ctxKey int

const requestIDKey ctxKey = 0

// RequestID returns the ID that the requestID middleware stored in ctx.
func RequestID(ctx context.Context) string {
    id, _ := ctx.Value(requestIDKey).(string)
    return id
}

var validRequestID = regexp.MustCompile(\`^[A-Za-z0-9-]{1,64}$\`)

// requestID tags every request with an ID (reusing a sane incoming X-Request-Id),
// returns it in the response, and puts it in the context for logs.
func (s *Server) requestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        id := r.Header.Get("X-Request-Id")
        if !validRequestID.MatchString(id) {
            b := make([]byte, 8)
            _, _ = rand.Read(b)
            id = hex.EncodeToString(b)
        }
        w.Header().Set("X-Request-Id", id)
        next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
    })
}

// statusRecorder remembers the status code a handler wrote.
type statusRecorder struct {
    http.ResponseWriter
    status int
}

func (rec *statusRecorder) WriteHeader(code int) {
    rec.status = code
    rec.ResponseWriter.WriteHeader(code)
}

// Unwrap lets http.ResponseController reach the underlying writer (for Flush, deadlines...).
func (rec *statusRecorder) Unwrap() http.ResponseWriter { return rec.ResponseWriter }

func (s *Server) logRequests(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
        next.ServeHTTP(rec, r)
        s.log.InfoContext(r.Context(), "request",
            "method", r.Method,
            "path", r.URL.Path,
            "status", rec.status,
            "duration_ms", float64(time.Since(start).Microseconds())/1000,
            "ip", clientIP(r),
            "request_id", RequestID(r.Context()),
        )
    })
}

func (s *Server) recoverPanics(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if v := recover(); v != nil {
                if v == http.ErrAbortHandler { // the server uses this panic to abort a response: let it through
                    panic(v)
                }
                s.log.ErrorContext(r.Context(), "panic", "value", v, "request_id", RequestID(r.Context()))
                w.Header().Set("Connection", "close")
                writeError(w, http.StatusInternalServerError, "internal server error")
            }
        }()
        next.ServeHTTP(w, r)
    })
}

// rateLimit rejects clients that exceed the limiter with 429 Too Many Requests.
func (s *Server) rateLimit(next http.Handler) http.Handler {
    if s.cfg.Limiter == nil {
        return next
    }
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if ok, wait := s.cfg.Limiter.Allow(clientIP(r)); !ok {
            w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
            writeError(w, http.StatusTooManyRequests, "rate limit exceeded, slow down")
            return
        }
        next.ServeHTTP(w, r)
    })
}

// requireAPIKey protects admin routes. The comparison takes the same time whether
// the key is almost right or completely wrong, so it can't be guessed byte by byte.
func (s *Server) requireAPIKey(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        got := r.Header.Get("X-API-Key")
        if s.cfg.APIKey == "" || subtle.ConstantTimeCompare([]byte(got), []byte(s.cfg.APIKey)) != 1 {
            writeError(w, http.StatusUnauthorized, "missing or invalid API key")
            return
        }
        next.ServeHTTP(w, r)
    })
}

// clientIP is the TCP peer address. Behind a load balancer every request would come
// from the balancer, so you'd read X-Forwarded-For instead, but only from a proxy you trust.
func clientIP(r *http.Request) string {
    host, _, err := net.SplitHostPort(r.RemoteAddr)
    if err != nil {
        return r.RemoteAddr
    }
    return host
}` },
          ],
          run: `go vet ./...      # everything compiles now`,
        },
        {
          title: "main: configuration, wiring and graceful shutdown",
          explain: `\`main\` is the composition root: the only code that knows about every package.

- **Configuration from environment variables** (twelve-factor style) with defaults, validated at startup so a typo fails fast with a clear message.
- **Wiring** builds the limiter, store, service and API explicitly. Swapping \`NewMemoryStore()\` for a PostgreSQL store later changes one line.
- **Server timeouts**: the zero-value \`http.Server\` has none, so a client trickling headers could hold a connection forever.
- **Lifecycle**: \`signal.NotifyContext\` cancels \`ctx\` on Ctrl-C or SIGTERM (what Docker and Kubernetes send). The server runs in a goroutine; \`main\` waits for **either** a serve error (like "address already in use") **or** a signal, then calls \`Shutdown\` with a 10-second budget so in-flight requests finish. A background goroutine cleans up rate-limit buckets until the same context is canceled.
- \`run\` returns an error and \`main\` decides the exit code: the same testable shape as the CLI project.

Start it in one terminal and try it from another.`,
          files: [
            { path: "cmd/snip/main.go", lang: "go", code: `// Command snip runs the URL shortener API.
package main

import (
    "context"
    "errors"
    "fmt"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "strconv"
    "syscall"
    "time"

    "github.com/you/snip/internal/httpapi"
    "github.com/you/snip/internal/links"
    "github.com/you/snip/internal/ratelimit"
)

type config struct {
    Addr          string
    BaseURL       string
    APIKey        string
    RatePerMinute int
}

func envOr(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}

// loadConfig reads twelve-factor style configuration from environment variables.
func loadConfig() (config, error) {
    cfg := config{
        Addr:    envOr("ADDR", ":8080"),
        BaseURL: envOr("BASE_URL", "http://localhost:8080"),
        APIKey:  os.Getenv("API_KEY"),
    }
    rpm, err := strconv.Atoi(envOr("RATE_LIMIT_PER_MINUTE", "30"))
    if err != nil || rpm < 1 {
        return cfg, errors.New("RATE_LIMIT_PER_MINUTE must be a positive integer")
    }
    cfg.RatePerMinute = rpm
    return cfg, nil
}

func main() {
    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
    if err := run(logger); err != nil {
        logger.Error("exiting", "err", err)
        os.Exit(1)
    }
}

func run(logger *slog.Logger) error {
    cfg, err := loadConfig()
    if err != nil {
        return err
    }
    if cfg.APIKey == "" {
        logger.Warn("API_KEY is not set: deleting links is disabled")
    }

    // Wiring: build every dependency here and pass it down explicitly. No globals.
    limiter := ratelimit.New(float64(cfg.RatePerMinute)/60, max(cfg.RatePerMinute/6, 1))
    service := links.NewService(links.NewMemoryStore())
    api := httpapi.New(service, httpapi.Config{BaseURL: cfg.BaseURL, APIKey: cfg.APIKey, Logger: logger, Limiter: limiter})

    srv := &http.Server{
        Addr:              cfg.Addr,
        Handler:           api.Handler(),
        ReadHeaderTimeout: 5 * time.Second, // the zero-value server has no timeouts at all
        ReadTimeout:       10 * time.Second,
        WriteTimeout:      10 * time.Second,
        IdleTimeout:       60 * time.Second,
        ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
    }

    // ctx is canceled on Ctrl-C (SIGINT) or SIGTERM, which Docker and Kubernetes send before killing us.
    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer stop()

    go func() { // background job: forget idle rate-limit buckets every minute
        ticker := time.NewTicker(time.Minute)
        defer ticker.Stop()
        for {
            select {
            case <-ticker.C:
                limiter.Cleanup(10 * time.Minute)
            case <-ctx.Done():
                return
            }
        }
    }()

    serveErr := make(chan error, 1)
    go func() {
        logger.Info("listening", "addr", cfg.Addr, "base_url", cfg.BaseURL)
        serveErr <- srv.ListenAndServe()
    }()

    select {
    case err := <-serveErr:
        return fmt.Errorf("server: %w", err) // e.g. the port is already in use
    case <-ctx.Done():
    }

    logger.Info("shutting down: finishing in-flight requests")
    shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(shutdownCtx); err != nil {
        return fmt.Errorf("shutdown: %w", err)
    }
    logger.Info("shutdown complete")
    return nil
}` },
          ],
          run: `# terminal 1
API_KEY=dev-secret go run ./cmd/snip

# terminal 2
curl -s localhost:8080/healthz
curl -si -X POST localhost:8080/api/links -H 'Content-Type: application/json' \\
  -d '{"url": "https://go.dev/doc/effective_go", "slug": "effective"}'
curl -s -X POST localhost:8080/api/links -H 'Content-Type: application/json' -d '{"url": "https://pkg.go.dev"}'
curl -si localhost:8080/effective | head -3
curl -s localhost:8080/api/links/effective
curl -s -X POST localhost:8080/api/links -H 'Content-Type: application/json' -d '{"url": "ftp://files.example"}'
curl -s -X POST localhost:8080/api/links -H 'Content-Type: application/json' -d '{"url": "https://x.dev", "slug": "effective"}'
curl -s -X POST localhost:8080/api/links -d '{"url": "https://go.dev"}'           # forgot the header
curl -s -X DELETE localhost:8080/api/links/effective
curl -s -o /dev/null -w '%{http_code}\\n' -X DELETE -H 'X-API-Key: dev-secret' localhost:8080/api/links/effective
for i in 1 2 3 4; do curl -s -o /dev/null -w '%{http_code} ' -X POST localhost:8080/api/links \\
  -H 'Content-Type: application/json' -d '{"url": "https://go.dev"}'; done
curl -si -X POST localhost:8080/api/links -H 'Content-Type: application/json' -d '{"url": "https://go.dev"}' \\
  | grep -iE '^(HTTP|retry-after)|error'

# back in terminal 1: press Ctrl-C`,
          output: `# terminal 2
{"status":"ok"}

HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/links/effective
X-Request-Id: ef3a001664729843
Date: Tue, 03 Nov 2026 23:12:38 GMT
Content-Length: 161

{"slug":"effective","short_url":"http://localhost:8080/effective","url":"https://go.dev/doc/effective_go","clicks":0,"created_at":"2026-11-03T23:12:38.041498Z"}

{"slug":"agkTZxX","short_url":"http://localhost:8080/agkTZxX","url":"https://pkg.go.dev","clicks":0,"created_at":"2026-11-03T23:12:38.048361Z"}

HTTP/1.1 302 Found
Content-Type: text/html; charset=utf-8
Location: https://go.dev/doc/effective_go

{"slug":"effective","short_url":"http://localhost:8080/effective","url":"https://go.dev/doc/effective_go","clicks":1,"created_at":"2026-11-03T23:12:38.041498Z"}

{"error":"url must be an absolute http or https URL of at most 2048 characters"}
{"error":"slug is already taken"}
{"error":"Content-Type must be application/json"}
{"error":"missing or invalid API key"}
204
429 429 429 429
HTTP/1.1 429 Too Many Requests
Retry-After: 2
{"error":"rate limit exceeded, slow down"}

# terminal 1 (one JSON log line per request, then the shutdown)
{"time":"2026-11-03T23:12:37.40476Z","level":"INFO","msg":"listening","addr":":8080","base_url":"http://localhost:8080"}
{"time":"2026-11-03T23:12:38.028922Z","level":"INFO","msg":"request","method":"GET","path":"/healthz","status":200,"duration_ms":0.038,"ip":"127.0.0.1","request_id":"66580f5c91ab07bf"}
{"time":"2026-11-03T23:12:38.041527Z","level":"INFO","msg":"request","method":"POST","path":"/api/links","status":201,"duration_ms":0.078,"ip":"127.0.0.1","request_id":"ef3a001664729843"}
...
{"time":"2026-11-03T23:12:38.114675Z","level":"INFO","msg":"request","method":"POST","path":"/api/links","status":429,"duration_ms":0.014,"ip":"127.0.0.1","request_id":"a284237c97e32830"}
^C{"time":"2026-11-03T23:12:38.11743Z","level":"INFO","msg":"shutting down: finishing in-flight requests"}
{"time":"2026-11-03T23:12:38.117461Z","level":"INFO","msg":"shutdown complete"}`,
        },
        {
          title: "Tests: table-driven, httptest and a fake clock",
          explain: `Three test files, three techniques:

- **\`links_test.go\`** tests the domain directly: generated slugs, a validation table, duplicate slugs, and **100 concurrent \`Resolve\` calls** that must count exactly 100 clicks. Under \`-race\`, that test fails immediately if the store's locking is wrong.
- **\`limiter_test.go\`** replaces the limiter's clock with a **fake clock** and moves time with \`Advance\`. The test is instant and deterministic: no \`time.Sleep\`, no flaky timing.
- **\`server_test.go\`** sends requests through the full middleware chain with \`httptest.NewRecorder\`. A small \`do\` helper keeps tests readable, and a **generic \`decode[T]\`** helper parses JSON responses into any type. It covers every error message clients can see, redirects and click counts, 409s, API keys, 429 with \`Retry-After\`, request IDs (including rejecting a forged one with a newline) and automatic 405s.

The tests build their own dependencies (a quiet logger, a fresh store), which is only possible because nothing is global.`,
          files: [
            { path: "internal/links/links_test.go", lang: "go", code: `package links

import (
    "context"
    "errors"
    "sync"
    "testing"
    "time"
)

func newTestService() *Service {
    s := NewService(NewMemoryStore())
    s.now = func() time.Time { return time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC) }
    return s
}

func TestShortenGeneratesSlug(t *testing.T) {
    s := newTestService()
    l, err := s.Shorten(context.Background(), "  https://go.dev/doc  ", "")
    if err != nil {
        t.Fatal(err)
    }
    if len(l.Slug) != 7 || !ValidSlug(l.Slug) {
        t.Errorf("generated slug %q is not a valid 7-character slug", l.Slug)
    }
    if l.URL != "https://go.dev/doc" || !l.CreatedAt.Equal(s.now()) {
        t.Errorf("link = %+v", l)
    }
}

func TestShortenValidation(t *testing.T) {
    tests := []struct {
        name, url, slug string
        wantErr         error
    }{
        {"custom slug", "https://example.com", "my-link", nil},
        {"empty url", "", "", ErrInvalidURL},
        {"relative url", "/just/a/path", "", ErrInvalidURL},
        {"not http", "javascript:alert(1)", "", ErrInvalidURL},
        {"no host", "https://", "", ErrInvalidURL},
        {"slug too short", "https://example.com", "ab", ErrInvalidSlug},
        {"slug with spaces", "https://example.com", "my link", ErrInvalidSlug},
        {"reserved slug", "https://example.com", "API", ErrInvalidSlug},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := newTestService().Shorten(context.Background(), tt.url, tt.slug)
            if !errors.Is(err, tt.wantErr) {
                t.Errorf("Shorten(%q, %q) error = %v, want %v", tt.url, tt.slug, err, tt.wantErr)
            }
        })
    }
}

func TestSlugTaken(t *testing.T) {
    s := newTestService()
    ctx := context.Background()
    if _, err := s.Shorten(ctx, "https://a.example", "docs"); err != nil {
        t.Fatal(err)
    }
    if _, err := s.Shorten(ctx, "https://b.example", "docs"); !errors.Is(err, ErrSlugTaken) {
        t.Errorf("second Shorten error = %v, want ErrSlugTaken", err)
    }
}

func TestResolveCountsClicksConcurrently(t *testing.T) {
    s := newTestService()
    ctx := context.Background()
    if _, err := s.Shorten(ctx, "https://go.dev", "gopher"); err != nil {
        t.Fatal(err)
    }
    var wg sync.WaitGroup
    for range 100 { // run with -race: the store's lock must make this safe
        wg.Add(1)
        go func() {
            defer wg.Done()
            if target, err := s.Resolve(ctx, "gopher"); err != nil || target != "https://go.dev" {
                t.Errorf("Resolve = %q, %v", target, err)
            }
        }()
    }
    wg.Wait()
    l, _ := s.Stats(ctx, "gopher")
    if l.Clicks != 100 {
        t.Errorf("clicks = %d, want 100", l.Clicks)
    }
}

func TestNotFound(t *testing.T) {
    s := newTestService()
    ctx := context.Background()
    if _, err := s.Resolve(ctx, "nope"); !errors.Is(err, ErrNotFound) {
        t.Errorf("Resolve error = %v", err)
    }
    if err := s.Delete(ctx, "nope"); !errors.Is(err, ErrNotFound) {
        t.Errorf("Delete error = %v", err)
    }
}

func TestRandomSlugUsesAlphabet(t *testing.T) {
    seen := map[string]bool{}
    for range 1000 {
        slug := RandomSlug(7)
        if !ValidSlug(slug) {
            t.Fatalf("invalid slug %q", slug)
        }
        seen[slug] = true
    }
    if len(seen) < 1000 {
        t.Errorf("only %d distinct slugs in 1000 tries", len(seen))
    }
}` },
            { path: "internal/ratelimit/limiter_test.go", lang: "go", code: `package ratelimit

import (
    "testing"
    "time"
)

// fakeClock lets tests move time forward instantly instead of sleeping.
type fakeClock struct{ t time.Time }

func (c *fakeClock) Now() time.Time          { return c.t }
func (c *fakeClock) Advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestLimiter(rate float64, burst int) (*Limiter, *fakeClock) {
    clock := &fakeClock{t: time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)}
    l := New(rate, burst)
    l.now = clock.Now
    return l, clock
}

func TestBurstThenRefill(t *testing.T) {
    l, clock := newTestLimiter(2, 3) // 2 tokens per second, bursts of 3

    for i := range 3 {
        if ok, _ := l.Allow("1.2.3.4"); !ok {
            t.Fatalf("request %d of the burst was rejected", i+1)
        }
    }
    ok, retry := l.Allow("1.2.3.4")
    if ok || retry != 500*time.Millisecond {
        t.Fatalf("4th request: ok=%v retry=%v, want rejected with 500ms", ok, retry)
    }

    clock.Advance(500 * time.Millisecond) // one token back
    if ok, _ := l.Allow("1.2.3.4"); !ok {
        t.Error("after 500ms one request should pass")
    }
    if ok, _ := l.Allow("1.2.3.4"); ok {
        t.Error("...but only one")
    }

    clock.Advance(time.Hour) // refills, but never above the burst size
    for i := range 4 {
        ok, _ := l.Allow("1.2.3.4")
        if want := i < 3; ok != want {
            t.Errorf("after an hour, request %d: ok=%v, want %v", i+1, ok, want)
        }
    }
}

func TestKeysAreIndependent(t *testing.T) {
    l, _ := newTestLimiter(1, 1)
    if ok, _ := l.Allow("alice"); !ok {
        t.Fatal("alice's first request rejected")
    }
    if ok, _ := l.Allow("bob"); !ok {
        t.Error("bob was limited by alice's usage")
    }
}

func TestCleanup(t *testing.T) {
    l, clock := newTestLimiter(1, 1)
    l.Allow("old")
    clock.Advance(11 * time.Minute)
    l.Allow("new")
    if removed := l.Cleanup(10 * time.Minute); removed != 1 {
        t.Errorf("Cleanup removed %d keys, want 1", removed)
    }
    if _, ok := l.buckets["new"]; !ok {
        t.Error("an active key was removed")
    }
}` },
            { path: "internal/httpapi/server_test.go", lang: "go", code: `package httpapi

import (
    "encoding/json"
    "io"
    "log/slog"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    "github.com/you/snip/internal/links"
    "github.com/you/snip/internal/ratelimit"
)

const testKey = "test-api-key"

func newTestAPI(t *testing.T, limiter *ratelimit.Limiter) http.Handler {
    t.Helper()
    quiet := slog.New(slog.NewTextHandler(io.Discard, nil)) // keep test output clean
    svc := links.NewService(links.NewMemoryStore())
    return New(svc, Config{BaseURL: "https://sn.ip", APIKey: testKey, Logger: quiet, Limiter: limiter}).Handler()
}

// do sends one request through the handler and returns the recorded response.
func do(h http.Handler, method, path, body string, headers ...string) *httptest.ResponseRecorder {
    req := httptest.NewRequest(method, path, strings.NewReader(body))
    if body != "" {
        req.Header.Set("Content-Type", "application/json")
    }
    for i := 0; i+1 < len(headers); i += 2 {
        req.Header.Set(headers[i], headers[i+1])
    }
    rec := httptest.NewRecorder()
    h.ServeHTTP(rec, req)
    return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
    t.Helper()
    var v T
    if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
        t.Fatalf("response is not JSON: %v\\n%s", err, rec.Body.String())
    }
    return v
}

func TestCreateLink(t *testing.T) {
    tests := []struct {
        name       string
        body       string
        wantStatus int
        wantError  string
    }{
        {"random slug", \`{"url": "https://go.dev"}\`, http.StatusCreated, ""},
        {"custom slug", \`{"url": "https://go.dev", "slug": "golang"}\`, http.StatusCreated, ""},
        {"empty body", \`\`, http.StatusBadRequest, "request body is empty"},
        {"malformed", \`{"url": \`, http.StatusBadRequest, "malformed JSON"},
        {"wrong type", \`{"url": 42}\`, http.StatusBadRequest, \`field "url" must be a string\`},
        {"unknown field", \`{"url": "https://go.dev", "slgu": "x"}\`, http.StatusBadRequest, \`unknown field "slgu"\`},
        {"two objects", \`{"url": "https://a.dev"}{"url": "https://b.dev"}\`, http.StatusBadRequest, "request body must contain a single JSON object"},
        {"invalid url", \`{"url": "not a url"}\`, http.StatusUnprocessableEntity, links.ErrInvalidURL.Error()},
        {"invalid slug", \`{"url": "https://go.dev", "slug": "a b"}\`, http.StatusUnprocessableEntity, links.ErrInvalidSlug.Error()},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rec := do(newTestAPI(t, nil), http.MethodPost, "/api/links", tt.body)
            if rec.Code != tt.wantStatus {
                t.Fatalf("status = %d, want %d; body %s", rec.Code, tt.wantStatus, rec.Body.String())
            }
            if tt.wantError != "" {
                if got := decode[map[string]string](t, rec)["error"]; got != tt.wantError {
                    t.Errorf("error = %q, want %q", got, tt.wantError)
                }
                return
            }
            link := decode[linkView](t, rec)
            if link.URL != "https://go.dev" || link.ShortURL != "https://sn.ip/"+link.Slug {
                t.Errorf("link = %+v", link)
            }
            if loc := rec.Header().Get("Location"); loc != "/api/links/"+link.Slug {
                t.Errorf("Location = %q", loc)
            }
        })
    }
}

func TestRedirectCountsClicks(t *testing.T) {
    api := newTestAPI(t, nil)
    do(api, http.MethodPost, "/api/links", \`{"url": "https://go.dev/blog", "slug": "blog"}\`)

    for range 3 {
        rec := do(api, http.MethodGet, "/blog", "")
        if rec.Code != http.StatusFound || rec.Header().Get("Location") != "https://go.dev/blog" {
            t.Fatalf("GET /blog = %d, Location %q", rec.Code, rec.Header().Get("Location"))
        }
    }
    stats := decode[linkView](t, do(api, http.MethodGet, "/api/links/blog", ""))
    if stats.Clicks != 3 {
        t.Errorf("clicks = %d, want 3", stats.Clicks)
    }
    if rec := do(api, http.MethodGet, "/missing", ""); rec.Code != http.StatusNotFound {
        t.Errorf("unknown slug: status %d, want 404", rec.Code)
    }
}

func TestDuplicateSlugConflicts(t *testing.T) {
    api := newTestAPI(t, nil)
    do(api, http.MethodPost, "/api/links", \`{"url": "https://a.dev", "slug": "same"}\`)
    if rec := do(api, http.MethodPost, "/api/links", \`{"url": "https://b.dev", "slug": "same"}\`); rec.Code != http.StatusConflict {
        t.Errorf("status = %d, want 409", rec.Code)
    }
}

func TestDeleteNeedsAPIKey(t *testing.T) {
    api := newTestAPI(t, nil)
    do(api, http.MethodPost, "/api/links", \`{"url": "https://go.dev", "slug": "temp"}\`)

    if rec := do(api, http.MethodDelete, "/api/links/temp", ""); rec.Code != http.StatusUnauthorized {
        t.Errorf("no key: status %d, want 401", rec.Code)
    }
    if rec := do(api, http.MethodDelete, "/api/links/temp", "", "X-API-Key", "wrong"); rec.Code != http.StatusUnauthorized {
        t.Errorf("wrong key: status %d, want 401", rec.Code)
    }
    if rec := do(api, http.MethodDelete, "/api/links/temp", "", "X-API-Key", testKey); rec.Code != http.StatusNoContent {
        t.Errorf("right key: status %d, want 204", rec.Code)
    }
    if rec := do(api, http.MethodGet, "/temp", ""); rec.Code != http.StatusNotFound {
        t.Errorf("after delete: status %d, want 404", rec.Code)
    }
}

func TestRateLimit(t *testing.T) {
    api := newTestAPI(t, ratelimit.New(1, 2)) // bursts of 2, then 1 per second
    body := \`{"url": "https://go.dev"}\`
    for i := range 2 {
        if rec := do(api, http.MethodPost, "/api/links", body); rec.Code != http.StatusCreated {
            t.Fatalf("request %d: status %d", i+1, rec.Code)
        }
    }
    rec := do(api, http.MethodPost, "/api/links", body)
    if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") != "1" {
        t.Errorf("3rd request: status %d, Retry-After %q; want 429 and 1", rec.Code, rec.Header().Get("Retry-After"))
    }
    if rec := do(api, http.MethodGet, "/healthz", ""); rec.Code != http.StatusOK {
        t.Errorf("other routes must not be limited: status %d", rec.Code)
    }
}

func TestRequestID(t *testing.T) {
    api := newTestAPI(t, nil)
    if id := do(api, http.MethodGet, "/healthz", "").Header().Get("X-Request-Id"); len(id) != 16 {
        t.Errorf("generated request id %q, want 16 hex characters", id)
    }
    if id := do(api, http.MethodGet, "/healthz", "", "X-Request-Id", "abc-123").Header().Get("X-Request-Id"); id != "abc-123" {
        t.Errorf("incoming request id not reused: got %q", id)
    }
    if id := do(api, http.MethodGet, "/healthz", "", "X-Request-Id", "bad id\\nwith newline").Header().Get("X-Request-Id"); len(id) != 16 {
        t.Errorf("unsafe incoming request id should be replaced, got %q", id)
    }
}

func TestMethodNotAllowed(t *testing.T) {
    rec := do(newTestAPI(t, nil), http.MethodPut, "/api/links/x", "")
    if rec.Code != http.StatusMethodNotAllowed {
        t.Errorf("status = %d, want 405", rec.Code)
    }
}` },
          ],
          run: `go test -race ./...
go test -v -run 'TestCreateLink' ./internal/httpapi`,
          output: `?   	github.com/you/snip/cmd/snip	[no test files]
ok  	github.com/you/snip/internal/httpapi	1.169s
ok  	github.com/you/snip/internal/links	1.305s
ok  	github.com/you/snip/internal/ratelimit	1.409s`,
        },
        {
          title: "Package it as a container",
          explain: `A **multi-stage build**: compile in the full \`golang\` image, then copy only the static binary into **distroless** (no shell, no package manager, a tiny attack surface) running as a **non-root** user. The final image is a few megabytes.

- \`CGO_ENABLED=0\` makes the binary fully static, so it runs without a C library.
- Copying \`go.mod\` (and \`go.sum\` once you have dependencies) before the source lets Docker cache downloaded modules between builds.
- Kubernetes sends SIGTERM on rollout; the graceful shutdown from step 5 drains requests. Point readiness and liveness probes at \`/healthz\`.

To go further: swap \`MemoryStore\` for PostgreSQL (see the extensions), so data survives restarts and several replicas can share it.`,
          files: [
            { path: "Dockerfile", lang: "dockerfile", code: `# Build stage: the full Go toolchain
FROM golang:1.24 AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/snip ./cmd/snip

# Run stage: a tiny image with no shell or package manager, running as non-root
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/snip /snip
EXPOSE 8080
ENTRYPOINT ["/snip"]` },
          ],
          run: `docker build -t snip .
docker run --rm -p 8080:8080 -e API_KEY=change-me -e BASE_URL=http://localhost:8080 snip
curl -s localhost:8080/healthz`,
          output: `{"status":"ok"}`,
        },
      ],
      extensions: [
        "Add a PostgresStore implementing links.Store with pgx (or database/sql + sqlc), a migration creating the links table, and an atomic `UPDATE ... SET clicks = clicks + 1`.",
        "Record clicks asynchronously: push events onto a buffered channel processed by a worker, so redirects never wait on a database write.",
        "Cache hot slugs in Redis with go-redis, and use singleflight so a burst of requests for one slug hits the store once.",
        "Add expiring links (an expires_at field returning 410 Gone) and a background janitor goroutine.",
        "Expose Prometheus metrics (requests by route and status, redirect latency) and OpenTelemetry traces.",
        "Write an OpenAPI spec and generate a typed client, or rebuild the HTTP layer with chi or Gin to compare.",
      ],
      verify: `$GO_CMD vet ./... && $GO_CMD test -race -count=1 ./... && $GO_CMD build -o snip ./cmd/snip && { RATE_LIMIT_PER_MINUTE=abc ./snip > cfg.log; [ $? -eq 1 ]; } && grep -q 'RATE_LIMIT_PER_MINUTE must be a positive integer' cfg.log`,
    },
    interview: [
      {
        q: "How would you structure a Go web service, and why?",
        a: "Keep cmd/<app>/main.go as the composition root that reads config, builds dependencies and manages the lifecycle. Put application code under internal/: a domain package with types, rules and small interfaces for what it needs (a Store), an HTTP package that translates requests to domain calls and domain errors to status codes, and storage implementations. Dependencies point inward, everything is injected through constructors or struct fields (no globals), so each layer is testable with fakes and the transport or database can change independently.",
        freq: "very-common",
      },
      {
        q: "How do you return consistent errors from a Go API?",
        a: "Define domain errors as sentinel values or typed errors, wrap with %w for context, and map them to HTTP responses in exactly one place (a fail/respondError function) using errors.Is/errors.As: not found → 404, conflict → 409, validation → 400/422, everything unknown → 500 with a generic message. Log unexpected errors with a request ID so support can find them, never leak internal details to clients, and keep a single JSON error shape like {\"error\": \"...\"} or RFC 9457 problem details.",
        freq: "common",
      },
      {
        q: "How would you scale this URL shortener?",
        a: "The redirect path dominates traffic and is read-heavy: put slugs in a cache (Redis, plus an in-process LRU) in front of a primary database, make the API stateless so it scales horizontally behind a load balancer, and record clicks asynchronously (queue or batched counters) so redirects don't wait on writes. Generate slugs without coordination (random with collision retry, or ID ranges per instance encoded in base62). Move rate limiting to a shared store or the gateway. Use a CDN or edge workers for the hottest links, and shard the database by slug if it outgrows one node.",
        freq: "common",
      },
      {
        q: "Why compare API keys with subtle.ConstantTimeCompare?",
        a: "A normal byte comparison returns as soon as it finds a mismatch, so it takes slightly longer the more leading bytes are correct. Over many requests an attacker can measure that difference and recover a secret byte by byte (a timing attack). ConstantTimeCompare always examines every byte, so the timing doesn't depend on how close the guess was. Better still, store only a hash of the key and compare hashes.",
      },
    ],
    quiz: [
      {
        q: "Why does the redirect use 302 instead of 301?",
        options: ["302 is faster", "Browsers cache 301s and stop asking, so clicks wouldn't be counted", "301 is deprecated", "302 keeps the body"],
        answer: 1,
        explain: "Permanent redirects are cached by browsers.",
      },
      {
        q: "What does http.MaxBytesReader protect against?",
        options: ["Slow clients", "Huge request bodies exhausting memory", "SQL injection", "CSRF"],
        answer: 1,
        explain: "Reads beyond the limit fail with *http.MaxBytesError.",
      },
      {
        q: "Why is the limiter's clock a field instead of calling time.Now directly?",
        options: ["Performance", "Tests can control time without sleeping", "time.Now isn't thread-safe", "It's required by sync.Mutex"],
        answer: 1,
        explain: "Fake clocks make time-based tests instant and deterministic.",
      },
      {
        q: "In \"GET /{slug}\" and \"GET /healthz\", which handles a request for /healthz?",
        options: ["GET /{slug}", "GET /healthz, the more specific pattern", "Whichever was registered first", "It panics on conflict"],
        answer: 1,
        explain: "Go 1.22's ServeMux picks the most specific match.",
      },
    ],
  },

  // ------------------------------------------------------------------ INTERVIEW PREP
  {
    id: "go-interview",
    stage: "Interview",
    title: "Go interview prep: the questions, the gotchas and a 4-week plan",
    tagline: "What Go interviews test, the classic coding exercises in idiomatic Go (LRU cache, concurrent crawler, heaps), the language gotchas interviewers love, and 16 deep-dive questions with model answers.",
    difficulty: "advanced",
    minutes: 60,
    visualizers: ["cache", "heap"],
    concept: `
## What a Go interview loop looks like
| Round | What they look for in Go specifically |
|---|---|
| **Phone screen / quiz** | Slices vs arrays, maps, interfaces, errors, goroutines vs threads, defer, value vs pointer receivers |
| **Coding** | Correct, readable Go: early returns, \`errors\` handled, the right standard packages (\`slices\`, \`maps\`, \`strings.Builder\`, \`container/heap\`) |
| **Concurrency** | Worker pools, channels vs mutexes, \`context\` cancellation, avoiding leaks and races, \`sync.WaitGroup\`, \`errgroup\` |
| **System design** | A service in Go: layering, HTTP/gRPC, timeouts, graceful shutdown, observability, scaling |
| **Debugging / review** | Spot the bug: nil map, loop variable capture, typed nil error, slice aliasing, missing \`Close\`, data races |

## Coding-round habits that score well in Go
- Know the toolbox: \`slices.Sort\`/\`SortFunc\`/\`BinarySearch\`, \`maps.Keys\` + \`slices.Sorted\`, \`strings.Builder\`, \`strconv\`, \`container/heap\` and \`container/list\`, \`math.MaxInt\`, \`min\`/\`max\` built-ins.
- Sets are \`map[T]struct{}\` (or \`map[T]bool\` for readability); queues are slices (\`q = q[1:]\`); stacks are slices (\`s = s[:len(s)-1]\`).
- Preallocate: \`make([]int, 0, n)\`, \`make(map[string]int, n)\`.
- Return \`(value, ok)\` or \`(value, error)\` instead of sentinel values like -1 when designing APIs.
- Talk about **concurrency safety** of anything you build: "this cache isn't safe for concurrent use; I'd add a mutex, and \`Get\` needs the full lock because it updates recency".

## A 4-week plan
| Week | Focus | Practice |
|---|---|---|
| 1 | Language core: slices, maps, structs, interfaces, errors, generics | Re-implement the Foundations and Core samples from memory; 10 easy LeetCode problems in Go |
| 2 | Concurrency: goroutines, channels, select, sync, context, patterns | Worker pool, pipeline, rate limiter and crawler from scratch, all under \`-race\` |
| 3 | Services: net/http, JSON, middleware, databases, testing, profiling | Build the URL shortener project without looking; add PostgreSQL; profile it with pprof |
| 4 | Mock interviews | 2 coding + 1 concurrency + 1 design session per week; review the gotchas sample and the questions below |
`,
    keyPoints: [
      "Go interviews test idioms as much as algorithms",
      "Know slices, maps, interfaces and errors deeply",
      "Concurrency questions: pools, channels vs mutexes, context, leaks, races",
      "Use the standard library: slices, maps, container/heap, strings.Builder",
      "Mention concurrency safety for every data structure you write",
      "Practice spotting the classic gotchas",
    ],
    code: [
      {
        title: "Classic: an LRU cache with container/list and generics",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "container/list"
    "fmt"
    "sync"
)

type entry[K comparable, V any] struct {
    key K
    val V
}

// LRU is a fixed-size cache that evicts the least recently used key.
// A map gives O(1) lookup; a doubly linked list keeps recency order (front = most recent).
type LRU[K comparable, V any] struct {
    mu       sync.Mutex // Get changes the order too, so even reads need the full lock
    capacity int
    order    *list.List
    items    map[K]*list.Element
}

func NewLRU[K comparable, V any](capacity int) *LRU[K, V] {
    return &LRU[K, V]{capacity: capacity, order: list.New(), items: make(map[K]*list.Element, capacity)}
}

func (c *LRU[K, V]) Get(key K) (V, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()
    if el, ok := c.items[key]; ok {
        c.order.MoveToFront(el)
        return el.Value.(*entry[K, V]).val, true
    }
    var zero V
    return zero, false
}

// Put inserts or updates a key and reports which key was evicted, if any.
func (c *LRU[K, V]) Put(key K, val V) (evicted K, didEvict bool) {
    c.mu.Lock()
    defer c.mu.Unlock()
    if el, ok := c.items[key]; ok {
        el.Value.(*entry[K, V]).val = val
        c.order.MoveToFront(el)
        return evicted, false
    }
    c.items[key] = c.order.PushFront(&entry[K, V]{key, val})
    if c.order.Len() > c.capacity {
        oldest := c.order.Back()
        c.order.Remove(oldest)
        evicted = oldest.Value.(*entry[K, V]).key
        delete(c.items, evicted)
        return evicted, true
    }
    return evicted, false
}

func (c *LRU[K, V]) Keys() []K { // most recently used first
    c.mu.Lock()
    defer c.mu.Unlock()
    keys := make([]K, 0, c.order.Len())
    for el := c.order.Front(); el != nil; el = el.Next() {
        keys = append(keys, el.Value.(*entry[K, V]).key)
    }
    return keys
}

func main() {
    cache := NewLRU[string, int](3)
    cache.Put("a", 1)
    cache.Put("b", 2)
    cache.Put("c", 3)
    fmt.Println("order:", cache.Keys())

    v, ok := cache.Get("a") // touching "a" makes it the most recent
    fmt.Println("get a:", v, ok, "| order:", cache.Keys())

    if k, ok := cache.Put("d", 4); ok {
        fmt.Println("put d evicted:", k) // "b" was the least recently used
    }
    _, ok = cache.Get("b")
    fmt.Println("b still cached:", ok)

    cache.Put("c", 30) // updating also refreshes recency
    fmt.Println("order:", cache.Keys())

    var wg sync.WaitGroup
    for i := range 50 { // safe under concurrency thanks to the mutex (try go run -race)
        wg.Add(1)
        go func() {
            defer wg.Done()
            cache.Put(fmt.Sprint("k", i%5), i)
            cache.Get("k0")
        }()
    }
    wg.Wait()
    fmt.Println("after 50 concurrent writers, size:", len(cache.Keys()))
}`,
          },
        ],
        output: `order: [c b a]
get a: 1 true | order: [a c b]
put d evicted: b
b still cached: false
order: [c d a]
after 50 concurrent writers, size: 3`,
        explain: `- **Why both structures**: the map finds an element in O(1); the list moves it to the front and finds the oldest (the back) in O(1). Neither alone does both.
- \`container/list\` stores \`any\`, so values need a type assertion (\`el.Value.(*entry[K, V])\`). The generic wrapper keeps that ugliness inside.
- A \`sync.RWMutex\` doesn't help here: \`Get\` modifies the list. Interviewers like this point. For high contention, **shard** the cache (N LRUs selected by key hash) or accept approximate LRU.
- Follow-ups to expect: add TTLs (store an expiry in \`entry\`, check it in \`Get\`), cap by memory instead of count, or prevent stampedes with \`singleflight\`.`,
      },
      {
        title: "Classic: a concurrent web crawler that fetches each page once",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "errors"
    "fmt"
    "maps"
    "slices"
    "sync"
    "sync/atomic"
    "time"
)

type Fetcher interface {
    Fetch(url string) (body string, links []string, err error)
}

// Crawl visits pages up to depth levels deep, fetching each URL at most once,
// with at most 'parallel' fetches in flight.
func Crawl(start string, depth, parallel int, f Fetcher) map[string]string {
    var (
        mu      sync.Mutex
        visited = map[string]bool{}
        results = map[string]string{}
        wg      sync.WaitGroup
        sem     = make(chan struct{}, parallel) // a semaphore bounding concurrent fetches
    )
    var visit func(url string, depth int)
    visit = func(url string, depth int) {
        defer wg.Done()
        if depth <= 0 {
            return
        }
        mu.Lock()
        if visited[url] {
            mu.Unlock()
            return
        }
        visited[url] = true // claim it before fetching, so no other goroutine fetches it too
        mu.Unlock()

        sem <- struct{}{}
        body, links, err := f.Fetch(url)
        <-sem

        mu.Lock()
        if err != nil {
            results[url] = "error: " + err.Error()
        } else {
            results[url] = body
        }
        mu.Unlock()

        for _, link := range links {
            wg.Add(1) // before starting the goroutine
            go visit(link, depth-1)
        }
    }
    wg.Add(1)
    go visit(start, depth)
    wg.Wait()
    return results
}

type page struct {
    body  string
    links []string
}

type fakeFetcher struct {
    pages map[string]page
    calls atomic.Int32
}

func (f *fakeFetcher) Fetch(url string) (string, []string, error) {
    f.calls.Add(1)
    time.Sleep(5 * time.Millisecond) // pretend to be the network
    if p, ok := f.pages[url]; ok {
        return p.body, p.links, nil
    }
    return "", nil, errors.New("not found")
}

func main() {
    f := &fakeFetcher{pages: map[string]page{
        "https://go.test/":         {"Home", []string{"https://go.test/pkg/", "https://go.test/cmd/"}},
        "https://go.test/pkg/":     {"Packages", []string{"https://go.test/", "https://go.test/pkg/fmt/", "https://go.test/pkg/os/"}},
        "https://go.test/pkg/fmt/": {"Package fmt", []string{"https://go.test/", "https://go.test/pkg/"}},
        "https://go.test/pkg/os/":  {"Package os", []string{"https://go.test/", "https://go.test/pkg/"}},
    }}
    results := Crawl("https://go.test/", 4, 3, f)
    for _, url := range slices.Sorted(maps.Keys(results)) { // map order is random: sort for output
        fmt.Printf("%-26s %s\\n", url, results[url])
    }
    fmt.Println("fetch calls:", f.calls.Load(), "(each URL exactly once)")
}`,
          },
        ],
        output: `https://go.test/           Home
https://go.test/cmd/       error: not found
https://go.test/pkg/       Packages
https://go.test/pkg/fmt/   Package fmt
https://go.test/pkg/os/    Package os
fetch calls: 5 (each URL exactly once)`,
        explain: `- This is the famous exercise from the Tour of Go, and a favorite interview question because every line can go wrong.
- **Check-and-mark under one lock**: if you checked \`visited\` and marked it in two separate critical sections, two goroutines could both see "not visited" and fetch the same page.
- **\`wg.Add(1)\` before \`go\`**, never inside the new goroutine, or \`Wait\` might return before it registers.
- The **semaphore** bounds network concurrency while still allowing many goroutines to exist (most are waiting).
- Follow-ups: cancellation with \`context\` (pass ctx into Fetch and stop spawning when done), per-host politeness, and returning results through a channel instead of a shared map.`,
      },
      {
        title: "Heaps: top K and merging sorted lists with container/heap",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "container/heap"
    "fmt"
)

// minHeap implements heap.Interface: sort.Interface plus Push and Pop.
type minHeap []int

func (h minHeap) Len() int           { return len(h) }
func (h minHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h minHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *minHeap) Push(x any)        { *h = append(*h, x.(int)) }
func (h *minHeap) Pop() any {
    old := *h
    x := old[len(old)-1]
    *h = old[:len(old)-1]
    return x
}

// topK returns the k largest values, largest first, in O(n log k) time and O(k) space.
func topK(nums []int, k int) []int {
    h := &minHeap{}
    for _, n := range nums {
        heap.Push(h, n)
        if h.Len() > k {
            heap.Pop(h) // drop the smallest of the k+1
        }
    }
    out := make([]int, h.Len())
    for i := len(out) - 1; i >= 0; i-- {
        out[i] = heap.Pop(h).(int)
    }
    return out
}

// cursor points at lists[list][idx]; the heap orders cursors by the value they point at.
type cursor struct{ val, list, idx int }

type cursorHeap []cursor

func (h cursorHeap) Len() int           { return len(h) }
func (h cursorHeap) Less(i, j int) bool { return h[i].val < h[j].val }
func (h cursorHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *cursorHeap) Push(x any)        { *h = append(*h, x.(cursor)) }
func (h *cursorHeap) Pop() any {
    old := *h
    x := old[len(old)-1]
    *h = old[:len(old)-1]
    return x
}

// mergeK merges k sorted lists in O(n log k).
func mergeK(lists [][]int) []int {
    h := &cursorHeap{}
    for i, l := range lists {
        if len(l) > 0 {
            *h = append(*h, cursor{l[0], i, 0})
        }
    }
    heap.Init(h) // O(k)
    var out []int
    for h.Len() > 0 {
        c := heap.Pop(h).(cursor)
        out = append(out, c.val)
        if next := c.idx + 1; next < len(lists[c.list]) {
            heap.Push(h, cursor{lists[c.list][next], c.list, next})
        }
    }
    return out
}

func main() {
    fmt.Println("top 3:", topK([]int{5, 1, 9, 3, 7, 8, 2}, 3))
    fmt.Println("merged:", mergeK([][]int{{1, 4, 5}, {1, 3, 4}, {2, 6}, {}}))
}`,
          },
        ],
        output: `top 3: [9 8 7]
merged: [1 1 2 3 4 4 5 6]`,
        explain: `- \`container/heap\` works on **any** type implementing five methods. \`Push\` and \`Pop\` have pointer receivers because they change the slice's length; call \`heap.Push(h, x)\`, never \`h.Push(x)\` directly, or the heap property breaks.
- **Top K with a min-heap of size k** is the standard trick: the smallest of the current top k sits at the root, ready to be evicted. O(n log k) beats sorting (O(n log n)) when k is small.
- \`mergeK\` keeps one cursor per list: the heap always holds the smallest unmerged element of each list. The same pattern merges sorted files in external sorting and LSM-tree compaction.`,
      },
      {
        title: "Spot the bug: the gotchas interviewers love",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "maps"
    "slices"
    "strconv"
    "unicode/utf8"
)

type MyErr struct{}

func (*MyErr) Error() string { return "my error" }

func mayFail(fail bool) error {
    var e *MyErr
    if fail {
        e = &MyErr{}
    }
    return e // BUG: a nil *MyErr inside a non-nil error interface
}

func writeNilMap() (result string) {
    defer func() {
        if r := recover(); r != nil {
            result = fmt.Sprint("panic: ", r)
        }
    }()
    var m map[string]int
    m["x"] = 1
    return "ok"
}

func deferOrder() (out []string) {
    for i := range 3 {
        defer func() { out = append(out, "deferred "+strconv.Itoa(i)) }()
    }
    x := "before"
    defer fmt.Println("defer arguments are evaluated immediately:", x)
    x = "after"
    _ = x
    return []string{"returned"}
}

func main() {
    base := make([]int, 3, 10)
    a := append(base, 1)
    b := append(base, 2) // same backing array as a: overwrites a[3]
    fmt.Println("1. shared backing array:", a[3], b[3])

    type item struct{ n int }
    items := []item{{1}, {2}}
    for _, it := range items {
        it.n *= 10 // changes a copy
    }
    fmt.Println("2. range gives copies:", items)
    for i := range items {
        items[i].n *= 10
    }
    fmt.Println("   index into the slice instead:", items)

    s := "héllo"
    fmt.Println("3. len counts bytes:", len(s), "| runes:", utf8.RuneCountInString(s), "| s[1] is a byte:", s[1], "| []rune(s)[1]:", string([]rune(s)[1]))

    var nilMap map[string]int
    var nilSlice []int
    nilSlice = append(nilSlice, 1)
    fmt.Println("4. read nil map:", nilMap["x"], "| append to nil slice:", nilSlice, "| write nil map:", writeNilMap())

    fmt.Println("5. typed nil error is not nil:", mayFail(false) != nil)

    var err error
    if true {
        _, err := strconv.Atoi("x") // := declares a NEW err that shadows the outer one
        _ = err
    }
    fmt.Println("6. outer err still nil after shadowing:", err == nil)

    m := map[string]int{"b": 2, "a": 1, "c": 3}
    fmt.Println("7. map order is random, so sort the keys:", slices.Sorted(maps.Keys(m)))

    res := deferOrder()
    fmt.Println("8. defers run last-in, first-out, after return sets results:", res)

    var funcs []func() int
    for i := range 3 {
        funcs = append(funcs, func() int { return i })
    }
    fmt.Println("9. each iteration has its own i (Go 1.22+):", funcs[0](), funcs[1](), funcs[2]())
}`,
          },
        ],
        output: `1. shared backing array: 2 2
2. range gives copies: [{1} {2}]
   index into the slice instead: [{10} {20}]
3. len counts bytes: 6 | runes: 5 | s[1] is a byte: 195 | []rune(s)[1]: é
4. read nil map: 0 | append to nil slice: [1] | write nil map: panic: assignment to entry in nil map
5. typed nil error is not nil: true
6. outer err still nil after shadowing: true
7. map order is random, so sort the keys: [a b c]
defer arguments are evaluated immediately: before
8. defers run last-in, first-out, after return sets results: [returned deferred 2 deferred 1 deferred 0]
9. each iteration has its own i (Go 1.22+): 0 1 2`,
        explain: `Each line is a classic "what does this print?" question:
1. Two \`append\`s on a slice with spare capacity write into the **same array**. Use \`slices.Clone\` or a full slice expression \`base[:3:3]\`.
2. The \`range\` value is a **copy**; modify through the index or use a slice of pointers.
3. Strings are bytes: \`len\` and indexing work in bytes; \`é\` takes two. Range over the string or convert to \`[]rune\` for characters.
4. Reading a nil map returns zero values and appending to a nil slice works, but **writing to a nil map panics**.
5. The typed nil interface trap from the interfaces chapter.
6. \`:=\` in an inner scope **shadows**; the outer \`err\` is never set. Linters (\`govet -vettool shadow\`) catch it.
7. Map iteration order is deliberately randomized.
8. Notice the line printed just **before** item 8: it comes from inside \`deferOrder\`. Deferred calls run in LIFO order when \`deferOrder\` returns, and the \`Println\` defer printed "before" because its arguments were evaluated at the \`defer\` statement. The deferred closures can still change the named result after \`return\`.
9. Before Go 1.22 all three closures shared one \`i\` and printed \`3 3 3\`. Older codebases (and interviewers) still ask about it.`,
      },
    ],
    interview: [
      {
        q: "When would you choose Go, and when wouldn't you?",
        a: "Go fits network services, APIs, CLIs, infrastructure and cloud tooling (Docker, Kubernetes, Terraform are Go): fast compilation, a single static binary, strong concurrency primitives, a rich standard library, easy deployment and a small language teams can read consistently. It's less suited to hard real-time or extremely latency-sensitive code (GC pauses, though small), heavy numeric/ML work (Python/C++ ecosystems), GUI or game development, and problems that benefit from very expressive type systems or zero-cost abstractions (Rust, C++).",
        freq: "common",
      },
      {
        q: "How is a slice represented and what happens on append?",
        a: "A slice is a three-word header: a pointer to a backing array, a length and a capacity. append writes into the existing array if len < cap (so other slices sharing the array can see the change); otherwise it allocates a bigger array (roughly doubling for small slices, growing ~1.25x for large ones), copies the elements, and returns a header pointing to the new array. That's why you must use the returned slice (s = append(s, x)), and why two appends on the same base can overwrite each other.",
        freq: "very-common",
      },
      {
        q: "How are Go maps implemented, and what are their limitations?",
        a: "Since Go 1.24, maps use Swiss tables: open addressing with groups of 8 slots and control bytes holding hash fragments, probed with SIMD-style comparisons, split into tables that grow independently (earlier versions used buckets with overflow chains). Lookups and inserts are O(1) on average. Limitations: not safe for concurrent writes (the runtime crashes on detected concurrent map writes), iteration order is randomized, elements aren't addressable (m[k].field = v doesn't compile), keys must be comparable, and memory isn't returned when you delete entries (recreate the map to shrink).",
        freq: "very-common",
      },
      {
        q: "Value receivers vs pointer receivers: how do you choose?",
        a: "Use pointer receivers when the method mutates the receiver, when the struct is large (avoid copying), or when it contains a sync.Mutex or other no-copy fields; use value receivers for small immutable types (time.Time, Point). Be consistent across a type's methods. Method sets matter: the method set of T includes only value-receiver methods, while *T includes both, so if any interface method has a pointer receiver, only *T satisfies the interface.",
        freq: "very-common",
      },
      {
        q: "What's the difference between new and make?",
        a: "new(T) allocates zeroed storage for any type T and returns a *T. make is only for slices, maps and channels: it initializes their internal structures (backing array, hash table, channel buffer) and returns the value itself, not a pointer. new([]int) gives a pointer to a nil slice, which is rarely useful; make([]int, 0, 10) gives a ready slice. Composite literals (&T{...}) are more common than new in practice.",
        freq: "common",
      },
      {
        q: "Explain defer precisely.",
        a: "defer schedules a function call to run when the surrounding function returns, whether normally or by panic. The function value and its arguments are evaluated immediately at the defer statement; the call happens later. Deferred calls run in last-in, first-out order, after return values are set, so deferred closures can read and modify named results (used for error wrapping and recover). Common mistakes: deferring inside a loop (resources pile up until the function returns; extract a helper function) and ignoring errors from deferred Close on writable files.",
        freq: "common",
      },
      {
        q: "Does Go have inheritance? How does embedding differ?",
        a: "No. Go uses composition: embedding a type in a struct promotes its fields and methods to the outer type, so they can be called directly, and the outer type can satisfy interfaces through promoted methods. But there's no subtype relationship (you can't pass the outer type where the embedded type is expected) and no virtual dispatch back into the outer type: a promoted method's receiver is always the embedded value. Polymorphism comes from interfaces instead.",
        freq: "common",
      },
      {
        q: "How would you build a concurrency-safe cache with expiration?",
        a: "A map from key to {value, expiresAt} guarded by a sync.RWMutex (or sharded into N maps by key hash to reduce contention). Get takes the read lock and treats expired entries as misses; Set takes the write lock. A janitor goroutine with a ticker deletes expired entries periodically, stopping via context or a done channel. Add singleflight to avoid stampedes on misses, a size bound with LRU eviction (container/list) if memory matters, and metrics for hit rate. Libraries: ristretto, freecache, or groupcache for distributed cases.",
        freq: "common",
      },
      {
        q: "How do you find and fix a goroutine leak in production?",
        a: "Symptoms: steadily rising goroutine count and memory. Confirm with runtime.NumGoroutine or the go_goroutines metric, then capture /debug/pprof/goroutine?debug=2 (or a profile diffed over time with -base) to see where goroutines are blocked: typically on a channel send with no receiver, a receive on a channel never closed, a missing context cancellation, or a forgotten ticker. Fix by giving every goroutine an exit path (select on ctx.Done(), close channels, buffered result channels when the receiver may leave), and add goleak to tests.",
        freq: "common",
      },
      {
        q: "What does init() do, and what's the order of initialization?",
        a: "init functions run automatically after a package's variables are initialized and before main. Order: imported packages are initialized first (depth-first, each once), then within a package, package-level variables in dependency order, then init functions in the order they appear (files presented to the compiler in name order). A package can have several init functions. Keep them minimal: hidden side effects at import time (registering drivers is the classic legitimate use) make code hard to test and reason about; prefer explicit constructors.",
      },
      {
        q: "What is the empty struct, and where is it useful?",
        a: "struct{} has zero size, and all zero-size values may share the same address. It's used for sets (map[string]struct{} stores no values), for signaling channels (chan struct{} carries an event, not data, as in ctx.Done()), and as a method receiver for types that hold no state. It makes intent explicit: the value carries no information.",
      },
      {
        q: "When do you use reflection in Go?",
        a: "When code must work with types unknown at compile time: encoders and decoders (encoding/json, ORMs), dependency injection containers, validation from struct tags, test helpers like reflect.DeepEqual or go-cmp. Downsides: it's slower, loses compile-time type safety, and panics on misuse. Prefer interfaces or generics when the set of operations is known; reach for reflection mainly in libraries.",
      },
      {
        q: "Walk me through what happens when you call http.Get.",
        a: "http.Get uses DefaultClient, which builds a Request and calls its Transport. The Transport looks for an idle keep-alive connection to that host in its pool; otherwise it resolves DNS, dials TCP (with Happy Eyeballs for IPv4/IPv6), performs the TLS handshake for https (negotiating HTTP/2 via ALPN if available), writes the request, and reads the response headers. The Response's Body streams the rest; the caller must read and Close it so the connection returns to the pool. Redirects are followed by the Client (up to 10 by default). DefaultClient has no timeout, so production code configures its own Client.",
        freq: "common",
      },
      {
        q: "How do you organize packages in a larger Go codebase?",
        a: "Package by responsibility or domain, not by layer type names like utils/models. Keep packages small and cohesive with clear, non-stuttering names (http.Server, not http.HTTPServer). Use internal/ to keep packages private to the module, cmd/ for binaries, and avoid import cycles by having higher-level packages depend on lower-level ones (and interfaces declared by consumers). Avoid premature abstraction and deep hierarchies; a flat layout is fine until it isn't.",
      },
      {
        q: "How do you make a type safe for concurrent use and communicate that?",
        a: "Encapsulate the state behind methods that take a mutex (or use atomics/channels internally), never expose the protected fields, keep the zero value valid or provide a constructor, and avoid copying the type after use (go vet's copylocks check catches copies of types containing a Mutex). Document it explicitly in the type's comment ('A Cache is safe for concurrent use by multiple goroutines'), as the standard library does, because Go has no type-system marker for thread safety. Test with -race and concurrent tests.",
      },
      {
        q: "Which recent Go features do you use?",
        a: "Go 1.21: min/max/clear built-ins, log/slog, slices and maps packages. 1.22: per-iteration loop variables, range over ints, method and wildcard patterns in net/http's ServeMux. 1.23: range-over-func iterators (iter.Seq), unique package. 1.24: generic type aliases, Swiss-table maps, the tool directive in go.mod, testing.B.Loop, os.Root, the omitzero JSON tag. 1.25: sync.WaitGroup.Go, testing/synctest, container-aware GOMAXPROCS, an experimental encoding/json/v2. 1.26: the Green Tea garbage collector by default and new(expr). Mentioning a few with a reason you used them shows you keep up.",
      },
    ],
    quiz: [
      {
        q: "What does append do when len(s) == cap(s)?",
        options: ["Panics", "Allocates a larger array and copies", "Overwrites index 0", "Returns s unchanged"],
        answer: 1,
        explain: "Always use the returned slice.",
      },
      {
        q: "What does new(T) return?",
        options: ["A T value", "A pointer to a zeroed T", "An initialized map", "nil"],
        answer: 1,
        explain: "make is for slices, maps and channels.",
      },
      {
        q: "Which is safe to use from several goroutines without extra locking?",
        options: ["map[string]int", "[]int with append", "A channel", "strings.Builder"],
        answer: 2,
        explain: "Channels synchronize internally.",
      },
      {
        q: "What does `for i := range 3 { defer fmt.Print(i) }` print?",
        options: ["012", "210", "333", "Nothing"],
        answer: 1,
        explain: "Arguments are evaluated at defer time; calls run LIFO.",
      },
      {
        q: "How many bytes does struct{}{} occupy?",
        options: ["0", "1", "8", "Depends on the platform"],
        answer: 0,
        explain: "That's why map[K]struct{} is a memory-efficient set.",
      },
      {
        q: "Save has a pointer receiver. Does a T value (not *T) satisfy `interface{ Save() }`?",
        options: ["Yes", "No, only *T does", "Only if T is a struct", "Only with generics"],
        answer: 1,
        explain: "T's method set excludes pointer-receiver methods.",
      },
      {
        q: "What does GOMAXPROCS control?",
        options: ["Max goroutines", "How many OS threads execute Go code simultaneously", "Heap size", "Number of CPUs installed"],
        answer: 1,
        explain: "Threads blocked in syscalls don't count toward it.",
      },
      {
        q: "In the LRU cache, why can't Get use a read lock (RLock)?",
        options: ["RLock is slower", "Get moves the element in the list, which is a write", "Maps forbid RLock", "It can, actually"],
        answer: 1,
        explain: "Reads that update recency are writes.",
      },
    ],
    problems: [
      { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "Medium", note: "map + container/list" },
      { title: "Merge k Sorted Lists", url: "https://leetcode.com/problems/merge-k-sorted-lists/", difficulty: "Hard", note: "container/heap of list heads" },
      { title: "Kth Largest Element in an Array", url: "https://leetcode.com/problems/kth-largest-element-in-an-array/", difficulty: "Medium", note: "size-k min-heap or quickselect" },
      { title: "Top K Frequent Words", url: "https://leetcode.com/problems/top-k-frequent-words/", difficulty: "Medium", note: "map + slices.SortFunc with tie-breaks" },
      { title: "Course Schedule", url: "https://leetcode.com/problems/course-schedule/", difficulty: "Medium", note: "topological sort with a slice queue" },
      { title: "Find Median from Data Stream", url: "https://leetcode.com/problems/find-median-from-data-stream/", difficulty: "Hard", note: "two heaps" },
    ],
  },
];
