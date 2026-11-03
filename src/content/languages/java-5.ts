import type { Lesson } from "../types";

// Java track, part 5: guided projects and interview prep.

const expensesTree = `expenses/
├── build.sh                         compile, test and package (no Maven needed)
├── src/
│   ├── main/java/expenses/
│   │   ├── Category.java            enum of spending categories
│   │   ├── Expense.java             validated record (BigDecimal money)
│   │   ├── ExpenseStore.java        CSV persistence with java.nio
│   │   ├── Report.java              totals and rankings with streams
│   │   └── Main.java                command-line interface
│   └── test/java/expenses/
│       └── ExpenseTests.java        dependency-free test runner
└── expenses.jar                     built by build.sh`;

const bookmarksTree = `bookmarks/
├── pom.xml
├── Dockerfile
├── compose.yaml                     Postgres + the API for local runs
└── src/
    ├── main/
    │   ├── java/com/example/bookmarks/
    │   │   ├── BookmarksApplication.java   entry point + Clock bean
    │   │   ├── AppProperties.java          typed configuration
    │   │   ├── Bookmark.java               JPA entity
    │   │   ├── BookmarkRepository.java     Spring Data repository
    │   │   ├── BookmarkRequest.java        request DTO with validation
    │   │   ├── BookmarkResponse.java       response DTO
    │   │   ├── PageResponse.java           stable paging envelope
    │   │   ├── BookmarkService.java        business logic + transactions
    │   │   ├── BookmarkNotFoundException.java
    │   │   ├── BookmarkController.java     REST endpoints
    │   │   └── ApiErrors.java              exceptions → ProblemDetail
    │   └── resources/
    │       ├── application.yml
    │       ├── application-prod.yml
    │       └── db/migration/V1__create_bookmark.sql
    └── test/java/com/example/bookmarks/
        └── BookmarkApiTest.java            MockMvc tests over the whole app`;

