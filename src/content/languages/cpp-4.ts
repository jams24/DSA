import type { Lesson } from "../types";

// C++ track, part 4: Ecosystem.

export const cppEcosystem: Lesson[] = [
  // ------------------------------------------------------------------ LIBRARIES
  {
    id: "cpp-libraries",
    stage: "Ecosystem",
    title: "The standard library's hidden gems and the libraries C++ teams use",
    tagline: "Dates and durations with <chrono>, random numbers done right, std::filesystem, then a curated toolbox: fmt, spdlog, JSON, HTTP, databases, Boost, Abseil, testing, math and GUI.",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## Know what the standard library gives you
Before adding a dependency, check the standard library. Beyond containers and algorithms it has:
| Header | What |
|---|---|
| \`<chrono>\` | Durations, clocks, time points, calendar dates and time zones (C++20) |
| \`<random>\` | Engines (mt19937, pcg-quality alternatives exist outside) and distributions |
| \`<filesystem>\` | Paths, directories, file metadata, copy/rename/remove |
| \`<format>\` / \`<print>\` | Type-safe formatting (based on the fmt library) |
| \`<charconv>\` | Fastest number parsing/printing: \`from_chars\`, \`to_chars\` |
| \`<regex>\` | Regular expressions. **Slow**: use RE2 or CTRE in hot paths |
| \`<thread>\`, \`<future>\`, \`<atomic>\` | Concurrency (see the concurrency chapter) |
| \`<numbers>\`, \`<cmath>\`, \`<numeric>\`, \`<bit>\` | Math constants, functions, reductions, bit tricks |

## <chrono> in one minute
- A **duration** is a count with a unit: \`2h + 45min\`, \`std::chrono::milliseconds(250)\`. Conversions that could lose precision need \`duration_cast\`.
- A **clock** gives **time points**: \`system_clock\` is wall time (can jump when the clock is adjusted), \`steady_clock\` only moves forward: **always measure elapsed time with steady_clock**.
- **Calendar** types (C++20): \`2026y / November / 3\` is a \`year_month_day\`; \`sys_days\` converts dates to a time point so you can subtract them. Time zones: \`std::chrono::zoned_time{"Europe/Paris", now}\`.

## <random> done right
- Don't use \`rand()\`: low quality and shared global state.
- An **engine** generates raw random bits (\`std::mt19937\` for simulations, \`std::mt19937_64\` for 64-bit values); a **distribution** shapes them (\`uniform_int_distribution\`, \`normal_distribution\`, \`bernoulli_distribution\`...).
- Create the engine **once** and reuse it. Seed it with \`std::random_device\` in real programs and with a fixed seed in tests (reproducible).
- Engine output is specified exactly by the standard; **distribution output is not**, so the same seed gives different dice rolls with libc++, libstdc++ and MSVC.
- None of these are cryptographically secure. For tokens and keys use the OS (\`getrandom\`, \`arc4random\`) or libsodium/OpenSSL.

## <filesystem>
\`std::filesystem::path\` handles separators and decomposition (\`filename\`, \`stem\`, \`extension\`, \`parent_path\`). Functions: \`exists\`, \`create_directories\`, \`file_size\`, \`copy\`, \`rename\`, \`remove_all\`, \`directory_iterator\`, \`recursive_directory_iterator\`. Most throw \`filesystem_error\`, or take an extra \`std::error_code&\` argument instead. **Directory iteration order is unspecified**: sort if you need stable output.

## Choosing third-party libraries
C++ has no single central registry, so evaluate: Is it **maintained**? Is it in **vcpkg/Conan**? **Header-only** (easy to add, slower to compile) or compiled? **License** (MIT/BSD/Boost are easy; GPL has obligations)? Does it require **exceptions or RTTI**? The **Toolbox tab** is a curated, opinionated list grouped by job, with snippets.

**Boost** deserves a special mention: a collection of 170+ peer-reviewed libraries. Many standard features (smart pointers, \`optional\`, \`variant\`, \`filesystem\`, threads, regex) started there. Highlights still used daily: Asio (networking), Beast (HTTP/WebSocket), JSON, Program Options, Unordered (fastest hash maps), Container, Multiprecision, Spirit, Test.
`,
    keyPoints: [
      "Check the standard library first: chrono, random, filesystem, format, charconv",
      "Measure elapsed time with steady_clock, never system_clock",
      "Create a random engine once; seed it from random_device, or fixed in tests",
      "Engine output is portable, distribution output isn't; neither is cryptographically secure",
      "std::regex is slow: RE2 or CTRE for hot paths",
      "Evaluate libraries by maintenance, packaging, header-only vs compiled, and license",
      "Boost, Abseil and Folly are the big general-purpose extensions",
    ],
    code: [
      {
        title: "Dates, durations and timing with <chrono>",
        variants: [
          {
            lang: "cpp",
            code: `#include <chrono>
#include <print>
#include <ratio>
#include <thread>

int main() {
    using namespace std::chrono;                               // also brings in the h, min, ms, y literals

    constexpr year_month_day today{2026y / November / 3};      // a calendar date
    std::println("{} is a {}", today, weekday{sys_days{today}});
    constexpr year_month_day christmas{2026y / December / 25};
    std::println("{} days until Christmas", (sys_days{christmas} - sys_days{today}).count());
    std::println("one month later: {}", today + months{1});
    std::println("last day of February 2028: {}", year_month_day{2028y / February / last});
    std::println("2100 is a leap year: {}", year{2100}.is_leap());

    auto meeting = 2h + 45min;                                 // the unit is part of the type
    std::println("2h + 45min = {} = {}", meeting, duration_cast<seconds>(meeting));
    std::println("90min in hours: {}", duration<double, std::ratio<3600>>(90min));

    auto timestamp = sys_days{today} + 14h + 30min;            // a time point (UTC)
    std::println("timestamp {} UTC", timestamp);
    std::println("unix time {}", duration_cast<seconds>(timestamp.time_since_epoch()).count());

    auto start = steady_clock::now();                          // steady_clock never jumps: use it to measure
    std::this_thread::sleep_for(20ms);
    auto elapsed = duration_cast<milliseconds>(steady_clock::now() - start);
    std::println("slept at least 20ms: {}", elapsed >= 20ms);
}`,
          },
        ],
        output: `2026-11-03 is a Tue
52 days until Christmas
one month later: 2026-12-03
last day of February 2028: 2028-02-29
2100 is a leap year: false
2h + 45min = 165min = 9900s
90min in hours: 1.5h
timestamp 2026-11-03 14:30:00 UTC
unix time 1793716200
slept at least 20ms: true`,
        explain: `- Durations print with their unit (\`165min\`), and mixing units converts automatically when no precision is lost. Converting minutes to seconds is safe; seconds to minutes needs \`duration_cast\` (it truncates).
- \`2028y / February / last\` names "the last day of February" and resolves to the 29th because 2028 is a leap year. 2100 isn't: century years must be divisible by 400.
- The elapsed time varies every run, so the sample prints only a comparison. For benchmarks use Google Benchmark (see the toolbox), which handles warm-up and statistics.`,
      },
      {
        title: "Random numbers and std::filesystem",
        variants: [
          {
            lang: "cpp",
            code: `#include <algorithm>
#include <cmath>
#include <filesystem>
#include <format>
#include <fstream>
#include <map>
#include <print>
#include <random>
#include <string>
#include <vector>

namespace fs = std::filesystem;

int main() {
    std::mt19937 engine(42);                                   // fixed seed: reproducible (good for tests)
    std::println("mt19937(42) first output: {}", engine());
    std::mt19937 standard;                                     // default seed 5489
    standard.discard(9999);
    std::println("10000th output of a default mt19937: {}", standard());

    std::uniform_int_distribution<int> die(1, 6);
    std::map<int, int> counts;
    for (int i = 0; i < 60'000; ++i) ++counts[die(engine)];
    bool fair = std::ranges::all_of(counts, [](const auto& kv) { return kv.second > 9'500 && kv.second < 10'500; });
    std::println("faces seen: {}, each close to 10000 times: {}", counts.size(), fair);

    std::normal_distribution<double> height(170.0, 10.0);     // mean 170, standard deviation 10
    double sum = 0;
    for (int i = 0; i < 100'000; ++i) sum += height(engine);
    std::println("sample mean within 0.5 of 170: {}", std::abs(sum / 100'000 - 170.0) < 0.5);

    std::vector<int> deck{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    std::ranges::shuffle(deck, engine);
    std::vector<int> sorted = deck;
    std::ranges::sort(sorted);
    std::println("shuffled deck still holds 1..10: {}", sorted == std::vector<int>{1, 2, 3, 4, 5, 6, 7, 8, 9, 10});

    fs::path p = "/var/log/app/server.log";
    std::println("filename={} stem={} extension={} parent={}",
                 p.filename().string(), p.stem().string(), p.extension().string(), p.parent_path().string());

    fs::path root = fs::temp_directory_path() / "dsa-quest-fs-demo";
    fs::remove_all(root);                                      // start clean
    fs::create_directories(root / "logs" / "2026");            // like mkdir -p
    std::ofstream(root / "logs" / "2026" / "nov.log") << "line 1\\nline 2\\n";
    std::ofstream(root / "logs" / "readme.md") << "# logs";
    std::ofstream(root / "notes.txt") << "hello";

    std::vector<std::string> entries;
    for (const auto& entry : fs::recursive_directory_iterator(root)) {
        std::string rel = fs::relative(entry.path(), root).generic_string();
        entries.push_back(entry.is_directory() ? rel + "/" : std::format("{} ({} bytes)", rel, entry.file_size()));
    }
    std::ranges::sort(entries);                                // iteration order is unspecified
    for (const auto& e : entries) std::println("  {}", e);

    fs::rename(root / "notes.txt", root / "logs" / "notes.txt");
    std::println("notes.txt moved into logs/: {}", fs::exists(root / "logs" / "notes.txt"));
    std::println("remove_all deleted {} entries", fs::remove_all(root));
}`,
          },
        ],
        output: `mt19937(42) first output: 1608637542
10000th output of a default mt19937: 4123659995
faces seen: 6, each close to 10000 times: true
sample mean within 0.5 of 170: true
shuffled deck still holds 1..10: true
filename=server.log stem=server extension=.log parent=/var/log/app
  logs/
  logs/2026/
  logs/2026/nov.log (14 bytes)
  logs/readme.md (6 bytes)
  notes.txt (5 bytes)
notes.txt moved into logs/: true
remove_all deleted 6 entries`,
        explain: `- **4123659995** is required by the C++ standard: every conforming \`mt19937\` must produce it as its 10000th value. That's why engines are portable. Dice rolls from \`uniform_int_distribution\` aren't, so the sample checks properties (all six faces, roughly 10000 each) instead of exact values. Tests of random code should do the same, or inject the generator.
- \`std::ofstream(path) << "..."\` writes through a temporary stream that's flushed and closed at the end of the statement.
- \`generic_string()\` always uses \`/\`, even on Windows, which keeps output portable.
- \`remove_all\` returns the number of files and directories it deleted.`,
      },
    ],
    toolbox: [
      {
        category: "Formatting & logging",
        blurb: "std::format and std::print came from fmt; spdlog is the de facto logger.",
        libs: [
          {
            name: "{fmt}",
            tag: "essential",
            what: "The library std::format is based on: fast, type-safe formatting with compile-time format string checks.",
            when: "Use std::format/std::print when your compiler supports them; fmt when you need older compilers, faster compile times, or extras (fmt::join, colors, chrono and ranges formatting everywhere).",
            snippet: {
              lang: "cpp",
              code: `#include <fmt/format.h>
#include <fmt/ranges.h>
#include <fmt/color.h>

std::string s = fmt::format("{:>8.2f} | {:#x} | {}", 3.14159, 255, "text");
fmt::print("{}\\n", std::vector{1, 2, 3});                          // [1, 2, 3]
fmt::print("{}\\n", fmt::join(names, ", "));
fmt::print(fg(fmt::color::crimson) | fmt::emphasis::bold, "error: {}\\n", msg);`,
            },
          },
          {
            name: "spdlog",
            tag: "essential",
            what: "Very fast, header-only or compiled logging built on fmt: sinks for console, rotating files, syslog; sync or async.",
            when: "The default logger for C++ applications. Quill is faster for low-latency systems; glog (Google) in older codebases.",
            snippet: {
              lang: "cpp",
              code: `#include <spdlog/spdlog.h>
#include <spdlog/sinks/rotating_file_sink.h>

spdlog::set_level(spdlog::level::debug);
spdlog::set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] [%t] %v");
spdlog::info("server listening on port {}", port);
spdlog::warn("slow request: {} took {}ms", path, ms);

auto file = spdlog::rotating_logger_mt("app", "logs/app.log", 10 * 1024 * 1024, 5);   // 10 MB x 5 files
file->error("payment {} failed: {}", id, reason);`,
            },
          },
          {
            name: "Quill",
            tag: "rising",
            what: "Asynchronous logging with nanosecond-scale hot-path cost: formatting happens on a background thread.",
            when: "Trading systems, games and anything latency-sensitive where even spdlog's formatting cost matters.",
          },
        ],
      },
      {
        category: "JSON & serialization",
        blurb: "No JSON in the standard library (yet: C++26 reflection will make serialization libraries much simpler).",
        libs: [
          {
            name: "nlohmann/json",
            tag: "essential",
            what: "\"JSON for Modern C++\": intuitive, STL-like API, header-only. The most popular C++ JSON library.",
            when: "Default for convenience: configs, APIs, tooling. Not the fastest; for heavy throughput use simdjson (parsing) or Glaze.",
            snippet: {
              lang: "cpp",
              code: `#include <nlohmann/json.hpp>
using json = nlohmann::json;

struct User {
    std::string name;
    int age;
    std::vector<std::string> roles;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(User, name, age, roles)   // generates to_json / from_json

json j = User{"Ada", 36, {"admin"}};
std::string text = j.dump(2);                                 // pretty-print with 2 spaces
User back = json::parse(text).get<User>();

json doc = json::parse(R"({"items": [{"id": 1, "price": 9.5}]})");
double price = doc["items"][0]["price"];
std::string missing = doc.value("currency", "USD");          // default if absent
json invalid = json::parse("{oops", nullptr, false);          // no exception
if (invalid.is_discarded()) { /* handle bad input */ }`,
            },
          },
          {
            name: "simdjson",
            tag: "popular",
            what: "Parses JSON at gigabytes per second using SIMD instructions; on-demand API that only parses what you read.",
            when: "Log processing, analytics, high-throughput APIs where parsing dominates. Read-only: pair it with another library for writing.",
          },
          {
            name: "Glaze",
            tag: "rising",
            what: "Extremely fast JSON (and BEVE, CSV, TOML) read/write with compile-time reflection of aggregates: often no macros needed.",
            when: "When you want both speed and automatic struct mapping. Requires a recent compiler (C++23).",
            snippet: {
              lang: "cpp",
              code: `#include <glaze/glaze.hpp>

struct Order { int id; std::string item; double price; };    // aggregates are reflected automatically

Order order{7, "book", 12.5};
std::string json = glz::write_json(order).value_or("");        // {"id":7,"item":"book","price":12.5}
auto parsed = glz::read_json<Order>(R"({"id":8,"item":"pen","price":1.2})");
if (parsed) std::println("{}", parsed->item);`,
            },
          },
          {
            name: "Boost.JSON",
            tag: "popular",
            what: "Fast JSON with a DOM (value, object, array), streaming parser, and value_from/value_to conversions.",
            when: "When you already use Boost (it pairs naturally with Beast, as in the REST API project).",
          },
          {
            name: "Protocol Buffers / FlatBuffers / Cap'n Proto",
            tag: "popular",
            what: "Schema-based binary serialization: compact, fast, versioned. FlatBuffers and Cap'n Proto read data without parsing (zero-copy).",
            when: "Service-to-service messages (Protobuf with gRPC), game assets and networking (FlatBuffers), IPC. JSON stays best for public APIs.",
          },
        ],
      },
      {
        category: "HTTP & networking",
        blurb: "The standard has no networking yet. These fill the gap; web frameworks are in the next chapter.",
        libs: [
          {
            name: "Boost.Asio / standalone Asio",
            tag: "essential",
            what: "The foundation of C++ networking: async I/O on sockets, timers, signals and serial ports, with callbacks, futures or C++20 coroutines.",
            when: "Any custom network server or client, and the base layer of Beast, cpp-httplib alternatives, many game servers and trading systems.",
            snippet: {
              lang: "cpp",
              code: `#include <boost/asio.hpp>
namespace asio = boost::asio;
using asio::ip::tcp;

asio::awaitable<void> echo(tcp::socket socket) {              // one coroutine per connection
    char data[1024];
    for (;;) {
        std::size_t n = co_await socket.async_read_some(asio::buffer(data), asio::use_awaitable);
        co_await asio::async_write(socket, asio::buffer(data, n), asio::use_awaitable);
    }
}

asio::awaitable<void> listener(unsigned short port) {
    auto executor = co_await asio::this_coro::executor;
    tcp::acceptor acceptor(executor, {tcp::v4(), port});
    for (;;) asio::co_spawn(executor, echo(co_await acceptor.async_accept(asio::use_awaitable)), asio::detached);
}

int main() {
    asio::io_context io;
    asio::co_spawn(io, listener(9000), asio::detached);
    io.run();                                                  // the event loop
}`,
            },
          },
          {
            name: "cpr",
            tag: "popular",
            what: "\"Curl for People\": a Python-requests-like HTTP client wrapping libcurl.",
            when: "The easiest way to call REST APIs from C++. Use libcurl directly for fine control, Beast when you're already on Asio.",
            snippet: {
              lang: "cpp",
              code: `#include <cpr/cpr.h>

cpr::Response r = cpr::Get(cpr::Url{"https://api.github.com/repos/jams24/DSA"},
                           cpr::Header{{"Accept", "application/vnd.github+json"}},
                           cpr::Timeout{5000});
if (r.status_code == 200) {
    auto repo = nlohmann::json::parse(r.text);
    std::println("{} stars", repo["stargazers_count"].get<int>());
}

cpr::Response created = cpr::Post(cpr::Url{"http://localhost:8080/todos"},
                                  cpr::Body{R"({"title":"Learn C++"})"},
                                  cpr::Header{{"Content-Type", "application/json"}});`,
            },
          },
          {
            name: "libcurl",
            tag: "standard",
            what: "The C library behind curl: every protocol, every option, on every platform.",
            when: "Maximum control and portability; wrap its handles in RAII (unique_ptr with curl_easy_cleanup) or use cpr.",
          },
          {
            name: "gRPC",
            tag: "popular",
            what: "Google's RPC framework: Protobuf contracts, HTTP/2 streaming, generated C++ client and server code.",
            when: "Internal service-to-service APIs, especially in polyglot systems (C++ engine called from Go or Java services).",
          },
          {
            name: "ZeroMQ (cppzmq)",
            tag: "popular",
            what: "Brokerless messaging sockets: pub/sub, push/pull, request/reply patterns over TCP, IPC or in-process.",
            when: "Low-latency messaging between processes without running a broker. For durable streams use Kafka (librdkafka).",
          },
        ],
      },
      {
        category: "Databases",
        blurb: "Most C++ database access is a thin RAII layer over the official C client.",
        libs: [
          {
            name: "libpqxx",
            tag: "essential",
            what: "The official C++ client for PostgreSQL: connections, transactions, prepared statements, streaming.",
            when: "Default for Postgres. Drogon and userver include their own async Postgres clients.",
            snippet: {
              lang: "cpp",
              code: `#include <pqxx/pqxx>

pqxx::connection conn{"postgresql://app:secret@localhost/shop"};
pqxx::work tx{conn};                                           // a transaction (RAII: aborts unless committed)
tx.exec("INSERT INTO orders (customer, total) VALUES ($1, $2)", pqxx::params{"ada", 42.5});
for (auto [id, customer, total] : tx.query<int, std::string, double>("SELECT id, customer, total FROM orders")) {
    std::println("{} {} {}", id, customer, total);
}
tx.commit();`,
            },
          },
          {
            name: "SQLite + SQLiteCpp",
            tag: "essential",
            what: "SQLite is an embedded SQL database in one C file; SQLiteCpp is a small RAII wrapper.",
            when: "Desktop and mobile apps, tools, caches, tests: anywhere you want SQL without a server.",
            snippet: {
              lang: "cpp",
              code: `#include <SQLiteCpp/SQLiteCpp.h>

SQLite::Database db("app.db", SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE);
db.exec("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)");
SQLite::Statement insert(db, "INSERT INTO notes (text) VALUES (?)");
insert.bind(1, "remember the milk");
insert.exec();
SQLite::Statement query(db, "SELECT id, text FROM notes");
while (query.executeStep()) std::println("{}: {}", query.getColumn(0).getInt(), query.getColumn(1).getString());`,
            },
          },
          {
            name: "redis-plus-plus",
            tag: "popular",
            what: "A full-featured Redis client (on hiredis): connection pools, pipelines, pub/sub, cluster and sentinel.",
            when: "Caching, rate limiting and queues with Redis from C++.",
          },
          {
            name: "sqlpp11 / SOCI",
            tag: "popular",
            what: "sqlpp11: type-safe SQL embedded in C++ (queries checked at compile time). SOCI: one API for several databases.",
            when: "When you want compile-time-checked queries or database portability instead of raw SQL strings.",
          },
        ],
      },
      {
        category: "General-purpose foundations",
        blurb: "Big libraries that extend the standard library; most large C++ companies use one of them.",
        libs: [
          {
            name: "Boost",
            tag: "essential",
            what: "170+ peer-reviewed libraries: Asio, Beast, JSON, Unordered, Container, Program Options, Multiprecision, Graph, Spirit, Test...",
            when: "Pick individual libraries as needed (most are header-only). The proving ground for future standard features.",
          },
          {
            name: "Abseil",
            tag: "popular",
            what: "Google's C++ foundation library: Swiss-table hash maps, string utilities (StrCat, StrSplit), status types, synchronization, time.",
            when: "Fast hash maps (absl::flat_hash_map is typically much faster than std::unordered_map) and Google-style codebases.",
            snippet: {
              lang: "cpp",
              code: `#include <absl/container/flat_hash_map.h>
#include <absl/strings/str_split.h>
#include <absl/strings/str_join.h>

absl::flat_hash_map<std::string, int> counts;                // open addressing, SIMD probing
for (std::string_view word : absl::StrSplit(text, ' ', absl::SkipEmpty())) ++counts[word];
std::string csv = absl::StrJoin(std::vector{"a", "b", "c"}, ",");`,
            },
          },
          {
            name: "Folly",
            tag: "popular",
            what: "Meta's library of high-performance components: futures, concurrent queues, fbstring, F14 hash maps, coroutines.",
            when: "High-scale server code; heavier to build than Abseil.",
          },
          {
            name: "ankerl::unordered_dense / Boost.Unordered",
            tag: "rising",
            what: "Drop-in hash maps that are much faster than std::unordered_map.",
            when: "When profiling shows hash map lookups are hot. Single header (unordered_dense) or part of Boost.",
          },
        ],
      },
      {
        category: "Concurrency & parallelism",
        libs: [
          {
            name: "oneTBB",
            tag: "popular",
            what: "Intel's Threading Building Blocks: parallel_for, parallel_reduce, flow graphs, concurrent containers, a work-stealing scheduler.",
            when: "CPU-parallel algorithms on multicore machines; also powers std::execution::par in libstdc++.",
          },
          {
            name: "Taskflow",
            tag: "rising",
            what: "Header-only task-graph programming: describe dependencies between tasks and run them in parallel.",
            when: "Build systems, pipelines and simulations with complex task dependencies.",
          },
          {
            name: "moodycamel::ConcurrentQueue",
            tag: "popular",
            what: "A fast lock-free multi-producer multi-consumer queue, header-only.",
            when: "High-throughput producer/consumer code where a mutex-based queue is a bottleneck.",
          },
        ],
      },
      {
        category: "Testing & benchmarking",
        libs: [
          {
            name: "GoogleTest + GoogleMock",
            tag: "essential",
            what: "The most widely used C++ test framework, with fixtures, parameterized tests, death tests and mocking.",
            when: "Default choice; integrates with CTest and every IDE. Examples are in the tooling chapter.",
          },
          {
            name: "Catch2 / doctest",
            tag: "popular",
            what: "Expressive REQUIRE(a == b) assertions and SECTIONs; doctest is a Catch-like framework that compiles extremely fast.",
            when: "When you prefer natural assertions and BDD style; doctest for tests that live next to the code.",
          },
          {
            name: "Google Benchmark",
            tag: "essential",
            what: "Microbenchmarks with warm-up, automatic iteration counts, statistics and complexity estimates.",
            when: "Whenever you claim something is faster: measure it. nanobench is a lighter single-header alternative.",
            snippet: {
              lang: "cpp",
              code: `#include <benchmark/benchmark.h>

static void BM_VectorPushBack(benchmark::State& state) {
    for (auto _ : state) {
        std::vector<int> v;
        for (int i = 0; i < state.range(0); ++i) v.push_back(i);
        benchmark::DoNotOptimize(v.data());                    // stop the optimizer deleting the work
    }
    state.SetComplexityN(state.range(0));
}
BENCHMARK(BM_VectorPushBack)->Range(8, 8 << 10)->Complexity();
BENCHMARK_MAIN();`,
            },
          },
        ],
      },
      {
        category: "CLI, config & utilities",
        libs: [
          {
            name: "CLI11",
            tag: "essential",
            what: "Command-line parsing with subcommands, validators, config files and generated help. Header-only.",
            when: "Any command-line tool. cxxopts and argparse are lighter alternatives.",
            snippet: {
              lang: "cpp",
              code: `#include <CLI/CLI.hpp>

int main(int argc, char** argv) {
    CLI::App app{"inventory: manage stock"};
    std::string file = "stock.csv";
    int threshold = 5;
    app.add_option("-f,--file", file, "data file")->check(CLI::ExistingFile);
    auto* low = app.add_subcommand("low", "list items below a threshold");
    low->add_option("-t,--threshold", threshold)->check(CLI::PositiveNumber);
    CLI11_PARSE(app, argc, argv);
    if (*low) print_low_stock(file, threshold);
}`,
            },
          },
          {
            name: "toml++ / yaml-cpp",
            tag: "popular",
            what: "Config file parsers: toml++ is header-only and modern; yaml-cpp is the standard YAML library.",
            when: "Application configuration files.",
          },
          {
            name: "RE2 / CTRE",
            tag: "popular",
            what: "RE2: Google's fast, linear-time regex engine (no catastrophic backtracking). CTRE: regexes compiled at compile time.",
            when: "Instead of std::regex, which is slow in all major implementations.",
          },
        ],
      },
      {
        category: "Math, science, vision & AI",
        libs: [
          {
            name: "Eigen",
            tag: "essential",
            what: "Header-only linear algebra: matrices, vectors, decompositions, solvers, with expression templates and SIMD.",
            when: "Robotics, graphics, simulations, ML internals. Armadillo has a MATLAB-like API; BLAS/LAPACK for raw speed.",
            snippet: {
              lang: "cpp",
              code: `#include <Eigen/Dense>

Eigen::Matrix3d A;
A << 2, -1, 0,
    -1, 2, -1,
     0, -1, 2;
Eigen::Vector3d b(1, 0, 1);
Eigen::Vector3d x = A.ldlt().solve(b);                         // solve Ax = b
std::cout << "x =\\n" << x << "\\nA^T * A =\\n" << A.transpose() * A << "\\n";`,
            },
          },
          {
            name: "OpenCV",
            tag: "essential",
            what: "The computer vision library: image processing, video, feature detection, camera calibration, DNN inference.",
            when: "Anything with images or cameras.",
          },
          {
            name: "ONNX Runtime / LibTorch / llama.cpp",
            tag: "rising",
            what: "Run trained ML models from C++: ONNX Runtime (any exported model), LibTorch (PyTorch's C++ API), llama.cpp/ggml (LLMs on CPUs and GPUs).",
            when: "Deploying models in latency-sensitive or embedded C++ applications, where Python isn't an option.",
          },
        ],
      },
      {
        category: "GUI, graphics & games",
        libs: [
          {
            name: "Qt",
            tag: "essential",
            what: "A complete cross-platform application framework: widgets, QML, networking, databases, embedded UIs.",
            when: "Desktop and embedded GUI applications. Dual-licensed (LGPL/GPL or commercial).",
          },
          {
            name: "Dear ImGui",
            tag: "popular",
            what: "Immediate-mode GUI: build tool UIs with a few lines per frame, rendered with your graphics API.",
            when: "Debug tools, editors, in-game UIs, profilers. Not for traditional consumer apps.",
          },
          {
            name: "SDL3 / SFML / raylib",
            tag: "popular",
            what: "Windows, input, audio and 2D/3D rendering basics for games and multimedia.",
            when: "Learning game development and building small games; Unreal Engine (C++) and Godot (C++ modules) for big ones.",
          },
        ],
      },
    ],
    interview: [
      {
        q: "steady_clock vs system_clock?",
        a: "system_clock is wall-clock time (UTC-based, convertible to calendar dates). It can jump forwards or backwards when NTP or a user adjusts the clock, so it's for timestamps, not measurement. steady_clock is monotonic: it never goes backwards, which makes it right for measuring durations, timeouts and rate limiting. high_resolution_clock is usually an alias for one of the two; don't rely on it.",
        freq: "common",
      },
      {
        q: "Why is rand() a poor choice, and how do you generate random numbers properly?",
        a: "rand() has implementation-defined, often poor quality (small RAND_MAX, short periods), uses hidden global state (not thread-safe), and `rand() % n` introduces modulo bias. Use `<random>`: create an engine once (std::mt19937 seeded from std::random_device for real runs, a fixed seed for reproducible tests) and draw through a distribution (uniform_int_distribution handles bias). For security (tokens, keys) use a CSPRNG from the OS or a crypto library.",
        freq: "common",
      },
      {
        q: "Header-only vs compiled libraries?",
        a: "Header-only libraries ship all code in headers: trivial to integrate (no build or link step, no ABI concerns), and fully inlinable, but every translation unit re-parses them, increasing compile times, and changes force recompilation of all users. Compiled libraries ship a .a/.so: faster builds and smaller headers, a stable boundary, but need building per platform/compiler, and ABI compatibility matters (compiler, standard library, flags). Many libraries offer both modes (fmt, spdlog).",
      },
      {
        q: "What is the C++ ABI problem?",
        a: "Binary compatibility depends on compiler version, standard library (libstdc++ vs libc++), and flags: object layout, name mangling, exception handling and standard type layouts must match for separately compiled code to link and work. The standard committee has been reluctant to break ABI, which keeps some standard types (std::regex, unordered_map) slower than they could be. Practical consequences: build all C++ dependencies with the same toolchain (package managers help), and expose C APIs or stable types at plugin/library boundaries.",
      },
    ],
    quiz: [
      {
        q: "Which clock should you use to measure how long a function takes?",
        options: ["system_clock", "steady_clock", "file_clock", "utc_clock"],
        answer: 1,
        explain: "It's monotonic: it never jumps when the wall clock is adjusted.",
      },
      {
        q: "Two compilers run the same seeded std::uniform_int_distribution. The numbers are...",
        options: ["Always identical", "Possibly different: distribution algorithms aren't specified", "Always different", "Cryptographically secure"],
        answer: 1,
        explain: "Engines are specified exactly; distributions aren't.",
      },
      {
        q: "What does recursive_directory_iterator guarantee about order?",
        options: ["Alphabetical", "Creation time", "Nothing: it's unspecified", "Depth-first sorted"],
        answer: 2,
        explain: "Sort the results when order matters.",
      },
      {
        q: "Which is the most popular, most convenient C++ JSON library?",
        options: ["simdjson", "nlohmann/json", "RapidXML", "Eigen"],
        answer: 1,
        explain: "simdjson is faster; nlohmann/json is easiest.",
      },
      {
        q: "What does Boost.Asio provide?",
        options: ["GUI widgets", "Asynchronous networking and I/O with an event loop", "JSON parsing", "Unit testing"],
        answer: 1,
        explain: "Beast builds HTTP and WebSocket on top of it.",
      },
    ],
  },

  // ------------------------------------------------------------------ WEB & APIs
  {
    id: "cpp-web",
    stage: "Ecosystem",
    title: "Web servers and REST APIs in C++",
    tagline: "How a C++ server handles thousands of connections, an HTTP server from raw sockets, and the frameworks: Drogon, Crow, cpp-httplib, Boost.Beast, Oat++ and userver.",
    difficulty: "advanced",
    minutes: 40,
    diagram: {
      title: "A request through an asynchronous C++ server (Asio/Beast style)",
      nodes: [
        { id: "client", label: "Client", kind: "client", x: 90, y: 280, sub: "curl, browser, service" },
        { id: "kernel", label: "Kernel", kind: "control", x: 240, y: 280, sub: "TCP stack + epoll/kqueue" },
        { id: "loop", label: "io_context", kind: "lb", x: 400, y: 280, sub: "event loop, 1 thread per core" },
        { id: "session", label: "Session coroutine", kind: "service", x: 570, y: 140, sub: "read → parse → write" },
        { id: "router", label: "Router", kind: "gateway", x: 770, y: 140, sub: "method + path → handler" },
        { id: "handler", label: "Handler", kind: "service", x: 770, y: 330, sub: "logic + JSON" },
        { id: "db", label: "PostgreSQL", kind: "db", x: 910, y: 480, sub: "async client / pool" },
        { id: "pool", label: "Worker pool", kind: "worker", x: 570, y: 450, sub: "blocking or CPU-heavy work" },
      ],
      edges: [
        { from: "client", to: "kernel", label: "TCP" },
        { from: "kernel", to: "loop", label: "readiness events" },
        { from: "loop", to: "session", label: "resume" },
        { from: "session", to: "router", label: "parsed request" },
        { from: "router", to: "handler" },
        { from: "handler", to: "db", label: "async query" },
        { from: "handler", to: "pool", label: "offload", dashed: true },
        { from: "pool", to: "loop", label: "post result", dashed: true },
      ],
      flows: [
        {
          name: "GET /todos/7 with an async database call",
          path: ["client", "kernel", "loop", "session", "router", "handler", "db", "handler", "router", "session", "loop", "kernel", "client"],
          steps: [
            "The client's bytes arrive over TCP. The kernel buffers them; no application thread is blocked waiting.",
            "epoll (Linux) or kqueue (macOS) tells the event loop that this socket is readable. One io_context thread watches thousands of sockets.",
            "The loop resumes the connection's coroutine, which was suspended in co_await async_read. It reads and parses the HTTP request (Beast's parser).",
            "The session hands the parsed request to the router, which matches GET /todos/{id} and extracts id = 7.",
            "The handler validates the input and needs data from the database.",
            "It sends the query asynchronously and suspends (co_await). The thread immediately goes back to serving other connections.",
            "When the database replies, the loop resumes the handler with the rows.",
            "The handler serializes the todo to JSON and builds a 200 response.",
            "The router returns the response to the session.",
            "The session starts an async write of the response, suspending again until the socket can accept data.",
            "The event loop drives the write as the kernel's send buffer drains.",
            "The kernel sends the bytes; with keep-alive the session loops back to read the next request on the same connection.",
          ],
        },
        {
          name: "Offloading blocking work",
          path: ["client", "kernel", "loop", "session", "router", "handler", "pool", "loop", "session", "loop", "kernel", "client"],
          steps: [
            "A request arrives, e.g. POST /reports, which must resize an image or call a blocking library.",
            "The event loop is notified that the socket is readable.",
            "The session coroutine resumes, then reads and parses the request.",
            "The router matches POST /reports and dispatches to the report handler.",
            "The handler validates the input. The real work would block for hundreds of milliseconds.",
            "Blocking the event-loop thread would stall every connection it serves, so the handler posts the job to a worker thread pool and the coroutine suspends.",
            "When the worker finishes, it posts the result back to the event loop (asio::post), never touching the socket from the worker thread.",
            "The loop resumes the session with the result.",
            "The session starts the asynchronous write of the response.",
            "The event loop hands the bytes to the kernel as the socket becomes writable.",
            "The client receives the report. The rule: never block the event loop.",
          ],
        },
        {
          name: "A slow client doesn't block anyone",
          path: ["client", "kernel", "loop", "session", "loop", "kernel", "client"],
          steps: [
            "A client on a bad mobile network sends half of its request, then stalls.",
            "The loop is notified of the partial data.",
            "The session parses what it has and needs more bytes, so it suspends in async_read. Its state (a few KB) waits in the coroutine frame.",
            "The thread returns to the loop and serves other connections. A thread-per-connection server would be holding a whole thread (and its stack) idle here.",
            "A timeout timer (beast::tcp_stream::expires_after) guards the session: if the rest never arrives, the socket is closed.",
            "Either the rest arrives and processing continues, or the client gets disconnected. Thousands of slow clients cost memory, not threads.",
          ],
        },
      ],
    },
    concept: `
## Why write a web service in C++?
Most web APIs are written in Go, Java, Node or Python, and should be. C++ makes sense when you need **predictable low latency** (trading, ad bidding, game backends), **very high throughput per machine** (proxies like Envoy, databases, CDN edges), or when you're **exposing an existing C++ engine** (a search, ML or simulation library) over HTTP.

## How servers handle many connections
| Model | How it works | Trade-off |
|---|---|---|
| **Thread per connection** | Each connection gets a blocking thread | Simple; thousands of threads waste memory and context switches |
| **Event loop** (epoll/kqueue/io_uring) | A few threads wait for "socket ready" events and run handlers that never block | Scales to 100k+ connections; handlers must never block |
| **Async + coroutines** | The event loop, written as straight-line code with \`co_await\` | The modern sweet spot: readable and scalable |

**Boost.Asio** is the standard event-loop toolkit: an \`io_context\` runs the loop (call \`run()\` from one thread per core), and operations like \`async_read\` take a completion token: a callback, \`use_future\`, or \`use_awaitable\` for coroutines. **Boost.Beast** adds HTTP/1.1 and WebSocket parsing and serialization on top. Follow the diagram's flows to see what happens to a request.

## The frameworks
| Framework | Style | Choose it for |
|---|---|---|
| **Drogon** | Full framework: async, coroutines, ORM, Postgres/MySQL/Redis clients, WebSockets, filters | High-performance production APIs; consistently near the top of TechEmpower benchmarks |
| **Crow** | Flask-like micro-framework, header-only, \`CROW_ROUTE\` macros | Quick, readable REST services |
| **cpp-httplib** | Single header, blocking (thread pool), server **and** client | Tools, tests, internal endpoints, embedding a small HTTP API |
| **Boost.Beast** | Low-level HTTP/WebSocket on Asio | Full control, custom servers, building your own framework (see the project) |
| **Oat++** | DTOs, OpenAPI/Swagger generation, dependency injection | API-first services with generated documentation |
| **userver** | Yandex's coroutine framework with batteries (Postgres, Mongo, Redis, gRPC, metrics) | Large microservice deployments |
| **gRPC** | Protobuf RPC over HTTP/2 | Internal service-to-service APIs |

## Building blocks of a real API
- **Routing**: method + path pattern → handler.
- **JSON**: nlohmann/json, Boost.JSON, Glaze or simdjson.
- **Validation**: check every field; return \`400\` with a clear error body (\`application/problem+json\`).
- **Database**: an async client (Drogon's, userver's) or a connection pool around libpqxx on worker threads.
- **Observability**: structured logs (spdlog), metrics (prometheus-cpp), traces (OpenTelemetry C++).
- **Deployment**: a multi-stage Docker build (compile in a full image, copy one static-ish binary into a small runtime image), behind a reverse proxy or load balancer that terminates TLS.

The samples below start from **raw POSIX sockets** (everything frameworks hide), then show the same endpoints in the popular frameworks.
`,
    keyPoints: [
      "C++ backends win on latency, throughput per machine, and reusing C++ engines",
      "Event loops (epoll/kqueue) + async I/O scale to many connections; never block the loop",
      "Asio's io_context is the event loop; Beast adds HTTP and WebSocket",
      "Coroutines (co_await) make async code read like blocking code",
      "Drogon for full-featured speed, Crow for simplicity, cpp-httplib for tiny services",
      "Offload blocking or CPU-heavy work to a thread pool and post results back",
      "Production needs validation, structured logs, metrics, timeouts and a reverse proxy",
    ],
    code: [
      {
        title: "An HTTP server and client from raw POSIX sockets",
        variants: [
          {
            lang: "cpp",
            code: `#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <array>
#include <cerrno>
#include <cstdint>
#include <format>
#include <print>
#include <string>
#include <string_view>
#include <system_error>
#include <thread>
#include <utility>

class Socket {                                       // RAII: each file descriptor is closed exactly once
public:
    explicit Socket(int fd) : fd_(fd) {
        if (fd_ < 0) throw std::system_error(errno, std::generic_category(), "socket");
    }
    Socket(Socket&& other) noexcept : fd_(std::exchange(other.fd_, -1)) {}
    Socket(const Socket&) = delete;
    Socket& operator=(const Socket&) = delete;
    Socket& operator=(Socket&&) = delete;
    ~Socket() {
        if (fd_ >= 0) ::close(fd_);
    }
    int fd() const { return fd_; }

private:
    int fd_;
};

void check(long result, const char* what) {
    if (result < 0) throw std::system_error(errno, std::generic_category(), what);
}

void send_all(int fd, std::string_view data) {
    while (!data.empty()) {                          // send() may write only part of the buffer
        ssize_t n = ::send(fd, data.data(), data.size(), 0);
        check(n, "send");
        data.remove_prefix(static_cast<std::size_t>(n));
    }
}

std::string receive(int fd, bool until_headers_end) {
    std::string data;
    char buffer[1024];
    while (!until_headers_end || data.find("\\r\\n\\r\\n") == std::string::npos) {
        ssize_t n = ::recv(fd, buffer, sizeof buffer, 0);
        check(n, "recv");
        if (n == 0) break;                           // the peer closed the connection
        data.append(buffer, static_cast<std::size_t>(n));
    }
    return data;
}

std::string handle(std::string_view request) {      // a pure function: easy to unit test
    std::string_view line = request.substr(0, request.find("\\r\\n"));   // "GET /hello?name=Ada HTTP/1.1"
    auto first_space = line.find(' ');
    auto last_space = line.rfind(' ');
    std::string_view method = line.substr(0, first_space);
    std::string_view target = line.substr(first_space + 1, last_space - first_space - 1);

    int status = 200;
    std::string body;
    if (method != "GET") {
        status = 405;
        body = R"({"error":"method not allowed"})";
    } else if (target.starts_with("/hello")) {
        std::string_view name = "world";
        if (auto q = target.find("name="); q != std::string_view::npos) name = target.substr(q + 5);
        body = std::format(R"({{"message":"Hello, {}!"}})", name);
    } else {
        status = 404;
        body = R"({"error":"not found"})";
    }
    std::string_view reason = status == 200 ? "OK" : status == 404 ? "Not Found" : "Method Not Allowed";
    return std::format("HTTP/1.1 {} {}\\r\\nContent-Type: application/json\\r\\nContent-Length: {}\\r\\n"
                       "Connection: close\\r\\n\\r\\n{}", status, reason, body.size(), body);
}

sockaddr_in loopback(std::uint16_t port) {
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);   // 127.0.0.1 only: not reachable from outside
    addr.sin_port = htons(port);
    return addr;
}

Socket listen_on_free_port(std::uint16_t& port) {
    Socket s(::socket(AF_INET, SOCK_STREAM, 0));
    int yes = 1;
    check(::setsockopt(s.fd(), SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes), "setsockopt");
    sockaddr_in addr = loopback(0);                  // port 0: the OS picks a free port
    check(::bind(s.fd(), reinterpret_cast<sockaddr*>(&addr), sizeof addr), "bind");
    check(::listen(s.fd(), 16), "listen");
    socklen_t len = sizeof addr;
    check(::getsockname(s.fd(), reinterpret_cast<sockaddr*>(&addr), &len), "getsockname");
    port = ntohs(addr.sin_port);
    return s;
}

std::string http_request(std::uint16_t port, std::string_view method, std::string_view target) {
    Socket s(::socket(AF_INET, SOCK_STREAM, 0));
    sockaddr_in addr = loopback(port);
    check(::connect(s.fd(), reinterpret_cast<sockaddr*>(&addr), sizeof addr), "connect");
    send_all(s.fd(), std::format("{} {} HTTP/1.1\\r\\nHost: localhost\\r\\n\\r\\n", method, target));
    return receive(s.fd(), false);                   // read until the server closes
}

int main() {
    std::uint16_t port = 0;
    Socket listener = listen_on_free_port(port);
    std::println("listening on 127.0.0.1 (port chosen by the OS: {})", port > 0 ? "yes" : "no");

    std::jthread server([&listener] {                // a toy server: handles 3 connections, one at a time
        for (int i = 0; i < 3; ++i) {
            Socket client(::accept(listener.fd(), nullptr, nullptr));
            send_all(client.fd(), handle(receive(client.fd(), true)));
        }                                            // closing the socket ends the response
    });

    struct Call { std::string_view method, target; };
    for (const Call& call : std::array<Call, 3>{{{"GET", "/hello?name=Ada"}, {"GET", "/nope"}, {"POST", "/hello"}}}) {
        std::string response = http_request(port, call.method, call.target);
        std::string status_line = response.substr(0, response.find("\\r\\n"));
        std::string body = response.substr(response.find("\\r\\n\\r\\n") + 4);
        std::println("{} {} -> {} | {}", call.method, call.target, status_line, body);
    }
}`,
          },
        ],
        output: `listening on 127.0.0.1 (port chosen by the OS: yes)
GET /hello?name=Ada -> HTTP/1.1 200 OK | {"message":"Hello, Ada!"}
GET /nope -> HTTP/1.1 404 Not Found | {"error":"not found"}
POST /hello -> HTTP/1.1 405 Method Not Allowed | {"error":"method not allowed"}`,
        explain: `- **This is what every framework does underneath**: \`socket\` → \`bind\` → \`listen\` → \`accept\` per connection, then read bytes until the blank line (\`\\r\\n\\r\\n\`) that ends the HTTP headers, and write back a status line, headers and body.
- The \`Socket\` class applies RAII to file descriptors: every early return or exception still closes the socket.
- \`send\` and \`recv\` may transfer **fewer bytes** than requested, hence the loops. Forgetting that is a classic networking bug.
- \`handle\` is a pure function from request text to response text, so it's testable without any network.
- What's missing for production: concurrent connections (this serves one at a time), a real HTTP parser (chunked bodies, keep-alive, header size limits), URL decoding, timeouts, and TLS. That's why you use Beast, Drogon or Crow, shown next. The REST API project builds a real server on Beast.`,
      },
      {
        title: "The same API in the popular frameworks",
        noCheck: "needs cpp-httplib, Crow and Drogon, which the test environment doesn't install",
        variants: [
          {
            lang: "cpp",
            code: `// cpp-httplib: one header, blocking handlers on a thread pool, server AND client
#include <httplib.h>
#include <nlohmann/json.hpp>

int main() {
    httplib::Server server;
    server.Get("/hello", [](const httplib::Request& req, httplib::Response& res) {
        std::string name = req.has_param("name") ? req.get_param_value("name") : "world";
        res.set_content(nlohmann::json{{"message", "Hello, " + name + "!"}}.dump(), "application/json");
    });
    server.Get("/todos/:id", [](const httplib::Request& req, httplib::Response& res) {
        int id = std::stoi(req.path_params.at("id"));
        res.set_content(nlohmann::json{{"id", id}, {"title", "Learn C++"}}.dump(), "application/json");
    });
    server.Post("/todos", [](const httplib::Request& req, httplib::Response& res) {
        auto body = nlohmann::json::parse(req.body, nullptr, false);
        if (body.is_discarded() || !body.contains("title")) {
            res.status = 400;
            res.set_content(R"({"error":"title is required"})", "application/json");
            return;
        }
        res.status = 201;
        res.set_content(nlohmann::json{{"id", 1}, {"title", body["title"]}}.dump(), "application/json");
    });
    server.listen("0.0.0.0", 8080);
}

// the client half, e.g. in a test:
// httplib::Client cli("http://localhost:8080");
// if (auto res = cli.Get("/hello?name=Ada")) std::println("{} {}", res->status, res->body);`,
          },
          {
            lang: "cpp",
            code: `// Crow: Flask-style routes with typed path parameters
#include <crow.h>

int main() {
    crow::SimpleApp app;

    CROW_ROUTE(app, "/hello/<string>")([](const std::string& name) {
        return crow::json::wvalue{{"message", "Hello, " + name + "!"}};
    });

    CROW_ROUTE(app, "/todos/<int>")([](int id) {
        if (id != 1) return crow::response(404);
        return crow::response(crow::json::wvalue{{"id", id}, {"title", "Learn C++"}});
    });

    CROW_ROUTE(app, "/todos").methods(crow::HTTPMethod::Post)([](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body || !body.has("title")) return crow::response(400, "title is required");
        return crow::response(201, crow::json::wvalue{{"id", 2}, {"title", body["title"].s()}});
    });

    app.port(8080).multithreaded().run();
}`,
          },
          {
            lang: "cpp",
            code: `// Drogon: an async framework with controllers, coroutines and a built-in database client
#include <drogon/drogon.h>
#include <drogon/HttpController.h>
using namespace drogon;

class TodoController : public HttpController<TodoController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(TodoController::get, "/todos/{id}", Get);
    ADD_METHOD_TO(TodoController::create, "/todos", Post);
    METHOD_LIST_END

    Task<HttpResponsePtr> get(HttpRequestPtr req, int id) {
        auto db = app().getDbClient();
        auto rows = co_await db->execSqlCoro("SELECT id, title, done FROM todos WHERE id = $1", id);
        if (rows.empty()) co_return HttpResponse::newNotFoundResponse();
        Json::Value todo;
        todo["id"] = rows[0]["id"].as<int>();
        todo["title"] = rows[0]["title"].as<std::string>();
        todo["done"] = rows[0]["done"].as<bool>();
        co_return HttpResponse::newHttpJsonResponse(todo);
    }

    Task<HttpResponsePtr> create(HttpRequestPtr req) {
        auto json = req->getJsonObject();
        if (!json || !json->isMember("title")) {
            auto bad = HttpResponse::newHttpResponse();
            bad->setStatusCode(k400BadRequest);
            co_return bad;
        }
        auto db = app().getDbClient();
        auto rows = co_await db->execSqlCoro("INSERT INTO todos (title) VALUES ($1) RETURNING id", (*json)["title"].asString());
        Json::Value created;
        created["id"] = rows[0]["id"].as<int>();
        created["title"] = (*json)["title"];
        auto res = HttpResponse::newHttpJsonResponse(created);
        res->setStatusCode(k201Created);
        co_return res;
    }
};

int main() {
    app().loadConfigFile("config.json")          // listeners, thread count, database connection
         .run();
}`,
          },
        ],
        explain: `- **cpp-httplib** is the fastest way to put an HTTP API on a C++ program: one header, no async concepts. Each connection is served by a thread from a pool, so it's best for modest load.
- **Crow** routes look like Flask; \`<int>\` and \`<string>\` path parameters are type-checked and converted for you.
- **Drogon** handlers are coroutines: \`co_await db->execSqlCoro(...)\` suspends without blocking the event loop thread, exactly the "async database call" flow in the diagram.
- These framework snippets weren't compiled in this course's test run (the libraries aren't installed there), so check them against each library's current docs. The raw-socket sample above and the Beast project are compiled and tested.`,
      },
    ],
    interview: [
      {
        q: "How would you design a C++ server to handle 100,000 concurrent connections?",
        a: "Avoid thread-per-connection. Use an event-driven design: non-blocking sockets multiplexed with epoll/kqueue (or io_uring), typically through Boost.Asio. Run one io_context per core (or one shared by N threads), keep per-connection state small (coroutine frames or session objects), never block the event loop (offload blocking or CPU-heavy work to a worker pool and post results back), use timeouts for idle and slow clients, and tune OS limits (file descriptors, backlog, socket buffers). Measure with load tests and watch tail latency.",
        freq: "common",
      },
      {
        q: "What is Boost.Asio's io_context?",
        a: "The core I/O execution context: it owns the platform's event demultiplexer (epoll, kqueue, IOCP, io_uring) and a queue of ready handlers. Async operations register interest and return immediately; `io_context::run()` blocks, waits for events and runs completion handlers (or resumes coroutines) on the calling thread. Calling run() from several threads makes a thread pool; strands serialize handlers for one connection to avoid data races without locks.",
        freq: "common",
      },
      {
        q: "Why must you never block the event loop?",
        a: "A single event-loop thread serves many connections by running short handlers one after another. If one handler blocks (synchronous DB call, sleep, heavy computation, blocking file I/O), every other connection on that thread stalls: latency spikes for all clients and throughput collapses. Use async APIs, or post blocking work to a dedicated thread pool and resume when it completes.",
        freq: "common",
      },
      {
        q: "Which C++ web framework would you choose and why?",
        a: "It depends on the job. Drogon for a production, high-throughput API with database access (async, coroutines, ORM, built-in clients). Crow for a small, readable REST service. cpp-httplib to quickly embed an HTTP endpoint in an existing program or for tests (blocking, single header). Boost.Beast when you need full control (custom protocols, WebSockets, building your own framework) and already use Asio. gRPC for internal service-to-service calls. Also consider whether C++ is right at all: if no C++ code or latency constraint is involved, Go or Java are often more productive for web APIs.",
      },
      {
        q: "send() returned fewer bytes than you asked to send. What does that mean?",
        a: "Nothing went wrong: stream sockets may accept only part of the buffer (the kernel's send buffer is full or the call was interrupted). You must loop, advancing past the bytes already sent, until everything is written (or use a library call like asio::write that does it). The same applies to recv: one call may return part of a message, or parts of several, so protocols need framing (HTTP headers + Content-Length, length prefixes, delimiters).",
      },
    ],
    quiz: [
      {
        q: "What's the main scalability problem with one thread per connection?",
        options: ["Threads can't read sockets", "Each thread costs memory and scheduling, which breaks down at thousands of connections", "It's not allowed by POSIX", "It disables TLS"],
        answer: 1,
        explain: "Event loops serve many connections per thread.",
      },
      {
        q: "A handler in an Asio event loop calls a blocking 2-second database query. What happens?",
        options: ["Only that request waits", "Every connection served by that thread stalls for 2 seconds", "Asio cancels it", "Nothing"],
        answer: 1,
        explain: "Use async clients or a worker pool.",
      },
      {
        q: "Which framework is a single header providing both an HTTP server and client?",
        options: ["Drogon", "cpp-httplib", "Oat++", "gRPC"],
        answer: 1,
        explain: "Great for tools, tests and small services.",
      },
      {
        q: "How does an HTTP server know where the headers end?",
        options: ["A null byte", "An empty line (\\r\\n\\r\\n)", "The TCP packet boundary", "A timeout"],
        answer: 1,
        explain: "Then Content-Length (or chunked encoding) frames the body.",
      },
      {
        q: "What does binding to port 0 do?",
        options: ["Fails", "Lets the OS choose a free port", "Uses port 80", "Listens on all ports"],
        answer: 1,
        explain: "Useful in tests: getsockname tells you which port you got.",
      },
    ],
  },
];
