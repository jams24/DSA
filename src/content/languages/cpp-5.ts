import type { Lesson } from "../types";

// C++ track, part 5: guided projects and interview prep.

const kvTree = `kvstore/
├── CMakeLists.txt
├── src/
│   ├── kv_store.hpp          the Store class: interface and invariants
│   ├── kv_store.cpp          hash map + append-only log, replay, crash recovery, compaction
│   ├── command.hpp           the text protocol (SET/GET/DEL/KEYS/COUNT/COMPACT)
│   ├── command.cpp
│   └── main.cpp              the REPL: prompt when interactive, quiet when piped
└── tests/
    └── kv_store_test.cpp     dependency-free tests, run under ASan + UBSan`;

const apiTree = `todo-api/
├── CMakeLists.txt
├── Dockerfile                multi-stage: build with GCC, run on a slim image
├── src/
│   ├── todo.hpp              the Todo type + its JSON conversion
│   ├── todo_store.hpp/.cpp   thread-safe in-memory storage
│   ├── router.hpp/.cpp       pure function: HTTP request → HTTP response
│   ├── server.hpp/.cpp       Asio/Beast: accept loop + one coroutine per connection
│   ├── json_src.cpp          compiles Boost.JSON (header-only mode)
│   └── main.cpp              config from env, signals, thread pool
└── tests/
    └── api_test.cpp          router unit tests + a real HTTP round trip`;