export const javaProjects: Lesson[] = [
  // ------------------------------------------------------------------ PROJECT: CLI
  {
    id: "java-project-cli",
    stage: "Projects",
    title: "Project: an expense tracker CLI",
    tagline: "Build a real command-line tool with records, enums, BigDecimal money, CSV files, streams, error handling and tests, using nothing but the JDK.",
    difficulty: "intermediate",
    minutes: 60,
    concept: `
## What you'll build
A command-line expense tracker you can actually use:
\`\`\`text
$ expenses add 12.50 food Lunch with team
Added #1   2026-11-03  food            $12.50  Lunch with team
$ expenses report --month 2026-11
Total $54.50 across 3 expenses
...
\`\`\`
It stores data in a CSV file, prints reports, validates every input and has a test suite. It needs **only the JDK**: no Maven, no libraries. That's deliberate: you'll see exactly what a build tool would do for you.

## Design decisions (and why)
- **Records for data, enums for fixed sets.** \`Expense\` is a record that validates itself in its compact constructor, so an invalid expense can't exist anywhere in the program.
- **\`BigDecimal\` for money.** \`0.1 + 0.2\` is \`0.30000000000000004\` in \`double\`. Money needs exact decimal arithmetic.
- **Separate pure logic from I/O.** \`Report\` is pure functions on lists (trivial to test). \`ExpenseStore\` does file I/O. \`Main\` parses arguments and prints. Each layer can be tested on its own.
- **\`Main.run\` returns an exit code** instead of calling \`System.exit\` everywhere, so tests can drive the CLI and check its output. Exit codes follow Unix conventions: 0 success, 1 bad input, 2 usage error, 3 storage error.
- **Atomic saves.** Write to a temp file, then rename it over the real file, so a crash mid-write never corrupts your data.

Work through the steps on the **Build** tab. Each step shows complete files, the command to run and what you should see.
`,
    keyPoints: [
      "Model data with validated records and enums: invalid states become unrepresentable",
      "Use BigDecimal (never double) for money",
      "Keep pure logic (Report) separate from I/O (ExpenseStore, Main)",
      "Return exit codes from a run() method so the CLI is testable",
      "Write files atomically: temp file + ATOMIC_MOVE",
      "A build script shows what Maven does: compile, test, package",
    ],
    project: {
      summary: `A complete **expense tracker CLI** in plain Java 21: \`add\`, \`list\`, \`report\` and \`delete\` commands, CSV persistence in \`~/.expenses.csv\` (or \`$EXPENSES_FILE\`), month and category filters, a text report with percentages, input validation with friendly errors, and a test suite, all packaged as \`expenses.jar\`.`,
      skills: ["records", "enums", "BigDecimal", "java.time", "java.nio.file", "streams & collectors", "exceptions", "testing", "packaging a jar"],
      tree: expensesTree,
      steps: [
        {
          title: "Model the domain: Category and Expense",
          explain: `Start with the data. A **\`Category\` enum** gives a fixed vocabulary with a forgiving parser ("Food", " food " and "FOOD" all work, and a typo gets a helpful error).

**\`Expense\` is a record** whose compact constructor validates and normalizes:
- money is a \`BigDecimal\` with at most 2 decimal places, stored as exactly 2 (\`12.5\` becomes \`12.50\`);
- the amount must be positive, the date and category present;
- the description is trimmed, single-line and not too long.

Because every \`Expense\` goes through this constructor (records have no other way in), the rest of the program never re-checks these rules. Unsaved expenses have id 0; the store assigns real ids.`,
          files: [
            {
              path: "src/main/java/expenses/Category.java",
              lang: "java",
              code: `package expenses;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

/** The fixed set of spending categories. Once parsed, a typo is impossible. */
public enum Category {
    FOOD, TRANSPORT, HOUSING, UTILITIES, HEALTH, FUN, OTHER;

    /** Case-insensitive parse with a helpful error message. */
    public static Category parse(String raw) {
        String wanted = raw.strip().toUpperCase(Locale.ROOT);
        for (Category c : values()) {
            if (c.name().equals(wanted)) return c;
        }
        throw new IllegalArgumentException("unknown category '" + raw + "' (choose from " + allLabels() + ")");
    }

    public static String allLabels() {
        return Arrays.stream(values()).map(Category::label).collect(Collectors.joining(", "));
    }

    public String label() {
        return name().toLowerCase(Locale.ROOT);
    }
}`,
            },
            {
              path: "src/main/java/expenses/Expense.java",
              lang: "java",
              code: `package expenses;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Objects;

/**
 * One expense. The compact constructor validates and normalizes every instance,
 * so an invalid Expense can't exist anywhere in the program.
 */
public record Expense(int id, LocalDate date, BigDecimal amount, Category category, String description) {
    public static final int MAX_DESCRIPTION = 120;

    public Expense {
        Objects.requireNonNull(date, "date is required");
        Objects.requireNonNull(amount, "amount is required");
        Objects.requireNonNull(category, "category is required");
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("amount must be positive, got " + amount.toPlainString());
        }
        if (amount.scale() > 2) {
            throw new IllegalArgumentException("amount can't have more than 2 decimal places: " + amount.toPlainString());
        }
        amount = amount.setScale(2, RoundingMode.UNNECESSARY);     // 12.5 -> 12.50, never rounds
        description = description == null ? "" : description.strip();
        if (description.length() > MAX_DESCRIPTION) {
            throw new IllegalArgumentException("description is longer than " + MAX_DESCRIPTION + " characters");
        }
        if (description.lines().count() > 1) {
            throw new IllegalArgumentException("description must be a single line");
        }
    }

    /** An expense that hasn't been saved yet (id 0). */
    public static Expense draft(LocalDate date, BigDecimal amount, Category category, String description) {
        return new Expense(0, date, amount, category, description);
    }

    public Expense withId(int newId) {
        return new Expense(newId, date, amount, category, description);
    }
}`,
            },
          ],
          run: `mkdir -p out/main
javac -d out/main $(find src/main/java -name '*.java')
jshell --class-path out/main
jshell> import expenses.*; import java.math.BigDecimal; import java.time.LocalDate;
jshell> Expense.draft(LocalDate.of(2026, 11, 3), new BigDecimal("12.5"), Category.parse(" Food "), " Lunch ")
jshell> Expense.draft(LocalDate.of(2026, 11, 3), new BigDecimal("-1"), Category.FOOD, "refund")`,
          output: `$4 ==> Expense[id=0, date=2026-11-03, amount=12.50, category=FOOD, description=Lunch]
|  Exception java.lang.IllegalArgumentException: amount must be positive, got -1`,
        },
        {
          title: "Persist to CSV with java.nio",
          explain: `\`ExpenseStore\` reads and writes a CSV file: a header line, then \`id,date,amount,category,description\`.

Things worth noticing:
- **Where's the file?** \`fromEnvironment()\` reads the \`EXPENSES_FILE\` environment variable and falls back to \`~/.expenses.csv\`. Tests pass their own temp path to the constructor.
- **A missing file is not an error**: it's the first run, so \`load()\` returns an empty list.
- **Quoting.** A description like \`Movie "Dune", part two\` contains a comma and quotes. Following RFC 4180, such fields are wrapped in quotes and inner quotes are doubled. \`split\` is a tiny state machine that undoes it.
- **Corrupt lines** become an \`IOException\` that names the file and line number, with the original exception as the cause.
- **Atomic save**: write a temp file in the same directory, then \`Files.move(..., ATOMIC_MOVE)\` replaces the old file in one step.
- **Ids** are \`max + 1\`, so they keep increasing as you add.`,
          files: [
            {
              path: "src/main/java/expenses/ExpenseStore.java",
              lang: "java",
              code: `package expenses;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Persists expenses as CSV: a header line, then id,date,amount,category,description. */
public final class ExpenseStore {
    static final String HEADER = "id,date,amount,category,description";

    private final Path file;

    public ExpenseStore(Path file) {
        this.file = file;
    }

    /** $EXPENSES_FILE if set, otherwise ~/.expenses.csv. */
    public static ExpenseStore fromEnvironment() {
        String configured = System.getenv("EXPENSES_FILE");
        if (configured != null && !configured.isBlank()) return new ExpenseStore(Path.of(configured));
        return new ExpenseStore(Path.of(System.getProperty("user.home"), ".expenses.csv"));
    }

    public List<Expense> load() throws IOException {
        List<Expense> result = new ArrayList<>();
        if (Files.notExists(file)) return result;                 // first run: nothing saved yet
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        for (int i = 1; i < lines.size(); i++) {                   // line 0 is the header
            String line = lines.get(i);
            if (line.isBlank()) continue;
            try {
                result.add(parse(line));
            } catch (RuntimeException e) {
                throw new IOException(file + " line " + (i + 1) + " is corrupt: " + e.getMessage(), e);
            }
        }
        return result;
    }

    /** Writes a temp file, then renames it over the real one: a crash never leaves half a file. */
    public void save(List<Expense> expenses) throws IOException {
        Path target = file.toAbsolutePath();
        Files.createDirectories(target.getParent());
        List<String> lines = new ArrayList<>(expenses.size() + 1);
        lines.add(HEADER);
        for (Expense e : expenses) lines.add(format(e));
        Path tmp = Files.createTempFile(target.getParent(), ".expenses", ".tmp");
        try {
            Files.write(tmp, lines, StandardCharsets.UTF_8);
            Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(tmp);                              // only still there if something failed
        }
    }

    public Expense add(Expense draft) throws IOException {
        List<Expense> all = load();
        int nextId = all.stream().mapToInt(Expense::id).max().orElse(0) + 1;
        Expense saved = draft.withId(nextId);
        all.add(saved);
        save(all);
        return saved;
    }

    public boolean delete(int id) throws IOException {
        List<Expense> all = load();
        boolean removed = all.removeIf(e -> e.id() == id);
        if (removed) save(all);
        return removed;
    }

    // ---- CSV encoding ----------------------------------------------------------

    static String format(Expense e) {
        return String.join(",",
            Integer.toString(e.id()),
            e.date().toString(),                                    // ISO-8601, e.g. 2026-11-03
            e.amount().toPlainString(),
            e.category().label(),
            quote(e.description()));
    }

    static Expense parse(String line) {
        List<String> f = split(line);
        if (f.size() != 5) throw new IllegalArgumentException("expected 5 fields, found " + f.size());
        return new Expense(Integer.parseInt(f.get(0)), LocalDate.parse(f.get(1)), new BigDecimal(f.get(2)), Category.parse(f.get(3)), f.get(4));
    }

    /** Quotes a field containing a comma or quote, doubling inner quotes (RFC 4180). */
    static String quote(String s) {
        if (s.indexOf(',') < 0 && s.indexOf('"') < 0) return s;
        return '"' + s.replace("\\"", "\\"\\"") + '"';
    }

    /** Splits one CSV line, honoring quoted fields. */
    static List<String> split(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');                             // "" inside quotes is one quote
                    i++;
                } else if (c == '"') {
                    inQuotes = false;
                } else {
                    current.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        if (inQuotes) throw new IllegalArgumentException("unterminated quote");
        fields.add(current.toString());
        return fields;
    }
}`,
            },
          ],
          run: `javac -d out/main $(find src/main/java -name '*.java')
jshell --class-path out/main
jshell> import expenses.*; import java.math.BigDecimal; import java.time.LocalDate; import java.nio.file.Path;
jshell> new ExpenseStore(Path.of("/tmp/demo.csv")).add(Expense.draft(LocalDate.of(2026, 11, 2), new BigDecimal("8.2"), Category.FUN, "Movie \\"Dune\\", part two"))
jshell> /exit
cat /tmp/demo.csv`,
          output: `$5 ==> Expense[id=1, date=2026-11-02, amount=8.20, category=FUN, description=Movie "Dune", part two]
id,date,amount,category,description
1,2026-11-02,8.20,fun,"Movie ""Dune"", part two"`,
        },
        {
          title: "Reports with streams",
          explain: `\`Report\` is a set of **pure functions**: lists in, values out, no files and no printing. That makes it the easiest part to test and to reuse (a web UI could call the same methods).

- \`total\` reduces amounts with \`BigDecimal::add\` starting from \`ZERO\`.
- \`byCategory\` groups into an \`EnumMap\` and sums with the \`reducing\` collector, then sorts by amount (largest first) into a \`LinkedHashMap\` to keep that order.
- \`byMonth\` groups by \`YearMonth\` into a \`TreeMap\`, so months come out in calendar order.
- \`largest\` sorts by amount descending, breaking ties by id so output is deterministic.
- \`render\` builds the report as lines, with a percentage and a little bar per category. Percentages use \`divide(total, 1, HALF_UP)\`: with \`BigDecimal\` you always say how to round a division.
- Formatting uses \`Locale.US\` explicitly so \`$1,200.00\` looks the same on every machine.`,
          files: [
            {
              path: "src/main/java/expenses/Report.java",
              lang: "java",
              code: `package expenses;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.stream.Collectors;

/** Pure functions over expenses: no I/O, easy to test. */
public final class Report {
    private Report() {}

    public static BigDecimal total(List<Expense> expenses) {
        return expenses.stream().map(Expense::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Totals per category, largest first. */
    public static Map<Category, BigDecimal> byCategory(List<Expense> expenses) {
        Map<Category, BigDecimal> totals = expenses.stream().collect(Collectors.groupingBy(
            Expense::category,
            () -> new EnumMap<>(Category.class),
            Collectors.reducing(BigDecimal.ZERO, Expense::amount, BigDecimal::add)));
        return totals.entrySet().stream()
            .sorted(Map.Entry.<Category, BigDecimal>comparingByValue().reversed()
                .thenComparing(Map.Entry.<Category, BigDecimal>comparingByKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    /** Totals per month, in calendar order. */
    public static SortedMap<YearMonth, BigDecimal> byMonth(List<Expense> expenses) {
        return expenses.stream().collect(Collectors.groupingBy(
            e -> YearMonth.from(e.date()),
            TreeMap::new,
            Collectors.reducing(BigDecimal.ZERO, Expense::amount, BigDecimal::add)));
    }

    public static List<Expense> largest(List<Expense> expenses, int n) {
        return expenses.stream()
            .sorted(Comparator.comparing(Expense::amount).reversed().thenComparingInt(Expense::id))
            .limit(n)
            .toList();
    }

    /** A null month or category means "don't filter on it". */
    public static List<Expense> filter(List<Expense> expenses, YearMonth month, Category category) {
        return expenses.stream()
            .filter(e -> month == null || YearMonth.from(e.date()).equals(month))
            .filter(e -> category == null || e.category() == category)
            .sorted(Comparator.comparing(Expense::date).thenComparingInt(Expense::id))
            .toList();
    }

    public static String money(BigDecimal amount) {
        return String.format(Locale.US, "$%,.2f", amount);
    }

    public static String row(Expense e) {
        return String.format(Locale.US, "#%-3d %s  %-10s %11s  %s",
            e.id(), e.date(), e.category().label(), money(e.amount()), e.description()).stripTrailing();
    }

    /** The full text report, one string per line. */
    public static List<String> render(List<Expense> expenses) {
        List<String> lines = new ArrayList<>();
        BigDecimal total = total(expenses);
        lines.add("Total " + money(total) + " across " + expenses.size() + (expenses.size() == 1 ? " expense" : " expenses"));
        if (expenses.isEmpty()) return lines;

        lines.add("");
        lines.add("By category");
        byCategory(expenses).forEach((category, sum) -> {
            BigDecimal percent = sum.multiply(BigDecimal.valueOf(100)).divide(total, 1, RoundingMode.HALF_UP);
            String bar = "#".repeat(percent.intValue() / 5);       // one # per 5%
            lines.add(String.format(Locale.US, "  %-10s %11s %6s%%  %s",
                category.label(), money(sum), percent.toPlainString(), bar).stripTrailing());
        });

        lines.add("");
        lines.add("By month");
        byMonth(expenses).forEach((month, sum) -> lines.add(String.format(Locale.US, "  %-10s %11s", month, money(sum))));

        lines.add("");
        lines.add("Largest");
        largest(expenses, 3).forEach(e -> lines.add("  " + row(e)));
        return lines;
    }
}`,
            },
          ],
        },
        {
          title: "The command-line interface",
          explain: `\`Main\` turns arguments into calls. The important design choice: **\`main\` is two lines**. All the work happens in \`run(args, store, out, err, today)\`, which takes its dependencies as parameters and **returns an exit code**. Tests can call it with a temp store, a fixed date and captured output, and nothing ever calls \`System.exit\` in the middle of a test.

Other details:
- A small \`Options\` record parses \`--date\`, \`--month\` and \`--category\` flags and collects everything else as positional arguments, so \`add 12.50 food Lunch with team\` works without quotes.
- **Errors are values for the user, not stack traces.** Invalid input (\`IllegalArgumentException\`, which includes \`NumberFormatException\`) prints \`error: ...\` and returns 1; unknown commands return 2; disk problems return 3.
- The help text is a text block with \`formatted\`.`,
          files: [
            {
              path: "src/main/java/expenses/Main.java",
              lang: "java",
              code: `package expenses;

import java.io.IOException;
import java.io.PrintStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Command-line entry point. The logic lives in run() so tests can call it. */
public final class Main {
    private Main() {}

    public static void main(String[] args) {
        int code = run(args, ExpenseStore.fromEnvironment(), System.out, System.err, LocalDate.now());
        System.exit(code);
    }

    static int run(String[] args, ExpenseStore store, PrintStream out, PrintStream err, LocalDate today) {
        if (args.length == 0 || List.of("help", "-h", "--help").contains(args[0])) {
            usage(out);
            return 0;
        }
        String[] rest = Arrays.copyOfRange(args, 1, args.length);
        try {
            switch (args[0]) {
                case "add" -> add(rest, store, out, today);
                case "list" -> list(rest, store, out);
                case "report" -> report(rest, store, out);
                case "delete" -> delete(rest, store, out);
                default -> {
                    err.println("unknown command '" + args[0] + "'");
                    usage(err);
                    return 2;
                }
            }
            return 0;
        } catch (IllegalArgumentException e) {                   // bad input from the user
            err.println("error: " + e.getMessage());
            return 1;
        } catch (IOException e) {                                // problems with the data file
            err.println("storage error: " + e.getMessage());
            return 3;
        }
    }

    /** add <amount> <category> <description...> [--date YYYY-MM-DD] */
    private static void add(String[] args, ExpenseStore store, PrintStream out, LocalDate today) throws IOException {
        Options o = Options.parse(args);
        List<String> p = o.positional();
        if (p.size() < 3) throw new IllegalArgumentException("usage: add <amount> <category> <description> [--date YYYY-MM-DD]");
        BigDecimal amount = parseAmount(p.get(0));
        Category category = Category.parse(p.get(1));
        String description = String.join(" ", p.subList(2, p.size()));
        LocalDate date = o.date() != null ? o.date() : today;
        Expense saved = store.add(Expense.draft(date, amount, category, description));
        out.println("Added " + Report.row(saved));
    }

    /** list [--month YYYY-MM] [--category NAME] */
    private static void list(String[] args, ExpenseStore store, PrintStream out) throws IOException {
        Options o = Options.parse(args);
        List<Expense> shown = Report.filter(store.load(), o.month(), o.category());
        if (shown.isEmpty()) {
            out.println("No expenses found.");
            return;
        }
        shown.forEach(e -> out.println(Report.row(e)));
        out.println("Total " + Report.money(Report.total(shown)));
    }

    /** report [--month YYYY-MM] [--category NAME] */
    private static void report(String[] args, ExpenseStore store, PrintStream out) throws IOException {
        Options o = Options.parse(args);
        Report.render(Report.filter(store.load(), o.month(), o.category())).forEach(out::println);
    }

    /** delete <id> */
    private static void delete(String[] args, ExpenseStore store, PrintStream out) throws IOException {
        if (args.length != 1) throw new IllegalArgumentException("usage: delete <id>");
        int id = parseId(args[0]);
        if (!store.delete(id)) throw new IllegalArgumentException("no expense with id " + id);
        out.println("Deleted #" + id);
    }

    static BigDecimal parseAmount(String raw) {
        try {
            return new BigDecimal(raw.strip());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("not a valid amount: '" + raw + "'");
        }
    }

    static int parseId(String raw) {
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("not a valid id: '" + raw + "'");
        }
    }

    /** Flags (--date, --month, --category) plus positional arguments. */
    private record Options(List<String> positional, LocalDate date, YearMonth month, Category category) {
        static Options parse(String[] args) {
            List<String> positional = new ArrayList<>();
            LocalDate date = null;
            YearMonth month = null;
            Category category = null;
            for (int i = 0; i < args.length; i++) {
                String arg = args[i];
                if (!arg.startsWith("--")) {
                    positional.add(arg);
                    continue;
                }
                if (i + 1 >= args.length) throw new IllegalArgumentException(arg + " needs a value");
                String value = args[++i];
                try {
                    switch (arg) {
                        case "--date" -> date = LocalDate.parse(value);
                        case "--month" -> month = YearMonth.parse(value);
                        case "--category" -> category = Category.parse(value);
                        default -> throw new IllegalArgumentException("unknown option " + arg);
                    }
                } catch (DateTimeParseException e) {
                    throw new IllegalArgumentException("bad value for " + arg + ": '" + value + "'");
                }
            }
            return new Options(positional, date, month, category);
        }
    }

    private static void usage(PrintStream out) {
        out.println("""
            expenses: track spending from the command line

            usage:
              expenses add <amount> <category> <description> [--date YYYY-MM-DD]
              expenses list [--month YYYY-MM] [--category NAME]
              expenses report [--month YYYY-MM] [--category NAME]
              expenses delete <id>

            categories: %s
            data file:  $EXPENSES_FILE, or ~/.expenses.csv""".formatted(Category.allLabels()));
    }
}`,
            },
          ],
          run: `javac -d out/main $(find src/main/java -name '*.java')
export EXPENSES_FILE=/tmp/expenses-demo.csv
alias expenses='java -cp out/main expenses.Main'
expenses add 1200 housing Rent --date 2026-10-01
expenses add 30 food Groceries --date 2026-10-15
expenses add 12.50 food "Lunch, with team" --date 2026-11-02
expenses add 20 transport Train --date 2026-11-03
expenses add 22 fun Concert --date 2026-11-03
expenses list --month 2026-11
expenses report
expenses add 5 snacks Chips; echo "exit code $?"`,
          output: `Added #1   2026-10-01  housing      $1,200.00  Rent
Added #2   2026-10-15  food            $30.00  Groceries
Added #3   2026-11-02  food            $12.50  Lunch, with team
Added #4   2026-11-03  transport       $20.00  Train
Added #5   2026-11-03  fun             $22.00  Concert
#3   2026-11-02  food            $12.50  Lunch, with team
#4   2026-11-03  transport       $20.00  Train
#5   2026-11-03  fun             $22.00  Concert
Total $54.50
Total $1,284.50 across 5 expenses

By category
  housing      $1,200.00   93.4%  ##################
  food            $42.50    3.3%
  fun             $22.00    1.7%
  transport       $20.00    1.6%

By month
  2026-10      $1,230.00
  2026-11         $54.50

Largest
  #1   2026-10-01  housing      $1,200.00  Rent
  #2   2026-10-15  food            $30.00  Groceries
  #5   2026-11-03  fun             $22.00  Concert
error: unknown category 'snacks' (choose from food, transport, housing, utilities, health, fun, other)
exit code 1`,
        },
        {
          title: "Tests without a framework",
          explain: `Real projects use JUnit (see the tooling chapter), but a test is just code that checks other code. This file contains a **15-line test runner**: \`test(name, body)\` runs a lambda and records pass or fail; \`check\`, \`checkEquals\` and \`checkThrows\` are the assertions.

What the tests cover, and why:
- **Validation rules** at their boundaries: zero, negative, three decimal places, missing date.
- **CSV round-trip** with the nasty case (commas *and* quotes) and the exact encoded string.
- **The store** against a real temp file: ids, delete, and a *second* store instance reading what the first wrote.
- **Reports** on a fixed data set with known answers.
- **The CLI** through \`Main.run\` with captured output and every exit code.

Notice there's no mocking anywhere: pure functions and temp files make the code easy to test as it is.`,
          files: [
            {
              path: "src/test/java/expenses/ExpenseTests.java",
              lang: "java",
              code: `package expenses;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

/** A tiny test runner so the project needs nothing but the JDK. With Maven, these would be JUnit tests. */
public final class ExpenseTests {
    interface TestBody {
        void run() throws Exception;
    }

    private static int passed = 0;
    private static int failed = 0;

    public static void main(String[] args) {
        test("amounts are normalized to cents", ExpenseTests::amountsAreNormalized);
        test("invalid expenses are rejected", ExpenseTests::invalidExpensesAreRejected);
        test("categories parse case-insensitively", ExpenseTests::categoriesParse);
        test("CSV round-trips commas and quotes", ExpenseTests::csvRoundTrip);
        test("the store assigns ids and persists", ExpenseTests::storePersists);
        test("reports group and rank correctly", ExpenseTests::reports);
        test("CLI commands and exit codes", ExpenseTests::cliCommands);
        System.out.println(passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }

    static void test(String name, TestBody body) {
        try {
            body.run();
            passed++;
            System.out.println("  ok    " + name);
        } catch (Exception | AssertionError e) {
            failed++;
            System.out.println("  FAIL  " + name + ": " + e);
        }
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    static void checkEquals(Object expected, Object actual) {
        if (!expected.equals(actual)) throw new AssertionError("expected <" + expected + "> but was <" + actual + ">");
    }

    static void checkThrows(Class<? extends Throwable> type, TestBody body) {
        try {
            body.run();
        } catch (Throwable t) {
            if (type.isInstance(t)) return;
            throw new AssertionError("expected " + type.getSimpleName() + " but got " + t);
        }
        throw new AssertionError("expected " + type.getSimpleName() + " but nothing was thrown");
    }

    static Expense expense(String date, String amount, Category category, String text) {
        return Expense.draft(LocalDate.parse(date), new BigDecimal(amount), category, text);
    }

    static Path tempFile() throws IOException {
        return Files.createTempDirectory("expenses-test").resolve("data.csv");
    }

    // ---- tests ---------------------------------------------------------------------

    static void amountsAreNormalized() {
        checkEquals(new BigDecimal("12.50"), expense("2026-11-01", "12.5", Category.FOOD, "x").amount());
        checkEquals("Lunch", expense("2026-11-01", "1", Category.FOOD, "  Lunch ").description());
    }

    static void invalidExpensesAreRejected() {
        checkThrows(IllegalArgumentException.class, () -> expense("2026-11-01", "0", Category.FOOD, "free?"));
        checkThrows(IllegalArgumentException.class, () -> expense("2026-11-01", "-3", Category.FOOD, "refund"));
        checkThrows(IllegalArgumentException.class, () -> expense("2026-11-01", "1.999", Category.FOOD, "a fraction of a cent"));
        checkThrows(NullPointerException.class, () -> Expense.draft(null, BigDecimal.ONE, Category.FOOD, "no date"));
    }

    static void categoriesParse() {
        checkEquals(Category.FOOD, Category.parse(" Food "));
        checkThrows(IllegalArgumentException.class, () -> Category.parse("snacks"));
    }

    static void csvRoundTrip() {
        Expense e = expense("2026-11-02", "8.20", Category.FUN, "Movie \\"Dune\\", part two").withId(7);
        String line = ExpenseStore.format(e);
        checkEquals("7,2026-11-02,8.20,fun,\\"Movie \\"\\"Dune\\"\\", part two\\"", line);
        checkEquals(e, ExpenseStore.parse(line));
    }

    static void storePersists() throws IOException {
        Path file = tempFile();
        ExpenseStore store = new ExpenseStore(file);
        checkEquals(List.of(), store.load());                                  // missing file = empty
        checkEquals(1, store.add(expense("2026-11-01", "5", Category.FOOD, "coffee")).id());
        checkEquals(2, store.add(expense("2026-11-01", "7", Category.FOOD, "bagel")).id());
        check(store.delete(1), "delete should report success");
        check(!store.delete(99), "deleting a missing id should return false");
        List<Expense> reloaded = new ExpenseStore(file).load();                // a fresh store reads the file
        checkEquals(1, reloaded.size());
        checkEquals("bagel", reloaded.get(0).description());
        checkEquals(3, store.add(expense("2026-11-03", "1", Category.OTHER, "gum")).id());
    }

    static void reports() {
        List<Expense> xs = List.of(
            expense("2026-10-01", "1200", Category.HOUSING, "rent").withId(1),
            expense("2026-10-15", "30", Category.FOOD, "groceries").withId(2),
            expense("2026-11-02", "12.50", Category.FOOD, "lunch").withId(3),
            expense("2026-11-03", "20", Category.TRANSPORT, "train").withId(4));
        checkEquals(new BigDecimal("1262.50"), Report.total(xs));
        Map<Category, BigDecimal> byCategory = Report.byCategory(xs);
        checkEquals(List.of(Category.HOUSING, Category.FOOD, Category.TRANSPORT), List.copyOf(byCategory.keySet()));
        checkEquals(new BigDecimal("42.50"), byCategory.get(Category.FOOD));
        checkEquals(new BigDecimal("32.50"), Report.byMonth(xs).get(YearMonth.of(2026, 11)));
        checkEquals(List.of(1, 2), Report.largest(xs, 2).stream().map(Expense::id).toList());
        checkEquals(1, Report.filter(xs, YearMonth.of(2026, 11), Category.FOOD).size());
    }

    static void cliCommands() throws IOException {
        ExpenseStore store = new ExpenseStore(tempFile());
        LocalDate today = LocalDate.of(2026, 11, 3);
        checkEquals(0, exitCode(store, today, "add", "12.5", "food", "Lunch", "with", "team"));
        checkEquals(0, exitCode(store, today, "add", "1200", "housing", "Rent", "--date", "2026-10-01"));
        String listed = output(store, today, "list", "--month", "2026-11");
        check(listed.contains("Lunch with team") && !listed.contains("Rent"), "list should filter by month: " + listed);
        String report = output(store, today, "report");
        check(report.contains("Total $1,212.50 across 2 expenses"), "unexpected report: " + report);
        checkEquals(1, exitCode(store, today, "add", "-5", "food", "refund"));       // invalid amount
        checkEquals(1, exitCode(store, today, "add", "5", "snacks", "chips"));       // unknown category
        checkEquals(1, exitCode(store, today, "add", "5", "food", "x", "--date", "2026-13-01"));
        checkEquals(1, exitCode(store, today, "delete", "42"));                      // no such id
        checkEquals(2, exitCode(store, today, "fly"));                               // unknown command
        checkEquals(0, exitCode(store, today, "delete", "1"));
        checkEquals(1, store.load().size());
    }

    static int exitCode(ExpenseStore store, LocalDate today, String... args) {
        PrintStream sink = new PrintStream(new ByteArrayOutputStream(), true, StandardCharsets.UTF_8);
        return Main.run(args, store, sink, sink, today);
    }

    static String output(ExpenseStore store, LocalDate today, String... args) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        PrintStream out = new PrintStream(bytes, true, StandardCharsets.UTF_8);
        int code = Main.run(args, store, out, out, today);
        check(code == 0, "exit code " + code);
        return bytes.toString(StandardCharsets.UTF_8);
    }
}`,
            },
          ],
          run: `javac -d out/main $(find src/main/java -name '*.java')
javac -cp out/main -d out/test $(find src/test/java -name '*.java')
java -cp out/main:out/test expenses.ExpenseTests`,
          output: `  ok    amounts are normalized to cents
  ok    invalid expenses are rejected
  ok    categories parse case-insensitively
  ok    CSV round-trips commas and quotes
  ok    the store assigns ids and persists
  ok    reports group and rank correctly
  ok    CLI commands and exit codes
7 passed, 0 failed`,
        },
        {
          title: "Build and package a runnable jar",
          explain: `\`build.sh\` does what Maven's \`package\` phase does, in four commands: compile main code, compile tests against it, **run the tests** (a failure stops the build because of \`set -e\` and the test runner's exit code), and create a jar whose manifest names the main class.

\`--release 21\` makes \`javac\` check your code against the Java 21 API even when you build with a newer JDK, so the jar runs on any Java 21+ runtime.

Then make it feel like a real command with a tiny wrapper script on your \`PATH\`. From here, moving to Maven is mechanical: the folders already follow the standard layout (\`src/main/java\`, \`src/test/java\`).`,
          files: [
            {
              path: "build.sh",
              lang: "bash",
              code: `#!/usr/bin/env bash
# Compile, test and package without Maven or Gradle.
set -euo pipefail

BIN="\${JAVA_HOME:+$JAVA_HOME/bin/}"     # use $JAVA_HOME if set, else whatever is on PATH
rm -rf out expenses.jar
mkdir -p out/main out/test

"\${BIN}javac" --release 21 -d out/main $(find src/main/java -name '*.java')
"\${BIN}javac" --release 21 -cp out/main -d out/test $(find src/test/java -name '*.java')
"\${BIN}java" -cp out/main:out/test expenses.ExpenseTests
"\${BIN}jar" --create --file expenses.jar --main-class expenses.Main -C out/main .

echo "built expenses.jar"`,
            },
          ],
          run: `bash build.sh
java -jar expenses.jar help

# make it a real command
mkdir -p ~/bin
printf '#!/bin/sh\\nexec java -jar %s "$@"\\n' "$PWD/expenses.jar" > ~/bin/expenses
chmod +x ~/bin/expenses     # ~/bin must be on your PATH
expenses report --month 2026-11`,
          output: `  ok    amounts are normalized to cents
  ...
7 passed, 0 failed
built expenses.jar
expenses: track spending from the command line

usage:
  expenses add <amount> <category> <description> [--date YYYY-MM-DD]
  expenses list [--month YYYY-MM] [--category NAME]
  expenses report [--month YYYY-MM] [--category NAME]
  expenses delete <id>

categories: food, transport, housing, utilities, health, fun, other
data file:  $EXPENSES_FILE, or ~/.expenses.csv`,
        },
      ],
      extensions: [
        "Add a `budget` command: store a monthly limit per category and warn when a month goes over it.",
        "Export: `report --format json` using a hand-written JSON writer, then try the same with Jackson in a Maven project.",
        "Move to Maven: add a pom.xml, convert ExpenseTests into JUnit 5 + AssertJ tests, and add picocli for argument parsing.",
        "Swap the CSV file for SQLite through JDBC (org.xerial:sqlite-jdbc) behind the same ExpenseStore methods.",
        "Add recurring expenses (rent every month) generated on startup for months that are missing them.",
        "Compile it to a native binary with GraalVM `native-image -jar expenses.jar` and compare startup time.",
      ],
      verify: `bash build.sh && export EXPENSES_FILE="$PWD/data/expenses.csv" && J="\${JAVA_HOME:+$JAVA_HOME/bin/}java" && "$J" -jar expenses.jar add 1200 housing Rent --date 2026-10-01 && "$J" -jar expenses.jar add 12.50 food "Lunch, with team" --date 2026-11-02 && "$J" -jar expenses.jar list --month 2026-11 | grep -qF 'Lunch, with team' && "$J" -jar expenses.jar report | grep -qF 'Total $1,212.50 across 2 expenses' && ! "$J" -jar expenses.jar add -5 food refund 2>/dev/null`,
    },
    interview: [
      {
        q: "Why use BigDecimal instead of double for money?",
        a: "`double` is binary floating point: most decimal fractions (0.1, 0.2) can't be represented exactly, so sums drift (`0.1 + 0.2 == 0.30000000000000004`) and rounding errors accumulate. `BigDecimal` stores an exact unscaled integer plus a scale, so decimal arithmetic is exact, and every division must specify a scale and `RoundingMode`. Create it from a String (`new BigDecimal(\"0.10\")`) or `BigDecimal.valueOf(double)`, never `new BigDecimal(0.1)`. Remember that `equals` is scale-sensitive (`2.0` ≠ `2.00`); use `compareTo` for numeric equality. Alternatives: store integer cents in a `long`, or use a money library (JSR 354 Moneta).",
        freq: "very-common",
      },
      {
        q: "How would you make a CLI tool testable?",
        a: "Keep `main` trivial and move logic into a method that receives its dependencies (arguments, input/output streams, the clock or current date, the storage) and returns an exit code instead of calling `System.exit`. Separate pure logic (parsing, calculations, formatting) from I/O so most tests need no files at all, and use temp directories for the rest. Then tests can run the full command path in-process and assert on output and exit codes.",
        freq: "common",
      },
      {
        q: "How do you write a file safely so a crash can't corrupt it?",
        a: "Write the new content to a temporary file in the same directory (same filesystem), flush/close it, then atomically rename it over the original (`Files.move` with `ATOMIC_MOVE` and `REPLACE_EXISTING`). Readers see either the old file or the new one, never a partial write. For stronger durability, also fsync the file (FileChannel.force) before renaming. Databases go further with write-ahead logs.",
      },
    ],
    quiz: [
      {
        q: "Why does the project validate inside the record's compact constructor?",
        options: ["It's faster", "Every Expense must pass through it, so invalid ones can't exist", "Records require it", "To support serialization"],
        answer: 1,
        explain: "Validating at construction makes the invariant hold everywhere in the program.",
      },
      {
        q: "`new BigDecimal(\"12.5\").setScale(2, RoundingMode.UNNECESSARY)` gives...",
        options: ["12.5", "12.50", "An ArithmeticException", "13"],
        answer: 1,
        explain: "Increasing the scale never needs rounding, so UNNECESSARY is safe here.",
      },
      {
        q: "Why does Main.run return an int instead of calling System.exit?",
        options: ["System.exit is deprecated", "So tests can call it and check exit codes without killing the JVM", "ints are faster", "To support Windows"],
        answer: 1,
        explain: "System.exit would terminate the test runner itself.",
      },
      {
        q: "How is the CSV field `Movie \"Dune\", part two` encoded?",
        options: ["Movie \"Dune\", part two", "\"Movie \"\"Dune\"\", part two\"", "Movie \\\"Dune\\\", part two", "It can't be stored"],
        answer: 1,
        explain: "RFC 4180: wrap in quotes and double the inner quotes.",
      },
      {
        q: "What does `javac --release 21` guarantee when compiling with JDK 25?",
        options: ["Nothing", "The code only uses Java 21 language features and APIs, so it runs on Java 21+", "The jar is smaller", "Tests are skipped"],
        answer: 1,
        explain: "--release checks against the target platform's API, not just the bytecode version.",
      },
    ],
  },

  // ------------------------------------------------------------------ PROJECT: SPRING API
  {
    id: "java-project-api",
    stage: "Projects",
    title: "Project: a Spring Boot REST API",
    tagline: "Build a production-shaped Bookmarks API: Spring Boot 4, JPA with Flyway migrations, validation, ProblemDetail errors, paging, tests, Actuator and Docker.",
    difficulty: "advanced",
    minutes: 90,
    concept: `
## What you'll build
A REST API for saving bookmarks, built the way professional Spring teams build services:
\`\`\`text
GET    /api/bookmarks?q=spring&page=0&size=20   search + paging
GET    /api/bookmarks/{id}
POST   /api/bookmarks                           201 + Location header
PUT    /api/bookmarks/{id}
DELETE /api/bookmarks/{id}                      204
GET    /actuator/health                         for load balancers and Kubernetes
\`\`\`
## The architecture
\`\`\`text
HTTP ─► BookmarkController ─► BookmarkService ─► BookmarkRepository ─► H2 (dev/tests) or PostgreSQL (prod)
             │ DTO records          │ @Transactional       │ Spring Data JPA       ▲
             │ @Valid               │ domain rules         │                       │ Flyway migrations
             ▼                      ▼
         ApiErrors: exceptions → RFC 9457 ProblemDetail JSON
\`\`\`
## What you need
- **JDK 21+** and **Maven 3.9+** (or generate the project with the Maven wrapper from [start.spring.io](https://start.spring.io)).
- Docker, only for the last step.

Read the **Spring Boot chapter** first if DI, controllers or \`@Transactional\` are new. Then follow the **Build** tab step by step. By the end you'll have a service you could deploy, and talking points for "walk me through an API you built" in interviews.
`,
    keyPoints: [
      "Generate the skeleton with start.spring.io; one starter per capability",
      "Flyway owns the schema; Hibernate maps it (ddl-auto none/validate)",
      "Entities stay inside; records are the API contract",
      "Services hold the rules and the transactions; controllers stay thin",
      "One @RestControllerAdvice turns exceptions into ProblemDetail",
      "Test through HTTP with MockMvc against the whole application",
      "Configure per environment with profiles and environment variables",
    ],
    project: {
      summary: `A **Bookmarks REST API** on Spring Boot 4 and Java 21: CRUD endpoints with validation, search and paging, Flyway-managed schema on H2 (dev and tests) and PostgreSQL (production), RFC 9457 error responses, MockMvc tests over the whole app, Actuator health checks, virtual threads, and a Dockerfile plus Compose file to run it with Postgres.`,
      skills: ["Spring Boot 4", "dependency injection", "Spring MVC", "Bean Validation", "Spring Data JPA", "Flyway", "ProblemDetail", "MockMvc testing", "profiles & config", "Docker"],
      tree: bookmarksTree,
      steps: [
        {
          title: "Generate the project",
          explain: `Go to **start.spring.io** and choose: Maven, Java 21, Spring Boot 4.x, group \`com.example\`, artifact \`bookmarks\`, and the dependencies **Spring Web**, **Spring Data JPA**, **Validation**, **Flyway Migration**, **H2 Database**, **PostgreSQL Driver** and **Spring Boot Actuator**. Download, unzip, and open it in your IDE. (The generated project includes the Maven wrapper, \`./mvnw\`, so Maven doesn't even need to be installed.)

Compare what you got with the \`pom.xml\` here:
- The **parent** \`spring-boot-starter-parent\` manages the versions of hundreds of libraries, so most dependencies have no \`<version>\`.
- Each **starter** pulls in a coherent set of libraries plus auto-configuration.
- The database drivers are \`runtime\` scope: you never compile against them.
- \`flyway-database-postgresql\` adds Postgres support to Flyway (it's a separate module in recent Flyway versions).

The application class gets one extra bean: a \`Clock\`, so code that needs "now" can be tested with a fixed time. \`@ConfigurationPropertiesScan\` finds the \`AppProperties\` record. The YAML config enables virtual threads and turns off open-session-in-view.`,
          files: [
            {
              path: "pom.xml",
              lang: "xml",
              code: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.1.2</version>
    <relativePath/>
  </parent>

  <groupId>com.example</groupId>
  <artifactId>bookmarks</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>bookmarks</name>

  <properties>
    <java.version>21</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-webmvc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-flyway</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-database-postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>com.h2database</groupId>
      <artifactId>h2</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>`,
            },
            {
              path: "src/main/java/com/example/bookmarks/BookmarksApplication.java",
              lang: "java",
              code: `package com.example.bookmarks;

import java.time.Clock;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
@ConfigurationPropertiesScan
public class BookmarksApplication {

    public static void main(String[] args) {
        SpringApplication.run(BookmarksApplication.class, args);
    }

    /** Inject "now" instead of calling Instant.now() everywhere: tests can supply a fixed clock. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}`,
            },
            {
              path: "src/main/java/com/example/bookmarks/AppProperties.java",
              lang: "java",
              code: `package com.example.bookmarks;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Typed view of the app.* properties in application.yml. */
@ConfigurationProperties("app")
public record AppProperties(@DefaultValue("50") int maxPageSize) {}`,
            },
            {
              path: "src/main/resources/application.yml",
              lang: "yaml",
              code: `spring:
  application:
    name: bookmarks
  datasource:
    url: jdbc:h2:mem:bookmarks;DB_CLOSE_DELAY=-1   # in-memory database for dev and tests
  jpa:
    open-in-view: false        # no lazy loading during JSON rendering
    hibernate:
      ddl-auto: none           # Flyway owns the schema
  threads:
    virtual:
      enabled: true            # each request runs on a virtual thread

app:
  max-page-size: 50

management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      probes:
        enabled: true          # /actuator/health/liveness and /readiness`,
            },
          ],
          run: `./mvnw spring-boot:run          # or: mvn spring-boot:run
curl -s localhost:8080/actuator/health`,
          output: `{"groups":["liveness","readiness"],"status":"UP"}`,
        },
        {
          title: "The schema, the entity and the repository",
          explain: `**Flyway** runs every \`src/main/resources/db/migration/V<n>__<name>.sql\` file once, in order, and records it in a \`flyway_schema_history\` table. Never edit a migration that has run anywhere; add \`V2__...\` instead. The same SQL works on H2 and Postgres here.

**The entity** maps a table row to an object. JPA requires a no-arg constructor (it can be \`protected\`). There are getters but no public setters: changes go through \`update(...)\`, a method with a meaningful name.

**The repository** is just an interface. Spring Data generates the implementation at startup, including \`findByTitleContainingIgnoreCase\`, derived from the method name: \`WHERE lower(title) LIKE lower('%' || ? || '%')\` with paging and sorting from the \`Pageable\`.`,
          files: [
            {
              path: "src/main/resources/db/migration/V1__create_bookmark.sql",
              lang: "sql",
              code: `CREATE TABLE bookmark (
    id         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    url        VARCHAR(2048)            NOT NULL,
    title      VARCHAR(200)             NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_bookmark_created_at ON bookmark (created_at);`,
            },
            {
              path: "src/main/java/com/example/bookmarks/Bookmark.java",
              lang: "java",
              code: `package com.example.bookmarks;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "bookmark")
public class Bookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)    // the database generates ids
    private Long id;

    @Column(nullable = false, length = 2048)
    private String url;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Bookmark() {}                                 // required by JPA

    public Bookmark(String url, String title, Instant now) {
        this.url = url;
        this.title = title;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(String url, String title, Instant now) {
        this.url = url;
        this.title = title;
        this.updatedAt = now;
    }

    public Long getId() { return id; }
    public String getUrl() { return url; }
    public String getTitle() { return title; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}`,
            },
            {
              path: "src/main/java/com/example/bookmarks/BookmarkRepository.java",
              lang: "java",
              code: `package com.example.bookmarks;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {

    /** Derived query: WHERE lower(title) LIKE %text%, with paging and sorting from the Pageable. */
    Page<Bookmark> findByTitleContainingIgnoreCase(String text, Pageable pageable);
}`,
            },
          ],
          run: `./mvnw spring-boot:run
# the log shows Flyway applying the migration:
#   Migrating schema "PUBLIC" to version "1 - create bookmark"
#   Successfully applied 1 migration`,
        },
        {
          title: "DTOs and the service layer",
          explain: `**DTOs are the API contract.** \`BookmarkRequest\` is what clients send, with Bean Validation constraints on each component. \`BookmarkResponse\` is what they get back. \`PageResponse\` is our own paging envelope, so the JSON shape doesn't depend on Spring's internal \`Page\` class. The entity never leaves the service.

**The service** holds the use cases and the transaction boundaries:
- \`@Transactional(readOnly = true)\` on the class makes queries efficient; write methods override it with plain \`@Transactional\`.
- In \`update\`, there's no \`save()\` call: inside a transaction, Hibernate **detects changes** to managed entities (dirty checking) and issues the UPDATE at commit.
- Not found is an exception, \`BookmarkNotFoundException\`, which the next-but-one step maps to 404.
- The page size is capped by \`app.max-page-size\` so nobody can request a million rows.`,
          files: [
            {
              path: "src/main/java/com/example/bookmarks/BookmarkRequest.java",
              lang: "java",
              code: `package com.example.bookmarks;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** What clients send to create or replace a bookmark. */
public record BookmarkRequest(
    @NotBlank @Size(max = 2048) @Pattern(regexp = "https?://.+", message = "must be an http(s) URL") String url,
    @NotBlank @Size(max = 200) String title) {}`,
            },
            {
              path: "src/main/java/com/example/bookmarks/BookmarkResponse.java",
              lang: "java",
              code: `package com.example.bookmarks;

import java.time.Instant;

/** What clients receive. The entity itself never leaves the service layer. */
public record BookmarkResponse(long id, String url, String title, Instant createdAt, Instant updatedAt) {

    static BookmarkResponse from(Bookmark b) {
        return new BookmarkResponse(b.getId(), b.getUrl(), b.getTitle(), b.getCreatedAt(), b.getUpdatedAt());
    }
}`,
            },
            {
              path: "src/main/java/com/example/bookmarks/PageResponse.java",
              lang: "java",
              code: `package com.example.bookmarks;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;

/** A stable JSON shape for paged results. */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {

    static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(page.getContent().stream().map(mapper).toList(),
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}`,
            },
            {
              path: "src/main/java/com/example/bookmarks/BookmarkNotFoundException.java",
              lang: "java",
              code: `package com.example.bookmarks;

public class BookmarkNotFoundException extends RuntimeException {

    public BookmarkNotFoundException(long id) {
        super("bookmark " + id + " not found");
    }
}`,
            },
            {
              path: "src/main/java/com/example/bookmarks/BookmarkService.java",
              lang: "java",
              code: `package com.example.bookmarks;

import java.time.Clock;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)                       // default for every method: read-only
public class BookmarkService {

    private final BookmarkRepository repository;
    private final Clock clock;
    private final AppProperties properties;

    public BookmarkService(BookmarkRepository repository, Clock clock, AppProperties properties) {
        this.repository = repository;
        this.clock = clock;
        this.properties = properties;
    }

    public PageResponse<BookmarkResponse> search(String query, int page, int size) {
        int safeSize = Math.clamp(size, 1, properties.maxPageSize());
        var pageable = PageRequest.of(Math.max(page, 0), safeSize,
            Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return PageResponse.from(repository.findByTitleContainingIgnoreCase(query.strip(), pageable), BookmarkResponse::from);
    }

    public BookmarkResponse get(long id) {
        return BookmarkResponse.from(find(id));
    }

    @Transactional
    public BookmarkResponse create(BookmarkRequest request) {
        Bookmark saved = repository.save(new Bookmark(request.url().strip(), request.title().strip(), clock.instant()));
        return BookmarkResponse.from(saved);
    }

    @Transactional
    public BookmarkResponse update(long id, BookmarkRequest request) {
        Bookmark bookmark = find(id);
        bookmark.update(request.url().strip(), request.title().strip(), clock.instant());
        return BookmarkResponse.from(bookmark);       // no save(): dirty checking writes it at commit
    }

    @Transactional
    public void delete(long id) {
        repository.delete(find(id));
    }

    private Bookmark find(long id) {
        return repository.findById(id).orElseThrow(() -> new BookmarkNotFoundException(id));
    }
}`,
            },
          ],
        },
        {
          title: "The REST controller",
          explain: `The controller is deliberately boring: it maps HTTP to service calls and picks status codes.

- \`@RequestMapping("/api/bookmarks")\` sets the base path; each method adds the verb and sub-path.
- \`@RequestParam(defaultValue = ...)\` makes query parameters optional.
- \`create\` returns **201 Created** with a \`Location\` header built from the current request URL, so clients know where the new resource lives.
- \`delete\` returns **204 No Content**.
- \`@Valid\` on the body runs the constraints from \`BookmarkRequest\` before the method body executes.`,
          files: [
            {
              path: "src/main/java/com/example/bookmarks/BookmarkController.java",
              lang: "java",
              code: `package com.example.bookmarks;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/bookmarks")
public class BookmarkController {

    private final BookmarkService service;

    public BookmarkController(BookmarkService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<BookmarkResponse> search(@RequestParam(defaultValue = "") String q,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        return service.search(q, page, size);
    }

    @GetMapping("/{id}")
    public BookmarkResponse get(@PathVariable long id) {
        return service.get(id);
    }

    @PostMapping
    public ResponseEntity<BookmarkResponse> create(@Valid @RequestBody BookmarkRequest request) {
        BookmarkResponse created = service.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    public BookmarkResponse update(@PathVariable long id, @Valid @RequestBody BookmarkRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        service.delete(id);
    }
}`,
            },
          ],
          run: `./mvnw spring-boot:run
curl -si -X POST localhost:8080/api/bookmarks \\
  -H 'Content-Type: application/json' \\
  -d '{"url": "https://spring.io/guides", "title": "Spring guides"}'
curl -s 'localhost:8080/api/bookmarks?q=spring'`,
          output: `HTTP/1.1 201
Location: http://localhost:8080/api/bookmarks/1
Content-Type: application/json

{"id":1,"url":"https://spring.io/guides","title":"Spring guides","createdAt":"2026-11-03T10:15:30.512Z","updatedAt":"2026-11-03T10:15:30.512Z"}
{"items":[{"id":1,"url":"https://spring.io/guides","title":"Spring guides","createdAt":"2026-11-03T10:15:30.512Z","updatedAt":"2026-11-03T10:15:30.512Z"}],"page":0,"size":20,"totalItems":1,"totalPages":1}`,
        },
        {
          title: "Errors as ProblemDetail",
          explain: `Without this class, a missing bookmark would be a 500 with a generic body, and validation errors would be hard for clients to read. \`ApiErrors\` maps exceptions to **RFC 9457 Problem Details** in one place:
- \`BookmarkNotFoundException\` → **404**.
- \`MethodArgumentNotValidException\` (thrown when \`@Valid\` fails) → **400**, with an \`errors\` object mapping each invalid field to its message. Clients can show these next to form fields.

Spring writes a \`ProblemDetail\` as \`application/problem+json\` and fills in \`instance\` (the request path) for you. Anything unexpected still becomes a 500 without leaking internals.`,
          files: [
            {
              path: "src/main/java/com/example/bookmarks/ApiErrors.java",
              lang: "java",
              code: `package com.example.bookmarks;

import java.util.Map;
import java.util.TreeMap;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Turns exceptions into RFC 9457 problem responses, in one place for the whole API. */
@RestControllerAdvice
public class ApiErrors {

    @ExceptionHandler(BookmarkNotFoundException.class)
    ProblemDetail notFound(BookmarkNotFoundException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        problem.setTitle("Bookmark not found");
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalid(MethodArgumentNotValidException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "request body is invalid");
        problem.setTitle("Validation failed");
        Map<String, String> errors = new TreeMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> errors.putIfAbsent(f.getField(), f.getDefaultMessage()));
        problem.setProperty("errors", errors);
        return problem;
    }
}`,
            },
          ],
          run: `curl -s localhost:8080/api/bookmarks/999
curl -s -X POST localhost:8080/api/bookmarks -H 'Content-Type: application/json' -d '{"url": "ftp://x", "title": ""}'`,
          output: `{"type":"about:blank","title":"Bookmark not found","status":404,"detail":"bookmark 999 not found","instance":"/api/bookmarks/999"}
{"type":"about:blank","title":"Validation failed","status":400,"detail":"request body is invalid","instance":"/api/bookmarks","errors":{"title":"must not be blank","url":"must be an http(s) URL"}}`,
        },
        {
          title: "Test the API end to end",
          explain: `\`@SpringBootTest\` starts the **whole application** (with the in-memory H2 database and Flyway migrations), and **MockMvc** sends requests through the full Spring MVC stack (filters, validation, JSON, the advice) without opening a socket. Assertions use \`jsonPath\` on the response body.

Each test starts by clearing the table so tests don't depend on each other's data. The tests read like the API documentation: create/read/update/delete, validation errors, 404s, search with paging, and the health endpoint.

\`./mvnw test\` (or \`./mvnw verify\`) runs them; CI should run them on every push.`,
          files: [
            {
              path: "src/test/java/com/example/bookmarks/BookmarkApiTest.java",
              lang: "java",
              code: `package com.example.bookmarks;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class BookmarkApiTest {

    @Autowired WebApplicationContext context;
    @Autowired BookmarkRepository repository;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        repository.deleteAll();                                       // independent tests
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    static String body(String url, String title) {
        return """
            {"url": "%s", "title": "%s"}""".formatted(url, title);
    }

    String create(String url, String title) throws Exception {
        return mvc.perform(post("/api/bookmarks").contentType(MediaType.APPLICATION_JSON).content(body(url, title)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getHeader("Location");
    }

    @Test
    void createReadUpdateDelete() throws Exception {
        String location = create("https://spring.io", "Spring");

        mvc.perform(get(location))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.url").value("https://spring.io"))
            .andExpect(jsonPath("$.title").value("Spring"));

        mvc.perform(put(location).contentType(MediaType.APPLICATION_JSON).content(body("https://spring.io/projects", "Spring projects")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Spring projects"));

        mvc.perform(delete(location)).andExpect(status().isNoContent());
        mvc.perform(get(location)).andExpect(status().isNotFound());
    }

    @Test
    void invalidInputGivesProblemDetailWithFieldErrors() throws Exception {
        mvc.perform(post("/api/bookmarks").contentType(MediaType.APPLICATION_JSON).content(body("ftp://example.com", "")))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.errors.url").value("must be an http(s) URL"))
            .andExpect(jsonPath("$.errors.title").value("must not be blank"));
    }

    @Test
    void missingBookmarkIs404() throws Exception {
        mvc.perform(get("/api/bookmarks/424242"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.title").value("Bookmark not found"))
            .andExpect(jsonPath("$.detail").value("bookmark 424242 not found"));
    }

    @Test
    void searchIsCaseInsensitiveAndPaged() throws Exception {
        create("https://spring.io", "Spring Boot");
        create("https://docs.spring.io", "Spring Framework docs");
        create("https://go.dev", "Go");

        mvc.perform(get("/api/bookmarks").param("q", "SPRING").param("size", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.totalItems").value(2))
            .andExpect(jsonPath("$.totalPages").value(2))
            .andExpect(jsonPath("$.items[0].title").value("Spring Framework docs"));   // newest first
    }

    @Test
    void createReturnsLocationHeader() throws Exception {
        mvc.perform(post("/api/bookmarks").contentType(MediaType.APPLICATION_JSON).content(body("https://kafka.apache.org", "Kafka")))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", org.hamcrest.Matchers.matchesPattern(".*/api/bookmarks/\\\\d+")));
    }

    @Test
    void healthIsUp() throws Exception {
        mvc.perform(get("/actuator/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }
}`,
            },
          ],
          run: `./mvnw test`,
          output: `[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS`,
        },
        {
          title: "Production: Postgres profile, Docker and Compose",
          explain: `In production the app talks to **PostgreSQL**. \`application-prod.yml\` overrides only what changes, reading connection details from **environment variables** (never committed). Activate it with \`SPRING_PROFILES_ACTIVE=prod\`.

The **Dockerfile** is multi-stage: a Maven + JDK image builds the jar, and a slim JRE image runs it as a non-root user. \`MaxRAMPercentage\` sizes the heap from the container's memory limit.

\`compose.yaml\` starts Postgres (with a health check) and the API, wired together. Flyway creates the schema in Postgres on first start, exactly as it did in H2.

The password in the Compose file is for your laptop only. In a real deployment it comes from your platform's secret store.`,
          files: [
            {
              path: "src/main/resources/application-prod.yml",
              lang: "yaml",
              code: `spring:
  datasource:
    url: \${DATABASE_URL}                 # e.g. jdbc:postgresql://db:5432/bookmarks
    username: \${DATABASE_USER}
    password: \${DATABASE_PASSWORD}
    hikari:
      maximum-pool-size: 10             # what the database can handle, not your thread count

logging:
  structured:
    format:
      console: ecs                      # JSON logs for your log platform`,
            },
            {
              path: "Dockerfile",
              lang: "dockerfile",
              code: `# ---- build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline          # cached layer: only reruns when pom.xml changes
COPY src ./src
RUN mvn -q -B package -DskipTests

# ---- run stage ----
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 app
WORKDIR /app
COPY --from=build /src/target/bookmarks-*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]`,
            },
            {
              path: "compose.yaml",
              lang: "yaml",
              code: `services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: bookmarks
      POSTGRES_USER: bookmarks
      POSTGRES_PASSWORD: local-dev-only
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bookmarks"]
      interval: 3s
      retries: 20

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DATABASE_URL: jdbc:postgresql://db:5432/bookmarks
      DATABASE_USER: bookmarks
      DATABASE_PASSWORD: local-dev-only
    ports:
      - "8080:8080"`,
            },
          ],
          run: `docker compose up --build -d
curl -s localhost:8080/actuator/health/readiness
curl -s -X POST localhost:8080/api/bookmarks -H 'Content-Type: application/json' \\
  -d '{"url": "https://www.postgresql.org", "title": "PostgreSQL"}'
docker compose down -v`,
          output: `{"status":"UP"}
{"id":1,"url":"https://www.postgresql.org","title":"PostgreSQL","createdAt":"...","updatedAt":"..."}`,
        },
      ],
      extensions: [
        "Add tags: a `V2__tags.sql` migration with a join table, `@ManyToMany` or a `@ElementCollection`, and filtering by tag.",
        "Secure it: add spring-boot-starter-security with HTTP Basic for writes, then switch to a JWT resource server.",
        "Replace H2 in tests with Testcontainers PostgreSQL and `@ServiceConnection`, so tests use the production database.",
        "Add springdoc-openapi and explore the generated Swagger UI.",
        "Fetch each bookmark's page title asynchronously with RestClient on a virtual thread when the title is empty.",
        "Add optimistic locking with a `@Version` column and return 409 Conflict on concurrent updates.",
        "Expose Prometheus metrics (micrometer-registry-prometheus) and add a custom counter for bookmarks created.",
      ],
      verify: "net: mvn -q -B test",
    },
    interview: [
      {
        q: "Walk me through how you'd design a CRUD REST API in Spring Boot.",
        a: "Resource-oriented URLs (`/api/bookmarks`, `/api/bookmarks/{id}`) with correct verbs and status codes (201 + Location on create, 204 on delete, 404, 400/422 for validation). Layers: thin controllers with request/response DTO records and `@Valid`; services holding business rules and `@Transactional` boundaries; Spring Data repositories; entities that never leave the service. Centralized error handling with ProblemDetail. Schema managed by Flyway. Paging with a capped page size and a stable envelope. Configuration via profiles and environment variables. Tests: MockMvc over the full app plus Testcontainers for the real database. Observability via Actuator health probes, metrics and structured logs. Then discuss security, versioning and idempotency as follow-ups.",
        freq: "very-common",
      },
      {
        q: "Why use DTOs instead of returning JPA entities?",
        a: "Entities model the database; DTOs model the API contract. Returning entities couples clients to your schema (renaming a column breaks the API), can leak fields you didn't mean to expose (password hashes, internal flags), triggers lazy-loading exceptions or N+1 queries during serialization, and invites mass-assignment bugs when binding requests directly to entities. Records make DTOs cheap to write; MapStruct can automate mapping when there are many.",
        freq: "common",
      },
      {
        q: "What does Hibernate dirty checking mean?",
        a: "Entities loaded inside a persistence context (transaction) are managed: Hibernate keeps a snapshot of their state. At flush/commit it compares current state to the snapshot and issues UPDATE statements for changed entities automatically, without an explicit `save()`. It only works for managed entities inside a transaction; detached entities (outside the transaction) must be merged.",
        freq: "common",
      },
      {
        q: "How do you manage database schema changes in production?",
        a: "With versioned migrations (Flyway or Liquibase) stored in the repo and applied automatically at startup or in a deploy step, never `ddl-auto=update`. Migrations are immutable once applied; changes go in new versions. For zero-downtime deploys, use expand-and-contract: add new columns/tables in a backward-compatible way, deploy code that writes both, backfill, switch reads, then remove old columns in a later release. Test migrations against a production-like database (Testcontainers).",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Why is `spring.jpa.hibernate.ddl-auto` set to `none` in this project?",
        options: ["It's faster", "Flyway migrations own the schema", "H2 doesn't support DDL", "Spring Boot 4 removed it"],
        answer: 1,
        explain: "Letting Hibernate alter the schema in production is dangerous; versioned migrations are reviewable and repeatable.",
      },
      {
        q: "The update() method in the service never calls save(). Why does the change still reach the database?",
        options: ["It doesn't", "Dirty checking flushes changes to managed entities at commit", "The controller saves it", "H2 auto-saves"],
        answer: 1,
        explain: "Inside a transaction, Hibernate tracks managed entities and writes changes at flush.",
      },
      {
        q: "Which status and header should POST /api/bookmarks return on success?",
        options: ["200 and no header", "201 and Location", "204 and Location", "302 and Location"],
        answer: 1,
        explain: "201 Created, with Location pointing at the new resource.",
      },
      {
        q: "How does the prod profile get the database password?",
        options: ["From application-prod.yml", "From an environment variable referenced in application-prod.yml", "Hard-coded in the Dockerfile", "From the pom.xml"],
        answer: 1,
        explain: "The YAML only references DATABASE_PASSWORD; the platform injects the value.",
      },
      {
        q: "What does MockMvc with @SpringBootTest exercise?",
        options: ["Only the controller class", "The full Spring MVC stack and the app context, without a real network socket", "Only the database", "A deployed server"],
        answer: 1,
        explain: "Requests go through filters, converters, validation and advice, in-process.",
      },
    ],
  },

  // ------------------------------------------------------------------ INTERVIEW
  {
    id: "java-interview",
    stage: "Interview",
    title: "Java interview preparation",
    tagline: "How Java interviews work, a study plan, coding-round tips in Java, classic hand-written implementations, and rapid-fire questions with model answers.",
    difficulty: "intermediate",
    minutes: 45,
    concept: `
## What a Java backend interview loop looks like
| Round | What they test | Prepare with |
|---|---|---|
| **Recruiter / phone screen** | Background, motivation, basics | Your 2-minute story; the rapid-fire questions below |
| **Coding (1 or 2 rounds)** | Data structures and algorithms, written in Java | The DSA worlds, LeetCode 150, the arena |
| **Java / Spring deep dive** | Language internals, collections, concurrency, JVM, Spring | Every chapter of this track and its Interview tab |
| **System design** (mid/senior) | Designing scalable services | The System Design worlds |
| **Behavioral** | Ownership, conflict, failure, impact | The Interview Practice STAR story bank |
| **Take-home** (sometimes) | Code quality, tests, structure | The two projects in this track |

## A four-week plan
1. **Week 1: language core.** OOP, \`equals\`/\`hashCode\`, \`String\`, collections internals (HashMap!), generics, exceptions. Daily: 2 easy/medium problems in Java.
2. **Week 2: modern Java and concurrency.** Streams, Optional, records, sealed types; threads, \`synchronized\` vs \`volatile\`, executors, \`CompletableFuture\`, \`ConcurrentHashMap\`, virtual threads.
3. **Week 3: JVM and Spring.** Memory areas, GC, leaks; DI, auto-configuration, \`@Transactional\` pitfalls, JPA N+1, REST design. Be able to explain your Bookmarks API.
4. **Week 4: mocks.** Timed problems in the arena, the mock-interview simulator, one system design per day, STAR stories.

## Writing interview code in Java
- **Know your tools**: \`HashMap\`, \`HashSet\`, \`ArrayDeque\` (stack and queue), \`PriorityQueue\`, \`TreeMap\` (floor/ceiling), \`Arrays.sort\`, \`Collections.sort\`, \`StringBuilder\`, \`Arrays.fill\`, \`Arrays.asList\`/\`List.of\`, \`Map.merge\`, \`computeIfAbsent\`.
- **Comparators**: write \`(a, b) -> Integer.compare(a[0], b[0])\` or \`Comparator.comparingInt(...)\`, never \`a - b\`, which overflows for large values.
- **Overflow**: use \`long\` for sums and products; \`mid = lo + (hi - lo) / 2\`.
- **Characters**: \`c - 'a'\` gives an index 0..25; \`int[26]\` beats a map for lowercase letters.
- **Strings are immutable**: build output with \`StringBuilder\`; \`s.toCharArray()\` to modify.
- **Arrays.sort**: primitives use dual-pivot quicksort (not stable); objects use TimSort (stable).
- **Talk while you code**: state the brute force, its complexity, then optimize. Test with an edge case (empty, one element, duplicates, negatives) before saying "done".

## Hand-written classics
Interviewers love asking you to implement something the JDK already has, to see if you understand it: an **LRU cache** (HashMap + doubly linked list), an **immutable class**, a **thread-safe singleton**, a **producer-consumer** queue, a **HashMap** with chaining. The samples below are clean versions to study.

## Practice links
- Coding: the **LeetCode 150** step-through simulations and the **Arena** for timed drills.
- Concepts: the **Questions** bank and **flashcards** (every Interview tab in this track feeds them).
- Behavioral and mocks: **Interview Practice**.
`,
    keyPoints: [
      "Expect coding, Java/Spring deep-dive, system design and behavioral rounds",
      "Master HashMap internals, equals/hashCode, String immutability and concurrency basics",
      "Use Integer.compare in comparators, long for sums, lo + (hi - lo) / 2 for midpoints",
      "Know the classics by heart: LRU cache, immutable class, singleton, producer-consumer",
      "State brute force, complexity, then optimize; test edge cases out loud",
      "Be ready to walk through a project you built, including trade-offs",
    ],
    code: [
      {
        title: "Classic string and array questions, idiomatic Java",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;
import java.util.stream.Collectors;

public class Classics {
    static String reverseWords(String s) {
        List<String> words = new ArrayList<>(Arrays.asList(s.strip().split(" +")));
        Collections.reverse(words);
        return String.join(" ", words);
    }

    static boolean isAnagram(String a, String b) {           // O(n) time, O(1) space for a-z
        if (a.length() != b.length()) return false;
        int[] counts = new int[26];
        for (int i = 0; i < a.length(); i++) {
            counts[a.charAt(i) - 'a']++;
            counts[b.charAt(i) - 'a']--;
        }
        for (int c : counts) if (c != 0) return false;
        return true;
    }

    static Optional<Character> firstUnique(String s) {       // LinkedHashMap keeps first-seen order
        Map<Character, Long> freq = s.chars().mapToObj(c -> (char) c)
            .collect(Collectors.groupingBy(c -> c, LinkedHashMap::new, Collectors.counting()));
        return freq.entrySet().stream().filter(e -> e.getValue() == 1).map(Map.Entry::getKey).findFirst();
    }

    static boolean isPalindrome(String s) {                  // two pointers, skip non-alphanumerics
        int i = 0, j = s.length() - 1;
        while (i < j) {
            char a = s.charAt(i), b = s.charAt(j);
            if (!Character.isLetterOrDigit(a)) i++;
            else if (!Character.isLetterOrDigit(b)) j--;
            else if (Character.toLowerCase(a) != Character.toLowerCase(b)) return false;
            else { i++; j--; }
        }
        return true;
    }

    static int[] twoSum(int[] nums, int target) {            // one pass with a HashMap
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[] {j, i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }

    static List<Integer> topKFrequent(int[] nums, int k) {   // count, then a size-k min-heap
        Map<Integer, Integer> count = new HashMap<>();
        for (int n : nums) count.merge(n, 1, Integer::sum);
        PriorityQueue<Map.Entry<Integer, Integer>> heap = new PriorityQueue<>(Map.Entry.comparingByValue());
        for (var e : count.entrySet()) {
            heap.offer(e);
            if (heap.size() > k) heap.poll();
        }
        List<Integer> result = new ArrayList<>();
        while (!heap.isEmpty()) result.add(heap.poll().getKey());
        Collections.reverse(result);
        return result;
    }

    static String compress(String s) {                      // "aaabccdddd" -> "a3bc2d4"
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); ) {
            int j = i;
            while (j < s.length() && s.charAt(j) == s.charAt(i)) j++;
            sb.append(s.charAt(i));
            if (j - i > 1) sb.append(j - i);
            i = j;
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        System.out.println(reverseWords("  the sky   is blue "));
        System.out.println(isAnagram("listen", "silent") + " " + isAnagram("rat", "car"));
        System.out.println(firstUnique("swiss").orElse('-') + " " + firstUnique("aabb").orElse('-'));
        System.out.println(isPalindrome("A man, a plan, a canal: Panama") + " " + isPalindrome("race a car"));
        System.out.println(Arrays.toString(twoSum(new int[] {2, 7, 11, 15}, 9)));
        System.out.println(topKFrequent(new int[] {1, 1, 1, 2, 2, 3}, 2));
        System.out.println(compress("aaabccdddd"));
    }
}`,
          },
        ],
        output: `blue is sky the
true false
w -
true false
[0, 1]
[1, 2]
a3bc2d4`,
        explain: `- Each method shows the pattern interviewers look for: a counting array, a hash map in one pass, two pointers, a size-k heap, a run-length scan.
- Say the complexity as you go: \`twoSum\` is O(n) time and O(n) space; \`topKFrequent\` is O(n log k).
- \`firstUnique\` returns \`Optional\` instead of a magic value like \`' '\`.`,
      },
      {
        title: "Implement an LRU cache by hand (HashMap + doubly linked list)",
        variants: [
          {
            lang: "java",
            code: `import java.util.HashMap;
import java.util.Map;
import java.util.StringJoiner;

public class LruByHand {
    static final class LruCache<K, V> {
        private final class Node {
            final K key;
            V value;
            Node prev, next;

            Node(K key, V value) {
                this.key = key;
                this.value = value;
            }
        }

        private final int capacity;
        private final Map<K, Node> index = new HashMap<>();   // key -> node: O(1) lookup
        private final Node head = new Node(null, null);       // sentinels: no null checks at the ends
        private final Node tail = new Node(null, null);

        LruCache(int capacity) {
            this.capacity = capacity;
            head.next = tail;
            tail.prev = head;
        }

        V get(K key) {
            Node node = index.get(key);
            if (node == null) return null;
            unlink(node);
            linkFront(node);                                   // most recently used goes to the front
            return node.value;
        }

        void put(K key, V value) {
            Node node = index.get(key);
            if (node != null) {
                node.value = value;
                unlink(node);
                linkFront(node);
                return;
            }
            if (index.size() == capacity) {
                Node lru = tail.prev;                          // least recently used is at the back
                unlink(lru);
                index.remove(lru.key);
            }
            node = new Node(key, value);
            index.put(key, node);
            linkFront(node);
        }

        private void unlink(Node n) {
            n.prev.next = n.next;
            n.next.prev = n.prev;
        }

        private void linkFront(Node n) {
            n.next = head.next;
            n.prev = head;
            head.next.prev = n;
            head.next = n;
        }

        @Override
        public String toString() {
            StringJoiner sj = new StringJoiner(", ", "[", "]");
            for (Node n = head.next; n != tail; n = n.next) sj.add(n.key + "=" + n.value);
            return sj.toString();
        }
    }

    public static void main(String[] args) {
        LruCache<Integer, Integer> cache = new LruCache<>(2);      // LeetCode 146's example
        cache.put(1, 1);
        cache.put(2, 2);
        System.out.println("get(1) = " + cache.get(1) + "   " + cache);
        cache.put(3, 3);                                           // evicts key 2
        System.out.println("get(2) = " + cache.get(2) + "   " + cache);
        cache.put(4, 4);                                           // evicts key 1
        System.out.println("get(1) = " + cache.get(1) + "   " + cache);
        System.out.println("get(3) = " + cache.get(3) + ", get(4) = " + cache.get(4) + "   " + cache);
    }
}`,
          },
        ],
        output: `get(1) = 1   [1=1, 2=2]
get(2) = null   [3=3, 1=1]
get(1) = null   [4=4, 3=3]
get(3) = 3, get(4) = 4   [4=4, 3=3]`,
        explain: `- The map gives O(1) lookup; the doubly linked list gives O(1) "move to front" and "remove the oldest". Together every operation is O(1).
- **Sentinel** head and tail nodes remove all the special cases for empty lists and edges.
- Follow-ups to expect: make it thread-safe (a lock around get/put, or segment it), add TTL expiry, or "how would you do this in production?" (\`LinkedHashMap\` with access order, or Caffeine).`,
      },
      {
        title: "Immutable classes and defensive copies",
        variants: [
          {
            lang: "java",
            code: `import java.util.ArrayList;
import java.util.List;

public class Immutability {
    // The recipe: final class, private final fields, defensive copies in and out, no setters.
    static final class Team {
        private final String name;
        private final List<String> members;

        Team(String name, List<String> members) {
            this.name = name;
            this.members = List.copyOf(members);          // copy in (and reject null elements)
        }

        String name() { return name; }

        List<String> members() { return members; }        // already unmodifiable: safe to hand out

        Team withMember(String member) {                  // "modifying" returns a new object
            List<String> next = new ArrayList<>(members);
            next.add(member);
            return new Team(name, next);
        }
    }

    static final class LeakyTeam {                        // looks immutable, isn't
        private final List<String> members;

        LeakyTeam(List<String> members) { this.members = members; }   // keeps the caller's list

        List<String> members() { return members; }                    // hands out the internal list
    }

    record Playlist(String name, List<String> songs) {   // records need the same care for mutable components
        Playlist {
            songs = List.copyOf(songs);
        }
    }

    public static void main(String[] args) {
        List<String> input = new ArrayList<>(List.of("ada", "linus"));
        LeakyTeam leaky = new LeakyTeam(input);
        Team safe = new Team("core", input);
        input.add("mallory");                              // the caller changes its own list later
        System.out.println("leaky sees " + leaky.members());
        System.out.println("safe sees  " + safe.members());

        try {
            safe.members().add("eve");
        } catch (UnsupportedOperationException e) {
            System.out.println("safe.members() can't be modified");
        }
        Team bigger = safe.withMember("grace");
        System.out.println(safe.members() + " -> " + bigger.members());

        List<String> songs = new ArrayList<>(List.of("intro"));
        Playlist p = new Playlist("focus", songs);
        songs.clear();
        System.out.println(p);
    }
}`,
          },
        ],
        output: `leaky sees [ada, linus, mallory]
safe sees  [ada, linus]
safe.members() can't be modified
[ada, linus] -> [ada, linus, grace]
Playlist[name=focus, songs=[intro]]`,
        explain: `- \`final\` on a field only stops reassignment; the **object it points to** can still change. Immutability needs defensive copies of mutable inputs.
- Immutable objects are automatically thread-safe, can be shared and cached freely, and make great map keys.
- \`String\`, the boxed numbers, \`LocalDate\`, \`BigDecimal\` and \`List.of\` collections are all immutable for these reasons.`,
      },
      {
        title: "Thread-safe singletons: enum, holder and double-checked locking",
        variants: [
          {
            lang: "java",
            code: `import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class Singletons {
    enum Registry {                                // simplest and safest: the JVM guarantees one instance
        INSTANCE;

        private int lookups;

        synchronized int lookup() { return ++lookups; }
    }

    static final class Config {                    // lazy via the holder idiom: no locks in the code
        private Config() { System.out.println("  Config created"); }

        private static final class Holder {
            static final Config INSTANCE = new Config();
        }

        static Config get() { return Holder.INSTANCE; }
    }

    static final class Connection {                // double-checked locking: volatile is essential
        private static volatile Connection instance;

        private Connection() { System.out.println("  Connection created"); }

        static Connection get() {
            Connection local = instance;            // one volatile read on the fast path
            if (local == null) {
                synchronized (Connection.class) {
                    local = instance;
                    if (local == null) instance = local = new Connection();
                }
            }
            return local;
        }
    }

    public static void main(String[] args) {
        System.out.println(Registry.INSTANCE.lookup() + " " + Registry.INSTANCE.lookup());
        System.out.println("before the first Config.get()");
        System.out.println("same Config: " + (Config.get() == Config.get()));

        Set<Connection> seen = ConcurrentHashMap.newKeySet();
        try (ExecutorService pool = Executors.newFixedThreadPool(8)) {
            for (int i = 0; i < 1_000; i++) pool.submit(() -> seen.add(Connection.get()));   // 8 threads race
        }
        System.out.println("distinct Connection instances: " + seen.size());
    }
}`,
          },
        ],
        output: `1 2
before the first Config.get()
  Config created
same Config: true
  Connection created
distinct Connection instances: 1`,
        explain: `- **Enum singleton** (Effective Java's recommendation): thread-safe, serialization-safe and reflection-proof for free.
- **Holder idiom**: the nested class is initialized only on the first \`get()\`, and class initialization is thread-safe.
- **Double-checked locking** only works with \`volatile\`: without it another thread could see a non-null reference to a not-yet-constructed object.
- In Spring apps you rarely write singletons: beans are singletons by default, and dependency injection keeps them testable.`,
      },
    ],
    interview: [
      {
        q: "JDK vs JRE vs JVM?",
        a: "The **JVM** executes bytecode (class loading, verification, interpreter, JIT, GC). The **JRE** is the JVM plus the standard class libraries needed to run programs. The **JDK** is the JRE plus development tools: `javac`, `jar`, `jshell`, `jdeps`, `jcmd`, `jlink`. Since Java 11 vendors ship JDKs only; for small runtime images you build a custom runtime with `jlink`.",
        freq: "very-common",
      },
      {
        q: "Why is String immutable in Java?",
        a: "Security (class names, file paths, URLs and credentials passed as strings can't be changed after validation), thread safety (shared freely without synchronization), the string pool (literals can be shared only because nobody can modify them), and hash caching (`hashCode` is computed once, which makes strings fast HashMap keys). The cost is that concatenation in a loop creates garbage, hence `StringBuilder`.",
        freq: "very-common",
      },
      {
        q: "String vs StringBuilder vs StringBuffer?",
        a: "`String` is immutable. `StringBuilder` is a mutable, unsynchronized buffer: use it to build strings in loops. `StringBuffer` is the old synchronized version; its locking is rarely useful, so prefer StringBuilder. A single expression like `a + b + c` is already compiled to efficient code (invokedynamic since Java 9), so you only need a builder in loops.",
        freq: "very-common",
      },
      {
        q: "What is the equals/hashCode contract?",
        a: "Equal objects must have equal hash codes; `equals` must be reflexive, symmetric, transitive, consistent and return false for null. Unequal objects may share a hash code (collisions are allowed but hurt performance). Override both together, based on the same fields, ideally immutable ones. Breaking it means hash-based collections can't find your objects. Records generate a correct pair automatically.",
        freq: "very-common",
      },
      {
        q: "final vs finally vs finalize?",
        a: "`final` is a modifier: a final variable can't be reassigned, a final method can't be overridden, a final class can't be subclassed. `finally` is the block after try/catch that always runs (for cleanup). `finalize()` was a GC callback on Object; it's deprecated for removal because it's unpredictable and slow. Use try-with-resources or `Cleaner` instead.",
        freq: "common",
      },
      {
        q: "HashMap vs Hashtable vs ConcurrentHashMap vs Collections.synchronizedMap?",
        a: "**HashMap**: not thread-safe, allows one null key and null values, fastest single-threaded. **Hashtable**: legacy, every method synchronized on one lock, no nulls. **synchronizedMap**: a wrapper with one lock around every call; compound operations and iteration still need manual locking. **ConcurrentHashMap**: designed for concurrency, lock-free reads, fine-grained locking on writes, atomic `compute`/`merge`, weakly consistent iterators, no nulls. Use HashMap for confined data and ConcurrentHashMap for shared data.",
        freq: "very-common",
      },
      {
        q: "Fail-fast vs fail-safe iterators?",
        a: "Fail-fast iterators (ArrayList, HashMap) check a modification counter and throw `ConcurrentModificationException` if the collection is structurally modified other than through the iterator, a best-effort bug detector. Fail-safe (more precisely weakly consistent or snapshot) iterators, from `ConcurrentHashMap` and `CopyOnWriteArrayList`, never throw: they iterate over a snapshot or tolerate concurrent changes, possibly not reflecting the latest updates.",
        freq: "common",
      },
      {
        q: "Comparable vs Comparator?",
        a: "`Comparable<T>` defines a class's natural ordering via `compareTo` inside the class (`String`, `Integer`, `LocalDate`). `Comparator<T>` is an external strategy you pass in, so you can have many orderings without modifying the class: `Comparator.comparing(Person::lastName).thenComparing(Person::age, reverseOrder())`. Keep `compareTo` consistent with `equals`, and avoid subtraction-based comparisons because of overflow.",
        freq: "common",
      },
      {
        q: "What is the difference between static and instance members?",
        a: "Static fields and methods belong to the class: one copy shared by all instances, accessible without an object, and static methods can't use `this`. Instance members belong to each object. Static state is effectively global (hard to test, a common source of leaks and thread-safety bugs), so keep it to constants and pure utility methods. Static nested classes don't hold a reference to an outer instance; inner classes do.",
        freq: "common",
      },
      {
        q: "How does Java handle memory for a method call with objects?",
        a: "Each call pushes a stack frame holding parameters and local variables. Primitives are stored directly in the frame; object variables hold references to objects on the heap. Java is always pass-by-value: the reference is copied, so the callee can mutate the shared object but reassigning its parameter doesn't affect the caller. When the method returns the frame is popped; heap objects live until unreachable and collected.",
        freq: "common",
      },
      {
        q: "What design patterns appear in the JDK and Spring?",
        a: "Builder (`StringBuilder`, `HttpRequest.newBuilder()`, `Stream.builder()`), Factory method (`List.of`, `Executors.newFixedThreadPool`, `Calendar.getInstance`), Singleton (`Runtime.getRuntime()`, enum singletons, Spring beans), Decorator (`BufferedReader(new FileReader(...))`, `Collections.unmodifiableList`), Strategy (`Comparator`, Spring's `PasswordEncoder`), Iterator, Observer (listeners, Spring application events), Template method (`AbstractList`, `JdbcTemplate`), Proxy (dynamic proxies, Spring AOP for @Transactional), Adapter (`Arrays.asList`, `InputStreamReader`).",
        freq: "common",
      },
      {
        q: "Explain SOLID briefly with Java examples.",
        a: "**S**ingle responsibility: a class has one reason to change (separate `ReportFormatter` from `ReportRepository`). **O**pen/closed: extend behavior by adding classes (a new `PaymentMethod` implementation) rather than editing switches. **L**iskov substitution: subtypes must honor the supertype's contract (no `Square extends Rectangle`). **I**nterface segregation: small focused interfaces (`Readable`, `Closeable`) rather than one fat one. **D**ependency inversion: depend on abstractions injected from outside (a service takes a `PaymentGateway` interface), which Spring's DI makes natural.",
        freq: "common",
      },
      {
        q: "What's the difference between an abstract class with no fields and an interface with default methods?",
        a: "Practically similar for behavior, but a class can extend only one abstract class and implement many interfaces; abstract classes can have constructors, protected members and (if needed later) state, while interfaces can't hold instance state and all members are public (except private helper methods). Choose an interface for a contract or capability, and keep abstract classes for sharing implementation among a closely related family.",
      },
      {
        q: "How would you find and fix a production service that gets slower over hours and then crashes?",
        a: "Classic memory leak symptoms. Check GC logs or metrics: old-generation usage after each full GC trending up, GC time increasing. Capture a heap dump (automatically with `-XX:+HeapDumpOnOutOfMemoryError`, or `jcmd <pid> GC.heap_dump` before it dies), analyze in Eclipse MAT: dominator tree, largest retained sets, path to GC roots. Typical culprits: unbounded caches or static maps, listeners not removed, ThreadLocals in pools, unclosed resources. Fix the root cause, add a bounded cache or cleanup, add a metric/alert on heap after GC, and a load test to prevent regressions.",
        freq: "common",
      },
      {
        q: "Tell me about a Java project you built. (How to answer)",
        a: "Use a structure: the problem and users; the architecture (draw controller → service → repository → database, plus external calls); key decisions with trade-offs (why Postgres, why Flyway, why records as DTOs, why virtual threads); something hard you solved (a concurrency bug, a slow query and how you found it); how you tested it (unit, MockMvc, Testcontainers); how it runs in production (Docker, health checks, metrics); and what you'd improve next. The Bookmarks API and expense tracker in this track are designed so you can tell this story.",
        freq: "very-common",
      },
    ],
    quiz: [
      {
        q: "Which comparator is safe for any int values?",
        options: ["(a, b) -> a - b", "(a, b) -> Integer.compare(a, b)", "(a, b) -> a > b ? 1 : 0", "(a, b) -> b - a"],
        answer: 1,
        explain: "Subtraction overflows for large magnitudes and gives the wrong sign.",
      },
      {
        q: "An LRU cache with O(1) get and put uses...",
        options: ["A TreeMap", "A HashMap plus a doubly linked list", "Two arrays", "A PriorityQueue"],
        answer: 1,
        explain: "The map finds nodes; the list orders them by recency.",
      },
      {
        q: "Why must the instance field be volatile in double-checked locking?",
        options: ["For speed", "So no thread can see a non-null reference to a partially constructed object", "volatile makes it final", "It isn't needed"],
        answer: 1,
        explain: "volatile provides the happens-before edge for safe publication.",
      },
      {
        q: "A class has `private final List<String> items` assigned from a constructor parameter. Is it immutable?",
        options: ["Yes, final makes it immutable", "Not unless it copies the list (and doesn't expose a mutable one)", "Yes, if the class is public", "Only with Lombok"],
        answer: 1,
        explain: "final prevents reassignment, not mutation of the list.",
      },
      {
        q: "Which is the safest singleton implementation in Java?",
        options: ["A public static field", "An enum with a single constant", "A synchronized getInstance on every call", "Double-checked locking without volatile"],
        answer: 1,
        explain: "Enums are thread-safe, serialization-safe and reflection-proof.",
      },
      {
        q: "Which data structure would you reach for to find the k largest of n numbers efficiently?",
        options: ["A size-k min-heap", "Sorting a LinkedList", "A HashSet", "A Stack"],
        answer: 0,
        explain: "O(n log k): keep the k largest seen, evicting the smallest.",
      },
      {
        q: "What's the safe midpoint in binary search?",
        options: ["(lo + hi) / 2", "lo + (hi - lo) / 2", "(lo * hi) / 2", "hi / 2"],
        answer: 1,
        explain: "lo + hi can overflow int when both are large.",
      },
      {
        q: "Arrays.sort on an Integer[] (objects) uses which algorithm?",
        options: ["Dual-pivot quicksort (unstable)", "TimSort (stable)", "Heapsort", "Bubble sort"],
        answer: 1,
        explain: "Primitives use dual-pivot quicksort; objects use stable TimSort.",
      },
    ],
    problems: [
      { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "Medium", note: "implement both ways" },
      { title: "Valid Anagram", url: "https://leetcode.com/problems/valid-anagram/", difficulty: "Easy", note: "int[26] counting" },
      { title: "Top K Frequent Elements", url: "https://leetcode.com/problems/top-k-frequent-elements/", difficulty: "Medium", note: "size-k heap" },
      { title: "Print in Order", url: "https://leetcode.com/problems/print-in-order/", difficulty: "Easy", note: "CountDownLatch or semaphores" },
      { title: "Print FooBar Alternately", url: "https://leetcode.com/problems/print-foobar-alternately/", difficulty: "Medium", note: "Semaphore handoff" },
      { title: "Design HashMap", url: "https://leetcode.com/problems/design-hashmap/", difficulty: "Easy", note: "buckets + chaining" },
      { title: "Merge Intervals", url: "https://leetcode.com/problems/merge-intervals/", difficulty: "Medium", note: "sort with Integer.compare" },
    ],
  },
];
