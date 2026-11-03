import type { Lesson } from "../types";

// Java track, part 2: Core.

export const javaCore: Lesson[] = [
  // ------------------------------------------------------------------ INHERITANCE
  {
    id: "java-inheritance",
    stage: "Core",
    title: "Inheritance, interfaces & polymorphism",
    tagline: "extends vs implements, abstract classes, default methods, sealed types and pattern-matching switch.",
    difficulty: "intermediate",
    minutes: 30,
    concept: `
## Inheritance: IS-A
\`class Manager extends Employee\` means a Manager **is an** Employee: it inherits the fields and methods and can **override** behavior. Java has **single inheritance** of classes (one \`extends\`) but a class can implement **many interfaces**.
\`\`\`java
class Employee {
    protected final String name;
    Employee(String name) { this.name = name; }
    double monthlyPay() { return 0; }
}

class Manager extends Employee {
    private final double salary;
    Manager(String name, double salary) {
        super(name);                   // call the parent constructor
        this.salary = salary;
    }
    @Override                          // compiler checks you really override something
    double monthlyPay() { return salary / 12; }
}
\`\`\`
- \`super(...)\` calls the parent constructor (until Java 25 it had to be the first statement; Java 25's *flexible constructor bodies* allow validation code before it). \`super.method()\` calls the parent's version.
- Always write **\`@Override\`**: a typo in the signature becomes a compile error instead of a silent new method.

## Polymorphism
A variable of the parent type can hold any subtype, and the **actual object's** method runs (dynamic dispatch):
\`\`\`java
List<Employee> staff = List.of(new Manager("Grace", 150_000), new Contractor("Linus", 95, 120));
for (Employee e : staff) total += e.monthlyPay();   // each object picks its own implementation
\`\`\`
Code that works on \`Employee\` keeps working when you add a new subtype. That's the **open/closed principle**.

## Abstract classes vs interfaces
\`\`\`java
abstract class Shape {                       // can't be instantiated
    abstract double area();                  // subclasses must implement
    String describe() { return "area " + area(); }   // shared code
}

interface Notifier {
    void send(String to, String msg);                    // abstract
    default void sendAll(List<String> to, String msg) {  // default method (Java 8+)
        to.forEach(t -> send(t, msg));
    }
    static Notifier console() { ... }                    // static factory
}
\`\`\`
| | Abstract class | Interface |
|---|---|---|
| Multiple inheritance | No (one parent) | Yes (implement many) |
| State (instance fields) | Yes | No (only constants) |
| Constructors | Yes | No |
| Methods | abstract + concrete | abstract + \`default\` + \`static\` + \`private\` |
| Use for | Shared state and code in a closely related family | A **capability** or contract (\`Comparable\`, \`Runnable\`, \`Notifier\`) |

Default to interfaces. Reach for an abstract class when subclasses genuinely share state or a template of steps.

An interface with exactly **one abstract method** is a **functional interface**: it can be implemented with a lambda (\`(to, msg) -> System.out.println(msg)\`). More in the streams chapter.

## Sealed types and pattern matching (Java 17 and 21)
A **sealed** interface or class lists exactly which types may extend it. Combined with records and \`switch\` patterns, you get **algebraic data types**:
\`\`\`java
sealed interface Shape permits Circle, Rectangle {}
record Circle(double r) implements Shape {}
record Rectangle(double w, double h) implements Shape {}

double area(Shape s) {
    return switch (s) {
        case Circle c -> Math.PI * c.r() * c.r();
        case Rectangle(double w, double h) -> w * h;   // record pattern: deconstruct
    };   // no default: the compiler knows the list is complete
}
\`\`\`
Add a new \`Triangle\` to the \`permits\` list and every switch that forgot it **fails to compile**. That's safer than a \`default\` branch that silently does the wrong thing. Guards refine cases: \`case Circle c when c.r() == 0 -> 0;\`. Pattern matching also works with \`instanceof\`: \`if (obj instanceof String s && !s.isBlank()) ...\`.

## Composition over inheritance
Inheritance couples a subclass to its parent's internals ("fragile base class"). Prefer **composition**: hold an object and delegate to it.
- Use \`extends\` only for a true IS-A relationship where the subclass honors every promise of the parent (**Liskov substitution**: anywhere a \`Rectangle\` works, a \`Square\` subclass must work too; it usually doesn't, so don't do it).
- Use composition (HAS-A) to reuse behavior: a \`RetryingNotifier\` *wraps* any \`Notifier\` (the decorator pattern).
- Mark classes \`final\` unless they're designed for extension.

## Object methods in a hierarchy
\`toString\`, \`equals\` and \`hashCode\` are inherited from \`Object\`. Be careful overriding \`equals\` across a hierarchy: \`Point.equals(ColorPoint)\` vs \`ColorPoint.equals(Point)\` easily breaks symmetry. Records and \`final\` classes avoid the problem.
`,
    keyPoints: [
      "One superclass (extends), many interfaces (implements)",
      "Always annotate overrides with @Override",
      "Polymorphism: the runtime class's method runs, chosen at run time",
      "Interfaces = capabilities (default methods allowed); abstract classes = shared state",
      "sealed + records + switch patterns = exhaustive, compiler-checked type hierarchies",
      "Prefer composition (delegate) over inheritance; respect Liskov substitution",
    ],
    code: [
      {
        title: "Abstract classes, overriding and polymorphism: a payroll",
        variants: [
          {
            lang: "java",
            code: `import java.util.List;

public class Payroll {
    abstract static class Employee {
        private final String name;
        protected final double base;

        Employee(String name, double base) {
            this.name = name;
            this.base = base;
        }

        abstract double monthlyPay();                    // every subclass must implement

        String payslip() {                               // shared logic calling the abstract part
            return "%-6s %-9s $%,.2f".formatted(name, getClass().getSimpleName(), monthlyPay());
        }
    }

    static class Salaried extends Employee {
        Salaried(String name, double annual) { super(name, annual); }

        @Override
        double monthlyPay() { return base / 12; }
    }

    static class Manager extends Salaried {
        private final double bonus;

        Manager(String name, double annual, double bonus) {
            super(name, annual);
            this.bonus = bonus;
        }

        @Override
        double monthlyPay() { return super.monthlyPay() + bonus / 12; }   // extend, don't repeat
    }

    static class Contractor extends Employee {
        private final int hours;

        Contractor(String name, double hourlyRate, int hours) {
            super(name, hourlyRate);
            this.hours = hours;
        }

        @Override
        double monthlyPay() { return base * hours; }
    }

    public static void main(String[] args) {
        List<Employee> staff = List.of(
            new Salaried("Ada", 120_000),
            new Manager("Grace", 150_000, 24_000),
            new Contractor("Linus", 95.5, 120));
        double total = 0;
        for (Employee e : staff) {                       // one loop, three behaviors
            System.out.println(e.payslip());
            total += e.monthlyPay();
        }
        System.out.printf("Total payroll: $%,.2f%n", total);
        Employee grace = staff.get(1);
        System.out.println("Manager is-a Salaried: " + (grace instanceof Salaried));
    }
}`,
          },
        ],
        output: `Ada    Salaried  $10,000.00
Grace  Manager   $14,500.00
Linus  Contractor $11,460.00
Total payroll: $35,960.00
Manager is-a Salaried: true`,
        explain: `- \`payslip()\` is written once in the parent and calls \`monthlyPay()\`, which is resolved at run time for each object. This is the **template method** pattern.
- \`super.monthlyPay()\` reuses the parent's calculation instead of duplicating \`base / 12\`.
- \`%,.2f\` prints a grouped number with two decimals (grouping follows your locale).
- \`getClass()\` returns the *runtime* class, so the parent's method prints "Manager" for Grace.`,
      },
      {
        title: "Sealed interfaces, records and pattern-matching switch (Java 21)",
        variants: [
          {
            lang: "java",
            code: `import java.util.List;

public class Shapes {
    sealed interface Shape permits Circle, Rectangle, Triangle {}
    record Circle(double radius) implements Shape {}
    record Rectangle(double width, double height) implements Shape {}
    record Triangle(double base, double height) implements Shape {}

    static double area(Shape s) {
        return switch (s) {
            case Circle c -> Math.PI * c.radius() * c.radius();
            case Rectangle(double w, double h) -> w * h;            // record pattern
            case Triangle t when t.base() == 0 -> 0;                // guarded case
            case Triangle t -> 0.5 * t.base() * t.height();
        };                                                          // exhaustive: no default
    }

    static String describe(Object o) {
        return switch (o) {
            case null -> "null!";
            case Integer i when i > 100 -> "big int " + i;
            case Integer i -> "int " + i;
            case String str -> "string of length " + str.length();
            case Shape sh -> "shape with area %.2f".formatted(area(sh));
            default -> "something else: " + o.getClass().getSimpleName();
        };
    }

    public static void main(String[] args) {
        List<Shape> shapes = List.of(new Circle(1), new Rectangle(3, 4), new Triangle(6, 2));
        double total = 0;
        for (Shape s : shapes) {
            System.out.printf("%-10s %6.2f%n", s.getClass().getSimpleName(), area(s));
            total += area(s);
        }
        System.out.printf("total      %6.2f%n", total);
        for (Object o : new Object[] {42, 1000, "hello", new Circle(2), 3.5, null}) System.out.println(describe(o));
    }
}`,
          },
        ],
        output: `Circle       3.14
Rectangle   12.00
Triangle     6.00
total       21.14
int 42
big int 1000
string of length 5
shape with area 12.57
something else: Double
null!`,
        explain: `- \`permits\` closes the hierarchy, so \`area\` needs no \`default\`. Add a \`Square\` to the permits list and this switch stops compiling until you handle it.
- \`case Rectangle(double w, double h)\` deconstructs the record into variables.
- Order matters: the guarded \`Integer i when i > 100\` must come before the plain \`Integer i\`, or the compiler rejects it as dominated.
- \`case null\` lets a switch handle null instead of throwing \`NullPointerException\`.`,
      },
      {
        title: "Interfaces, default methods and composition",
        variants: [
          {
            lang: "java",
            code: `import java.util.ArrayList;
import java.util.List;

public class Notifications {
    interface Notifier {
        void send(String to, String message);

        default void sendAll(List<String> recipients, String message) {
            for (String r : recipients) send(r, message);
        }

        static Notifier console() {                        // a lambda implements the one abstract method
            return (to, msg) -> System.out.println("[console] " + to + ": " + msg);
        }
    }

    static class EmailNotifier implements Notifier {
        @Override
        public void send(String to, String message) {
            System.out.println("[email] " + to + ": " + message);
        }
    }

    // Composition: wraps ANY Notifier and adds validation, without subclassing it.
    static class ValidatingNotifier implements Notifier {
        private final Notifier inner;
        private final List<String> rejected = new ArrayList<>();

        ValidatingNotifier(Notifier inner) { this.inner = inner; }

        @Override
        public void send(String to, String message) {
            if (to.isBlank() || !to.contains("@")) {
                rejected.add("'" + to + "'");
                return;
            }
            inner.send(to, message);
        }

        List<String> rejected() { return rejected; }
    }

    public static void main(String[] args) {
        Notifier email = new EmailNotifier();
        email.sendAll(List.of("ada@example.com", "linus@example.com"), "Build passed");
        Notifier.console().send("ops", "Deploy started");

        ValidatingNotifier safe = new ValidatingNotifier(email);
        safe.sendAll(List.of("grace@example.com", " ", "not-an-email"), "Hello");
        System.out.println("rejected: " + safe.rejected());
    }
}`,
          },
        ],
        output: `[email] ada@example.com: Build passed
[email] linus@example.com: Build passed
[console] ops: Deploy started
[email] grace@example.com: Hello
rejected: [' ', 'not-an-email']`,
        explain: `- \`sendAll\` is a **default method**: every implementation gets it for free, and \`ValidatingNotifier.sendAll\` routes through its own \`send\`.
- \`Notifier\` has one abstract method, so a lambda can implement it (\`console()\`).
- \`ValidatingNotifier\` is a **decorator**: it HAS-A \`Notifier\` and adds behavior. It works with email, console, or any future implementation, which inheritance couldn't do.`,
      },
    ],
    interview: [
      {
        q: "Abstract class vs interface: when do you use which?",
        a: "Use an **interface** to define a capability or contract that unrelated classes can implement (`Comparable`, `AutoCloseable`, `PaymentGateway`); a class can implement many, and since Java 8 interfaces can carry `default`, `static` and `private` methods. Use an **abstract class** when closely related subclasses share **state** (instance fields), constructors, or a template of steps with some abstract hooks; a class can extend only one. Rule of thumb: program to interfaces; add an abstract base class as an implementation convenience behind the interface if needed.",
        freq: "very-common",
      },
      {
        q: "What is polymorphism and how does Java implement it?",
        a: "Polymorphism lets one piece of code work with objects of many types through a common supertype. Java has **compile-time** polymorphism (overloading, resolved by static types) and **runtime** polymorphism (overriding): calls to non-static, non-private, non-final methods are dispatched on the object's actual class via a virtual method table, so `employee.monthlyPay()` runs Manager's or Contractor's implementation. The JIT often devirtualizes and inlines these calls when only one or two types are seen.",
        freq: "very-common",
      },
      {
        q: "What are sealed classes and why pair them with pattern matching?",
        a: "A `sealed` class or interface declares the complete set of permitted subtypes (`permits A, B, C`); subtypes must be `final`, `sealed` or `non-sealed`. Because the compiler knows every possible subtype, a `switch` over the sealed type can be **exhaustive without a default**, and adding a new subtype breaks compilation everywhere it isn't handled. This is Java's take on algebraic data types: model a closed set of cases (payment methods, AST nodes, API results) with records, and process them with type patterns and record deconstruction.",
        freq: "common",
      },
      {
        q: "Why prefer composition over inheritance?",
        a: "Inheritance exposes the parent's implementation to the subclass, so changes in the parent can break subclasses (the fragile base class problem); it's fixed at compile time; and it's easy to violate Liskov substitution (the classic `Square extends Rectangle`). Composition holds a reference to another object and delegates: the dependency is through a public interface, can be swapped at run time, and multiple behaviors can be combined (decorators). Use inheritance for genuine IS-A relationships designed for extension.",
        freq: "common",
      },
      {
        q: "Can you override a static or private method?",
        a: "No. **Static** methods are resolved by the compile-time type; declaring the same static method in a subclass *hides* the parent's, it doesn't override it, so there's no dynamic dispatch. **Private** methods aren't visible to subclasses at all; a subclass method with the same name is unrelated. **Final** methods can't be overridden by design. `@Override` on any of these is a compile error, which is one more reason to always use it.",
      },
    ],
    quiz: [
      {
        q: "How many classes can a Java class extend directly?",
        options: ["Zero", "One", "Two", "Unlimited"],
        answer: 1,
        explain: "Single inheritance for classes; a class can implement many interfaces.",
      },
      {
        q: "`Employee e = new Manager(); e.monthlyPay();` which implementation runs if Manager overrides it?",
        options: ["Employee's", "Manager's", "Both, parent first", "It doesn't compile"],
        answer: 1,
        explain: "Overridden methods dispatch on the runtime class of the object.",
      },
      {
        q: "What does `@Override` buy you?",
        options: ["Faster calls", "A compile error if the method doesn't actually override anything", "Makes the method final", "Allows overriding static methods"],
        answer: 1,
        explain: "It turns signature typos into compile errors instead of silently adding a new method.",
      },
      {
        q: "A switch over a sealed interface with records has a case for every permitted type. What else is needed?",
        options: ["A default branch", "Nothing: the compiler knows it's exhaustive", "A case null", "A break in each case"],
        answer: 1,
        explain: "Sealed hierarchies let the compiler prove exhaustiveness.",
      },
      {
        q: "Which can an interface NOT have?",
        options: ["default methods", "static methods", "instance fields (per-object state)", "private methods"],
        answer: 2,
        explain: "Interface fields are implicitly public static final constants.",
      },
    ],
  },

  // ------------------------------------------------------------------ EXCEPTIONS
  {
    id: "java-exceptions",
    stage: "Core",
    title: "Exceptions & resource handling",
    tagline: "Checked vs unchecked, try-with-resources, custom exceptions, chaining causes, and how to read a stack trace.",
    difficulty: "intermediate",
    minutes: 25,
    concept: `
## The hierarchy
\`\`\`text
Throwable
├── Error                    serious JVM problems: OutOfMemoryError, StackOverflowError. Don't catch.
└── Exception                checked: must be caught or declared (IOException, SQLException)
    └── RuntimeException     unchecked: NullPointerException, IllegalArgumentException,
                             IllegalStateException, IndexOutOfBoundsException, ArithmeticException
\`\`\`
- **Checked** exceptions must be handled (\`try/catch\`) or declared (\`throws IOException\`). The compiler enforces it. Meant for recoverable conditions outside the program's control (a missing file, a dropped connection).
- **Unchecked** exceptions (\`RuntimeException\` and subclasses) don't need declaring. They usually signal **bugs or violated preconditions**: null where it shouldn't be, a bad argument, an illegal state.

Modern Java code (and frameworks like Spring) leans on unchecked exceptions; lambdas and streams in particular don't mix well with checked ones.

## try / catch / finally
\`\`\`java
try {
    int qty = Integer.parseInt(input);
    reserve(sku, qty);
} catch (NumberFormatException e) {             // most specific first
    log.warn("bad quantity {}", input);
} catch (IllegalArgumentException | IllegalStateException e) {   // multi-catch
    throw new OrderException("cannot order " + sku, e);          // wrap, keep the cause
} finally {
    metrics.increment("order.attempts");        // always runs (even after return)
}
\`\`\`

## try-with-resources
Anything that implements \`AutoCloseable\` (files, streams, sockets, JDBC connections, locks you wrap) should be opened in a try-with-resources:
\`\`\`java
try (var reader = Files.newBufferedReader(path);
     var writer = Files.newBufferedWriter(out)) {
    reader.lines().map(String::toUpperCase).forEach(l -> write(writer, l));
}   // closed automatically, in reverse order, even if an exception is thrown
\`\`\`
If the body throws and \`close()\` also throws, the close exception is attached as a **suppressed** exception instead of hiding the original. That's why it beats hand-written \`finally { r.close(); }\`.

## Throwing and custom exceptions
\`\`\`java
if (amount <= 0) throw new IllegalArgumentException("amount must be positive: " + amount);

public class InsufficientFundsException extends RuntimeException {
    private final long shortfallCents;
    public InsufficientFundsException(long shortfallCents) {
        super("insufficient funds, short by " + shortfallCents + " cents");
        this.shortfallCents = shortfallCents;
    }
    public long shortfallCents() { return shortfallCents; }
}
\`\`\`
Create a custom exception when callers need to **distinguish** the failure or need **extra data**. Otherwise reuse the standard ones (\`IllegalArgumentException\`, \`IllegalStateException\`, \`UnsupportedOperationException\`, \`NoSuchElementException\`).

## Chaining: never lose the cause
When translating a low-level exception into a higher-level one, pass the original as the **cause**: \`new OrderException("...", e)\`. The stack trace then shows \`Caused by: ...\` all the way down. Dropping the cause is one of the most common reasons production bugs are hard to diagnose.

## Reading a stack trace
\`\`\`text
Exception in thread "main" java.lang.IllegalStateException: order already shipped
    at shop.Order.cancel(Order.java:42)          <- where it was thrown
    at shop.OrderService.cancel(OrderService.java:17)
    at shop.Main.main(Main.java:9)               <- how we got there
Caused by: ...                                   <- the original exception, if chained
\`\`\`
Read the first line (type and message), then the top frame in **your** code. For NPEs, Java's **helpful NullPointerException** messages name exactly what was null: \`Cannot invoke "String.length()" because "user.name" is null\`.

## Best practices
- **Fail fast**: validate arguments at the boundary and throw with a clear message (\`Objects.requireNonNull(x, "x")\`).
- **Catch only what you can handle.** Otherwise let it propagate to a layer that can (a global error handler in a web app).
- **Never swallow**: \`catch (Exception e) {}\` hides bugs. At minimum log with the exception object.
- **Don't catch \`Exception\` or \`Throwable\`** broadly except at the very top level.
- **Don't use exceptions for normal control flow**: they're slow (stack capture) and obscure intent. For "might be absent", return \`Optional\`.
- **Log or rethrow, not both**: double logging floods logs with duplicate stack traces.
- Clean up with try-with-resources, not \`finalize\`.
`,
    keyPoints: [
      "Checked exceptions must be caught or declared; RuntimeExceptions don't",
      "Error (OOM, StackOverflow) is not meant to be caught",
      "try-with-resources closes AutoCloseables in reverse order; close failures become suppressed",
      "Always chain the cause when wrapping: new XException(msg, e)",
      "Catch specific exceptions first; never swallow exceptions silently",
      "finally runs even after a return; don't return from finally",
      "Use Optional, not exceptions, for normal 'not found' results",
    ],
    code: [
      {
        title: "Custom exceptions, multi-catch and chaining",
        variants: [
          {
            lang: "java",
            code: `import java.util.Map;

public class Orders {
    static class OrderException extends Exception {            // checked: callers must handle it
        OrderException(String message, Throwable cause) { super(message, cause); }
    }

    static class OutOfStockException extends RuntimeException { // unchecked, with extra data
        final String sku;
        OutOfStockException(String sku) {
            super("out of stock: " + sku);
            this.sku = sku;
        }
    }

    static final Map<String, Integer> STOCK = Map.of("book", 3, "pen", 0);

    static int parseQuantity(String raw) {
        try {
            int q = Integer.parseInt(raw.strip());
            if (q <= 0) throw new IllegalArgumentException("quantity must be positive: " + q);
            return q;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("not a number: '" + raw + "'", e);   // keep the cause
        }
    }

    static void reserve(String sku, int qty) {
        if (STOCK.getOrDefault(sku, 0) < qty) throw new OutOfStockException(sku);
    }

    static String placeOrder(String sku, String rawQty) throws OrderException {
        try {
            int qty = parseQuantity(rawQty);
            reserve(sku, qty);
            return "ordered " + qty + " x " + sku;
        } catch (IllegalArgumentException | OutOfStockException e) {   // multi-catch
            throw new OrderException("cannot order " + sku, e);         // translate + chain
        }
    }

    public static void main(String[] args) {
        String[][] attempts = {{"book", "2"}, {"book", "two"}, {"pen", "1"}, {"book", "-1"}};
        for (String[] a : attempts) {
            try {
                System.out.println(placeOrder(a[0], a[1]));
            } catch (OrderException e) {
                System.out.println(e.getMessage() + " <- " + e.getCause().getMessage());
            }
        }
    }
}`,
          },
        ],
        output: `ordered 2 x book
cannot order book <- not a number: 'two'
cannot order pen <- out of stock: pen
cannot order book <- quantity must be positive: -1`,
        explain: `- \`placeOrder\` declares \`throws OrderException\`, so \`main\` *must* catch it: that's what "checked" means.
- Low-level failures (\`NumberFormatException\`, \`OutOfStockException\`) are **translated** into one domain exception for the caller, with the original kept as the cause. \`e.printStackTrace()\` would show both.
- Multi-catch types can't be subclasses of each other (that would be redundant).`,
      },
      {
        title: "try-with-resources, close order and suppressed exceptions",
        variants: [
          {
            lang: "java",
            code: `public class Resources {
    static class Resource implements AutoCloseable {
        private final String name;
        private final boolean failOnClose;

        Resource(String name, boolean failOnClose) {
            this.name = name;
            this.failOnClose = failOnClose;
            System.out.println("open " + name);
        }

        void use() { System.out.println("use " + name); }

        @Override
        public void close() {
            System.out.println("close " + name);
            if (failOnClose) throw new IllegalStateException("close failed: " + name);
        }
    }

    static int finallyDemo() {
        try {
            return 1;
        } finally {
            System.out.println("finally runs even after return");
        }
    }

    public static void main(String[] args) {
        try (Resource db = new Resource("db", false); Resource file = new Resource("file", false)) {
            db.use();
            file.use();
        }   // closed automatically, in REVERSE order of opening

        try (Resource r = new Resource("socket", true)) {
            r.use();
            throw new RuntimeException("work failed");
        } catch (RuntimeException e) {
            System.out.println("caught: " + e.getMessage());
            for (Throwable s : e.getSuppressed()) System.out.println("suppressed: " + s.getMessage());
        }
        System.out.println("finallyDemo returned " + finallyDemo());
    }
}`,
          },
        ],
        output: `open db
open file
use db
use file
close file
close db
open socket
use socket
close socket
caught: work failed
suppressed: close failed: socket
finally runs even after return
finallyDemo returned 1`,
        explain: `- Resources close in reverse order, like a stack: \`file\` was opened last, so it closes first (it might depend on \`db\`).
- When both the body and \`close()\` throw, you get the **body's** exception, with the close failure attached via \`getSuppressed()\`. A hand-written \`finally { close(); }\` would have *replaced* the real error.
- \`finally\` runs before the method actually returns. Never \`return\` from inside \`finally\`: it silently discards any exception.`,
      },
      {
        title: "The runtime exceptions you'll meet first",
        variants: [
          {
            lang: "java",
            code: `import java.util.ArrayList;
import java.util.List;

public class CommonExceptions {
    interface Risky { void run() throws Exception; }

    static String name;   // a field that was never set

    static void attempt(String label, Risky r) {
        try {
            r.run();
            System.out.println(label + ": ok");
        } catch (Exception e) {
            System.out.println(label + ": " + e.getClass().getSimpleName() + " - " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        attempt("divide", () -> System.out.println(10 / 0));
        attempt("parse", () -> Integer.parseInt("12a"));
        attempt("null", () -> System.out.println(name.length()));
        attempt("immutable", () -> List.of(1, 2).add(3));
        attempt("modify while iterating", () -> {
            List<Integer> xs = new ArrayList<>(List.of(1, 2, 3));
            for (Integer x : xs) if (x == 1) xs.remove(x);
        });
        attempt("safe", () -> Integer.parseInt(" 42 ".strip()));
    }
}`,
          },
        ],
        output: `divide: ArithmeticException - / by zero
parse: NumberFormatException - For input string: "12a"
null: NullPointerException - Cannot invoke "String.length()" because "CommonExceptions.name" is null
immutable: UnsupportedOperationException - null
modify while iterating: ConcurrentModificationException - null
safe: ok`,
        explain: `- **Helpful NPE messages** name the exact expression that was null.
- \`List.of\` returns an immutable list; mutators throw \`UnsupportedOperationException\` (with no message).
- Removing from a list inside a for-each makes the iterator throw \`ConcurrentModificationException\` on its next step. Use \`removeIf\` or \`Iterator.remove\` (collections chapter).
- Integer division by zero throws; floating-point division by zero gives \`Infinity\` or \`NaN\` instead.`,
      },
    ],
    interview: [
      {
        q: "Checked vs unchecked exceptions: what's the difference and which should you use?",
        a: "**Checked** exceptions (subclasses of `Exception` but not `RuntimeException`) must be caught or declared with `throws`; the compiler enforces it. **Unchecked** exceptions (`RuntimeException`, `Error`) don't. The intent: checked for recoverable conditions the caller should consider (I/O failures), unchecked for programming errors and violated preconditions. In practice many teams and frameworks prefer unchecked exceptions because checked ones leak implementation details through signatures and don't compose with lambdas. Whatever you choose: document, chain causes, and handle at the right layer.",
        freq: "very-common",
      },
      {
        q: "What is try-with-resources and why is it better than finally?",
        a: "`try (Resource r = ...) { }` automatically calls `close()` on every declared `AutoCloseable`, in reverse order, whether the block completes normally or throws. Compared with closing in `finally`: it's less code, handles multiple resources correctly (a failure closing one doesn't skip the others), and if both the body and `close()` throw, the body's exception propagates with the close exception added as **suppressed** rather than masking the original.",
        freq: "very-common",
      },
      {
        q: "Does finally always run?",
        a: "Almost always: after normal completion, after an exception, and even after `return`, `break` or `continue` in the try block. It doesn't run if the JVM halts (`System.exit`, `Runtime.halt`, a crash or `kill -9`) or the thread is stuck forever in the try block. Pitfall: a `return` or a thrown exception inside `finally` overrides the original return value or exception, silently discarding it. Never return from finally.",
        freq: "common",
      },
      {
        q: "What's the difference between `throw` and `throws`?",
        a: "`throw` is a statement that raises an exception object: `throw new IllegalArgumentException(\"bad\");`. `throws` is part of a method signature declaring which checked exceptions the method may propagate: `void load() throws IOException`. Unchecked exceptions can be listed in `throws` for documentation but don't have to be.",
        freq: "common",
      },
      {
        q: "How do you handle exceptions in a REST API?",
        a: "Let domain and validation exceptions propagate out of services, and translate them centrally (in Spring, a `@RestControllerAdvice` with `@ExceptionHandler` methods) into consistent HTTP responses: 400 for validation errors, 404 for not found, 409 for conflicts, 500 for unexpected errors, ideally using the RFC 9457 Problem Details JSON format. Log unexpected errors once with the stack trace and a correlation id; never leak stack traces or internal messages to clients.",
      },
    ],
    quiz: [
      {
        q: "Which of these is a checked exception?",
        options: ["NullPointerException", "IllegalArgumentException", "IOException", "ArithmeticException"],
        answer: 2,
        explain: "IOException extends Exception but not RuntimeException, so it must be caught or declared.",
      },
      {
        q: "With `try (A a = ...; B b = ...)`, in which order are they closed?",
        options: ["a then b", "b then a", "In parallel", "Only if no exception was thrown"],
        answer: 1,
        explain: "Reverse order of declaration, always.",
      },
      {
        q: "The try block throws X, then close() throws Y. What does the caller see?",
        options: ["Y", "X, with Y as a suppressed exception", "Both as separate exceptions", "Nothing"],
        answer: 1,
        explain: "try-with-resources preserves the primary exception and attaches close failures as suppressed.",
      },
      {
        q: "Why should you pass the original exception when wrapping it?",
        options: ["It's required by the compiler", "So the stack trace shows the root cause", "It makes the code faster", "To make it checked"],
        answer: 1,
        explain: "The cause chain is often the only clue to what really failed.",
      },
      {
        q: "What's wrong with `catch (Exception e) { }`?",
        options: ["Nothing", "It silently swallows every failure, including bugs", "It doesn't compile", "It catches Errors too"],
        answer: 1,
        explain: "Empty catch blocks hide bugs. Handle, log, or let it propagate.",
      },
    ],
  },

  // ------------------------------------------------------------------ COLLECTIONS
  {
    id: "java-collections",
    stage: "Core",
    title: "Collections & generics",
    tagline: "List, Set, Map, Deque and PriorityQueue: how they work, what they cost, and how generics keep them type-safe.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["hashtable"],
    concept: `
## The Collections Framework
\`\`\`text
Iterable
└── Collection
    ├── List      ordered, indexed, duplicates allowed      ArrayList, LinkedList
    ├── Set       no duplicates                             HashSet, LinkedHashSet, TreeSet
    └── Queue     FIFO / priority                           ArrayDeque, PriorityQueue
        └── Deque double-ended: stack AND queue             ArrayDeque, LinkedList
Map (not a Collection): key → value                         HashMap, LinkedHashMap, TreeMap
\`\`\`
**Declare variables by interface, construct the implementation**: \`List<String> names = new ArrayList<>();\`. You can swap implementations later without touching the code that uses it.

## Which one? (the interview cheat sheet)
| Need | Use | Why |
|---|---|---|
| A list, mostly appending and indexing | **ArrayList** | Contiguous array: O(1) get, amortized O(1) add, cache-friendly |
| Fast "contains?" / no duplicates | **HashSet** | O(1) average |
| Key → value lookups | **HashMap** | O(1) average |
| Keep insertion order | **LinkedHashMap / LinkedHashSet** | Hash + a linked list through the entries |
| Sorted keys, ranges, floor/ceiling | **TreeMap / TreeSet** | Red-black tree: O(log n) |
| Stack or queue | **ArrayDeque** | Faster than \`Stack\` (legacy, synchronized) and \`LinkedList\` |
| Always get the min (or max) | **PriorityQueue** | Binary heap: O(log n) offer/poll, O(1) peek |
| LRU cache | **LinkedHashMap** with \`accessOrder=true\` + \`removeEldestEntry\` | |
| Keys are enums | **EnumMap / EnumSet** | Array/bit-vector backed, very fast |
| Shared between threads | **ConcurrentHashMap**, \`CopyOnWriteArrayList\`, \`BlockingQueue\` | Concurrency chapter |

**LinkedList is almost never the right choice**: O(n) to reach an index, and every node is a separate object (poor cache locality). Even for queues, \`ArrayDeque\` wins.

## How HashMap works
1. \`key.hashCode()\` is computed, its high bits mixed into the low bits, and masked to pick one of the table's **buckets** (the table size is a power of two, default 16).
2. The bucket holds a small linked list of entries; \`equals\` finds the right key. When a bucket grows past 8 entries (and the table has ≥ 64 buckets), it turns into a **red-black tree**, so the worst case is O(log n) instead of O(n).
3. When size exceeds **capacity × load factor (0.75)**, the table **doubles** and every entry is redistributed.

Consequences: keys need correct \`equals\` *and* \`hashCode\`; don't mutate a key after inserting it; iteration order is **not defined**; one \`null\` key is allowed (but not in \`ConcurrentHashMap\` or \`Map.of\`). Play with the hash table visualizer to see buckets, collisions and resizing.

## Map API you should know
\`\`\`java
map.getOrDefault(k, 0);
map.putIfAbsent(k, v);
map.merge(word, 1, Integer::sum);                         // count occurrences
map.computeIfAbsent(dept, d -> new ArrayList<>()).add(e); // group into lists
map.entrySet() / keySet() / values();                     // views, not copies
\`\`\`

## Ordering things
- **Comparable** is a class's natural order: \`class Version implements Comparable<Version>\`, \`compareTo\` returns negative, zero or positive.
- **Comparator** is an external order, built fluently:
\`\`\`java
people.sort(Comparator.comparing(Person::lastName)
                      .thenComparing(Person::firstName)
                      .thenComparing(Person::age, Comparator.reverseOrder()));
\`\`\`
\`List.sort\` and \`Collections.sort\` are **stable** (TimSort): equal elements keep their order.

## Iterating safely
- Removing from a collection inside a for-each throws \`ConcurrentModificationException\`. Use \`removeIf(predicate)\` or an \`Iterator\` and \`it.remove()\`.
- \`List.remove(int index)\` vs \`List.remove(Object o)\`: on a \`List<Integer>\`, \`list.remove(1)\` removes **index 1**. Use \`list.remove(Integer.valueOf(1))\` to remove the value.

## Immutable collections
\`List.of(...)\`, \`Set.of(...)\`, \`Map.of(...)\` and \`List.copyOf(...)\` create **unmodifiable** collections (no nulls allowed). \`Collections.unmodifiableList(list)\` is only a read-only **view**: changes to the underlying list show through. \`Arrays.asList\` is fixed-size but writable.

## Generics
Generics give compile-time type safety: \`List<String>\` can only hold strings, and \`get\` returns \`String\` without a cast.
\`\`\`java
class Box<T> { T value; }                          // generic class
static <T> T firstOf(List<T> xs) { return xs.get(0); }   // generic method
static <T extends Comparable<T>> T max(List<T> xs)       // bounded type parameter
\`\`\`
**Wildcards and PECS** ("Producer Extends, Consumer Super"):
- \`List<? extends Number>\`: you can **read** \`Number\`s from it (a producer), but not add to it. Accepts \`List<Integer>\`, \`List<Double>\`.
- \`List<? super Integer>\`: you can **add** \`Integer\`s to it (a consumer). Accepts \`List<Number>\`, \`List<Object>\`.
- Why needed: \`List<Integer>\` is **not** a \`List<Number>\` (generics are *invariant*); otherwise you could add a \`Double\` to a list of integers.

**Type erasure**: generic types exist only at compile time. At run time \`List<String>\` and \`List<Integer>\` are both just \`List\`. So you can't do \`new T()\`, \`T[]\`, or \`instanceof List<String>\`, and primitives can't be type arguments (\`List<int>\` is illegal: use \`List<Integer>\` or \`IntStream\`).
`,
    keyPoints: [
      "ArrayList, HashMap, HashSet, ArrayDeque cover 90% of needs",
      "HashMap: hashCode picks the bucket, equals finds the key; resize at 75% full",
      "TreeMap/TreeSet: sorted, O(log n), floor/ceiling/range queries",
      "PriorityQueue is a min-heap; pass a Comparator for max-heap or custom order",
      "Use removeIf or Iterator.remove, never remove inside a for-each",
      "List.of/Map.of are immutable and reject nulls",
      "PECS: ? extends to read (producer), ? super to write (consumer)",
      "Generics are erased at run time: no new T(), no List<int>",
    ],
    complexity: [
      { op: "ArrayList get / set", time: "O(1)" },
      { op: "ArrayList add (end)", time: "O(1) amortized", note: "grows ×1.5 when full" },
      { op: "ArrayList add/remove at index", time: "O(n)", note: "shifts elements" },
      { op: "HashMap / HashSet get, put, contains", time: "O(1) avg", note: "O(log n) worst with treeified buckets" },
      { op: "TreeMap / TreeSet get, put, floor", time: "O(log n)" },
      { op: "ArrayDeque push / pop / offer / poll", time: "O(1) amortized" },
      { op: "PriorityQueue offer / poll", time: "O(log n)", note: "peek is O(1)" },
      { op: "PriorityQueue contains / remove(Object)", time: "O(n)" },
      { op: "Collections.sort / List.sort", time: "O(n log n)", space: "O(n)", note: "stable TimSort" },
    ],
    code: [
      {
        title: "Counting words with HashMap, TreeMap and LinkedHashSet",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;

public class WordCount {
    public static void main(String[] args) {
        String text = "the quick brown fox jumps over the lazy dog the fox";
        Map<String, Integer> counts = new HashMap<>();
        for (String w : text.split(" ")) counts.merge(w, 1, Integer::sum);   // insert 1 or add 1

        List<Map.Entry<String, Integer>> entries = new ArrayList<>(counts.entrySet());
        Comparator<Map.Entry<String, Integer>> byCountDesc = Map.Entry.comparingByValue(Comparator.reverseOrder());
        entries.sort(byCountDesc.thenComparing(Map.Entry.comparingByKey()));
        System.out.println("top 3: " + entries.subList(0, 3));

        Map<String, Integer> sorted = new TreeMap<>(counts);                 // sorted by key
        System.out.println("alphabetical: " + sorted);
        System.out.println("distinct words: " + counts.size() + ", 'cat' = " + counts.getOrDefault("cat", 0));

        Map<Integer, List<String>> byLength = new TreeMap<>();
        for (String w : sorted.keySet()) byLength.computeIfAbsent(w.length(), k -> new ArrayList<>()).add(w);
        System.out.println("by length: " + byLength);

        Set<String> firstSeen = new LinkedHashSet<>(Arrays.asList(text.split(" ")));
        System.out.println("first-seen order: " + firstSeen);
    }
}`,
          },
        ],
        output: `top 3: [the=3, fox=2, brown=1]
alphabetical: {brown=1, dog=1, fox=2, jumps=1, lazy=1, over=1, quick=1, the=3}
distinct words: 8, 'cat' = 0
by length: {3=[dog, fox, the], 4=[lazy, over], 5=[brown, jumps, quick]}
first-seen order: [the, quick, brown, fox, jumps, over, lazy, dog]`,
        explain: `- \`merge(w, 1, Integer::sum)\` is the idiomatic counter: put 1 if absent, otherwise combine the old value and 1 with \`Integer::sum\`.
- We never print the \`HashMap\` directly: its iteration order is unspecified and can change between Java versions. Sort, or copy into a \`TreeMap\`.
- \`computeIfAbsent(key, k -> new ArrayList<>()).add(w)\` is the grouping idiom: create the list the first time, then append.
- \`LinkedHashSet\` removes duplicates but remembers insertion order.`,
      },
      {
        title: "Stacks, queues, heaps and sorted maps",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;

public class Structures {
    record Task(String name, int priority) {}

    public static void main(String[] args) {
        Deque<Integer> stack = new ArrayDeque<>();       // prefer ArrayDeque over Stack
        stack.push(1);
        stack.push(2);
        stack.push(3);
        System.out.println("stack pop: " + stack.pop() + ", peek: " + stack.peek());

        Queue<String> queue = new ArrayDeque<>();
        queue.offer("a");
        queue.offer("b");
        queue.offer("c");
        System.out.println("queue poll: " + queue.poll() + ", remaining: " + queue);

        PriorityQueue<Task> pq = new PriorityQueue<>(Comparator.comparingInt(Task::priority).reversed());
        pq.add(new Task("email", 1));
        pq.add(new Task("outage", 9));
        pq.add(new Task("review", 5));
        StringBuilder order = new StringBuilder();
        while (!pq.isEmpty()) order.append(pq.poll().name()).append(' ');
        System.out.println("by priority: " + order.toString().strip());

        PriorityQueue<Integer> minHeap = new PriorityQueue<>();      // top-k with a size-k min-heap
        for (int x : new int[] {5, 1, 9, 3, 7, 8, 2}) {
            minHeap.offer(x);
            if (minHeap.size() > 3) minHeap.poll();                  // evict the smallest
        }
        List<Integer> top3 = new ArrayList<>(minHeap);
        top3.sort(Comparator.reverseOrder());
        System.out.println("top 3: " + top3);

        TreeMap<Integer, String> grades = new TreeMap<>(Map.of(90, "A", 80, "B", 70, "C", 60, "D"));
        StringBuilder g = new StringBuilder();
        for (int score : new int[] {95, 83, 61, 42}) {
            Map.Entry<Integer, String> e = grades.floorEntry(score);  // greatest key <= score
            g.append(score).append("->").append(e == null ? "F" : e.getValue()).append(' ');
        }
        System.out.println(g.toString().strip());
        System.out.println("first=" + grades.firstKey() + " ceiling(75)=" + grades.ceilingKey(75) + " below 80: " + grades.headMap(80));
    }
}`,
          },
        ],
        output: `stack pop: 3, peek: 2
queue poll: a, remaining: [b, c]
by priority: outage review email
top 3: [9, 8, 7]
95->A 83->B 61->D 42->F
first=60 ceiling(75)=80 below 80: {60=D, 70=C}`,
        explain: `- \`ArrayDeque\` is both a stack (\`push\`/\`pop\`/\`peek\` at the head) and a queue (\`offer\` at the tail, \`poll\` at the head).
- \`PriorityQueue\` is a **min-heap** by default. \`.reversed()\` on the comparator turns it into a max-heap. Iterating a PriorityQueue does *not* give sorted order; only repeated \`poll()\` does.
- The **top-k** pattern: keep a min-heap of size k; whatever survives is the k largest. O(n log k).
- \`TreeMap.floorEntry\` turns a grade table into a lookup in O(log n), no if-else chain.`,
      },
      {
        title: "Generics: classes, bounded methods and PECS wildcards",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;
import java.util.function.Function;

public class Generics {
    static class Box<T> {
        private final T value;
        Box(T value) { this.value = value; }
        T get() { return value; }
        <R> Box<R> map(Function<? super T, ? extends R> f) { return new Box<>(f.apply(value)); }
        @Override public String toString() { return "Box(" + value + ")"; }
    }

    // T must be comparable to itself (or a supertype)
    static <T extends Comparable<? super T>> T max(List<? extends T> items) {
        T best = items.get(0);
        for (T item : items) if (item.compareTo(best) > 0) best = item;
        return best;
    }

    static double sum(Collection<? extends Number> numbers) {   // producer: we READ from it
        double total = 0;
        for (Number n : numbers) total += n.doubleValue();
        return total;
    }

    static void addOnes(List<? super Integer> sink, int count) { // consumer: we WRITE into it
        for (int i = 0; i < count; i++) sink.add(1);
    }

    public static void main(String[] args) {
        Box<String> name = new Box<>("generics");
        Box<Integer> length = name.map(String::length);
        System.out.println(name + " -> " + length + ", no cast needed: " + (length.get() + 1));

        System.out.println(max(List.of(3, 17, 9)) + " " + max(List.of("pear", "apple", "zebra")));
        System.out.println(sum(List.of(1, 2, 3)) + " " + sum(List.of(1.5, 2.5)));

        List<Number> numbers = new ArrayList<>(List.of(0.5));
        addOnes(numbers, 2);                 // a List<Number> accepts Integers
        List<Object> objects = new ArrayList<>();
        addOnes(objects, 1);                 // so does a List<Object>
        System.out.println(numbers + " " + objects);

        List<String> strings = new ArrayList<>();
        List<Integer> ints = new ArrayList<>();
        System.out.println("same class at run time: " + (strings.getClass() == ints.getClass()));
    }
}`,
          },
        ],
        output: `Box(generics) -> Box(8), no cast needed: 9
17 zebra
6.0 4.0
[0.5, 1, 1] [1]
same class at run time: true`,
        explain: `- \`<T extends Comparable<? super T>>\` reads "any T that can compare itself to T or a supertype of T". It's the signature of \`Collections.max\`.
- \`sum\` takes \`? extends Number\`, so it accepts \`List<Integer>\` and \`List<Double>\`; a plain \`List<Number>\` parameter would reject both.
- \`addOnes\` takes \`? super Integer\` so it can write into a list of Integers, Numbers or Objects.
- The last line shows **type erasure**: both lists are plain \`ArrayList\` at run time.`,
      },
      {
        title: "Iteration pitfalls and immutable collections",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;

public class Pitfalls {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
        try {
            for (Integer n : nums) if (n % 2 == 0) nums.remove(n);
        } catch (ConcurrentModificationException e) {
            System.out.println("CME: don't remove inside a for-each");
        }

        nums = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
        nums.removeIf(n -> n % 2 == 0);
        System.out.println("removeIf: " + nums);

        Iterator<Integer> it = nums.iterator();
        while (it.hasNext()) if (it.next() == 3) it.remove();   // the iterator's own remove is safe
        System.out.println("iterator.remove: " + nums);

        List<Integer> list = new ArrayList<>(List.of(10, 20, 30));
        list.remove(1);                       // removes INDEX 1
        list.remove(Integer.valueOf(10));     // removes the VALUE 10
        System.out.println("remove(int) vs remove(Object): " + list);

        List<String> fixed = List.of("a", "b");
        try {
            fixed.add("c");
        } catch (UnsupportedOperationException e) {
            System.out.println("List.of is immutable");
        }
        List<String> view = Arrays.asList("x", "y");
        view.set(0, "z");                     // fixed-size, but writable
        System.out.println("Arrays.asList set: " + view);
    }
}`,
          },
        ],
        output: `CME: don't remove inside a for-each
removeIf: [1, 3, 5]
iterator.remove: [1, 5]
remove(int) vs remove(Object): [30]
List.of is immutable
Arrays.asList set: [z, y]`,
        explain: `- The for-each loop uses an iterator that detects structural changes made behind its back and fails fast.
- \`removeIf\` is the clean one-liner; \`Iterator.remove\` works when the logic is more complex.
- The \`remove(int)\` vs \`remove(Object)\` overload trap catches people in interviews: autoboxing doesn't happen when an exact \`int\` overload exists.`,
      },
    ],
    interview: [
      {
        q: "How does HashMap work internally?",
        a: "It's an array of buckets (size a power of two, default 16). `put` computes `key.hashCode()`, spreads the high bits (`h ^ (h >>> 16)`), and masks with `n - 1` to pick a bucket. Each bucket is a linked list of entries; the key is found with `equals`. Since Java 8, a bucket with more than 8 entries (when the table has at least 64 buckets) becomes a red-black tree, so worst-case lookups are O(log n). When `size > capacity × loadFactor (0.75)`, the table doubles and entries are redistributed (each lands either in the same index or index + old capacity). Average get/put is O(1). It allows one null key, isn't thread-safe, and iteration order is unspecified.",
        freq: "very-common",
      },
      {
        q: "ArrayList vs LinkedList?",
        a: "**ArrayList** stores elements in a contiguous array: O(1) random access, amortized O(1) append, O(n) insert/remove in the middle (shifting), compact and cache-friendly. **LinkedList** is a doubly linked list: O(1) insert/remove *if you already hold the node* (via an iterator), but O(n) to reach an index, and each element costs a separate node object (~24+ bytes overhead) with poor locality. In practice ArrayList wins almost every benchmark, and ArrayDeque beats LinkedList as a queue. Use LinkedList rarely, if ever.",
        freq: "very-common",
      },
      {
        q: "HashMap vs TreeMap vs LinkedHashMap?",
        a: "**HashMap**: O(1) average operations, no ordering. **LinkedHashMap**: HashMap plus a doubly linked list through the entries, so iteration follows insertion order (or access order: the basis for an LRU cache with `removeEldestEntry`). **TreeMap**: a red-black tree, O(log n), keys kept sorted by natural order or a Comparator, with navigation methods (`floorKey`, `ceilingEntry`, `headMap`, `subMap`). Pick by the ordering you need.",
        freq: "very-common",
      },
      {
        q: "What is a ConcurrentModificationException and how do you avoid it?",
        a: "Collections like `ArrayList` and `HashMap` keep a `modCount`; their iterators remember it and throw `ConcurrentModificationException` if the collection is structurally modified other than through the iterator itself. It's a **fail-fast** bug detector, usually triggered single-threaded by removing inside a for-each. Fixes: `removeIf`, `Iterator.remove()`, collecting changes and applying them after the loop, or iterating over a copy. For multi-threaded access use concurrent collections (`ConcurrentHashMap`, `CopyOnWriteArrayList`), whose iterators are weakly consistent and never throw it.",
        freq: "common",
      },
      {
        q: "What's type erasure and what limitations does it cause?",
        a: "The compiler checks generic types, then erases them: `List<String>` becomes a raw `List` in bytecode, with casts inserted where values are read. Benefits: backward compatibility with pre-Java-5 code and one class per generic type. Limitations: you can't create `new T()` or `new T[n]`, can't use `instanceof List<String>`, can't overload methods that differ only by type argument (`f(List<String>)` vs `f(List<Integer>)`), can't use primitives as type arguments, and type information isn't available at run time (work around with a `Class<T>` parameter or type tokens).",
        freq: "common",
      },
      {
        q: "Explain PECS.",
        a: "**Producer Extends, Consumer Super.** If a parameter only *produces* values you read, declare it `? extends T` so callers can pass collections of any subtype (`List<Integer>` for `Collection<? extends Number>`). If it only *consumes* values you write, declare it `? super T` so callers can pass collections of any supertype (`List<Object>` for `List<? super Integer>`). `Collections.copy(List<? super T> dest, List<? extends T> src)` shows both. If you both read and write, use exactly `T`.",
      },
    ],
    quiz: [
      {
        q: "Which collection gives O(1) average lookup of whether a value is present, with no duplicates?",
        options: ["ArrayList", "TreeSet", "HashSet", "LinkedList"],
        answer: 2,
        explain: "HashSet is backed by a HashMap: O(1) average contains. TreeSet is O(log n).",
      },
      {
        q: "What's the default load factor of HashMap, at which it resizes?",
        options: ["0.5", "0.75", "1.0", "2.0"],
        answer: 1,
        explain: "When size exceeds 75% of capacity, the table doubles.",
      },
      {
        q: "How do you get a max-heap of Integers?",
        options: ["new PriorityQueue<>()", "new PriorityQueue<>(Comparator.reverseOrder())", "new TreeSet<>()", "new ArrayDeque<>()"],
        answer: 1,
        explain: "PriorityQueue is a min-heap by default; a reversed comparator flips it.",
      },
      {
        q: "On a `List<Integer> list = [10, 20, 30]`, what does `list.remove(1)` remove?",
        options: ["The value 1", "The element at index 1 (20)", "Nothing", "It throws"],
        answer: 1,
        explain: "remove(int index) is an exact match, so no autoboxing to remove(Object) happens.",
      },
      {
        q: "Which method can accept both a `List<Integer>` and a `List<Double>`?",
        options: ["sum(List<Number> xs)", "sum(List<? extends Number> xs)", "sum(List<? super Number> xs)", "sum(List<Object> xs)"],
        answer: 1,
        explain: "Generics are invariant; `? extends Number` accepts lists of any Number subtype for reading.",
      },
      {
        q: "Why should you prefer ArrayDeque over Stack?",
        options: ["Stack can't hold objects", "Stack is a legacy synchronized class built on Vector; ArrayDeque is faster", "ArrayDeque is thread-safe", "Stack is LIFO"],
        answer: 1,
        explain: "Stack extends Vector (synchronized, legacy). The Javadoc itself recommends Deque/ArrayDeque.",
      },
    ],
    problems: [
      { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "Easy", note: "HashMap of value → index" },
      { title: "Group Anagrams", url: "https://leetcode.com/problems/group-anagrams/", difficulty: "Medium", note: "computeIfAbsent grouping" },
      { title: "Top K Frequent Elements", url: "https://leetcode.com/problems/top-k-frequent-elements/", difficulty: "Medium", note: "merge counts + size-k heap" },
      { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "Medium", note: "LinkedHashMap with accessOrder" },
    ],
  },

  // ------------------------------------------------------------------ STREAMS
  {
    id: "java-streams",
    stage: "Core",
    title: "Lambdas, streams & Optional",
    tagline: "Functional interfaces, method references, stream pipelines, collectors that group and summarize, and Optional done right.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["jstream"],
    concept: `
## Lambdas
A **lambda** is an anonymous function: \`(params) -> expression\` or \`(params) -> { statements; }\`. It implements a **functional interface** (an interface with exactly one abstract method):
\`\`\`java
Comparator<String> byLength = (a, b) -> Integer.compare(a.length(), b.length());
Runnable task = () -> System.out.println("running");
\`\`\`
Lambdas can use local variables from the surrounding scope only if they're **effectively final** (never reassigned). That rule prevents data races on captured locals.

## The core functional interfaces (java.util.function)
| Interface | Shape | Example |
|---|---|---|
| \`Function<T, R>\` | T → R | \`String::length\` |
| \`Predicate<T>\` | T → boolean | \`s -> s.isBlank()\` |
| \`Consumer<T>\` | T → void | \`System.out::println\` |
| \`Supplier<T>\` | () → T | \`ArrayList::new\` |
| \`BiFunction<T, U, R>\` | (T, U) → R | \`(a, b) -> a + b\` |
| \`UnaryOperator<T>\` / \`BinaryOperator<T>\` | T → T / (T, T) → T | \`String::toUpperCase\` / \`Integer::sum\` |
Primitive specializations (\`IntPredicate\`, \`ToIntFunction\`, \`IntBinaryOperator\`…) avoid boxing. They compose: \`f.andThen(g)\`, \`p.negate()\`, \`p.and(q)\`.

## Method references
| Kind | Syntax | Equivalent lambda |
|---|---|---|
| Static method | \`Integer::parseInt\` | \`s -> Integer.parseInt(s)\` |
| Instance method of a particular object | \`System.out::println\` | \`x -> System.out.println(x)\` |
| Instance method of an arbitrary object | \`String::toUpperCase\` | \`s -> s.toUpperCase()\` |
| Constructor | \`ArrayList::new\` | \`() -> new ArrayList<>()\` |

## Streams: declarative data pipelines
A stream is a **one-shot pipeline** over a source (collection, array, \`IntStream.range\`, \`Files.lines\`). It has three parts:
\`\`\`java
List<String> result = orders.stream()            // 1. source
    .filter(o -> o.total() > 100)               // 2. intermediate ops (lazy)
    .map(Order::customer)
    .distinct()
    .sorted()
    .toList();                                  // 3. terminal op: runs the pipeline
\`\`\`
- **Intermediate** (return a stream, lazy): \`filter\`, \`map\`, \`flatMap\`, \`distinct\`, \`sorted\`, \`limit\`, \`skip\`, \`peek\`, \`mapToInt\`, \`takeWhile\`.
- **Terminal** (produce a result, trigger execution): \`toList\` (Java 16+, unmodifiable), \`collect\`, \`forEach\`, \`reduce\`, \`count\`, \`min\`/\`max\`, \`anyMatch\`/\`allMatch\`/\`noneMatch\`, \`findFirst\`.
- Nothing happens until the terminal operation. Then elements flow through **one at a time**, and short-circuiting ops (\`limit\`, \`findFirst\`, \`anyMatch\`) stop early. Stateful ops like \`sorted\` must see everything first. **Watch it in the visualizer.**
- A stream can't be reused after its terminal operation.

## Collectors: grouping and summarizing
\`\`\`java
Map<String, List<Employee>> byDept   = staff.stream().collect(groupingBy(Employee::dept));
Map<String, Long> headcount          = staff.stream().collect(groupingBy(Employee::dept, counting()));
Map<String, Double> avgSalary        = staff.stream().collect(groupingBy(Employee::dept, averagingDouble(Employee::salary)));
Map<Boolean, List<Employee>> seniors = staff.stream().collect(partitioningBy(e -> e.age() > 40));
Map<Long, Employee> byId             = staff.stream().collect(toMap(Employee::id, e -> e));   // throws on duplicate keys!
String csv                           = names.stream().collect(joining(", ", "[", "]"));
\`\`\`
\`groupingBy(classifier, TreeMap::new, downstream)\` gives a sorted result map. \`toMap\` takes a third argument to merge duplicates.

## Primitive streams
\`IntStream\`, \`LongStream\`, \`DoubleStream\` avoid boxing and add \`sum\`, \`average\`, \`summaryStatistics\`, \`range\`/\`rangeClosed\`. Convert with \`mapToInt(...)\` and back with \`boxed()\`.

## Optional
\`Optional<T>\` is a **return type** that says "there may be no result":
\`\`\`java
Optional<User> user = repo.findByEmail(email);
String name = user.map(User::name).orElse("guest");
User u = user.orElseThrow(() -> new NotFoundException(email));
user.ifPresent(this::sendWelcome);
\`\`\`
Do: return it from lookups, chain with \`map\`/\`flatMap\`/\`filter\`, finish with \`orElse\`/\`orElseGet\`/\`orElseThrow\`. Don't: use it for fields, method parameters or collections (return an empty list instead), or call \`get()\` without checking. \`orElse(expensive())\` always evaluates its argument; use \`orElseGet(() -> expensive())\` for lazy defaults.

## When not to use streams
Streams shine for transform/filter/aggregate pipelines. A plain loop is clearer when you need early \`return\`, checked exceptions, mutation of several local variables, or index arithmetic. **Parallel streams** (\`.parallel()\`) use the common ForkJoinPool: only worth it for large, CPU-bound, independent work, and never for I/O or code with side effects.
`,
    keyPoints: [
      "A lambda implements a functional interface (exactly one abstract method)",
      "Captured local variables must be effectively final",
      "Streams are lazy: nothing runs until the terminal operation",
      "Elements flow one at a time; limit/findFirst/anyMatch short-circuit; sorted is a barrier",
      "groupingBy + downstream collectors (counting, averaging, mapping) replace most loops",
      "toList() (16+) is unmodifiable; toMap throws on duplicate keys without a merge function",
      "Optional is for return values; prefer map/orElse over get()",
      "Avoid parallel streams for I/O or side effects",
    ],
    code: [
      {
        title: "Stream pipelines and collectors on real data",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;
import java.util.stream.*;

public class StreamsDemo {
    record Employee(String name, String dept, double salary, int age) {}

    public static void main(String[] args) {
        List<Employee> staff = List.of(
            new Employee("Ada", "Eng", 150_000, 36),
            new Employee("Linus", "Eng", 130_000, 29),
            new Employee("Grace", "Eng", 170_000, 45),
            new Employee("Ken", "Ops", 110_000, 52),
            new Employee("Barbara", "Sales", 95_000, 41),
            new Employee("Margaret", "Ops", 125_000, 33));

        List<String> seniorEng = staff.stream()
            .filter(e -> e.dept().equals("Eng") && e.salary() > 140_000)
            .map(Employee::name)
            .sorted()
            .toList();
        System.out.println("senior eng: " + seniorEng);

        Map<String, Long> headcount = staff.stream()
            .collect(Collectors.groupingBy(Employee::dept, TreeMap::new, Collectors.counting()));
        System.out.println("headcount: " + headcount);

        Map<String, Double> avgSalary = staff.stream()
            .collect(Collectors.groupingBy(Employee::dept, TreeMap::new, Collectors.averagingDouble(Employee::salary)));
        avgSalary.forEach((dept, avg) -> System.out.printf("  %-5s avg $%,.0f%n", dept, avg));

        Map<Boolean, List<String>> over40 = staff.stream()
            .collect(Collectors.partitioningBy(e -> e.age() > 40, Collectors.mapping(Employee::name, Collectors.toList())));
        System.out.println("over 40: " + over40.get(true) + ", 40 or under: " + over40.get(false));

        Optional<Employee> top = staff.stream().max(Comparator.comparingDouble(Employee::salary));
        System.out.println("top earner: " + top.map(Employee::name).orElse("nobody"));

        DoubleSummaryStatistics stats = staff.stream().mapToDouble(Employee::salary).summaryStatistics();
        System.out.printf("payroll $%,.0f, min $%,.0f, max $%,.0f%n", stats.getSum(), stats.getMin(), stats.getMax());

        System.out.println(staff.stream().map(Employee::name).collect(Collectors.joining(", ", "[", "]")));
    }
}`,
          },
        ],
        output: `senior eng: [Ada, Grace]
headcount: {Eng=3, Ops=2, Sales=1}
  Eng   avg $150,000
  Ops   avg $117,500
  Sales avg $95,000
over 40: [Grace, Ken, Barbara], 40 or under: [Ada, Linus, Margaret]
top earner: Grace
payroll $780,000, min $95,000, max $170,000
[Ada, Linus, Grace, Ken, Barbara, Margaret]`,
        explain: `- Each pipeline reads like a sentence: *filter, map, sort, collect*.
- \`groupingBy(key, TreeMap::new, downstream)\`: the middle argument picks the map type (sorted here); the downstream collector decides what each group becomes (a count, an average…).
- \`partitioningBy\` always produces exactly two groups, \`true\` and \`false\`.
- \`summaryStatistics()\` computes count, sum, min, max and average in one pass.`,
      },
      {
        title: "Lambdas, functional interfaces and method references",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;
import java.util.function.*;

public class Lambdas {
    public static void main(String[] args) {
        Function<Integer, Integer> square = x -> x * x;
        Function<Integer, Integer> plusOne = x -> x + 1;
        System.out.println(square.andThen(plusOne).apply(5) + " " + square.compose(plusOne).apply(5));

        Predicate<String> empty = String::isEmpty;             // method reference
        Predicate<String> notEmpty = empty.negate();
        System.out.println(notEmpty.test("hi") + " " + notEmpty.test(""));

        Supplier<List<String>> fresh = ArrayList::new;         // constructor reference
        List<String> list = fresh.get();
        Consumer<String> adder = list::add;                    // bound to this particular list
        adder.accept("x");
        adder.accept("y");
        System.out.println(list);

        BiFunction<String, Integer, String> repeat = String::repeat;   // (s, n) -> s.repeat(n)
        UnaryOperator<String> shout = s -> s.toUpperCase() + "!";
        System.out.println(shout.apply(repeat.apply("ha", 3)));

        int base = 10;                                         // effectively final, so capturable
        IntBinaryOperator addBase = (a, b) -> a + b + base;
        System.out.println(addBase.applyAsInt(1, 2));

        List<String> words = new ArrayList<>(List.of("kiwi", "fig", "banana", "apple", "pear"));
        words.sort(Comparator.comparingInt(String::length).thenComparing(Comparator.reverseOrder()));
        System.out.println(words);

        Map<String, Integer> stock = new TreeMap<>(Map.of("apple", 3));
        stock.computeIfAbsent("pear", k -> 0);
        stock.merge("apple", 2, Integer::sum);
        stock.replaceAll((k, v) -> v * 10);
        System.out.println(stock);
    }
}`,
          },
        ],
        output: `26 36
true false
[x, y]
HAHAHA!
13
[fig, pear, kiwi, apple, banana]
{apple=50, pear=0}`,
        explain: `- \`andThen\` applies \`square\` then \`plusOne\` (25 + 1); \`compose\` applies \`plusOne\` first (6 squared).
- \`String::repeat\` used as a \`BiFunction\`: the first argument becomes the object the method is called on.
- If \`base\` were reassigned anywhere, the lambda wouldn't compile.
- Ties in length (\`pear\`, \`kiwi\`) are broken by the second comparator: reverse alphabetical.`,
      },
      {
        title: "flatMap, primitive streams, Optional and laziness",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;
import java.util.stream.*;

public class MoreStreams {
    record Order(String id, List<String> items) {}

    static final Map<String, String> EMAILS = Map.of("ada", "ada@example.com");

    static Optional<String> findEmail(String user) {
        return Optional.ofNullable(EMAILS.get(user));
    }

    public static void main(String[] args) {
        List<Order> orders = List.of(new Order("o1", List.of("pen", "book")), new Order("o2", List.of("book", "lamp", "pen")));
        Map<String, Long> itemCounts = orders.stream()
            .flatMap(o -> o.items().stream())                 // Stream<Order> -> Stream<String>
            .collect(Collectors.groupingBy(i -> i, TreeMap::new, Collectors.counting()));
        System.out.println(itemCounts);

        System.out.println(IntStream.rangeClosed(1, 5).map(x -> x * x).sum());
        System.out.println(IntStream.range(0, 20).filter(x -> x % 7 == 0).boxed().toList());
        System.out.println(Stream.iterate(1, x -> x * 2).limit(10).map(String::valueOf).collect(Collectors.joining(",")));

        String email = findEmail("ada").map(String::toUpperCase).orElse("unknown");
        String missing = findEmail("bob").orElseGet(() -> "no email for bob");
        System.out.println(email + " | " + missing);
        findEmail("ada").ifPresent(e -> System.out.println("send to " + e));

        List<String> trace = new ArrayList<>();
        List<Integer> firstTwo = Stream.of(3, 8, 1, 6, 9, 4, 7)
            .peek(x -> trace.add("saw " + x))
            .filter(x -> x > 4)
            .limit(2)
            .toList();
        System.out.println(firstTwo + " after " + trace.size() + " elements: " + trace);
    }
}`,
          },
        ],
        output: `{book=2, lamp=1, pen=2}
55
[0, 7, 14]
1,2,4,8,16,32,64,128,256,512
ADA@EXAMPLE.COM | no email for bob
send to ada@example.com
[8, 6] after 4 elements: [saw 3, saw 8, saw 1, saw 6]`,
        explain: `- \`flatMap\` turns each order into a stream of items and flattens them into one stream.
- \`Stream.iterate\` is infinite; \`limit\` makes it finite. Without \`limit\` this would never terminate.
- \`Optional.ofNullable\` wraps a possibly-null value. The chain never touches null.
- The last pipeline proves laziness: only 4 of the 7 elements were ever read, exactly like the visualizer. (\`peek\` is meant for debugging like this; don't put business logic in it.)`,
      },
    ],
    interview: [
      {
        q: "What makes streams lazy, and why does it matter?",
        a: "Intermediate operations (`filter`, `map`, `sorted`…) only build a pipeline description; nothing executes until a terminal operation (`collect`, `toList`, `count`, `findFirst`). Then elements are pulled through the whole pipeline one at a time (vertical processing). This enables short-circuiting (`limit`, `findFirst`, `anyMatch` stop as soon as they can, which also makes infinite streams usable), fuses operations into one pass with no intermediate collections, and avoids work for elements that are filtered out. Stateful operations like `sorted` and `distinct` are the exception: they must buffer input.",
        freq: "very-common",
      },
      {
        q: "map vs flatMap?",
        a: "`map` transforms each element into exactly one element: `Stream<Order>` → `Stream<Customer>`. `flatMap` transforms each element into a *stream* of zero or more elements and flattens them: `Stream<Order>` → `Stream<LineItem>` via `o -> o.items().stream()`. The same distinction exists on Optional: `map` wraps the function's result, `flatMap` expects the function to already return an Optional (avoiding `Optional<Optional<T>>`).",
        freq: "very-common",
      },
      {
        q: "How should Optional be used, and how should it not?",
        a: "Use it as a **method return type** when a result may legitimately be absent (`findById`), and consume it with `map`/`filter`/`flatMap` and `orElse`/`orElseGet`/`orElseThrow`/`ifPresent`. Don't use it for fields (not serializable, extra allocation), method parameters (callers end up passing `Optional.empty()` or null), or collections (return an empty collection). Avoid `optional.get()` without `isPresent()`; prefer `orElseThrow()`. Never return `null` from a method declared to return Optional.",
        freq: "very-common",
      },
      {
        q: "What is a functional interface? Name a few.",
        a: "An interface with exactly one abstract method (it may have default and static methods), optionally marked `@FunctionalInterface` so the compiler enforces it. Lambdas and method references implement them. Examples: `Runnable` (no args, no result), `Callable<V>` (returns V, may throw), `Comparator<T>`, and in `java.util.function`: `Function`, `Predicate`, `Consumer`, `Supplier`, `BiFunction`, `UnaryOperator`, `BinaryOperator`, plus primitive variants like `IntPredicate`.",
        freq: "common",
      },
      {
        q: "When are parallel streams a good or bad idea?",
        a: "Good: large data sets (tens of thousands of elements or more), CPU-heavy per-element work, an easily splittable source (`ArrayList`, arrays, `IntStream.range`), and stateless, non-interfering operations. Bad: small collections (splitting overhead dominates), I/O or blocking calls (they occupy the shared common ForkJoinPool used by the whole JVM), sources that split poorly (`LinkedList`, `Stream.iterate`), operations with side effects or shared mutable state, and order-sensitive operations like `findFirst` or `limit`. Always measure.",
      },
    ],
    quiz: [
      {
        q: "When does `list.stream().filter(...).map(...)` execute the filter?",
        options: ["Immediately", "When a terminal operation is called", "On a background thread", "Never"],
        answer: 1,
        explain: "Intermediate operations are lazy. Without a terminal op, nothing runs.",
      },
      {
        q: "Which collector gives `Map<String, Long>` counting employees per department?",
        options: ["toMap(Employee::dept, 1)", "groupingBy(Employee::dept, counting())", "partitioningBy(Employee::dept)", "joining(Employee::dept)"],
        answer: 1,
        explain: "groupingBy with the counting() downstream collector.",
      },
      {
        q: "A lambda uses a local variable `count` that's incremented later in the method. What happens?",
        options: ["It works", "Compile error: captured variables must be effectively final", "Runtime exception", "The lambda sees the old value"],
        answer: 1,
        explain: "Captured locals must never be reassigned.",
      },
      {
        q: "`Stream.of(3, 8, 1, 6, 9).filter(x -> x > 4).findFirst()` calls the filter how many times?",
        options: ["1", "2", "5", "0"],
        answer: 1,
        explain: "3 fails, 8 passes and findFirst short-circuits: two filter calls.",
      },
      {
        q: "Which is a recommended use of Optional?",
        options: ["As a field in an entity", "As a method parameter", "As the return type of findByEmail", "Wrapping a List"],
        answer: 2,
        explain: "Optional was designed as a return type for possibly-absent results.",
      },
      {
        q: "What's the difference between `orElse(x())` and `orElseGet(() -> x())`?",
        options: ["None", "orElse always calls x(); orElseGet only calls it when empty", "orElseGet always calls x()", "orElse throws when empty"],
        answer: 1,
        explain: "orElse's argument is evaluated eagerly, even if the Optional has a value.",
      },
    ],
  },

  // ------------------------------------------------------------------ TOOLING
  {
    id: "java-tooling",
    stage: "Core",
    title: "Maven, Gradle, JUnit & project structure",
    tagline: "Build tools, dependency management, the standard layout, unit tests with JUnit 5, AssertJ and Mockito, and logging.",
    difficulty: "intermediate",
    minutes: 30,
    concept: `
## Why a build tool
Real projects have dependencies (and their dependencies), tests, packaging, and plugins for formatting and analysis. A build tool downloads libraries from **Maven Central**, compiles, runs tests and produces a \`.jar\` the same way on every machine and in CI.

## Maven
Configured in \`pom.xml\` (Project Object Model). Every artifact has coordinates **groupId : artifactId : version**.
\`\`\`text
my-service/
├── pom.xml
├── mvnw, .mvn/          ← Maven wrapper: pins the Maven version, commit it
├── src/main/java/       ← production code (packages as folders)
├── src/main/resources/  ← config files, templates
├── src/test/java/       ← tests (same packages)
└── target/              ← build output (gitignore it)
\`\`\`
**Lifecycle phases** run in order: \`validate → compile → test → package → verify → install → deploy\`. Running a phase runs all earlier ones.
\`\`\`bash
./mvnw compile             # compile main code
./mvnw test                # + run unit tests
./mvnw package             # + build target/my-service-1.0.jar
./mvnw verify              # + integration tests, checks
./mvnw dependency:tree     # who pulled in which library (debug conflicts)
./mvnw -q -DskipTests package
\`\`\`
**Dependency scopes**: \`compile\` (default, everywhere), \`provided\` (supplied at run time, e.g. by a server), \`runtime\` (not needed to compile: JDBC drivers), \`test\` (JUnit, Mockito). A **BOM** (bill of materials) imported in \`<dependencyManagement>\` pins compatible versions of a family of libraries (Spring Boot's parent does this for hundreds of them).

## Gradle
Configured in code (\`build.gradle.kts\`, Kotlin DSL). Faster incremental builds and a build cache; more flexible, sometimes more complex. Android and many large companies use it.
\`\`\`bash
./gradlew build           # compile, test, assemble
./gradlew test --tests "*PriceCalculatorTest"
./gradlew dependencies
\`\`\`
| | Maven | Gradle |
|---|---|---|
| Config | XML, declarative, very standard | Kotlin/Groovy code |
| Speed | Good | Faster (incremental, build cache, daemon) |
| Learning curve | Gentle | Steeper |
| Popular in | Enterprise backends, Spring | Android, big monorepos |

## Unit tests with JUnit 5
\`\`\`java
class PriceCalculatorTest {
    @Test
    void appliesDiscountOverOneHundredDollars() {
        assertEquals(18_000, new PriceCalculator().total(20_000));
    }
}
\`\`\`
Essentials: \`@Test\`, \`@BeforeEach\`/\`@AfterEach\`, \`@DisplayName\`, \`@Disabled\`, \`@Nested\` (group related tests), \`@ParameterizedTest\` with \`@CsvSource\`/\`@ValueSource\`/\`@MethodSource\`, \`assertThrows\`, \`assertAll\`, \`@Tag\`, \`@Timeout\`. Name tests by behavior: \`rejectsNegativeAmounts\`. Structure each test as **Arrange, Act, Assert**.

**AssertJ** gives readable, chainable assertions with great failure messages: \`assertThat(users).hasSize(2).extracting(User::name).containsExactly("Ada", "Linus");\`

**Mockito** replaces collaborators with **mocks** so you test one class in isolation: stub with \`when(repo.find(1L)).thenReturn(Optional.of(user))\`, check interactions with \`verify(email).sendWelcome("ada@x.com")\`. Mock things you don't own sparingly; prefer fakes or **Testcontainers** (real Postgres/Kafka in Docker) for integration tests.

## The test pyramid
Many fast **unit** tests, fewer **integration** tests (a real database via Testcontainers, an HTTP layer slice), very few slow **end-to-end** tests. Run unit tests on every save; all of them in CI.

## Logging
Code against **SLF4J** (the API) and let the application pick the backend (**Logback** is Spring Boot's default; Log4j 2 is the other big one):
\`\`\`java
private static final Logger log = LoggerFactory.getLogger(OrderService.class);
log.info("order {} placed for {} items", orderId, count);   // {} placeholders, no string concat
log.error("payment failed for order {}", orderId, exception); // exception last
\`\`\`
Use levels consistently (ERROR needs a human, WARN is suspicious, INFO is business events, DEBUG is for developers). In production, log JSON with a request/trace id. Don't log secrets or personal data.

## Code quality
Format automatically (**Spotless** with google-java-format or Palantir), catch bugs with **Error Prone** or **SpotBugs**, enforce style with **Checkstyle**, measure coverage with **JaCoCo**, and keep dependencies patched (Dependabot or Renovate, plus OWASP dependency-check).
`,
    keyPoints: [
      "Maven: pom.xml, groupId:artifactId:version, lifecycle compile → test → package → install",
      "Standard layout: src/main/java, src/main/resources, src/test/java",
      "Commit the wrapper (mvnw / gradlew) so everyone uses the same build tool version",
      "Scopes: compile, provided, runtime, test; BOMs pin compatible versions",
      "JUnit 5: @Test, @BeforeEach, @ParameterizedTest, assertThrows",
      "AssertJ for readable assertions, Mockito to isolate collaborators, Testcontainers for real dependencies",
      "Log through SLF4J with {} placeholders; never log secrets",
    ],
    code: [
      {
        title: "A minimal pom.xml",
        note: "Java 21, JUnit 5, AssertJ and Mockito, with the Surefire plugin running tests",
        variants: [
          {
            lang: "xml",
            code: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.example</groupId>
  <artifactId>pricing</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <maven.compiler.release>21</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <dependencyManagement>
    <dependencies>
      <!-- BOM: one version for every JUnit module -->
      <dependency>
        <groupId>org.junit</groupId>
        <artifactId>junit-bom</artifactId>
        <version>5.13.4</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <version>3.27.6</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.mockito</groupId>
      <artifactId>mockito-junit-jupiter</artifactId>
      <version>5.20.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.4</version>
      </plugin>
    </plugins>
  </build>
</project>`,
          },
        ],
        explain: `- \`maven.compiler.release\` sets the Java language level and API.
- Importing \`junit-bom\` lets the JUnit dependency omit its version.
- Versions move fast: check Maven Central (or let Dependabot/Renovate open upgrade PRs). In Spring Boot projects the parent POM manages these versions for you.`,
      },
      {
        title: "The same build in Gradle (Kotlin DSL)",
        variants: [
          {
            lang: "kotlin",
            code: `// build.gradle.kts
plugins {
    java
    application
}

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }   // Gradle can download the JDK
}

repositories { mavenCentral() }

dependencies {
    testImplementation(platform("org.junit:junit-bom:5.13.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testImplementation("org.assertj:assertj-core:3.27.6")
    testImplementation("org.mockito:mockito-junit-jupiter:5.20.0")
}

application { mainClass = "com.example.pricing.Main" }

tasks.test { useJUnitPlatform() }`,
          },
        ],
        explain: `- \`implementation\` ≈ Maven compile scope, \`testImplementation\` ≈ test, \`runtimeOnly\` ≈ runtime.
- Toolchains make the build use the right JDK regardless of what's installed as default.`,
      },
      {
        title: "JUnit 5 + AssertJ: plain and parameterized tests",
        variants: [
          {
            lang: "java",
            code: `// src/main/java/com/example/pricing/PriceCalculator.java
package com.example.pricing;

public class PriceCalculator {
    /** 10% off orders above $100. Amounts are in cents. */
    public long total(long cents) {
        if (cents < 0) throw new IllegalArgumentException("amount must not be negative");
        return cents > 100_00 ? cents * 90 / 100 : cents;
    }
}

// src/test/java/com/example/pricing/PriceCalculatorTest.java
package com.example.pricing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PriceCalculatorTest {
    private PriceCalculator calc;

    @BeforeEach
    void setUp() { calc = new PriceCalculator(); }      // fresh object for every test

    @Test
    void appliesTenPercentDiscountAboveOneHundredDollars() {
        assertThat(calc.total(200_00)).isEqualTo(180_00);
    }

    @ParameterizedTest(name = "{0} cents -> {1} cents")
    @CsvSource({"0, 0", "5000, 5000", "10000, 10000", "10001, 9000"})
    void boundaries(long input, long expected) {
        assertThat(calc.total(input)).isEqualTo(expected);
    }

    @Test
    void rejectsNegativeAmounts() {
        assertThatThrownBy(() -> calc.total(-1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("negative");
    }
}`,
          },
        ],
        explain: `- Tests mirror the production package so they can see package-private members.
- The parameterized test checks the **boundaries** (exactly $100, one cent above), where off-by-one bugs live.
- Run with \`./mvnw test\`. A failing AssertJ assertion prints both values clearly: \`expected: 9000 but was: 10001\`.`,
      },
      {
        title: "Mockito: test a service without its database or email server",
        variants: [
          {
            lang: "java",
            code: `package com.example.signup;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// Production code under test, shown for context:
// class SignupService {
//     SignupService(UserRepository users, EmailSender email) { ... }
//     void signup(String email) {
//         if (users.existsByEmail(email)) throw new IllegalStateException("taken");
//         users.save(new User(email));
//         this.email.sendWelcome(email);
//     }
// }

@ExtendWith(MockitoExtension.class)
class SignupServiceTest {
    @Mock UserRepository users;
    @Mock EmailSender email;
    @InjectMocks SignupService service;      // constructed with the two mocks

    @Test
    void savesUserAndSendsWelcomeEmail() {
        when(users.existsByEmail("ada@example.com")).thenReturn(false);

        service.signup("ada@example.com");

        verify(users).save(any(User.class));
        verify(email).sendWelcome("ada@example.com");
    }

    @Test
    void rejectsDuplicateEmailAndSendsNothing() {
        when(users.existsByEmail("ada@example.com")).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> service.signup("ada@example.com"));

        verify(users, never()).save(any());
        verifyNoInteractions(email);
    }
}`,
          },
        ],
        explain: `- \`@Mock\` creates fakes that return defaults (false, null, empty) until stubbed with \`when(...).thenReturn(...)\`.
- \`verify\` asserts that an interaction happened (or \`never()\` happened).
- Mock *your own* interfaces at boundaries (repositories, gateways). Over-mocking couples tests to implementation details; for repositories, an integration test with Testcontainers is often more valuable.`,
      },
      {
        title: "Everyday commands",
        variants: [
          {
            lang: "bash",
            code: `# Maven
./mvnw clean verify                     # full build with tests
./mvnw test -Dtest=PriceCalculatorTest  # one test class
./mvnw dependency:tree -Dincludes=com.fasterxml.jackson.core
./mvnw versions:display-dependency-updates

# Gradle
./gradlew build
./gradlew test --tests "*PriceCalculatorTest"
./gradlew dependencies --configuration runtimeClasspath

# Run a packaged app
java -jar target/pricing-1.0.0-SNAPSHOT.jar`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Explain the Maven build lifecycle.",
        a: "The default lifecycle is an ordered list of phases: `validate`, `compile`, `test`, `package`, `verify`, `install` (to the local `~/.m2` repository) and `deploy` (to a remote repository). Invoking a phase runs every phase before it, and plugins bind goals to phases (Surefire runs unit tests in `test`, Failsafe runs integration tests in `verify`). There are also `clean` and `site` lifecycles. `mvn clean install` therefore cleans, compiles, tests, packages and installs.",
        freq: "common",
      },
      {
        q: "How do you resolve a dependency version conflict?",
        a: "Maven picks the **nearest** definition in the dependency tree (first declared wins on ties), which can silently select an old version and cause `NoSuchMethodError` at run time. Diagnose with `mvn dependency:tree`; fix by pinning the version in `<dependencyManagement>` (or importing a BOM), excluding the transitive dependency, or upgrading the library that drags in the old one. The Maven Enforcer plugin's `dependencyConvergence` rule catches conflicts at build time. Gradle picks the highest version by default and supports constraints and platforms.",
        freq: "common",
      },
      {
        q: "What's the difference between a mock, a stub and a fake?",
        a: "A **stub** returns canned answers to calls (`when(repo.find(1)).thenReturn(user)`). A **mock** additionally records interactions so you can verify them (`verify(email).send(...)`). A **fake** is a working lightweight implementation (an in-memory repository). Use stubs for queries, mocks only to verify important side effects at boundaries, and fakes or real dependencies (Testcontainers) when behavior matters more than interactions. Too much mocking makes tests brittle and tied to implementation.",
        freq: "common",
      },
      {
        q: "What does a good unit test look like?",
        a: "Fast (milliseconds), isolated (no shared state, no order dependence, no network), deterministic (no real clock or randomness: inject a `Clock`), and focused on one behavior with a descriptive name. It follows Arrange-Act-Assert, asserts on outcomes rather than internals, and fails with a clear message. Cover boundaries and error paths, not just the happy path. Code coverage is a hint about untested code, not a quality target.",
      },
    ],
    quiz: [
      {
        q: "Where do unit tests go in the Maven standard layout?",
        options: ["src/main/test", "src/test/java", "test/", "src/main/java/tests"],
        answer: 1,
        explain: "src/test/java, mirroring the packages in src/main/java.",
      },
      {
        q: "Which dependency scope fits a JDBC driver you only need at run time?",
        options: ["compile", "provided", "runtime", "test"],
        answer: 2,
        explain: "runtime: not needed to compile, needed when the app runs.",
      },
      {
        q: "`mvn package` runs which phases?",
        options: ["Only package", "validate, compile, test, package", "package and install", "clean and package"],
        answer: 1,
        explain: "A phase runs every earlier phase in the lifecycle.",
      },
      {
        q: "What does Mockito's `verify(email).sendWelcome(\"a@b.c\")` check?",
        options: ["That sendWelcome returns true", "That the mock's sendWelcome was called with that argument", "That an email was really sent", "That the method exists"],
        answer: 1,
        explain: "verify asserts an interaction with the mock happened.",
      },
      {
        q: "Why commit the Maven/Gradle wrapper (mvnw, gradlew)?",
        options: ["It's required by Java", "Everyone and CI build with the same tool version, without installing it", "It speeds up tests", "It stores dependencies"],
        answer: 1,
        explain: "The wrapper downloads and pins a specific build tool version.",
      },
    ],
  },
];