export const cppProjects: Lesson[] = [
  // ------------------------------------------------------------------ PROJECT 1: KV STORE
  {
    id: "cpp-project-kv",
    stage: "Projects",
    title: "Project: a persistent key-value store",
    tagline: "Build a small Redis-like database: a hash map with an append-only log, crash recovery, compaction, a command protocol, a REPL and sanitizer-checked tests.",
    difficulty: "intermediate",
    minutes: 75,
    visualizers: ["compaction"],
    concept: `
## What you'll build
A key-value database you can run, kill and restart without losing data:
\`\`\`text
$ ./build/kvstore data.kv
kvstore: 0 keys loaded from data.kv. Type HELP for commands.
kv> SET user:1 Ada Lovelace
OK
kv> GET user:1
Ada Lovelace
kv> KEYS user:
1) user:1
\`\`\`
It's the same core design used by Bitcask (Riak), Redis's AOF persistence and the write-ahead logs inside PostgreSQL and every LSM-tree database.

## Design decisions (and why)
- **In-memory hash map for reads.** \`std::unordered_map\` gives O(1) lookups. With a *transparent* hash, lookups by \`std::string_view\` don't allocate a temporary \`std::string\`.
- **Append-only log for durability.** Every change is appended to a file *before* it's applied in memory (**write-ahead**). Appending is the fastest kind of disk write, and an append can only damage the very end of the file.
- **Replay on startup.** Opening the store reads the log from the start and re-applies each record. The log *is* the database; the map is a cache of it.
- **Length-prefixed records.** Each record says how many bytes its key and value have, so values can contain spaces, newlines or even NUL bytes.
- **Crash recovery.** If the process dies mid-write, the last record is incomplete. Replay stops at the last complete record and truncates the torn tail.
- **Compaction.** Overwriting a key 1000 times leaves 1000 records. \`COMPACT\` writes the live data to a new file and atomically renames it over the old one.
- **Layers.** \`Store\` (storage, no I/O formatting), \`execute\` (the text protocol, a pure function of store + line), \`main\` (terminal I/O). Each is testable on its own.

Work through the steps on the **Build** tab.
`,
    keyPoints: [
      "Write-ahead: append to the log before changing memory",
      "Replay the log on startup; the in-memory map is just a cache",
      "Length-prefixed records make the format binary-safe",
      "Stop at the last complete record and truncate a torn tail",
      "Compaction: write live data to a temp file, then rename atomically",
      "A transparent hash allows string_view lookups without allocation",
      "Test under AddressSanitizer and UBSan",
    ],
    project: {
      summary: `A persistent **key-value store** in modern C++23 with no dependencies: \`SET\`, \`GET\`, \`DEL\`, \`KEYS [prefix]\`, \`COUNT\` and \`COMPACT\` commands, an append-only log with **crash recovery**, **compaction** via atomic rename, an interactive REPL that also works in pipes, a CMake build, and a test suite that runs under **AddressSanitizer + UBSan**.`,
      skills: ["classes & RAII", "unordered_map + transparent hashing", "std::optional", "string_view", "file I/O", "std::filesystem", "from_chars", "exceptions", "CMake", "testing with sanitizers"],
      tree: kvTree,
      steps: [
        {
          title: "Design the interface",
          explain: `Start with the header: it's the contract. Decisions visible here:
- \`get\` returns \`std::optional<std::string>\`: a missing key is a normal outcome, not an error.
- Keys are taken as \`std::string_view\`, so callers can pass literals, \`std::string\`s or slices without copies.
- The map uses **\`StringHash\`** with \`is_transparent\` plus \`std::equal_to<>\`: together they enable **heterogeneous lookup**, so \`data_.find(string_view)\` works without building a \`std::string\`.
- The store owns an open \`std::ofstream\` to its log, so copying a \`Store\` would mean two writers on one file. Copying is deleted.
- \`dropped_bytes()\` reports crash recovery; \`log_records()\` tells you when compaction is worth it.

Every member function that doesn't modify the store is \`const\`. That's documentation the compiler enforces.`,
          files: [
            {
              path: "src/kv_store.hpp",
              lang: "cpp",
              code: `#pragma once

#include <cstddef>
#include <filesystem>
#include <fstream>
#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace kv {

// Lets the map look keys up by std::string_view without building a std::string first.
struct StringHash {
    using is_transparent = void;
    std::size_t operator()(std::string_view s) const noexcept { return std::hash<std::string_view>{}(s); }
};

// A persistent key-value store: an in-memory hash map backed by an append-only log file.
// Every change is appended to the log before it's applied in memory; opening the store replays the log.
class Store {
public:
    explicit Store(std::filesystem::path log_path);

    Store(const Store&) = delete;                       // one owner per log file
    Store& operator=(const Store&) = delete;

    std::optional<std::string> get(std::string_view key) const;
    void set(std::string_view key, std::string_view value);
    bool erase(std::string_view key);                   // true if the key existed
    std::size_t size() const { return data_.size(); }
    std::vector<std::string> keys(std::string_view prefix = {}) const;   // sorted

    void compact();                                     // rewrite the log with one record per live key
    std::size_t log_records() const { return log_records_; }
    std::size_t dropped_bytes() const { return dropped_bytes_; }        // torn tail removed when opening
    const std::filesystem::path& path() const { return path_; }

private:
    void replay();
    void open_log();
    void append(char op, std::string_view key, std::string_view value);

    std::filesystem::path path_;
    std::unordered_map<std::string, std::string, StringHash, std::equal_to<>> data_;
    std::ofstream log_;
    std::size_t log_records_ = 0;
    std::size_t dropped_bytes_ = 0;
};

}  // namespace kv`,
            },
          ],
          run: `c++ -std=c++23 -fsyntax-only -x c++-header src/kv_store.hpp     # a header should compile on its own`,
        },
        {
          title: "The storage engine: log, replay, recovery and compaction",
          explain: `The record format, one per change:
\`\`\`text
S 6 12\\n user:1 Ada Lovelace \\n      (spaces added for readability)
<op> <key length> <value length>\\n<key bytes><value bytes>\\n
\`\`\`
\`S\` sets a key, \`D\` deletes one (value length 0). The trailing newline is a **commit marker**: a record is only valid if its final byte is there.

**Replay** walks the file record by record, tracking \`good\`, the offset just past the last complete record. It stops at the first record that's incomplete or malformed: a header without a newline, lengths that run past the end of the file, or a missing terminator. Whatever follows \`good\` is the remains of a write that was interrupted, so it's cut off with \`std::filesystem::resize_file\` and counted in \`dropped_bytes_\`.

**Writing** is write-ahead: \`set\` appends and flushes the record, and only then updates the map. If the write fails, an exception is thrown and memory still matches the log.

**Compaction** writes every live key (sorted, so files are reproducible) to \`data.kv.compact\`, then \`rename\`s it over the log. On POSIX systems rename is atomic: a crash leaves either the complete old log or the complete new one, never a mix.

Note on durability: \`flush()\` hands data to the operating system, which survives a process crash. Surviving a **power failure** also needs \`fsync\` (POSIX) on the file descriptor, which real databases call on every commit or in batches.`,
          files: [
            {
              path: "src/kv_store.cpp",
              lang: "cpp",
              code: `#include "kv_store.hpp"

#include <algorithm>
#include <charconv>
#include <iterator>
#include <ostream>
#include <stdexcept>
#include <system_error>
#include <utility>

namespace kv {
namespace {

// Record format (the lengths make keys and values binary-safe):
//   <op> <key length> <value length>\\n<key bytes><value bytes>\\n
// op is 'S' (set) or 'D' (delete, with value length 0). The final \\n marks the record complete.
struct Header {
    char op;
    std::size_t key_len;
    std::size_t value_len;
};

std::optional<Header> parse_header(std::string_view line) {
    if (line.size() < 5 || (line[0] != 'S' && line[0] != 'D') || line[1] != ' ') return std::nullopt;
    Header h{line[0], 0, 0};
    const char* end = line.data() + line.size();
    auto [after_key_len, ec1] = std::from_chars(line.data() + 2, end, h.key_len);
    if (ec1 != std::errc{} || after_key_len == end || *after_key_len != ' ') return std::nullopt;
    auto [after_value_len, ec2] = std::from_chars(after_key_len + 1, end, h.value_len);
    if (ec2 != std::errc{} || after_value_len != end) return std::nullopt;
    return h;
}

void write_record(std::ostream& out, char op, std::string_view key, std::string_view value) {
    out << op << ' ' << key.size() << ' ' << value.size() << '\\n' << key << value << '\\n';
}

void validate_key(std::string_view key) {
    if (key.empty()) throw std::invalid_argument("key must not be empty");
    if (key.size() > 1024) throw std::invalid_argument("key is longer than 1024 bytes");
}

}  // namespace

Store::Store(std::filesystem::path log_path) : path_(std::move(log_path)) {
    if (path_.has_parent_path()) std::filesystem::create_directories(path_.parent_path());
    replay();
    open_log();
}

void Store::replay() {
    std::ifstream in(path_, std::ios::binary);
    if (!in) return;                                         // first run: no log yet
    const std::string bytes{std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>()};
    in.close();

    std::size_t good = 0;                                    // just past the last complete record
    while (good < bytes.size()) {
        const std::size_t header_end = bytes.find('\\n', good);
        if (header_end == std::string::npos) break;
        const auto header = parse_header(std::string_view(bytes).substr(good, header_end - good));
        if (!header) break;

        const std::size_t body = header_end + 1;
        const std::size_t remaining = bytes.size() - body;
        if (header->key_len > remaining || header->value_len > remaining - header->key_len) break;
        const std::size_t end = body + header->key_len + header->value_len;
        if (end == bytes.size() || bytes[end] != '\\n') break;   // no commit marker: a torn write

        std::string key = bytes.substr(body, header->key_len);
        if (header->op == 'S') {
            data_.insert_or_assign(std::move(key), bytes.substr(body + header->key_len, header->value_len));
        } else {
            data_.erase(key);
        }
        ++log_records_;
        good = end + 1;
    }

    if (good < bytes.size()) {                               // cut the damaged tail so new records append cleanly
        dropped_bytes_ = bytes.size() - good;
        std::filesystem::resize_file(path_, good);
    }
}

void Store::open_log() {
    log_.close();
    log_.clear();
    log_.open(path_, std::ios::binary | std::ios::app);
    if (!log_) throw std::runtime_error("cannot open " + path_.string());
}

void Store::append(char op, std::string_view key, std::string_view value) {
    write_record(log_, op, key, value);
    log_.flush();                                            // hand the bytes to the OS before acknowledging
    if (!log_) throw std::runtime_error("write to " + path_.string() + " failed");
    ++log_records_;
}

std::optional<std::string> Store::get(std::string_view key) const {
    auto it = data_.find(key);                               // heterogeneous lookup: no std::string built
    if (it == data_.end()) return std::nullopt;
    return it->second;
}

void Store::set(std::string_view key, std::string_view value) {
    validate_key(key);
    append('S', key, value);                                 // log first (write-ahead) ...
    data_.insert_or_assign(std::string(key), std::string(value));   // ... then memory
}

bool Store::erase(std::string_view key) {
    auto it = data_.find(key);
    if (it == data_.end()) return false;                     // nothing to log
    append('D', key, {});
    data_.erase(it);
    return true;
}

std::vector<std::string> Store::keys(std::string_view prefix) const {
    std::vector<std::string> result;
    for (const auto& [key, value] : data_)
        if (key.starts_with(prefix)) result.push_back(key);
    std::ranges::sort(result);                               // hash maps have no useful order
    return result;
}

void Store::compact() {
    std::filesystem::path tmp = path_;
    tmp += ".compact";
    {
        std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
        for (const std::string& key : keys()) write_record(out, 'S', key, data_.find(key)->second);
        out.flush();
        if (!out) throw std::runtime_error("cannot write " + tmp.string());
    }
    log_.close();
    std::filesystem::rename(tmp, path_);                     // atomic replace on POSIX file systems
    log_records_ = data_.size();
    open_log();
}

}  // namespace kv`,
            },
          ],
          run: `c++ -std=c++23 -Wall -Wextra -c src/kv_store.cpp -o kv_store.o`,
        },
        {
          title: "A command protocol and a REPL",
          explain: `**\`execute\`** turns one line of text into one reply, Redis-style: \`SET key value\` (the value is the rest of the line, so it may contain spaces), \`GET\`, \`DEL\`, \`KEYS [prefix]\`, \`COUNT\`, \`COMPACT\`, \`HELP\`. Commands are case-insensitive. Errors become \`ERR ...\` replies instead of crashing the program, because one bad command shouldn't kill a database.

It's a **pure function of (store, line)**: no \`std::cin\`, no printing. That makes it trivial to test, and you could put it behind a TCP socket later without changing it (see the extensions).

**\`main\`** handles the terminal:
- \`isatty(STDIN_FILENO)\` detects whether a human is typing. The prompt and banner only appear interactively, so piping commands in (\`printf ... | ./kvstore\`) produces clean output that scripts can parse.
- \`std::fflush(stdout)\` after the prompt, because output is line-buffered and the prompt has no newline.
- \`QUIT\` or end of input (Ctrl-D) exits. The \`Store\` destructor closes the log: RAII again.
- Exceptions from opening the store (permissions, a directory instead of a file) end the program with a message and exit code 1.

The first **CMakeLists.txt** puts the logic in a library, \`kv_core\`, linked by the executable now and by the tests in the next step.`,
          files: [
            {
              path: "src/command.hpp",
              lang: "cpp",
              code: `#pragma once

#include <string>
#include <string_view>

#include "kv_store.hpp"

namespace kv {

// Runs one line of the text protocol against the store and returns the reply (without a trailing newline).
//   SET key value | GET key | DEL key | KEYS [prefix] | COUNT | COMPACT | HELP
std::string execute(Store& store, std::string_view line);

}  // namespace kv`,
            },
            {
              path: "src/command.cpp",
              lang: "cpp",
              code: `#include "command.hpp"

#include <algorithm>
#include <cctype>
#include <cstddef>
#include <exception>
#include <format>
#include <utility>
#include <vector>

namespace kv {
namespace {

std::string_view trim(std::string_view s) {
    while (!s.empty() && std::isspace(static_cast<unsigned char>(s.front()))) s.remove_prefix(1);
    while (!s.empty() && std::isspace(static_cast<unsigned char>(s.back()))) s.remove_suffix(1);
    return s;
}

// Splits off the first word: "SET a b c" -> {"SET", "a b c"}
std::pair<std::string_view, std::string_view> next_word(std::string_view s) {
    s = trim(s);
    const auto space = s.find(' ');
    if (space == std::string_view::npos) return {s, {}};
    return {s.substr(0, space), trim(s.substr(space + 1))};
}

std::string upper(std::string_view s) {
    std::string out(s);
    std::ranges::transform(out, out.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    return out;
}

constexpr std::string_view kHelp =
    "commands:\\n"
    "  SET key value   store a value (the value may contain spaces)\\n"
    "  GET key         print a value, or (nil)\\n"
    "  DEL key         delete a key\\n"
    "  KEYS [prefix]   list keys, sorted\\n"
    "  COUNT           number of keys\\n"
    "  COMPACT         rewrite the log without old versions\\n"
    "  QUIT            exit";

}  // namespace

std::string execute(Store& store, std::string_view line) {
    const auto [word, rest] = next_word(line);
    const std::string command = upper(word);
    try {
        if (command == "SET") {
            const auto [key, value] = next_word(rest);
            if (key.empty() || value.empty()) return "ERR usage: SET key value";
            store.set(key, value);
            return "OK";
        }
        if (command == "GET") {
            if (rest.empty()) return "ERR usage: GET key";
            return store.get(rest).value_or("(nil)");
        }
        if (command == "DEL") {
            if (rest.empty()) return "ERR usage: DEL key";
            return std::format("(integer) {}", store.erase(rest) ? 1 : 0);
        }
        if (command == "KEYS") {
            const std::vector<std::string> keys = store.keys(rest);
            if (keys.empty()) return "(empty)";
            std::string out;
            for (std::size_t i = 0; i < keys.size(); ++i) out += std::format("{}{}) {}", i == 0 ? "" : "\\n", i + 1, keys[i]);
            return out;
        }
        if (command == "COUNT") return std::format("(integer) {}", store.size());
        if (command == "COMPACT") {
            const std::size_t before = store.log_records();
            store.compact();
            return std::format("OK ({} log records -> {})", before, store.log_records());
        }
        if (command == "HELP") return std::string(kHelp);
        return std::format("ERR unknown command '{}' (try HELP)", word);
    } catch (const std::exception& e) {                       // one bad command must not kill the database
        return std::format("ERR {}", e.what());
    }
}

}  // namespace kv`,
            },
            {
              path: "src/main.cpp",
              lang: "cpp",
              code: `#include <unistd.h>                                          // isatty (POSIX)

#include <cstdio>
#include <exception>
#include <filesystem>
#include <iostream>
#include <print>
#include <string>

#include "command.hpp"
#include "kv_store.hpp"

int main(int argc, char* argv[]) {
    const std::filesystem::path file = argc > 1 ? argv[1] : "data.kv";
    try {
        kv::Store store(file);
        if (store.dropped_bytes() > 0) {
            std::println(stderr, "warning: removed {} bytes of an incomplete record at the end of {}",
                         store.dropped_bytes(), file.string());
        }

        const bool interactive = ::isatty(STDIN_FILENO) != 0;    // no prompt when input is piped
        if (interactive) std::println("kvstore: {} keys loaded from {}. Type HELP for commands.", store.size(), file.string());

        std::string line;
        while (true) {
            if (interactive) {
                std::print("kv> ");
                std::fflush(stdout);                             // the prompt has no newline
            }
            if (!std::getline(std::cin, line)) break;            // end of input (Ctrl-D)
            if (line.find_first_not_of(" \\t\\r") == std::string::npos) continue;
            if (line == "QUIT" || line == "quit") break;
            std::println("{}", kv::execute(store, line));
        }
    } catch (const std::exception& e) {
        std::println(stderr, "kvstore: {}", e.what());
        return 1;
    }
}`,
            },
            {
              path: "CMakeLists.txt",
              lang: "cmake",
              code: `cmake_minimum_required(VERSION 3.25)
project(kvstore VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# The logic lives in a library so the tests can link it too.
add_library(kv_core src/kv_store.cpp src/command.cpp)
target_include_directories(kv_core PUBLIC src)
target_compile_options(kv_core PRIVATE -Wall -Wextra -Wpedantic)

add_executable(kvstore src/main.cpp)
target_link_libraries(kvstore PRIVATE kv_core)`,
            },
          ],
          run: `cmake -S . -B build && cmake --build build
printf 'SET user:1 Ada Lovelace\\nSET user:2 Alan Turing\\nGET user:1\\nKEYS user:\\nDEL user:2\\nCOUNT\\n' | ./build/kvstore data.kv
echo 'GET user:1' | ./build/kvstore data.kv     # a brand-new process: the data survived
cat data.kv                                      # the log, record by record`,
          output: `OK
OK
Ada Lovelace
1) user:1
2) user:2
(integer) 1
(integer) 1
Ada Lovelace
S 6 12
user:1Ada Lovelace
S 6 11
user:2Alan Turing
D 6 0
user:2`,
        },
        {
          title: "Tests, sanitizers and crash recovery",
          explain: `The tests need no framework: a \`CHECK\` macro records failures with the line number (via \`std::source_location\`) and keeps going. Each test gets a fresh temporary directory from a small RAII \`TempDir\`, which deletes it afterwards.

What they prove:
1. **Basic operations**: set, overwrite, get, erase, sorted keys.
2. **Persistence**: data written by one \`Store\` is there when a new \`Store\` opens the same file (like restarting the process).
3. **Binary safety**: keys with spaces and values with newlines, fake headers and a NUL byte survive.
4. **Torn writes**: append half a record to the file (what a crash mid-write leaves), reopen, and check that the good data survives, exactly the damaged bytes were cut, and new writes work.
5. **Compaction**: 102 records shrink to 1, the file gets smaller, and the data survives a restart.
6. **The protocol**: replies for every command, including errors.

The updated **CMakeLists.txt** adds a \`KV_SANITIZE\` option and the test target. Build the tests with AddressSanitizer + UBSan: they turn silent memory bugs (an off-by-one in \`replay\`, a use-after-free) into immediate, precise failures.

Finally, simulate a crash by hand: append a torn record to \`data.kv\` and watch the store repair it.`,
          files: [
            {
              path: "tests/kv_store_test.cpp",
              lang: "cpp",
              code: `#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <print>
#include <source_location>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "command.hpp"
#include "kv_store.hpp"

namespace fs = std::filesystem;

namespace {

int failures = 0;

void check(bool ok, std::string_view what, std::source_location where = std::source_location::current()) {
    if (!ok) {
        ++failures;
        std::println(stderr, "    FAILED line {}: {}", where.line(), what);
    }
}
#define CHECK(cond) check((cond), #cond)

// A fresh directory per test, removed afterwards.
struct TempDir {
    fs::path path;
    explicit TempDir(const std::string& name) : path(fs::temp_directory_path() / ("kvstore-test-" + name)) {
        fs::remove_all(path);
        fs::create_directories(path);
    }
    ~TempDir() { fs::remove_all(path); }
    fs::path file(const std::string& name) const { return path / name; }
};

void test_basic_operations() {
    TempDir dir("basic");
    kv::Store store(dir.file("db.kv"));
    CHECK(store.size() == 0);
    CHECK(!store.get("missing").has_value());
    store.set("name", "Ada");
    store.set("name", "Ada Lovelace");                        // overwrite
    store.set("lang", "C++");
    CHECK(store.get("name") == "Ada Lovelace");
    CHECK(store.size() == 2);
    CHECK(store.erase("lang"));
    CHECK(!store.erase("lang"));                              // already gone
    CHECK(store.keys() == std::vector<std::string>{"name"});
}

void test_persists_across_restarts() {
    TempDir dir("persist");
    {
        kv::Store store(dir.file("db.kv"));
        store.set("user:1", "Ada");
        store.set("user:2", "Alan");
        store.set("user:1", "Ada Lovelace");
        store.erase("user:2");
    }                                                         // closed, like the process exiting
    kv::Store reopened(dir.file("db.kv"));
    CHECK(reopened.get("user:1") == "Ada Lovelace");
    CHECK(!reopened.get("user:2"));
    CHECK(reopened.size() == 1);
    CHECK(reopened.log_records() == 4);                       // every change was logged
}

void test_binary_safe_values() {
    TempDir dir("binary");
    std::string tricky = "two\\nlines and a fake header\\nS 1 1\\n";
    tricky += '\\0';
    tricky += "end";
    {
        kv::Store store(dir.file("db.kv"));
        store.set("key with spaces", tricky);
    }
    kv::Store reopened(dir.file("db.kv"));
    CHECK(reopened.get("key with spaces") == tricky);
}

void test_recovers_from_torn_write() {
    TempDir dir("torn");
    const fs::path file = dir.file("db.kv");
    {
        kv::Store store(file);
        store.set("a", "1");
        store.set("b", "2");
    }
    const auto good_size = fs::file_size(file);
    std::ofstream(file, std::ios::binary | std::ios::app) << "S 1 10\\nc12";   // a crash mid-write
    {
        kv::Store store(file);
        CHECK(store.dropped_bytes() == 10);
        CHECK(fs::file_size(file) == good_size);              // the torn tail was cut off
        CHECK(store.get("a") == "1" && store.get("b") == "2" && !store.get("c"));
        store.set("c", "3");                                  // appends cleanly after the cut
    }
    kv::Store reopened(file);
    CHECK(reopened.get("c") == "3");
    CHECK(reopened.dropped_bytes() == 0);
}

void test_compaction() {
    TempDir dir("compact");
    const fs::path file = dir.file("db.kv");
    {
        kv::Store store(file);
        for (int i = 0; i < 100; ++i) store.set("counter", std::to_string(i));
        store.set("temp", "x");
        store.erase("temp");
        CHECK(store.log_records() == 102);
        const auto before = fs::file_size(file);
        store.compact();
        CHECK(store.log_records() == 1);
        CHECK(fs::file_size(file) < before);
        store.set("after", "compaction");                     // the log is writable again
    }
    kv::Store reopened(file);
    CHECK(reopened.get("counter") == "99");
    CHECK(reopened.get("after") == "compaction");
    CHECK(reopened.size() == 2);
}

void test_command_protocol() {
    TempDir dir("commands");
    kv::Store store(dir.file("db.kv"));
    CHECK(kv::execute(store, "SET greeting hello world") == "OK");
    CHECK(kv::execute(store, "get greeting") == "hello world");      // commands are case-insensitive
    CHECK(kv::execute(store, "GET nope") == "(nil)");
    CHECK(kv::execute(store, "SET user:1 Ada") == "OK");
    CHECK(kv::execute(store, "SET user:2 Alan") == "OK");
    CHECK(kv::execute(store, "KEYS user:") == "1) user:1\\n2) user:2");
    CHECK(kv::execute(store, "DEL user:2") == "(integer) 1");
    CHECK(kv::execute(store, "DEL user:2") == "(integer) 0");
    CHECK(kv::execute(store, "COUNT") == "(integer) 2");
    CHECK(kv::execute(store, "SET lonely") == "ERR usage: SET key value");
    CHECK(kv::execute(store, "FLY away") == "ERR unknown command 'FLY' (try HELP)");
}

}  // namespace

int main() {
    const std::pair<const char*, void (*)()> tests[] = {
        {"basic operations", test_basic_operations},
        {"persists across restarts", test_persists_across_restarts},
        {"binary-safe keys and values", test_binary_safe_values},
        {"recovers from a torn write", test_recovers_from_torn_write},
        {"compaction", test_compaction},
        {"command protocol", test_command_protocol},
    };
    for (const auto& [name, test] : tests) {
        const int before = failures;
        test();
        std::println("  {}  {}", failures == before ? "ok  " : "FAIL", name);
    }
    std::println("{} tests, {} failures", std::size(tests), failures);
    return failures == 0 ? 0 : 1;
}`,
            },
            {
              path: "CMakeLists.txt",
              lang: "cmake",
              code: `cmake_minimum_required(VERSION 3.25)
project(kvstore VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(KV_SANITIZE "Build with AddressSanitizer and UndefinedBehaviorSanitizer" OFF)
if(KV_SANITIZE)
  add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer -g)
  add_link_options(-fsanitize=address,undefined)
endif()

# The logic lives in a library so the tests can link it too.
add_library(kv_core src/kv_store.cpp src/command.cpp)
target_include_directories(kv_core PUBLIC src)
target_compile_options(kv_core PRIVATE -Wall -Wextra -Wpedantic)

add_executable(kvstore src/main.cpp)
target_link_libraries(kvstore PRIVATE kv_core)

enable_testing()
add_executable(kv_tests tests/kv_store_test.cpp)
target_link_libraries(kv_tests PRIVATE kv_core)
add_test(NAME kv_tests COMMAND kv_tests)`,
            },
          ],
          run: `cmake -S . -B build-asan -DKV_SANITIZE=ON && cmake --build build-asan
./build-asan/kv_tests                           # or: ctest --test-dir build-asan
printf 'S 6 99\\nuser:3Gr' >> data.kv            # simulate a crash in the middle of a write
echo 'COUNT' | ./build/kvstore data.kv`,
          output: `  ok    basic operations
  ok    persists across restarts
  ok    binary-safe keys and values
  ok    recovers from a torn write
  ok    compaction
  ok    command protocol
6 tests, 0 failures
warning: removed 15 bytes of an incomplete record at the end of data.kv
(integer) 1`,
        },
      ],
      extensions: [
        "Durability: open the log with POSIX open() and call fsync() after each write, or group commits (fsync every 10 ms) and measure the throughput difference.",
        "Add a CRC32 checksum to each record header to detect corruption in the middle of the file, not just a torn tail.",
        "Add TTLs: `SET key value EX 60` stores an expiry time; expired keys disappear on read and during compaction.",
        "Serve the protocol over TCP with Boost.Asio (one coroutine per client) so several programs can share one store. Protect the Store with a std::shared_mutex.",
        "Compact automatically when log_records() exceeds 2 x size(), on a background thread.",
        "Replace the single log with segments + a hint file (the Bitcask design), or keep keys sorted in a memtable and flush SSTables (an LSM tree).",
        "Benchmark with Google Benchmark: 1 million SETs, then GETs, then a full replay. Try absl::flat_hash_map instead of std::unordered_map.",
      ],
      verify: `$CXX_CMD -Isrc -Wall -Wextra -Werror -g -fsanitize=address,undefined src/kv_store.cpp src/command.cpp tests/kv_store_test.cpp -o kv_tests && ./kv_tests && $CXX_CMD -Isrc -Wall -Wextra -Werror -O2 src/kv_store.cpp src/command.cpp src/main.cpp -o kvstore && printf 'SET user:1 Ada Lovelace\\nSET user:2 Alan Turing\\nDEL user:2\\n' | ./kvstore db.kv > /dev/null && printf 'GET user:1\\nGET user:2\\nCOUNT\\n' | ./kvstore db.kv > out.txt && grep -qx 'Ada Lovelace' out.txt && grep -qx '(nil)' out.txt && grep -qx '(integer) 1' out.txt && printf 'S 6 99\\nuser:3Gr' >> db.kv && echo COUNT | ./kvstore db.kv 2> err.txt | grep -qx '(integer) 1' && grep -q 'removed 15 bytes' err.txt`,
    },
    interview: [
      {
        q: "How does an append-only log give you durability and crash safety?",
        a: "Every change is written sequentially to the end of a file before it's acknowledged (write-ahead), so the file always contains the full history; the in-memory state can be rebuilt by replaying it. Appends are the fastest disk writes, and a crash can only damage the last record, which is detected (length prefix, terminator or checksum) and discarded on recovery. True durability against power loss also requires fsync before acknowledging. Old versions accumulate, so the log is periodically compacted by writing live data to a new file and atomically renaming it.",
        freq: "common",
      },
      {
        q: "What is heterogeneous lookup and why does it matter?",
        a: "Looking up a key in a container using a different but comparable type, e.g. finding a std::string key with a std::string_view or const char* without constructing a temporary std::string (which may allocate). For ordered containers it's enabled with a transparent comparator (std::less<>); for unordered containers (C++20) you need a hash with `is_transparent` and a transparent equality (std::equal_to<>). It removes allocations from hot lookup paths.",
        freq: "common",
      },
      {
        q: "Why write to a temporary file and rename it, instead of overwriting the file directly?",
        a: "Overwriting in place means a crash midway leaves a half-old, half-new, corrupted file. Writing the complete new content to a temporary file in the same directory, flushing (and fsyncing) it, and then calling rename() is atomic on POSIX file systems: readers and crash recovery see either the entire old file or the entire new one. The same trick is used by editors, package managers and databases.",
      },
    ],
    quiz: [
      {
        q: "In a write-ahead design, what happens first?",
        options: ["Update memory, then the log", "Append to the log, then update memory", "Only update memory", "Write a backup"],
        answer: 1,
        explain: "If the log write fails, memory still matches what's on disk.",
      },
      {
        q: "On startup the last log record is incomplete. What should replay do?",
        options: ["Refuse to start", "Delete the whole log", "Keep everything up to the last complete record and drop the torn tail", "Ignore it but keep the bytes"],
        answer: 2,
        explain: "Only the interrupted write is lost; leaving garbage would corrupt later appends.",
      },
      {
        q: "Why are records length-prefixed instead of space-separated?",
        options: ["Smaller files", "Keys and values can contain any bytes, including spaces and newlines", "Faster sorting", "It's required by C++"],
        answer: 1,
        explain: "The reader knows exactly how many bytes belong to each field.",
      },
      {
        q: "What makes `data_.find(std::string_view)` compile for an unordered_map<std::string, ...>?",
        options: ["Nothing: it always works", "A transparent hash (is_transparent) and std::equal_to<>", "A custom allocator", "Making the map const"],
        answer: 1,
        explain: "That's heterogeneous lookup (C++20 for unordered containers).",
      },
    ],
  },

  // ------------------------------------------------------------------ PROJECT 2: REST API
  {
    id: "cpp-project-api",
    stage: "Projects",
    title: "Project: a JSON REST API with Boost.Beast",
    tagline: "Build a multi-threaded HTTP API with coroutines: routing, JSON with Boost.JSON, validation, a thread-safe store, graceful shutdown, tests over real HTTP, and a Docker image.",
    difficulty: "advanced",
    minutes: 90,
    concept: `
## What you'll build
A to-do REST API, served by an asynchronous, multi-threaded C++ server:
| Method | Path | Does |
|---|---|---|
| GET | \`/health\` | Liveness check |
| GET | \`/todos\` (\`?done=true\`) | List todos, optionally filtered |
| POST | \`/todos\` | Create from \`{"title": "..."}\` → \`201\` + \`Location\` |
| GET | \`/todos/{id}\` | One todo or \`404\` |
| PATCH | \`/todos/{id}\` | Update \`title\` and/or \`done\` |
| DELETE | \`/todos/{id}\` | \`204\` or \`404\` |

## The stack
- **Boost.Asio**: the event loop (\`io_context\`) and async sockets. Several threads call \`io_context::run()\`, forming a thread pool.
- **Boost.Beast**: HTTP/1.1 parsing and serialization on top of Asio.
- **Boost.JSON**: parsing request bodies and serializing responses.
- **C++20 coroutines**: each connection is one \`asio::awaitable<void>\` function that reads like blocking code: read a request, handle it, write the response, repeat.

All three Boost libraries are used header-only, so the only requirement is the Boost headers (\`brew install boost\`, \`apt install libboost-all-dev\` or vcpkg).

## Architecture: keep HTTP at the edges
\`\`\`text
socket ──► server.cpp ──► router.cpp ──► todo_store.cpp
           (Asio/Beast)   (pure function)   (mutex-protected map)
\`\`\`
- **\`handle_request(request, store) -> response\`** is a pure function with no sockets, no threads and no global state. Most tests call it directly: fast and deterministic.
- **\`Server\`** only moves bytes: accept, read, call the router, write, enforce timeouts.
- **\`TodoStore\`** locks a mutex in every public method, because several server threads call it concurrently.

Swapping the in-memory store for PostgreSQL later only touches \`TodoStore\`. The server and router don't change.

Follow the steps on the **Build** tab. The server and the cpp-web chapter's diagram describe the same request flow.
`,
    keyPoints: [
      "Asio's io_context is the event loop; run() on N threads gives a thread pool",
      "One coroutine per connection: async code that reads top to bottom",
      "Keep the router a pure function of (request, store) so it's unit-testable",
      "Protect shared state (the store) with a mutex: handlers run on many threads",
      "Validate input and return 400 with a JSON error body",
      "Timeouts on every connection; graceful shutdown on SIGINT/SIGTERM",
      "Test over real HTTP on port 0 in addition to unit tests",
    ],
    project: {
      summary: `A **to-do REST API** in C++23 on **Boost.Beast + Asio + Boost.JSON**: six endpoints with validation and JSON error bodies, a coroutine per connection, a multi-threaded \`io_context\`, a mutex-protected store, timeouts, graceful shutdown, unit tests plus a real HTTP round trip, and a multi-stage **Docker** image.`,
      skills: ["Boost.Asio", "Boost.Beast", "Boost.JSON", "C++20 coroutines", "std::expected", "mutexes", "REST design", "testing", "CMake", "Docker"],
      tree: apiTree,
      steps: [
        {
          title: "Project setup and the domain",
          explain: `Install the Boost headers first: \`brew install boost\` (macOS), \`sudo apt install libboost-all-dev\` (Debian/Ubuntu), or add \`boost-beast\` and \`boost-json\` to a vcpkg manifest.

- **\`CMakeLists.txt\`** finds Boost through its CMake config (\`Boost::headers\`) and puts everything except \`main.cpp\` into a \`todo_core\` library, linked by both the server and the tests.
- **\`todo.hpp\`** defines the \`Todo\` type and teaches Boost.JSON how to serialize it with a \`tag_invoke\` overload, found through argument-dependent lookup. After that, \`boost::json::value_from(todo)\` and even \`value_from(std::vector<Todo>)\` just work.
- **\`TodoStore\`** keeps todos in a \`std::map\` (ordered by id, so listings are stable) behind a \`std::mutex\`. Every method locks with \`std::lock_guard\` and returns **copies**: never return references or pointers into data guarded by a lock, because the caller would use them after the lock is released.
- **\`json_src.cpp\`** compiles Boost.JSON's implementation into our program. Include \`<boost/json/src.hpp>\` in exactly one \`.cpp\` file (or link the compiled \`Boost::json\` library instead).`,
          files: [
            {
              path: "CMakeLists.txt",
              lang: "cmake",
              code: `cmake_minimum_required(VERSION 3.25)
project(todo_api VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(API_SANITIZE "Build with AddressSanitizer and UBSan" OFF)
if(API_SANITIZE)
  add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer -g)
  add_link_options(-fsanitize=address,undefined)
endif()

find_package(Boost 1.83 REQUIRED CONFIG)      # Asio, Beast and JSON are used header-only
find_package(Threads REQUIRED)

add_library(todo_core src/todo_store.cpp src/router.cpp src/server.cpp src/json_src.cpp)
target_include_directories(todo_core PUBLIC src)
target_link_libraries(todo_core PUBLIC Boost::headers Threads::Threads)
target_compile_options(todo_core PRIVATE -Wall -Wextra)

add_executable(todo-api src/main.cpp)
target_link_libraries(todo-api PRIVATE todo_core)

enable_testing()
add_executable(api_tests tests/api_test.cpp)
target_link_libraries(api_tests PRIVATE todo_core)
add_test(NAME api_tests COMMAND api_tests)`,
            },
            {
              path: "src/todo.hpp",
              lang: "cpp",
              code: `#pragma once

#include <boost/json.hpp>
#include <cstdint>
#include <string>

struct Todo {
    std::int64_t id = 0;
    std::string title;
    bool done = false;
};

// Boost.JSON finds this overload through argument-dependent lookup,
// so boost::json::value_from(todo) produces {"id":1,"title":"...","done":false}.
inline void tag_invoke(boost::json::value_from_tag, boost::json::value& jv, const Todo& todo) {
    jv = boost::json::object{{"id", todo.id}, {"title", todo.title}, {"done", todo.done}};
}`,
            },
            {
              path: "src/todo_store.hpp",
              lang: "cpp",
              code: `#pragma once

#include <cstdint>
#include <map>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

#include "todo.hpp"

// Thread-safe in-memory storage: every public method locks, so all server threads can share one store.
// Methods return copies; never hand out references into data guarded by a lock.
class TodoStore {
public:
    Todo create(std::string title);
    std::optional<Todo> find(std::int64_t id) const;
    std::vector<Todo> list(std::optional<bool> done = std::nullopt) const;
    std::optional<Todo> update(std::int64_t id, std::optional<std::string> title, std::optional<bool> done);
    bool remove(std::int64_t id);

private:
    mutable std::mutex mutex_;                     // mutable: const methods lock it too
    std::map<std::int64_t, Todo> todos_;           // ordered by id: stable listings
    std::int64_t next_id_ = 1;
};`,
            },
            {
              path: "src/todo_store.cpp",
              lang: "cpp",
              code: `#include "todo_store.hpp"

#include <utility>

Todo TodoStore::create(std::string title) {
    std::lock_guard lock(mutex_);
    const std::int64_t id = next_id_++;
    Todo todo{id, std::move(title), false};
    todos_.emplace(id, todo);
    return todo;
}

std::optional<Todo> TodoStore::find(std::int64_t id) const {
    std::lock_guard lock(mutex_);
    auto it = todos_.find(id);
    if (it == todos_.end()) return std::nullopt;
    return it->second;
}

std::vector<Todo> TodoStore::list(std::optional<bool> done) const {
    std::lock_guard lock(mutex_);
    std::vector<Todo> result;
    for (const auto& [id, todo] : todos_)
        if (!done || todo.done == *done) result.push_back(todo);
    return result;
}

std::optional<Todo> TodoStore::update(std::int64_t id, std::optional<std::string> title, std::optional<bool> done) {
    std::lock_guard lock(mutex_);
    auto it = todos_.find(id);
    if (it == todos_.end()) return std::nullopt;
    if (title) it->second.title = std::move(*title);
    if (done) it->second.done = *done;
    return it->second;
}

bool TodoStore::remove(std::int64_t id) {
    std::lock_guard lock(mutex_);
    return todos_.erase(id) == 1;
}`,
            },
            {
              path: "src/json_src.cpp",
              lang: "cpp",
              code: `// Compiles Boost.JSON's implementation into this program (header-only mode).
// It must be included in exactly one .cpp file; alternatively, link the compiled Boost::json library.
#include <boost/json/src.hpp>`,
            },
          ],
          run: `brew install boost            # or: sudo apt install libboost-all-dev`,
        },
        {
          title: "A pure router: requests in, responses out",
          explain: `\`handle_request\` is the whole API's behavior in one function that never touches a socket.

**Routing** splits the target into path and query, then matches \`/health\`, \`/todos\` and \`/todos/{id}\`. For a known path with the wrong method it answers **405 Method Not Allowed** with an \`Allow\` header, as HTTP requires. Unknown paths get **404**.

**Validation** uses \`std::expected\`:
- \`parse_object\` returns the JSON object or an error message (\`std::unexpected\`).
- \`valid_title\` trims whitespace and rejects non-strings, empty titles and titles over 200 characters.
- Every failure becomes a **400** with a JSON body like \`{"error":"title is required"}\`. Clients get a message they can show; nothing crashes.

**Ids** are parsed with \`std::from_chars\`: \`/todos/abc\`, \`/todos/-1\` and \`/todos/7x\` all become a clean 404 instead of an exception.

**Responses** always set \`Content-Type\` and call \`prepare_payload()\`, which sets \`Content-Length\`. \`keep_alive\` mirrors the request, so HTTP/1.1 clients can reuse the connection. A successful \`POST\` returns **201 Created** with a \`Location\` header pointing at the new resource.`,
          files: [
            {
              path: "src/router.hpp",
              lang: "cpp",
              code: `#pragma once

#include <boost/beast/http.hpp>

#include "todo_store.hpp"

namespace api {

namespace http = boost::beast::http;
using Request = http::request<http::string_body>;
using Response = http::response<http::string_body>;

// The whole API as a pure function: no sockets, no threads, easy to test.
Response handle_request(const Request& req, TodoStore& store);

}  // namespace api`,
            },
            {
              path: "src/router.cpp",
              lang: "cpp",
              code: `#include "router.hpp"

#include <charconv>
#include <cstdint>
#include <expected>
#include <format>
#include <optional>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>

namespace api {
namespace json = boost::json;
namespace {

Response make_response(const Request& req, http::status status) {
    Response res{status, req.version()};
    res.set(http::field::server, "todo-api");
    res.keep_alive(req.keep_alive());                 // HTTP/1.1 clients may reuse the connection
    return res;
}

Response json_response(const Request& req, http::status status, const json::value& body) {
    Response res = make_response(req, status);
    res.set(http::field::content_type, "application/json");
    res.body() = json::serialize(body);
    res.prepare_payload();                            // sets Content-Length
    return res;
}

Response error(const Request& req, http::status status, std::string_view message) {
    return json_response(req, status, json::object{{"error", message}});
}

Response method_not_allowed(const Request& req, std::string_view allowed) {
    Response res = error(req, http::status::method_not_allowed, "method not allowed");
    res.set(http::field::allow, allowed);
    return res;
}

std::optional<std::int64_t> parse_id(std::string_view text) {
    std::int64_t id = 0;
    const char* end = text.data() + text.size();
    auto [ptr, ec] = std::from_chars(text.data(), end, id);
    if (ec != std::errc{} || ptr != end || id <= 0) return std::nullopt;
    return id;
}

std::expected<json::object, std::string> parse_object(const Request& req) {
    boost::system::error_code ec;
    json::value body = json::parse(req.body(), ec);
    if (ec || !body.is_object()) return std::unexpected("request body must be a JSON object");
    return std::move(body.as_object());
}

std::expected<std::string, std::string> valid_title(const json::value& value) {
    if (!value.is_string()) return std::unexpected("title must be a string");
    std::string_view title = value.as_string();
    while (!title.empty() && title.front() == ' ') title.remove_prefix(1);
    while (!title.empty() && title.back() == ' ') title.remove_suffix(1);
    if (title.empty()) return std::unexpected("title must not be empty");
    if (title.size() > 200) return std::unexpected("title must be at most 200 characters");
    return std::string(title);
}

Response create_todo(const Request& req, TodoStore& store) {
    auto body = parse_object(req);
    if (!body) return error(req, http::status::bad_request, body.error());
    const json::value* title = body->if_contains("title");
    if (title == nullptr) return error(req, http::status::bad_request, "title is required");
    auto valid = valid_title(*title);
    if (!valid) return error(req, http::status::bad_request, valid.error());

    const Todo created = store.create(std::move(*valid));
    Response res = json_response(req, http::status::created, json::value_from(created));
    res.set(http::field::location, std::format("/todos/{}", created.id));
    return res;
}

Response update_todo(const Request& req, TodoStore& store, std::int64_t id) {
    auto body = parse_object(req);
    if (!body) return error(req, http::status::bad_request, body.error());
    std::optional<std::string> title;
    std::optional<bool> done;
    if (const json::value* t = body->if_contains("title")) {
        auto valid = valid_title(*t);
        if (!valid) return error(req, http::status::bad_request, valid.error());
        title = std::move(*valid);
    }
    if (const json::value* d = body->if_contains("done")) {
        if (!d->is_bool()) return error(req, http::status::bad_request, "done must be true or false");
        done = d->as_bool();
    }
    if (!title && !done) return error(req, http::status::bad_request, "nothing to update: send title and/or done");

    auto updated = store.update(id, std::move(title), done);
    if (!updated) return error(req, http::status::not_found, "no such todo");
    return json_response(req, http::status::ok, json::value_from(*updated));
}

}  // namespace

Response handle_request(const Request& req, TodoStore& store) {
    const std::string_view target = req.target();
    const auto question = target.find('?');
    const std::string_view path = target.substr(0, question);
    const std::string_view query = question == std::string_view::npos ? std::string_view{} : target.substr(question + 1);
    const http::verb method = req.method();

    if (path == "/health") {
        if (method != http::verb::get) return method_not_allowed(req, "GET");
        return json_response(req, http::status::ok, json::object{{"status", "ok"}});
    }

    if (path == "/todos") {
        if (method == http::verb::get) {
            std::optional<bool> done;
            if (query == "done=true") done = true;
            else if (query == "done=false") done = false;
            else if (!query.empty()) return error(req, http::status::bad_request, "supported filters: ?done=true or ?done=false");
            return json_response(req, http::status::ok, json::value_from(store.list(done)));
        }
        if (method == http::verb::post) return create_todo(req, store);
        return method_not_allowed(req, "GET, POST");
    }

    if (path.starts_with("/todos/")) {
        const auto id = parse_id(path.substr(7));
        if (!id) return error(req, http::status::not_found, "no such todo");
        switch (method) {
            case http::verb::get: {
                const auto todo = store.find(*id);
                if (!todo) return error(req, http::status::not_found, "no such todo");
                return json_response(req, http::status::ok, json::value_from(*todo));
            }
            case http::verb::patch:
                return update_todo(req, store, *id);
            case http::verb::delete_: {
                if (!store.remove(*id)) return error(req, http::status::not_found, "no such todo");
                Response res = make_response(req, http::status::no_content);
                res.prepare_payload();
                return res;
            }
            default:
                return method_not_allowed(req, "GET, PATCH, DELETE");
        }
    }

    return error(req, http::status::not_found, std::format("no route for {}", path));
}

}  // namespace api`,
            },
          ],
        },
        {
          title: "The async server: coroutines, a thread pool and graceful shutdown",
          explain: `**\`serve_connection\`** is one coroutine per client, and reads like blocking code:
1. \`expires_after(30s)\`: the connection is closed if the client is idle or too slow. Without timeouts, a few thousand silent clients exhaust your file descriptors.
2. \`co_await http::async_read(...)\`: suspends, freeing the thread, until a full request has arrived. Beast's parser enforces limits (8 KB of headers and 1 MB of body by default).
3. Call the pure router, then \`co_await http::async_write(...)\`.
4. Loop while the client wants keep-alive; then shut down the sending side gracefully.

\`asio::as_tuple(asio::use_awaitable)\` returns errors as values (\`[ec, bytes]\`) instead of throwing, which suits expected outcomes like "the client hung up".

**\`accept_loop\`** accepts connections forever and \`co_spawn\`s a session for each one. Closing the acceptor makes \`async_accept\` fail with \`operation_aborted\`, which ends the loop.

**\`Server::run(n)\`** starts the accept loop, then calls \`io_context::run()\` on \`n\` threads (n - 1 \`jthread\`s plus the caller). Asio hands ready work to whichever thread is free. Each connection's coroutine runs one step at a time, so a session never races with itself; the only shared state is the store, which has its own mutex.

**\`main\`** reads \`PORT\` from the environment (twelve-factor style, which Docker and cloud platforms expect), uses one thread per core, and installs a \`signal_set\`: Ctrl-C or \`docker stop\` (SIGTERM) calls \`stop()\`, which closes the acceptor and stops the loop so \`main\` returns normally. \`setvbuf\` makes stdout line-buffered, so logs appear immediately even when stdout is a pipe (as in Docker).`,
          files: [
            {
              path: "src/server.hpp",
              lang: "cpp",
              code: `#pragma once

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <string>

#include "todo_store.hpp"

namespace api {

// Accepts connections and serves each one with a coroutine. run() may use several threads.
class Server {
public:
    Server(TodoStore& store, const std::string& address, unsigned short port, bool log_requests);

    unsigned short port() const;                    // the real port (useful when constructed with port 0)
    boost::asio::io_context& context() { return io_; }
    void run(unsigned threads);                     // blocks until stop()
    void stop();                                    // safe to call from any thread

private:
    boost::asio::io_context io_;
    boost::asio::ip::tcp::acceptor acceptor_;
    TodoStore& store_;
    bool log_requests_;
};

}  // namespace api`,
            },
            {
              path: "src/server.cpp",
              lang: "cpp",
              code: `#include "server.hpp"

#include <boost/asio/as_tuple.hpp>
#include <boost/asio/co_spawn.hpp>
#include <boost/asio/detached.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/this_coro.hpp>
#include <boost/asio/use_awaitable.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <chrono>
#include <print>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

#include "router.hpp"

namespace api {
namespace asio = boost::asio;
namespace beast = boost::beast;
using tcp = asio::ip::tcp;

namespace {

asio::awaitable<void> serve_connection(beast::tcp_stream stream, TodoStore& store, bool log_requests) {
    beast::flat_buffer buffer;
    for (;;) {
        stream.expires_after(std::chrono::seconds(30));          // idle or slow clients get disconnected
        Request req;
        [[maybe_unused]] auto [read_error, bytes_read] =
            co_await http::async_read(stream, buffer, req, asio::as_tuple(asio::use_awaitable));
        if (read_error) break;                                   // client closed, timeout, or malformed HTTP

        Response res = handle_request(req, store);
        if (log_requests) {
            std::println("{} {} -> {}", std::string_view(req.method_string()), std::string_view(req.target()), res.result_int());
        }
        const bool keep_alive = res.keep_alive();
        [[maybe_unused]] auto [write_error, bytes_written] =
            co_await http::async_write(stream, res, asio::as_tuple(asio::use_awaitable));
        if (write_error || !keep_alive) break;
    }
    beast::error_code ignored;
    stream.socket().shutdown(tcp::socket::shutdown_send, ignored);   // graceful close
}

asio::awaitable<void> accept_loop(tcp::acceptor& acceptor, TodoStore& store, bool log_requests) {
    const auto executor = co_await asio::this_coro::executor;
    for (;;) {
        auto [ec, socket] = co_await acceptor.async_accept(asio::as_tuple(asio::use_awaitable));
        if (ec == asio::error::operation_aborted) co_return;     // the acceptor was closed: shutting down
        if (ec) continue;                                        // e.g. too many open files: keep serving
        asio::co_spawn(executor, serve_connection(beast::tcp_stream(std::move(socket)), store, log_requests), asio::detached);
    }
}

}  // namespace

Server::Server(TodoStore& store, const std::string& address, unsigned short port, bool log_requests)
    : acceptor_(io_, tcp::endpoint(asio::ip::make_address(address), port)),   // open + bind + listen
      store_(store),
      log_requests_(log_requests) {}

unsigned short Server::port() const { return acceptor_.local_endpoint().port(); }

void Server::run(unsigned threads) {
    asio::co_spawn(io_, accept_loop(acceptor_, store_, log_requests_), asio::detached);
    std::vector<std::jthread> pool;
    for (unsigned i = 1; i < threads; ++i) pool.emplace_back([this] { io_.run(); });
    io_.run();                                                   // the calling thread works too
}                                                                // the pool joins once run() returns everywhere

void Server::stop() {
    asio::post(io_, [this] {                                     // run on the loop: no data race on acceptor_
        beast::error_code ignored;
        acceptor_.close(ignored);
        io_.stop();
    });
}

}  // namespace api`,
            },
            {
              path: "src/main.cpp",
              lang: "cpp",
              code: `#include <algorithm>
#include <boost/asio/signal_set.hpp>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <print>
#include <string>
#include <thread>

#include "server.hpp"
#include "todo_store.hpp"

int main() {
    std::setvbuf(stdout, nullptr, _IOLBF, 0);                    // log lines appear immediately, even in Docker
    try {
        const char* port_env = std::getenv("PORT");             // configuration from the environment
        const auto port = static_cast<unsigned short>(port_env != nullptr ? std::stoi(port_env) : 8080);
        const unsigned threads = std::max(1u, std::thread::hardware_concurrency());

        TodoStore store;
        api::Server server(store, "0.0.0.0", port, true);
        boost::asio::signal_set signals(server.context(), SIGINT, SIGTERM);
        signals.async_wait([&server](const boost::system::error_code&, int) { server.stop(); });

        std::println("todo-api listening on http://0.0.0.0:{} with {} threads", server.port(), threads);
        server.run(threads);
        std::println("shut down cleanly");
    } catch (const std::exception& e) {
        std::println(stderr, "fatal: {}", e.what());
        return 1;
    }
}`,
            },
          ],
          run: `cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j
./build/todo-api                                 # terminal 1 (Ctrl-C stops it gracefully)

# terminal 2
curl -s -w '\\n' -X POST localhost:8080/todos -H 'Content-Type: application/json' -d '{"title":"Learn Boost.Beast"}'
curl -s -w '\\n' -X POST localhost:8080/todos -d '{"title":"Write tests"}'
curl -s -w '\\n' -X PATCH localhost:8080/todos/1 -d '{"done":true}'
curl -s -w '\\n' 'localhost:8080/todos?done=false'
curl -s -i -X POST localhost:8080/todos -d '{"title":""}'`,
          output: `# terminal 2
{"id":1,"title":"Learn Boost.Beast","done":false}
{"id":2,"title":"Write tests","done":false}
{"id":1,"title":"Learn Boost.Beast","done":true}
[{"id":2,"title":"Write tests","done":false}]
HTTP/1.1 400 Bad Request
Server: todo-api
Content-Type: application/json
Content-Length: 35

{"error":"title must not be empty"}

# terminal 1 (the thread count is your number of CPU cores)
todo-api listening on http://0.0.0.0:8080 with 8 threads
POST /todos -> 201
POST /todos -> 201
PATCH /todos/1 -> 200
GET /todos?done=false -> 200
POST /todos -> 400
^C
shut down cleanly`,
        },
        {
          title: "Tests: unit tests on the router, and a real HTTP round trip",
          explain: `Two kinds of tests, both without a framework (the same \`CHECK\` approach as the key-value store):

**Unit tests call \`handle_request\` directly.** They build \`Request\` objects, call the router and inspect status, headers and JSON. No network, no threads: thousands could run in a second. They cover creation (including trimming and the \`Location\` header), every validation error, updates, filters, deletes, 404s and 405s.

**One integration test goes over a real socket.** It starts a \`Server\` on **port 0** (the OS picks a free port, so tests never collide with a running server), runs it on two threads in a \`jthread\`, and talks to it with Beast's synchronous client: connect, write a request, read the response. This proves the wiring (accept loop, coroutines, keep-alive, serialization) actually works. \`server.stop()\` and the \`jthread\` destructor shut everything down cleanly.

Build the tests with the sanitizers (\`-DAPI_SANITIZE=ON\`). For a concurrency check, build a separate copy with \`-fsanitize=thread\` and run the integration test.`,
          files: [
            {
              path: "tests/api_test.cpp",
              lang: "cpp",
              code: `#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/address.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/json.hpp>
#include <cstdio>
#include <print>
#include <source_location>
#include <string>
#include <string_view>
#include <thread>
#include <utility>

#include "router.hpp"
#include "server.hpp"
#include "todo_store.hpp"

namespace {
namespace asio = boost::asio;
namespace beast = boost::beast;
namespace http = boost::beast::http;
namespace json = boost::json;

int failures = 0;

void check(bool ok, std::string_view what, std::source_location where = std::source_location::current()) {
    if (!ok) {
        ++failures;
        std::println(stderr, "    FAILED line {}: {}", where.line(), what);
    }
}
#define CHECK(cond) check((cond), #cond)

api::Request make_request(http::verb method, std::string target, std::string body = "") {
    api::Request req{method, target, 11};
    req.set(http::field::host, "localhost");
    if (!body.empty()) {
        req.set(http::field::content_type, "application/json");
        req.body() = std::move(body);
    }
    req.prepare_payload();
    return req;
}

std::string error_of(const api::Response& res) {
    return json::value_to<std::string>(json::parse(res.body()).at("error"));
}

void test_create_and_get() {
    TodoStore store;
    auto created = api::handle_request(make_request(http::verb::post, "/todos", R"({"title":"  Learn Beast  "})"), store);
    CHECK(created.result() == http::status::created);
    CHECK(created[http::field::location] == "/todos/1");
    CHECK(created[http::field::content_type] == "application/json");
    CHECK(created.body() == R"({"id":1,"title":"Learn Beast","done":false})");

    auto got = api::handle_request(make_request(http::verb::get, "/todos/1"), store);
    CHECK(got.result() == http::status::ok);
    CHECK(json::parse(got.body()).at("title").as_string() == "Learn Beast");
}

void test_validation_errors() {
    TodoStore store;
    auto post = [&store](std::string body) { return api::handle_request(make_request(http::verb::post, "/todos", std::move(body)), store); };
    auto missing = post(R"({"done":true})");
    CHECK(missing.result() == http::status::bad_request);
    CHECK(error_of(missing) == "title is required");
    CHECK(error_of(post(R"({"title":"   "})")) == "title must not be empty");
    CHECK(error_of(post(R"({"title":42})")) == "title must be a string");
    CHECK(error_of(post("not json")) == "request body must be a JSON object");
    CHECK(error_of(post(R"({"title":")" + std::string(201, 'x') + R"("})")) == "title must be at most 200 characters");
    CHECK(store.list().empty());                              // nothing was created
}

void test_update_filter_and_delete() {
    TodoStore store;
    store.create("Write tests");
    store.create("Ship it");
    auto patched = api::handle_request(make_request(http::verb::patch, "/todos/1", R"({"done":true})"), store);
    CHECK(patched.result() == http::status::ok);
    CHECK(json::parse(patched.body()).at("done").as_bool());
    CHECK(error_of(api::handle_request(make_request(http::verb::patch, "/todos/1", R"({"done":"yes"})"), store)) == "done must be true or false");
    CHECK(api::handle_request(make_request(http::verb::patch, "/todos/1", "{}"), store).result() == http::status::bad_request);
    CHECK(api::handle_request(make_request(http::verb::patch, "/todos/9", R"({"done":true})"), store).result() == http::status::not_found);

    auto done = api::handle_request(make_request(http::verb::get, "/todos?done=true"), store);
    CHECK(done.body() == R"([{"id":1,"title":"Write tests","done":true}])");
    auto open = api::handle_request(make_request(http::verb::get, "/todos?done=false"), store);
    CHECK(json::parse(open.body()).as_array().size() == 1);

    auto deleted = api::handle_request(make_request(http::verb::delete_, "/todos/1"), store);
    CHECK(deleted.result() == http::status::no_content);
    CHECK(deleted.body().empty());
    CHECK(api::handle_request(make_request(http::verb::delete_, "/todos/1"), store).result() == http::status::not_found);
}

void test_routing_errors() {
    TodoStore store;
    auto wrong_method = api::handle_request(make_request(http::verb::put, "/todos"), store);
    CHECK(wrong_method.result() == http::status::method_not_allowed);
    CHECK(wrong_method[http::field::allow] == "GET, POST");
    CHECK(api::handle_request(make_request(http::verb::get, "/todos/abc"), store).result() == http::status::not_found);
    CHECK(api::handle_request(make_request(http::verb::get, "/todos/-3"), store).result() == http::status::not_found);
    CHECK(api::handle_request(make_request(http::verb::get, "/nope"), store).result() == http::status::not_found);
    CHECK(api::handle_request(make_request(http::verb::get, "/todos?sort=asc"), store).result() == http::status::bad_request);
    CHECK(api::handle_request(make_request(http::verb::get, "/health"), store).body() == R"({"status":"ok"})");
}

api::Response send(unsigned short port, const api::Request& req) {
    asio::io_context io;
    beast::tcp_stream stream(io);
    stream.connect(asio::ip::tcp::endpoint(asio::ip::make_address("127.0.0.1"), port));
    http::write(stream, req);
    beast::flat_buffer buffer;
    api::Response res;
    http::read(stream, buffer, res);
    beast::error_code ignored;
    stream.socket().shutdown(asio::ip::tcp::socket::shutdown_both, ignored);
    return res;
}

void test_over_real_http() {
    TodoStore store;
    api::Server server(store, "127.0.0.1", 0, false);         // port 0: the OS picks a free port
    const unsigned short port = server.port();
    std::jthread runner([&server] { server.run(2); });
    auto created = send(port, make_request(http::verb::post, "/todos", R"({"title":"Ship it"})"));
    CHECK(created.result() == http::status::created);
    auto listed = send(port, make_request(http::verb::get, "/todos"));
    CHECK(listed.result() == http::status::ok);
    CHECK(listed.body() == R"([{"id":1,"title":"Ship it","done":false}])");
    server.stop();
}                                                             // runner joins after run() returns

}  // namespace

int main() {
    const std::pair<const char*, void (*)()> tests[] = {
        {"create and get", test_create_and_get},
        {"validation errors", test_validation_errors},
        {"update, filter and delete", test_update_filter_and_delete},
        {"routing errors (404, 405)", test_routing_errors},
        {"over real HTTP", test_over_real_http},
    };
    for (const auto& [name, test] : tests) {
        const int before = failures;
        test();
        std::println("  {}  {}", failures == before ? "ok  " : "FAIL", name);
    }
    std::println("{} tests, {} failures", std::size(tests), failures);
    return failures == 0 ? 0 : 1;
}`,
            },
          ],
          run: `cmake -S . -B build-asan -DAPI_SANITIZE=ON && cmake --build build-asan -j
./build-asan/api_tests`,
          output: `  ok    create and get
  ok    validation errors
  ok    update, filter and delete
  ok    routing errors (404, 405)
  ok    over real HTTP
5 tests, 0 failures`,
        },
        {
          title: "Ship it: a multi-stage Docker image",
          explain: `C++ deploys as a native binary, so the container doesn't need a compiler:
- **Stage 1 (build)**: a full image with GCC, CMake and the Boost headers compiles a Release build and runs the tests. If a test fails, the image build fails.
- **Stage 2 (runtime)**: a slim image with only the C++ runtime libraries and our binary, running as a non-root user.

The binary reads \`PORT\` from the environment and handles SIGTERM, so \`docker stop\` shuts it down gracefully. Put the container behind a reverse proxy or load balancer that terminates TLS.

Ubuntu 26.04 ships GCC 15 and a recent Boost, which together cover everything this project uses (\`<print>\`, \`std::expected\`, coroutines).`,
          files: [
            {
              path: "Dockerfile",
              lang: "dockerfile",
              code: `# --- build stage: compiler, CMake and Boost headers ---
FROM ubuntu:26.04 AS build
RUN apt-get update && apt-get install -y --no-install-recommends \\
        g++ cmake ninja-build libboost-dev ca-certificates \\
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY CMakeLists.txt .
COPY src ./src
COPY tests ./tests
RUN cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release \\
    && cmake --build build \\
    && ./build/api_tests

# --- runtime stage: just the binary ---
FROM ubuntu:26.04
RUN useradd --system --uid 10001 app
COPY --from=build /src/build/todo-api /usr/local/bin/todo-api
USER app
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/todo-api"]`,
            },
          ],
          run: `docker build -t todo-api .
docker run --rm -p 8080:8080 todo-api
curl -s localhost:8080/health`,
          output: `{"status":"ok"}`,
        },
      ],
      extensions: [
        "Persist todos in PostgreSQL: keep TodoStore's interface and implement it with libpqxx on a small thread pool, or switch to Drogon's async database client.",
        "Return 400 for malformed HTTP (Beast's read error) instead of silently closing, and 413 when the body limit is exceeded.",
        "Add pagination (`?limit=20&after=40`) and return a `next` link, as in the Java project.",
        "Add API keys: a middleware-style check in handle_request that returns 401 without a valid `Authorization: Bearer` header.",
        "Expose Prometheus metrics at /metrics: request counts and latency histograms per route (prometheus-cpp).",
        "Add WebSocket notifications with beast::websocket so clients see new todos instantly.",
        "Load-test with wrk or k6 and compare 1 thread vs one per core; then run the integration test under ThreadSanitizer.",
      ],
      verify: `$CXX_CMD -isystem "\${BOOST_INCLUDE:-/opt/homebrew/include}" -Isrc -Wall -Wextra -Werror -g -fsanitize=address,undefined -pthread src/todo_store.cpp src/router.cpp src/server.cpp src/json_src.cpp tests/api_test.cpp -o api_tests && ./api_tests && $CXX_CMD -isystem "\${BOOST_INCLUDE:-/opt/homebrew/include}" -Isrc -Wall -Wextra -Werror -pthread src/main.cpp src/todo_store.cpp src/router.cpp src/server.cpp src/json_src.cpp -o todo-api`,
    },
    interview: [
      {
        q: "Why keep the router a pure function separate from the networking code?",
        a: "It separates what the API does (status codes, validation, JSON) from how bytes move (sockets, coroutines, timeouts). The pure function can be unit-tested exhaustively without networking, threads or timing issues; the server can be tested with a few integration tests; and either side can change independently (switching from Beast to another transport, or adding endpoints) without touching the other.",
        freq: "common",
      },
      {
        q: "How does Asio let several threads serve connections safely?",
        a: "Multiple threads call io_context::run() and pick up ready completion handlers. Within one connection, a coroutine performs one operation at a time, so its socket and buffers aren't accessed concurrently. Shared application state (the store) must be synchronized separately with a mutex or by funneling access through a strand. Objects like the acceptor shouldn't be touched from arbitrary threads, which is why stop() posts its work onto the io_context.",
        freq: "common",
      },
      {
        q: "Which status codes should a REST API return for create, validation errors, missing resources and wrong methods?",
        a: "201 Created (with a Location header) for successful creation, 200 OK for reads and updates with a body, 204 No Content for successful deletes, 400 Bad Request (or 422) for invalid input with an explanatory body, 404 Not Found for unknown ids or routes, 405 Method Not Allowed with an Allow header when the path exists but the method doesn't, 401/403 for authentication/authorization, and 500 only for unexpected server errors.",
      },
    ],
    quiz: [
      {
        q: "Why does the integration test bind the server to port 0?",
        options: ["Port 0 is faster", "The OS picks a free port, so tests don't collide with other servers", "It disables networking", "Beast requires it"],
        answer: 1,
        explain: "server.port() reports the port that was chosen.",
      },
      {
        q: "Why does TodoStore return copies instead of references?",
        options: ["Copies are faster", "A reference would be used after the mutex is released: a data race", "References can't be returned", "Boost.JSON requires copies"],
        answer: 1,
        explain: "Never let references to lock-protected data escape the lock.",
      },
      {
        q: "What does `co_await http::async_read(...)` do to the thread while waiting for data?",
        options: ["Blocks it", "Frees it to run other connections' work", "Creates a new thread", "Spins"],
        answer: 1,
        explain: "The coroutine is suspended; the thread returns to the event loop.",
      },
      {
        q: "Why install a signal_set for SIGTERM?",
        options: ["To ignore Ctrl-C", "So `docker stop` triggers a graceful shutdown instead of a hard kill", "Required by Beast", "To catch segfaults"],
        answer: 1,
        explain: "Docker sends SIGTERM first, then SIGKILL after a timeout.",
      },
    ],
  },

  // ------------------------------------------------------------------ INTERVIEW
  {
    id: "cpp-interview",
    stage: "Interview",
    title: "C++ interview preparation",
    tagline: "How C++ interviews work, a study plan, coding-round tips in C++, the classic 'implement it yourself' questions (unique_ptr, vector, LRU cache) and rapid-fire questions with model answers.",
    difficulty: "intermediate",
    minutes: 45,
    visualizers: ["cache"],
    concept: `
## What C++ interview loops look like
C++ roles cluster in **trading and finance**, **games**, **embedded and automotive**, **browsers, databases and infrastructure**, **graphics and simulation**, and **ML systems**. Loops usually include:
| Round | What they test | Prepare with |
|---|---|---|
| **Coding (1-2 rounds)** | Data structures and algorithms, written in C++ | The DSA worlds, LeetCode 150, the arena |
| **C++ deep dive** | Memory, RAII, move semantics, templates, the STL, UB | Every chapter of this track and its Interview tab |
| **Implement-it-yourself** | unique_ptr, shared_ptr, vector, string, LRU cache, thread-safe queue | The samples below |
| **Systems / low level** | Caches, memory layout, concurrency, the OS, networking | The concurrency and web chapters |
| **System design** | For backend and infrastructure roles | The system design worlds |
| **Domain** | Trading: latency, lock-free. Games: data-oriented design. Embedded: no heap, no exceptions | Role-specific reading |

## A 4-week study plan
| Week | Focus |
|---|---|
| 1 | Foundations and memory: pointers vs references, stack vs heap, RAII, rule of 0/3/5, smart pointers. Write unique_ptr from memory. |
| 2 | STL and algorithms: container internals and complexities, iterator invalidation, algorithms and lambdas. 2 LeetCode problems a day in C++. |
| 3 | Modern and advanced: move semantics, templates and concepts, concurrency (mutex, atomics, condition variables), UB. Write MiniVector and a blocking queue. |
| 4 | Mock interviews: the rapid-fire questions below out loud, timed coding in the arena, one design question a day. |

## Writing C++ in a coding round
- \`#include <bits/stdc++.h>\` works on most judges (GCC) but **not** in real code or with Clang/MSVC. Include what you use.
- Use \`auto\`, structured bindings (\`for (auto& [k, v] : map)\`), and range-for to write less.
- Overflow is **undefined** for signed integers: use \`long long\` for sums and products, and \`mid = lo + (hi - lo) / 2\`.
- \`std::priority_queue\` is a max-heap; min-heap: \`std::priority_queue<int, std::vector<int>, std::greater<>>\`.
- \`unordered_map\` lookups: \`count\`/\`contains\`/\`find\`, never \`[]\` when you only want to check.
- Pass big containers by \`const&\`; return by value (moves and elision make it cheap).
- \`std::sort(v.begin(), v.end(), [](auto& a, auto& b) { return a.second < b.second; })\`: the comparator must be a **strict weak ordering**. \`<=\` is undefined behavior, and can crash.
- \`'\\n'\` instead of \`std::endl\` (which flushes) in output loops.

## How to answer C++ deep-dive questions
Interviewers look for **precision** and **trade-offs**. Use the right words (undefined behavior, ownership, invariant, strong exception guarantee, cache locality), mention costs ("\`shared_ptr\` adds atomic reference counting"), and say what you'd do in real code ("I'd use \`std::vector<std::unique_ptr<Shape>>\` and make the base destructor virtual"). Saying "that would be undefined behavior because..." is a strong signal.
`,
    keyPoints: [
      "Expect DSA in C++, a C++ deep dive, and implement-it-yourself questions",
      "Know unique_ptr, vector and an LRU cache well enough to write them from memory",
      "Signed overflow is UB: use long long and lo + (hi - lo) / 2",
      "Comparators must be strict weak orderings: never <=",
      "Explain costs and trade-offs, and name undefined behavior when you see it",
      "Practice saying answers out loud: precision beats length",
    ],
    code: [
      {
        title: "Implement unique_ptr",
        variants: [
          {
            lang: "cpp",
            code: `#include <print>
#include <string>
#include <utility>

template <typename T>
class UniquePtr {
public:
    UniquePtr() noexcept = default;
    explicit UniquePtr(T* p) noexcept : ptr_(p) {}              // explicit: no accidental ownership
    ~UniquePtr() { delete ptr_; }

    UniquePtr(const UniquePtr&) = delete;                       // unique: no copies
    UniquePtr& operator=(const UniquePtr&) = delete;
    UniquePtr(UniquePtr&& other) noexcept : ptr_(std::exchange(other.ptr_, nullptr)) {}
    UniquePtr& operator=(UniquePtr&& other) noexcept {
        if (this != &other) reset(other.release());              // self-move must not delete our object
        return *this;
    }

    T* release() noexcept { return std::exchange(ptr_, nullptr); }   // give up ownership
    void reset(T* p = nullptr) noexcept { delete std::exchange(ptr_, p); }
    T* get() const noexcept { return ptr_; }
    T& operator*() const { return *ptr_; }
    T* operator->() const noexcept { return ptr_; }
    explicit operator bool() const noexcept { return ptr_ != nullptr; }

private:
    T* ptr_ = nullptr;
};

template <typename T, typename... Args>
UniquePtr<T> make_owned(Args&&... args) {
    return UniquePtr<T>(new T(std::forward<Args>(args)...));
}

struct Resource {
    std::string name;
    explicit Resource(std::string n) : name(std::move(n)) { std::println("  + {}", name); }
    ~Resource() { std::println("  - {}", name); }
};

int main() {
    {
        auto a = make_owned<Resource>("A");
        auto b = std::move(a);
        std::println("a is {}, b owns {}", a ? "full" : "empty", b->name);
        b.reset(new Resource("B"));                             // A is destroyed
        Resource* raw = b.release();                            // now we must delete it ourselves
        std::println("released {}", raw->name);
        delete raw;
        auto c = make_owned<Resource>("C");
        c = make_owned<Resource>("D");                          // move assignment destroys C
        std::println("end of scope");
    }                                                           // D destroyed here
}`,
          },
        ],
        output: `  + A
a is empty, b owns A
  + B
  - A
released B
  - B
  + C
  + D
  - C
end of scope
  - D`,
        explain: `What interviewers check:
- Copy operations are **deleted**; move operations transfer the pointer and null the source, and are **noexcept**.
- \`reset\` stores the new pointer **before** deleting the old one (\`delete std::exchange(ptr_, p)\`), so it's correct even if the old object's destructor somehow reaches back into this pointer.
- Move assignment handles **self-assignment**.
- \`operator bool\` is **explicit**, so \`int x = ptr;\` doesn't compile but \`if (ptr)\` does.
- Follow-ups to expect: custom deleters (a second template parameter, stored with empty-base optimization so it costs nothing), the array version \`UniquePtr<T[]>\` (uses \`delete[]\`), and why \`make_unique\` exists.`,
      },
      {
        title: "Implement a vector",
        variants: [
          {
            lang: "cpp",
            code: `#include <cstddef>
#include <memory>
#include <print>
#include <string>
#include <utility>

template <typename T>
class MiniVector {
public:
    MiniVector() = default;
    MiniVector(const MiniVector& other) : MiniVector() {        // delegating: if a copy throws, ~MiniVector cleans up
        reserve(other.size_);
        for (const T& x : other) push_back(x);
    }
    MiniVector(MiniVector&& other) noexcept
        : data_(std::exchange(other.data_, nullptr)),
          size_(std::exchange(other.size_, 0)),
          capacity_(std::exchange(other.capacity_, 0)) {}
    MiniVector& operator=(MiniVector other) noexcept {          // copy-and-swap: copy and move assignment
        swap(other);
        return *this;
    }
    ~MiniVector() {
        std::destroy_n(data_, size_);                             // destroy the live elements...
        if (data_) std::allocator<T>{}.deallocate(data_, capacity_);   // ...then free the raw memory
    }

    void swap(MiniVector& other) noexcept {
        std::swap(data_, other.data_);
        std::swap(size_, other.size_);
        std::swap(capacity_, other.capacity_);
    }

    void reserve(std::size_t new_capacity) {                      // strong exception guarantee
        if (new_capacity <= capacity_) return;
        T* fresh = std::allocator<T>{}.allocate(new_capacity);
        std::size_t built = 0;
        try {
            for (; built < size_; ++built) std::construct_at(fresh + built, std::move_if_noexcept(data_[built]));
        } catch (...) {
            std::destroy_n(fresh, built);                         // undo: the old buffer is untouched
            std::allocator<T>{}.deallocate(fresh, new_capacity);
            throw;
        }
        std::destroy_n(data_, size_);
        if (data_) std::allocator<T>{}.deallocate(data_, capacity_);
        data_ = fresh;
        capacity_ = new_capacity;
    }

    template <typename... Args>
    T& emplace_back(Args&&... args) {
        if (size_ < capacity_) return *std::construct_at(data_ + size_++, std::forward<Args>(args)...);
        T value(std::forward<Args>(args)...);                     // build it BEFORE reallocating: args may
        reserve(capacity_ == 0 ? 1 : capacity_ * 2);              // refer into our own buffer (v.push_back(v[0]))
        return *std::construct_at(data_ + size_++, std::move(value));
    }
    void push_back(const T& value) { emplace_back(value); }
    void push_back(T&& value) { emplace_back(std::move(value)); }
    void pop_back() { std::destroy_at(data_ + --size_); }

    T& operator[](std::size_t i) { return data_[i]; }
    const T& operator[](std::size_t i) const { return data_[i]; }
    std::size_t size() const { return size_; }
    std::size_t capacity() const { return capacity_; }
    T* begin() { return data_; }
    T* end() { return data_ + size_; }
    const T* begin() const { return data_; }
    const T* end() const { return data_ + size_; }

private:
    T* data_ = nullptr;
    std::size_t size_ = 0;
    std::size_t capacity_ = 0;
};

int main() {
    MiniVector<std::string> v;
    for (const char* word : {"alpha", "beta", "gamma", "delta"}) v.emplace_back(word);
    std::println("size {} capacity {}", v.size(), v.capacity());
    v.push_back(v[0]);                                            // aliasing + reallocation: still safe
    std::println("size {} capacity {} last '{}'", v.size(), v.capacity(), v[4]);

    MiniVector<std::string> copy = v;                             // deep copy
    copy[0] = "changed";
    std::println("original[0] '{}', copy[0] '{}'", v[0], copy[0]);

    MiniVector<std::string> moved = std::move(copy);             // steals the buffer
    std::println("moved size {}, copy size {}", moved.size(), copy.size());
    moved.pop_back();
    std::print("moved:");
    for (const auto& s : moved) std::print(" {}", s);
    std::println("");
}`,
          },
        ],
        output: `size 4 capacity 4
size 5 capacity 8 last 'alpha'
original[0] 'alpha', copy[0] 'changed'
moved size 5, copy size 0
moved: changed beta gamma delta`,
        explain: `The points that separate a good answer from a great one:
- **Raw memory vs objects**: \`allocate\` gets uninitialized storage; \`construct_at\` builds an object in it; \`destroy_n\` runs destructors; \`deallocate\` frees memory. Capacity slots beyond \`size_\` hold no objects.
- **Growth by doubling** gives amortized O(1) \`push_back\`.
- **\`move_if_noexcept\`** during reallocation keeps the strong exception guarantee (see the move semantics chapter).
- **Aliasing**: \`v.push_back(v[0])\` passes a reference into the buffer that's about to be freed. We construct the new element first. (Real implementations construct it directly in the new buffer to save a move.)
- **The delegating copy constructor**: once the delegated-to constructor finishes, the object counts as constructed, so if a copy throws midway, the destructor runs and nothing leaks.`,
      },
      {
        title: "LRU cache with O(1) get and put",
        variants: [
          {
            lang: "cpp",
            code: `#include <cstddef>
#include <list>
#include <optional>
#include <print>
#include <string>
#include <unordered_map>
#include <utility>

class LruCache {
public:
    explicit LruCache(std::size_t capacity) : capacity_(capacity) {}

    std::optional<std::string> get(int key) {
        auto it = index_.find(key);
        if (it == index_.end()) return std::nullopt;
        order_.splice(order_.begin(), order_, it->second);      // O(1): relink the node at the front
        return it->second->second;
    }

    void put(int key, std::string value) {
        if (auto it = index_.find(key); it != index_.end()) {
            it->second->second = std::move(value);
            order_.splice(order_.begin(), order_, it->second);
            return;
        }
        if (order_.size() == capacity_) {                        // evict the least recently used: the back
            std::println("  evict {}", order_.back().first);
            index_.erase(order_.back().first);
            order_.pop_back();
        }
        order_.emplace_front(key, std::move(value));
        index_[key] = order_.begin();
    }

    void print() const {
        std::print("  cache (most recent first):");
        for (const auto& [key, value] : order_) std::print(" {}={}", key, value);
        std::println("");
    }

private:
    using Entry = std::pair<int, std::string>;
    std::size_t capacity_;
    std::list<Entry> order_;                                     // front = most recently used
    std::unordered_map<int, std::list<Entry>::iterator> index_;  // key -> its node in the list
};

int main() {
    LruCache cache(2);
    cache.put(1, "a");
    cache.put(2, "b");
    std::println("get(1) = {}", cache.get(1).value_or("miss"));   // 1 becomes most recent
    cache.put(3, "c");                                            // evicts 2
    std::println("get(2) = {}", cache.get(2).value_or("miss"));
    cache.put(4, "d");                                            // evicts 1
    std::println("get(3) = {}", cache.get(3).value_or("miss"));
    cache.print();
}`,
          },
        ],
        output: `get(1) = a
  evict 2
get(2) = miss
  evict 1
get(3) = c
  cache (most recent first): 3=c 4=d`,
        explain: `- The hash map finds a key's node in O(1); the doubly linked list keeps recency order and removes or relinks nodes in O(1).
- \`std::list::splice\` moves a node within the list **without invalidating iterators**, which is why the map can store list iterators safely. A \`std::vector\` couldn't do this.
- Common follow-ups: make it thread-safe (a mutex around get and put; note that \`get\` modifies the order, so even reads need the exclusive lock), make it generic (\`template <class K, class V>\`), add TTLs, or discuss sharding the cache to reduce lock contention.`,
      },
    ],
    interview: [
      {
        q: "Pointer vs reference?",
        a: "A reference is an alias that must be initialized, can't be null and can't be reseated; a pointer is an object holding an address that can be null, reassigned and do arithmetic. Use references for parameters that must refer to an object, pointers when 'no object' is valid or when re-pointing is needed. Neither expresses ownership; use smart pointers for that.",
        freq: "very-common",
      },
      {
        q: "Stack vs heap?",
        a: "Stack: automatic storage for locals and call frames, allocated by moving the stack pointer (extremely fast), freed automatically at scope exit, limited in size (typically 1-8 MB). Heap (free store): dynamic memory from new/malloc or allocators, any size and lifetime, slower (allocator bookkeeping, possible locking, fragmentation), and must be released (RAII/smart pointers). Prefer the stack and value semantics; use the heap for large, variable-size or long-lived objects (containers do this for you).",
        freq: "very-common",
      },
      {
        q: "What is undefined behavior? Give examples.",
        a: "Behavior the standard places no requirements on: the compiler may assume it never happens and optimize accordingly, so the program can do anything, including appearing to work. Examples: out-of-bounds access, dereferencing null or dangling pointers, use-after-free, double delete, signed integer overflow, data races, reading uninitialized variables, violating strict aliasing, modifying a const object, a missing return in a non-void function, and invalid iterator use. Find it with sanitizers (ASan, UBSan, TSan), warnings and static analysis.",
        freq: "very-common",
      },
      {
        q: "What is RAII?",
        a: "Resource Acquisition Is Initialization: tie a resource's lifetime to an object's lifetime. The constructor acquires (memory, file, lock, socket), the destructor releases, and since destructors run automatically at scope exit, including during exception unwinding, resources can't leak. Examples: std::vector, std::unique_ptr, std::lock_guard, std::fstream, std::jthread. It's the foundation of exception-safe C++.",
        freq: "very-common",
      },
      {
        q: "new/delete vs malloc/free?",
        a: "new allocates memory and calls the constructor (and throws std::bad_alloc on failure); delete calls the destructor and frees. malloc/free only handle raw bytes, return nullptr on failure, and know nothing about constructors. They must never be mixed (delete on malloc'ed memory is UB), and new[] must pair with delete[]. In modern code, use neither directly: containers and make_unique/make_shared.",
        freq: "common",
      },
      {
        q: "What happens if an exception is thrown from a destructor?",
        a: "Destructors are implicitly noexcept since C++11, so throwing out of one calls std::terminate. Even before that, throwing during stack unwinding (while another exception is in flight) terminated the program. Destructors must not throw: catch and log inside, or provide an explicit close()/flush() method that can report errors before destruction.",
        freq: "common",
      },
      {
        q: "What does `const` mean in its different positions?",
        a: "`const int* p` / `int const* p`: pointer to const int (can't modify through p, can repoint). `int* const p`: const pointer (can't repoint). `const int* const p`: both. A const member function (`int size() const`) promises not to modify the object's observable state (mutable members excepted) and is callable on const objects. `const T&` parameters avoid copies and promise no modification. constexpr is a stronger compile-time constant.",
        freq: "common",
      },
      {
        q: "What does `static` mean in C++?",
        a: "Several things by context. A static local variable is initialized once (thread-safely since C++11) and lives until program exit. A static data member is shared by all instances of the class. A static member function has no `this`. A static function or variable at namespace scope has internal linkage (visible only in its translation unit; prefer an anonymous namespace).",
        freq: "common",
      },
      {
        q: "What is the One Definition Rule (ODR)?",
        a: "Every variable, function, class or template may be defined only once per translation unit, and non-inline functions and variables exactly once in the whole program; inline functions, inline variables, classes and templates may appear in several translation units but all definitions must be identical. Violations (e.g. two different definitions of the same class in different files, or a non-inline function defined in a header included twice) cause linker errors or, worse, silent undefined behavior.",
      },
      {
        q: "How do you detect memory leaks and memory errors?",
        a: "Prevent them with RAII and smart pointers. Detect with AddressSanitizer + LeakSanitizer (-fsanitize=address) in tests and CI, Valgrind memcheck (slower, no recompilation), heap profilers (heaptrack, Instruments, massif) for growth, and static analysis (clang-tidy, the Clang static analyzer). For long-running services, monitor resident memory over time.",
        freq: "common",
      },
      {
        q: "What is the size of an empty class, and what is padding?",
        a: "An empty class has size 1, so distinct objects have distinct addresses (but an empty base class can take no space: the empty base optimization, or [[no_unique_address]] for members). Padding: the compiler inserts unused bytes so each member is aligned to its alignment requirement, and the struct's size is a multiple of its largest alignment. `struct { char c; int i; char d; }` is typically 12 bytes; reordering members from largest to smallest alignment reduces it to 8.",
      },
      {
        q: "Why is `volatile` not the right tool for sharing data between threads?",
        a: "volatile only prevents the compiler from optimizing away or reordering accesses to that variable relative to other volatile accesses; it provides no atomicity and no memory ordering between threads, so concurrent access is still a data race. Use std::atomic or mutexes. volatile is for memory-mapped hardware registers and signal handlers.",
      },
      {
        q: "What's the difference between std::array, a C array and std::vector?",
        a: "A C array (`int a[10]`) has a fixed size, decays to a pointer when passed (losing its size), and has no bounds-checked access or value semantics. std::array<int, 10> wraps it with zero overhead: knows its size, copyable and comparable, works with algorithms, and .at() checks bounds. std::vector is dynamically sized on the heap with growth. Use std::array for fixed sizes known at compile time, vector otherwise, and C arrays essentially never.",
      },
      {
        q: "Is shared_ptr thread-safe?",
        a: "Partially. The control block's reference counting is thread-safe: different threads can copy and destroy their own shared_ptr instances pointing to the same object. But concurrent access to the same shared_ptr instance (one thread reassigning while another reads it) is a data race (use std::atomic<std::shared_ptr<T>>, C++20), and the pointed-to object has no synchronization at all: protect it yourself.",
        freq: "common",
      },
      {
        q: "What does the `explicit` keyword do?",
        a: "On a constructor (or conversion operator), it prevents implicit conversions: `explicit Meters(double)` means `Meters m = 5.0;` and passing 5.0 where Meters is expected don't compile; you must write `Meters{5.0}`. Single-argument constructors should usually be explicit to avoid surprising conversions. `explicit operator bool` allows `if (x)` but not `int i = x`.",
      },
    ],
    quiz: [
      {
        q: "What's wrong with `std::sort(v.begin(), v.end(), [](int a, int b) { return a <= b; });`?",
        options: ["Nothing", "<= isn't a strict weak ordering: undefined behavior", "It sorts descending", "Lambdas can't be comparators"],
        answer: 1,
        explain: "Comparators must return false for equal elements; use <.",
      },
      {
        q: "`int mid = (lo + hi) / 2;` with large ints risks...",
        options: ["Nothing", "Signed overflow: undefined behavior", "A compile error", "Rounding errors only"],
        answer: 1,
        explain: "Use lo + (hi - lo) / 2.",
      },
      {
        q: "What does an LRU cache's std::list give that a vector can't?",
        options: ["Faster lookup", "O(1) relinking with stable iterators (splice)", "Less memory", "Sorting"],
        answer: 1,
        explain: "The map stores list iterators, which stay valid.",
      },
      {
        q: "In MiniVector, why construct the new element before reallocating?",
        options: ["Speed", "The argument may reference an element in the buffer being freed", "Alignment", "It's required by std::allocator"],
        answer: 1,
        explain: "v.push_back(v[0]) would otherwise read freed memory.",
      },
      {
        q: "What happens when an exception escapes a destructor?",
        options: ["It propagates normally", "std::terminate (destructors are noexcept)", "It's ignored", "The object is destroyed twice"],
        answer: 1,
        explain: "Never let exceptions escape destructors.",
      },
      {
        q: "sizeof an empty class is...",
        options: ["0", "1", "4", "8"],
        answer: 1,
        explain: "Distinct objects need distinct addresses.",
      },
      {
        q: "Which correctly declares a pointer you can't repoint, to an int you can modify?",
        options: ["const int* p", "int* const p", "const int* const p", "int const* p"],
        answer: 1,
        explain: "Read declarations right to left: p is a const pointer to int.",
      },
      {
        q: "Which tool finds use-after-free bugs at run time?",
        options: ["clang-format", "AddressSanitizer", "CMake", "ThreadSanitizer"],
        answer: 1,
        explain: "-fsanitize=address.",
      },
    ],
    problems: [
      { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "Medium", note: "list + unordered_map" },
      { title: "Min Stack", url: "https://leetcode.com/problems/min-stack/", difficulty: "Medium", note: "two stacks or pairs" },
      { title: "Design HashMap", url: "https://leetcode.com/problems/design-hashmap/", difficulty: "Easy", note: "buckets + chaining" },
      { title: "Implement Trie (Prefix Tree)", url: "https://leetcode.com/problems/implement-trie-prefix-tree/", difficulty: "Medium", note: "unique_ptr children" },
      { title: "LFU Cache", url: "https://leetcode.com/problems/lfu-cache/", difficulty: "Hard", note: "frequency lists" },
      { title: "Design Circular Queue", url: "https://leetcode.com/problems/design-circular-queue/", difficulty: "Medium", note: "ring buffer" },
    ],
  },
];
