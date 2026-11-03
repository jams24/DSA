import type { Lesson } from "../types";

// C++ track, part 2: Core.

export const cppCore: Lesson[] = [
  // ------------------------------------------------------------------ SMART POINTERS
  {
    id: "cpp-smart",
    stage: "Core",
    title: "Smart pointers and ownership",
    tagline: "unique_ptr for single ownership, shared_ptr and weak_ptr for shared ownership, custom deleters, and how to express ownership in function signatures.",
    difficulty: "intermediate",
    minutes: 30,
    visualizers: ["cppsmart"],
    concept: `
## Ownership is the question
For every heap object, someone must be responsible for freeing it: its **owner**. Raw pointers (\`T*\`) don't say whether they own what they point to. Smart pointers make ownership explicit and automatic (RAII).

## std::unique_ptr: exactly one owner
\`\`\`cpp
auto w = std::make_unique<Widget>("A");   // allocate + construct; w owns it
auto v = std::move(w);                    // ownership transferred; w is now null
// auto copy = v;                         // compile error: can't copy a unique owner
\`\`\`
- **Zero overhead**: the same size and speed as a raw pointer.
- Freed automatically when the owner is destroyed or reset.
- Movable, not copyable: ownership transfer is visible in the code (\`std::move\`).
- Works for arrays (\`std::unique_ptr<int[]>\`) and with **custom deleters** for C resources (\`FILE*\`, sockets, library handles).
- **Default choice** for heap objects: factories return \`unique_ptr\`, containers hold \`std::vector<std::unique_ptr<Base>>\` for polymorphism.

## std::shared_ptr: shared ownership, reference counted
\`\`\`cpp
auto a = std::make_shared<Config>();   // one allocation: object + control block
auto b = a;                            // use_count == 2
\`\`\`
- A **control block** stores the strong count (shared owners) and weak count. The object is destroyed when the last \`shared_ptr\` goes away.
- Costs: an extra control block, **atomic** increments and decrements on every copy (thread-safe counting, slower), and blurry ownership. Use it only when ownership is genuinely shared and lifetimes can't be predicted (caches, graphs, async callbacks that may outlive their creator).
- Always prefer \`std::make_shared\`: one allocation instead of two, and exception-safe.

## std::weak_ptr: observe without owning
A \`weak_ptr\` points into a \`shared_ptr\`'s control block without keeping the object alive. Call \`lock()\` to get a temporary \`shared_ptr\` (empty if the object is gone).
- **Breaks reference cycles**: if A owns B and B owns A through \`shared_ptr\`s, neither count ever reaches zero: a leak. Make the back-pointer (child to parent, observer to subject) a \`weak_ptr\`. Watch the cycle and the fix in the visualizer.
- Caches that shouldn't keep entries alive.

## Raw pointers and references still have a job
Non-owning access. A function that just uses a widget should take \`Widget&\` (or \`Widget*\` if it may be null), **not** a smart pointer: that keeps it usable with objects owned in any way.

| Signature | Means |
|---|---|
| \`void use(const Widget& w)\` | Uses it, doesn't care who owns it (most common) |
| \`void use(Widget* w)\` | Uses it, may be null |
| \`void take(std::unique_ptr<Widget> w)\` | Takes ownership (caller must \`std::move\`) |
| \`void share(std::shared_ptr<Widget> w)\` | Becomes a co-owner |
| \`std::unique_ptr<Widget> make()\` | Gives ownership to the caller |

## Rules of thumb
1. Prefer values and containers. Use the heap only when you need polymorphism, a large object, or a lifetime beyond the scope.
2. \`std::make_unique\` by default; upgrade to \`shared_ptr\` only for real shared ownership (a \`unique_ptr\` converts to \`shared_ptr\` with \`std::move\`).
3. Never write \`new\`/\`delete\` in application code.
4. Never create two smart pointers from the same raw pointer: double free.
`,
    keyPoints: [
      "unique_ptr: one owner, zero overhead, movable not copyable; the default",
      "make_unique / make_shared instead of new",
      "shared_ptr: reference counted (atomically); use only for genuinely shared ownership",
      "weak_ptr observes without owning; lock() to use; breaks shared_ptr cycles",
      "Pass Widget& or Widget* to functions that only use an object",
      "Pass unique_ptr by value to transfer ownership; return it from factories",
      "Custom deleters wrap C resources (FILE*, sockets, handles) in RAII",
    ],
    code: [
      {
        title: "unique_ptr: factories, transfer and containers",
        variants: [
          {
            lang: "cpp",
            code: `#include <memory>
#include <print>
#include <string>
#include <utility>
#include <vector>

struct Widget {
    std::string name;
    explicit Widget(std::string n) : name(std::move(n)) { std::println("  + {}", name); }
    ~Widget() { std::println("  - {}", name); }
};

std::unique_ptr<Widget> make_widget(std::string name) {        // gives ownership to the caller
    return std::make_unique<Widget>(std::move(name));
}

void consume(std::unique_ptr<Widget> w) {                       // takes ownership
    std::println("  consuming {}", w->name);
}                                                               // ...and destroys it here

void inspect(const Widget& w) {                                 // just uses it: a reference
    std::println("  inspecting {}", w.name);
}

int main() {
    auto a = make_widget("A");
    inspect(*a);
    // auto copy = a;                   // compile error: unique_ptr is not copyable
    auto b = std::move(a);              // ownership moves; a becomes null
    std::println("a is {}, b owns {}", a ? "full" : "empty", b->name);
    consume(std::move(b));
    std::println("after consume, b is {}", b ? "full" : "empty");

    std::vector<std::unique_ptr<Widget>> pool;
    pool.push_back(make_widget("C"));
    pool.push_back(make_widget("D"));
    std::println("pool holds {}", pool.size());
    pool.erase(pool.begin());           // erasing the owner destroys C
    std::println("end of main");
}                                       // the vector is destroyed, and D with it`,
          },
        ],
        output: `  + A
  inspecting A
a is empty, b owns A
  consuming A
  - A
after consume, b is empty
  + C
  + D
pool holds 2
  - C
end of main
  - D`,
        explain: `- Read the signatures: \`make_widget\` returns ownership, \`consume\` takes it (the caller *must* write \`std::move\`, which makes the transfer visible), \`inspect\` only borrows.
- A moved-from \`unique_ptr\` is guaranteed to be null; checking it is fine.
- When the vector grows, it moves the \`unique_ptr\`s, not the widgets: no widget is copied or destroyed.`,
      },
      {
        title: "shared_ptr counts and weak_ptr back-pointers",
        variants: [
          {
            lang: "cpp",
            code: `#include <memory>
#include <print>
#include <string>
#include <utility>
#include <vector>

struct Node {
    std::string name;
    std::vector<std::shared_ptr<Node>> children;   // a parent owns its children
    std::weak_ptr<Node> parent;                    // a child only observes its parent: no cycle
    explicit Node(std::string n) : name(std::move(n)) {}
    ~Node() { std::println("  ~Node {}", name); }
};

int main() {
    auto config = std::make_shared<std::string>("settings");
    std::println("use_count = {}", config.use_count());
    {
        auto another_owner = config;
        std::println("use_count = {} (two owners)", config.use_count());
    }
    std::println("use_count = {}", config.use_count());

    std::weak_ptr<std::string> observer = config;
    if (auto locked = observer.lock()) std::println("observer sees '{}'", *locked);
    config.reset();                                  // last owner gone: string destroyed
    std::println("observer expired: {}", observer.expired());

    {
        auto root = std::make_shared<Node>("root");
        auto child = std::make_shared<Node>("child");
        child->parent = root;                        // weak: doesn't raise root's count
        root->children.push_back(child);
        if (auto p = child->parent.lock()) std::println("child's parent is {}", p->name);
        std::println("counts: root={} child={}", root.use_count(), child.use_count());
    }
    std::println("both nodes were freed");
}`,
          },
        ],
        output: `use_count = 1
use_count = 2 (two owners)
use_count = 1
observer sees 'settings'
observer expired: true
child's parent is root
counts: root=1 child=2
  ~Node root
  ~Node child
both nodes were freed`,
        explain: `- \`child\` has two owners (the local variable and \`root->children\`); \`root\` has one, because the child's back-pointer is weak.
- At the end of the block, \`child\`'s local owner goes first (count 2 → 1), then \`root\`'s (1 → 0): root is destroyed, its \`children\` vector releases the last owner of child, and child is destroyed too.
- Make \`parent\` a \`shared_ptr\` instead and neither destructor would ever run: a leak through a cycle. The visualizer shows exactly that.`,
      },
      {
        title: "Custom deleters: RAII for C resources",
        variants: [
          {
            lang: "cpp",
            code: `#include <cstdio>
#include <memory>
#include <print>
#include <stdexcept>
#include <string>

// unique_ptr can manage anything with a "release" function, not just memory.
struct FileCloser {
    void operator()(std::FILE* f) const noexcept {
        std::fclose(f);
        std::println("  (file closed)");
    }
};
using File = std::unique_ptr<std::FILE, FileCloser>;

File open_temp_file() {
    File f(std::tmpfile());                  // a C API returning a raw handle
    if (!f) throw std::runtime_error("tmpfile failed");
    return f;
}

std::string read_all(std::FILE* f) {         // C-style API takes the raw handle: f.get()
    std::rewind(f);
    std::string text;
    char buffer[64];
    while (std::fgets(buffer, sizeof buffer, f) != nullptr) text += buffer;
    return text;
}

int main() {
    {
        File f = open_temp_file();
        std::fputs("written through a C API", f.get());
        std::println("read back: '{}'", read_all(f.get()));
    }                                         // fclose runs here, automatically
    std::println("after the block");

    // A shared_ptr takes the deleter as a constructor argument, e.g. a lambda:
    auto counter = std::shared_ptr<int>(new int(7), [](int* p) {
        std::println("  (custom delete of {})", *p);
        delete p;
    });
    auto second = counter;
    std::println("shared value {} with {} owners", *counter, counter.use_count());
}`,
          },
        ],
        output: `read back: 'written through a C API'
  (file closed)
after the block
shared value 7 with 2 owners
  (custom delete of 7)`,
        explain: `- A \`unique_ptr\` with a stateless deleter type is still the size of one pointer.
- \`.get()\` hands the raw pointer to C functions without giving up ownership.
- Wrap every C handle you use (sockets, \`sqlite3*\`, \`CURL*\`, OpenGL objects) this way and leaks become impossible, even when exceptions are thrown.`,
      },
    ],
    interview: [
      {
        q: "unique_ptr vs shared_ptr: when do you use each?",
        a: "`unique_ptr` expresses exclusive ownership with zero overhead; it's the default for heap objects: factories, polymorphic containers, pimpl. `shared_ptr` expresses shared ownership with reference counting (an extra control block and atomic count updates on every copy); use it only when several parts of the program must keep an object alive and none clearly outlives the others (shared caches, graphs, async operations). Overusing shared_ptr hides ownership and causes cycles and performance costs. A unique_ptr can be converted to a shared_ptr later if needed.",
        freq: "very-common",
      },
      {
        q: "How does shared_ptr work internally?",
        a: "Each shared_ptr holds two pointers: to the object and to a control block containing the strong count, the weak count, and the deleter/allocator. Copying increments the strong count atomically; destroying decrements it. When the strong count reaches zero the object is destroyed (deleter called); when both counts reach zero the control block is freed. `make_shared` allocates the object and control block together in one allocation (faster, better locality, but the memory isn't released until weak pointers are gone too). The count is thread-safe; the pointed-to object is not.",
        freq: "very-common",
      },
      {
        q: "What's a reference cycle and how does weak_ptr fix it?",
        a: "If object A holds a shared_ptr to B and B holds a shared_ptr to A (or a longer cycle), their strong counts never reach zero even after all outside owners are gone, so they leak. weak_ptr references the control block without contributing to the strong count; make the non-owning direction (child→parent, observer→subject, cache entry) weak and call `lock()` to use it, which returns an empty shared_ptr if the object is gone.",
        freq: "very-common",
      },
      {
        q: "Why prefer make_unique/make_shared over new?",
        a: "No naked `new` in the code (easier to audit), no repetition of the type, exception safety (historically, `f(std::shared_ptr<A>(new A), g())` could leak if `g()` threw between the allocation and the shared_ptr construction under older evaluation rules), and for make_shared a single allocation for object and control block. Exceptions: custom deleters or when you need to adopt a pointer from a C API.",
        freq: "common",
      },
      {
        q: "Should a function take a std::shared_ptr parameter?",
        a: "Only if it participates in ownership (stores it, extends the lifetime). A function that merely uses the object should take `T&`/`const T&` (or `T*` if nullable): that's cheaper (no atomic increment), and callable regardless of how the object is owned. To transfer unique ownership, take `std::unique_ptr<T>` by value. Taking `const std::shared_ptr<T>&` is a smell unless you might copy it conditionally.",
      },
    ],
    quiz: [
      {
        q: "What happens with `auto b = a;` when a is a std::unique_ptr?",
        options: ["b shares ownership", "Compile error: unique_ptr is not copyable", "a is moved automatically", "Undefined behavior"],
        answer: 1,
        explain: "Transfers must be explicit: auto b = std::move(a);",
      },
      {
        q: "When is the object owned by several shared_ptrs destroyed?",
        options: ["When the first owner is destroyed", "When the last owning shared_ptr is destroyed or reset", "At program exit", "When a weak_ptr expires"],
        answer: 1,
        explain: "Destruction happens when the strong count reaches zero.",
      },
      {
        q: "A child holds a shared_ptr to its parent, and the parent holds shared_ptrs to its children. What's the problem?",
        options: ["None", "A reference cycle: they're never freed", "Double free", "It doesn't compile"],
        answer: 1,
        explain: "Make the child-to-parent link a weak_ptr.",
      },
      {
        q: "What does weak_ptr::lock() return if the object is already gone?",
        options: ["A dangling pointer", "An empty shared_ptr", "It throws", "The last value"],
        answer: 1,
        explain: "Check the result before use.",
      },
      {
        q: "A function only needs to read a Widget. Best parameter type?",
        options: ["std::shared_ptr<Widget>", "std::unique_ptr<Widget>", "const Widget&", "Widget (by value)"],
        answer: 2,
        explain: "Borrow with a reference; ownership isn't the function's concern.",
      },
      {
        q: "What's the size overhead of std::unique_ptr<T> with the default deleter?",
        options: ["None: same as a raw pointer", "A control block", "Two pointers", "A mutex"],
        answer: 0,
        explain: "That's what makes it the default choice.",
      },
    ],
  },

  // ------------------------------------------------------------------ OOP
  {
    id: "cpp-oop",
    stage: "Core",
    title: "Inheritance, virtual functions and polymorphism",
    tagline: "Base and derived classes, virtual dispatch and vtables, abstract interfaces, slicing, and the modern alternatives: std::variant and concepts.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["cppvtable"],
    concept: `
## Inheritance
\`\`\`cpp
class Shape {                                    // a base class used as an interface
public:
    virtual ~Shape() = default;                  // ALWAYS virtual in a polymorphic base
    virtual double area() const = 0;             // pure virtual: must be overridden
    virtual std::string name() const { return "shape"; }   // virtual with a default
};

class Circle final : public Shape {              // public inheritance = IS-A
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return std::numbers::pi * r_ * r_; }
private:
    double r_;
};
\`\`\`
- A class with at least one **pure virtual** function (\`= 0\`) is **abstract**: you can't create one, only derived classes.
- **\`override\`** makes the compiler check that you really override a base virtual function (typos become errors). Always write it.
- **\`final\`** forbids further overriding or inheriting (and helps the compiler devirtualize).
- Use **public** inheritance for IS-A. (Private inheritance means "implemented in terms of" and is rare; prefer composition.)

## How virtual dispatch works
Each class with virtual functions has a **vtable**: a static table of function pointers, one per virtual function. Each object carries a hidden **vptr** pointing at its class's vtable. A call \`shape->area()\` loads the vptr, looks up the \`area\` slot and jumps there. The cost: one pointer per object and an indirect call that's hard to inline. **Step through it in the visualizer.**

Polymorphism only happens through **pointers or references**: \`std::vector<std::unique_ptr<Shape>>\`, \`const Shape&\`.

## Object slicing
Copying a derived object into a base **value** keeps only the base part: \`Shape s = circle;\` (if Shape weren't abstract) or passing \`Animal a\` by value. The derived data is "sliced off" and virtual calls go to the base version. Pass polymorphic objects by reference or pointer, and consider deleting the base class's copy operations.

## The virtual destructor rule
If you delete a derived object through a base pointer (\`std::unique_ptr<Shape>\` does exactly that), the base destructor **must be virtual**, or the derived destructor never runs: undefined behavior and leaks. Rule: a class with any virtual function gets \`virtual ~Base() = default;\`.

## dynamic_cast
\`dynamic_cast<Circle*>(shape)\` checks at run time and returns \`nullptr\` if the object isn't a Circle (for references it throws \`std::bad_cast\`). Needing it often is a design smell: usually a virtual function should do the work.

## Alternatives to inheritance
Inheritance couples types tightly and forces heap allocation and pointers. Modern C++ offers:
| Technique | Set of types | Dispatch | Good for |
|---|---|---|---|
| **Virtual functions** | Open: anyone can add a subclass | Run time (vtable) | Plugins, frameworks, large hierarchies |
| **\`std::variant\` + \`std::visit\`** | Closed: listed in the variant | Run time (switch on index), no heap | Messages, AST nodes, results, state machines |
| **Templates + concepts** | Any type with the right operations | Compile time | Generic algorithms, zero overhead |
| **Type erasure** (\`std::function\`, \`std::any\`) | Open | Run time | Callbacks, heterogeneous values |

**Composition over inheritance**: hold collaborators as members and delegate, rather than inheriting to reuse code.

## Multiple inheritance
Allowed: \`class Duck : public Flyer, public Swimmer\`. Inheriting several pure interfaces is fine. Inheriting state from two bases that share a common base creates the **diamond problem**, solved with \`virtual\` inheritance, but it's usually better to avoid the diamond.
`,
    keyPoints: [
      "virtual + override for run-time polymorphism; pure virtual (= 0) makes a class abstract",
      "Polymorphism needs pointers or references; copying into a base value slices",
      "A polymorphic base class needs a virtual destructor",
      "Virtual calls go through the object's vptr into its class's vtable",
      "dynamic_cast checks types at run time; frequent use signals a design problem",
      "std::variant + std::visit for closed sets, concepts/templates for compile-time polymorphism",
      "Prefer composition to inheritance for code reuse",
    ],
    code: [
      {
        title: "An abstract interface, overriding and dynamic_cast",
        variants: [
          {
            lang: "cpp",
            code: `#include <format>
#include <memory>
#include <numbers>
#include <print>
#include <string>
#include <vector>

class Shape {
public:
    virtual ~Shape() = default;                      // essential in a polymorphic base
    virtual double area() const = 0;                 // pure virtual: Shape is abstract
    virtual std::string name() const = 0;
    std::string describe() const {                   // non-virtual, built on the virtuals
        return std::format("{:<7} area {:6.2f}", name(), area());
    }
};

class Circle final : public Shape {
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return std::numbers::pi * r_ * r_; }
    std::string name() const override { return "Circle"; }

private:
    double r_;
};

class Rect : public Shape {
public:
    Rect(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
    std::string name() const override { return "Rect"; }
    double width() const { return w_; }
    double height() const { return h_; }

private:
    double w_, h_;
};

class Square final : public Rect {
public:
    explicit Square(double side) : Rect(side, side) {}
    std::string name() const override { return "Square"; }
};

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(1.0));
    shapes.push_back(std::make_unique<Rect>(2.0, 3.0));
    shapes.push_back(std::make_unique<Square>(2.0));

    double total = 0;
    for (const auto& shape : shapes) {               // one loop, three behaviors
        std::println("{}", shape->describe());
        total += shape->area();
    }
    std::println("total   area {:6.2f}", total);

    for (const auto& shape : shapes) {
        if (const auto* r = dynamic_cast<const Rect*>(shape.get())) {   // nullptr if not a Rect
            std::println("{} is-a Rect: {} x {}", shape->name(), r->width(), r->height());
        }
    }
}`,
          },
        ],
        output: `Circle  area   3.14
Rect    area   6.00
Square  area   4.00
total   area  13.14
Rect is-a Rect: 2 x 3
Square is-a Rect: 2 x 2`,
        explain: `- \`describe()\` is written once in the base and calls \`name()\` and \`area()\`, which dispatch to the actual class (the **template method** pattern).
- The \`unique_ptr<Shape>\`s delete through a base pointer, which is only correct because \`~Shape\` is virtual.
- \`Square\` is-a \`Rect\` here because squares never change shape. If \`Rect\` had \`set_width\`, a \`Square\` would break its promises (Liskov substitution), and this hierarchy would be wrong.`,
      },
      {
        title: "Object slicing: why polymorphism needs references",
        variants: [
          {
            lang: "cpp",
            code: `#include <print>
#include <string>

class Animal {
public:
    virtual ~Animal() = default;
    virtual std::string speak() const { return "..."; }
};

class Dog : public Animal {
public:
    std::string speak() const override { return name_ + " says woof"; }

private:
    std::string name_ = "Rex";
};

void by_value(Animal a) { std::println("by value:     {}", a.speak()); }       // copies only the Animal part
void by_reference(const Animal& a) { std::println("by reference: {}", a.speak()); }
void by_pointer(const Animal* a) { std::println("by pointer:   {}", a->speak()); }

int main() {
    Dog rex;
    by_value(rex);          // sliced!
    by_reference(rex);
    by_pointer(&rex);

    Animal copy = rex;      // also sliced: a brand-new Animal
    std::println("copy:         {}", copy.speak());
}`,
          },
        ],
        output: `by value:     ...
by reference: Rex says woof
by pointer:   Rex says woof
copy:         ...`,
        explain: `- \`by_value\` builds a new \`Animal\` from the \`Dog\`: only the base subobject is copied (no \`name_\`), and its vptr points to \`Animal\`'s vtable. The visualizer's "Object slicing" scenario shows the memory.
- To make slicing impossible, make polymorphic bases non-copyable or abstract (\`Animal\` with a pure virtual function can't be passed by value at all).`,
      },
      {
        title: "Closed sets with std::variant, and compile-time polymorphism with concepts",
        variants: [
          {
            lang: "cpp",
            code: `#include <concepts>
#include <numbers>
#include <print>
#include <variant>
#include <vector>

// 1. std::variant: a closed set of types, stored by value (no heap, no vtable).
struct Circle { double r; };
struct Rect { double w, h; };
struct Triangle { double base, height; };
using Shape = std::variant<Circle, Rect, Triangle>;

template <class... Fs>
struct overloaded : Fs... { using Fs::operator()...; };      // combine lambdas into one visitor

double area(const Shape& s) {
    return std::visit(overloaded{
        [](const Circle& c) { return std::numbers::pi * c.r * c.r; },
        [](const Rect& r) { return r.w * r.h; },
        [](const Triangle& t) { return 0.5 * t.base * t.height; },
    }, s);                                                       // missing a type = compile error
}

// 2. Concepts: any type with an area() returning something convertible to double.
template <typename T>
concept HasArea = requires(const T& t) {
    { t.area() } -> std::convertible_to<double>;
};

struct Square {
    double side;
    double area() const { return side * side; }
};
struct Hexagon {
    double side;
    double area() const { return 1.5 * 1.7320508075688772 * side * side; }
};

double total_area(const HasArea auto&... shapes) {           // resolved at compile time, inlinable
    return (shapes.area() + ... + 0.0);                       // fold expression
}

int main() {
    std::vector<Shape> shapes{Circle{1}, Rect{2, 3}, Triangle{4, 5}};
    double sum = 0;
    for (const Shape& s : shapes) {
        sum += area(s);
        if (const auto* r = std::get_if<Rect>(&s)) std::println("found a {}x{} rect", r->w, r->h);
    }
    std::println("variant total {:.2f}", sum);
    std::println("holds a Circle first? {}", std::holds_alternative<Circle>(shapes[0]));

    std::println("concept total {:.2f}", total_area(Square{2}, Hexagon{1}, Square{1}));
    // total_area(42);   // error: int does not satisfy HasArea (a clear message, not a template wall)
}`,
          },
        ],
        output: `found a 2x3 rect
variant total 19.14
holds a Circle first? true
concept total 7.60`,
        explain: `- The variant version keeps all shapes **inline in the vector** (no allocation per shape) and \`std::visit\` checks at compile time that every alternative is handled.
- The \`overloaded\` helper is a common idiom: it inherits the call operators of several lambdas.
- The concept version has no common base class at all: any type with a suitable \`area()\` works, and the calls can be inlined. The trade-off: the set of types must be known where it's used (templates), so you can't store mixed types in one vector without type erasure.`,
      },
    ],
    interview: [
      {
        q: "How do virtual functions work under the hood?",
        a: "For each polymorphic class the compiler emits a vtable: an array of pointers to that class's implementations of its virtual functions (plus RTTI info). Each object stores a hidden vptr to its class's vtable, set by the constructors (during construction the vptr points to the class currently being constructed, so virtual calls in constructors don't reach derived overrides). A virtual call loads the vptr, indexes the slot and makes an indirect call. Costs: one pointer per object, an indirect call that's hard to inline and can mispredict. Compilers devirtualize when they can prove the dynamic type (e.g. `final`).",
        freq: "very-common",
      },
      {
        q: "Why should a base class have a virtual destructor?",
        a: "If an object of a derived class is deleted through a pointer to the base (directly or via `std::unique_ptr<Base>`/`shared_ptr` created from a base pointer), a non-virtual base destructor means only the base destructor runs: the behavior is undefined, and in practice derived members (strings, vectors, handles) leak. Rule: any class meant to be used polymorphically gets `virtual ~Base() = default;`. If a base isn't meant for polymorphic deletion, make its destructor protected and non-virtual.",
        freq: "very-common",
      },
      {
        q: "What is object slicing?",
        a: "When a derived object is copied into an object of the base type (by-value parameter, assignment, storing in `std::vector<Base>`), only the base subobject is copied: derived members are lost and virtual calls on the copy use the base implementation. Avoid by passing polymorphic objects by reference or (smart) pointer, storing `std::unique_ptr<Base>` in containers, and making polymorphic base classes non-copyable or abstract.",
        freq: "very-common",
      },
      {
        q: "Can you call a virtual function from a constructor?",
        a: "You can, but it won't dispatch to the derived override: while the base constructor runs, the object is still only a base (its vptr points to the base vtable) because derived members aren't initialized yet. Calling a pure virtual function this way is undefined behavior (often a crash with 'pure virtual function called'). The same applies in destructors. Use a factory function or two-phase initialization if derived behavior is needed during setup.",
        freq: "common",
      },
      {
        q: "Runtime polymorphism vs compile-time polymorphism in C++?",
        a: "Runtime (virtual functions, type erasure like `std::function`) chooses the implementation while the program runs: an open set of types, heterogeneous containers, stable ABI for plugins, at the cost of indirect calls and usually heap allocation. Compile-time (templates, concepts, CRTP, overloading) selects code during compilation: zero overhead and full inlining, but the types must be known at compile time, it increases code size and compile times. `std::variant` sits between: a closed set chosen at run time without heap allocation.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What does `override` do?",
        options: ["Makes a function virtual", "Makes the compiler verify it overrides a base virtual function", "Prevents overriding", "Makes the call faster"],
        answer: 1,
        explain: "A mismatch in signature becomes a compile error.",
      },
      {
        q: "You store `std::vector<Animal>` and push_back a Dog. What's stored?",
        options: ["A Dog", "A sliced Animal copy", "A pointer to the Dog", "Nothing: compile error"],
        answer: 1,
        explain: "Values of the base type can only hold the base part.",
      },
      {
        q: "What makes a class abstract?",
        options: ["The abstract keyword", "At least one pure virtual function (= 0)", "A private constructor", "A virtual destructor"],
        answer: 1,
        explain: "C++ has no abstract keyword; a pure virtual member does it.",
      },
      {
        q: "dynamic_cast<Rect*>(p) when p points to a Circle returns...",
        options: ["A garbage pointer", "nullptr", "It throws", "A Rect copy"],
        answer: 1,
        explain: "Pointer dynamic_cast returns nullptr on mismatch; reference casts throw std::bad_cast.",
      },
      {
        q: "Which is best for a closed, fixed set of message types handled in many places?",
        options: ["Deep inheritance", "std::variant with std::visit", "void*", "Macros"],
        answer: 1,
        explain: "The compiler checks every visit handles every alternative.",
      },
      {
        q: "Where is the vtable pointer stored?",
        options: ["In each object of a polymorphic class", "In each function", "On the stack", "Nowhere"],
        answer: 0,
        explain: "Each object carries a vptr; the vtable itself is shared per class.",
      },
    ],
  },

  // ------------------------------------------------------------------ STL
  {
    id: "cpp-stl",
    stage: "Core",
    title: "The STL: containers and iterators",
    tagline: "vector, map, unordered_map, set, deque, priority_queue and friends: how they're built, what they cost, and the iterator invalidation rules.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["array"],
    concept: `
## The Standard Template Library
Three ideas that fit together:
- **Containers** own collections of elements.
- **Iterators** are generalized pointers into containers (\`begin()\`, \`end()\`), so algorithms work with any container.
- **Algorithms** (\`std::sort\`, \`std::find\`...) operate on iterator ranges. Next chapter.

## Picking a container
| Container | Structure | Use for |
|---|---|---|
| **\`std::vector\`** | Contiguous dynamic array | **The default.** Fast iteration, cache-friendly, O(1) push_back |
| \`std::array\` | Fixed-size array | Size known at compile time |
| \`std::deque\` | Chunks of arrays | Fast push/pop at both ends |
| \`std::list\` | Doubly linked list | Rarely: stable iterators, O(1) splice |
| **\`std::unordered_map\`** / \`unordered_set\` | Hash table (buckets of nodes) | O(1) average lookup by key |
| **\`std::map\`** / \`std::set\` | Red-black tree | Sorted keys, range queries, \`lower_bound\` |
| \`std::multimap\` / \`multiset\` | Red-black tree | Sorted, duplicate keys allowed |
| \`std::flat_map\` / \`flat_set\` (C++23) | Sorted vectors | Read-mostly maps: faster lookups, compact |
| \`std::priority_queue\` | Binary heap over a vector | Always get the max (or min) |
| \`std::stack\` / \`std::queue\` | Adapters over deque | LIFO / FIFO |
| \`std::string\` | Contiguous chars + small-string optimization | Text |

**Default to \`std::vector\`.** Modern CPUs are so much faster at scanning contiguous memory that a vector often beats a list or even a map for small sizes. Measure before picking something exotic.

## Using them well
- \`v.reserve(n)\` when you know the final size: avoids repeated reallocation.
- \`emplace_back(args...)\` constructs in place; \`push_back(value)\` copies or moves an existing object.
- \`map[key]\` **inserts** a default value if the key is missing. Use \`find\`, \`contains\` (C++20) or \`at\` to look up without inserting.
- \`std::erase_if(container, pred)\` (C++20) removes matching elements from any container. The old way is the erase-remove idiom: \`v.erase(std::remove_if(...), v.end())\`.
- Custom keys: \`std::map\` needs \`operator<\` (or a comparator); \`std::unordered_map\` needs \`std::hash\` and \`==\`.

## Iterator invalidation: the rule that prevents crashes
An iterator, pointer or reference into a container can become **invalid** when the container changes. Using an invalid one is undefined behavior.
| Container | Invalidated by |
|---|---|
| \`vector\`, \`string\` | Any insertion that **reallocates** (all of them); insert/erase **after** the position |
| \`deque\` | Insertion anywhere (iterators); erase in the middle (all) |
| \`list\`, \`map\`, \`set\` | Only the erased element. Very stable |
| \`unordered_map\`/\`set\` | Erase (that element); a **rehash** invalidates iterators (but not references) |

Safe erase-while-iterating: \`it = container.erase(it);\` (erase returns the next valid iterator).
`,
    keyPoints: [
      "vector is the default: contiguous, cache-friendly, amortized O(1) push_back",
      "unordered_map: O(1) average; map: sorted, O(log n), range queries",
      "map[key] inserts when missing; use find/contains/at to only look up",
      "reserve() avoids reallocations; emplace_back constructs in place",
      "std::erase_if (C++20) replaces the erase-remove idiom",
      "Reallocation invalidates every vector iterator, pointer and reference",
      "it = c.erase(it) is the safe way to erase while iterating",
    ],
    complexity: [
      { op: "vector: index, push_back", time: "O(1) / amortized O(1)" },
      { op: "vector: insert/erase in the middle", time: "O(n)" },
      { op: "deque: push/pop front or back", time: "O(1)" },
      { op: "list: insert/erase at an iterator", time: "O(1)", note: "but O(n) to find the spot" },
      { op: "map / set: find, insert, erase", time: "O(log n)" },
      { op: "unordered_map / set: find, insert, erase", time: "O(1) avg", note: "O(n) worst case" },
      { op: "flat_map: find / insert", time: "O(log n) / O(n)" },
      { op: "priority_queue: push / pop / top", time: "O(log n) / O(log n) / O(1)" },
    ],
    code: [
      {
        title: "Counting words: unordered_map, map and sorting",
        variants: [
          {
            lang: "cpp",
            code: `#include <algorithm>
#include <map>
#include <print>
#include <ranges>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

int main() {
    std::string text = "the quick brown fox jumps over the lazy dog the fox";
    std::unordered_map<std::string, int> counts;
    std::istringstream in(text);
    for (std::string word; in >> word;) ++counts[word];   // [] inserts 0 the first time

    std::vector<std::pair<std::string, int>> ranked(counts.begin(), counts.end());
    std::ranges::sort(ranked, [](const auto& a, const auto& b) {
        return a.second != b.second ? a.second > b.second : a.first < b.first;   // count desc, then word
    });
    for (const auto& [word, n] : ranked | std::views::take(3)) std::println("{:<6} {}", word, n);

    std::map<std::string, int> alphabetical(counts.begin(), counts.end());   // sorted by key
    std::print("alphabetical:");
    for (const auto& [word, n] : alphabetical) std::print(" {}={}", word, n);
    std::println("");

    std::println("distinct words: {}", counts.size());
    std::println("contains 'cat'? {}  count of 'fox': {}", counts.contains("cat"), counts.at("fox"));
    std::println("size still {} (contains/at don't insert)", counts.size());
    [[maybe_unused]] int oops = counts["cat"];           // operator[] DOES insert
    std::println("after counts[\\"cat\\"]: size {}", counts.size());
}`,
          },
        ],
        output: `the    3
fox    2
brown  1
alphabetical: brown=1 dog=1 fox=2 jumps=1 lazy=1 over=1 quick=1 the=3
distinct words: 8
contains 'cat'? false  count of 'fox': 2
size still 8 (contains/at don't insert)
after counts["cat"]: size 9`,
        explain: `- \`>>\` on a stream reads whitespace-separated words.
- We never print the \`unordered_map\` directly: its iteration order depends on hashing and differs between standard libraries. Sort, or copy into a \`std::map\`.
- Copying the pairs into a \`std::map\` gives alphabetical order for free, because \`std::map\` is a sorted tree.
- The \`operator[]\` trap is a classic bug: a "lookup" in a \`const\` function won't even compile, and in non-const code it silently grows the map.`,
      },
      {
        title: "Sorted maps, heaps, deques and adapters",
        variants: [
          {
            lang: "cpp",
            code: `#include <deque>
#include <functional>
#include <iterator>
#include <map>
#include <print>
#include <queue>
#include <set>
#include <stack>
#include <string>
#include <utility>
#include <vector>

char grade(const std::map<int, char>& cutoffs, int score) {
    auto it = cutoffs.upper_bound(score);           // first cutoff strictly above the score
    if (it == cutoffs.begin()) return 'F';
    return std::prev(it)->second;                   // the last cutoff <= score
}

int main() {
    std::map<int, char> cutoffs{{60, 'D'}, {70, 'C'}, {80, 'B'}, {90, 'A'}};
    for (int score : {95, 83, 61, 42}) std::print("{}->{} ", score, grade(cutoffs, score));
    std::println("");

    std::set<int> seen{5, 1, 9, 3};
    auto [it, inserted] = seen.insert(3);            // insert returns {iterator, was it new?}
    std::println("set {} | insert 3 again: inserted={} | first >= 4 is {}", seen, inserted, *seen.lower_bound(4));

    std::priority_queue<std::pair<int, std::string>> tasks;   // max-heap: biggest pair on top
    tasks.emplace(1, "email");
    tasks.emplace(9, "outage");
    tasks.emplace(5, "review");
    std::print("by priority:");
    while (!tasks.empty()) {
        std::print(" {}", tasks.top().second);
        tasks.pop();
    }
    std::println("");

    std::priority_queue<int, std::vector<int>, std::greater<>> smallest;   // min-heap: top-k largest
    for (int x : {5, 1, 9, 3, 7, 8, 2}) {
        smallest.push(x);
        if (smallest.size() > 3) smallest.pop();
    }
    std::print("top 3 (ascending):");
    while (!smallest.empty()) {
        std::print(" {}", smallest.top());
        smallest.pop();
    }
    std::println("");

    std::deque<int> window{1, 2, 3};
    window.push_front(0);
    window.push_back(4);
    window.pop_front();
    std::println("deque {}", window);

    std::stack<char> brackets;
    bool balanced = true;
    for (char c : std::string("{[()()]}")) {
        if (c == '(' || c == '[' || c == '{') {
            brackets.push(c);
        } else {
            char open = c == ')' ? '(' : c == ']' ? '[' : '{';
            if (brackets.empty() || brackets.top() != open) balanced = false;
            else brackets.pop();
        }
    }
    std::println("{{[()()]}} balanced: {}", balanced && brackets.empty());
}`,
          },
        ],
        output: `95->A 83->B 61->D 42->F
set {1, 3, 5, 9} | insert 3 again: inserted=false | first >= 4 is 5
by priority: outage review email
top 3 (ascending): 7 8 9
deque [1, 2, 3, 4]
{[()()]} balanced: true`,
        explain: `- \`upper_bound\` and \`lower_bound\` turn a sorted map into an O(log n) range lookup, no if-else chain.
- \`std::priority_queue\` is a max-heap by default; \`std::greater<>\` makes it a min-heap. Keeping a min-heap of size k leaves the k largest elements: O(n log k).
- \`{{\` prints a literal \`{\` in a format string.
- \`std::stack\` and \`std::queue\` are **adapters**: a restricted interface over another container (a deque by default).`,
      },
      {
        title: "Erasing safely, reserve and iterator invalidation",
        variants: [
          {
            lang: "cpp",
            code: `#include <algorithm>
#include <map>
#include <print>
#include <string>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3, 4, 5, 6, 7, 8};
    auto removed = std::erase_if(v, [](int x) { return x % 2 == 0; });   // C++20, any container
    std::println("erase_if removed {} -> {}", removed, v);

    std::vector<int> w{3, 1, 3, 2, 3};
    w.erase(std::remove(w.begin(), w.end(), 3), w.end());              // the classic erase-remove idiom
    std::println("erase-remove 3s -> {}", w);

    std::map<std::string, int> sessions{{"a", 0}, {"b", 5}, {"c", 0}, {"d", 2}};
    for (auto it = sessions.begin(); it != sessions.end();) {
        if (it->second == 0) it = sessions.erase(it);   // erase returns the next valid iterator
        else ++it;
    }
    std::println("active sessions {}", sessions);

    std::vector<int> grows;
    int reallocations = 0;
    const int* data = grows.data();
    for (int i = 0; i < 1000; ++i) {
        grows.push_back(i);
        if (grows.data() != data) {                       // the buffer moved: old pointers are dead
            ++reallocations;
            data = grows.data();
        }
    }
    std::println("1000 push_backs without reserve: {} reallocations", reallocations > 5 ? "many" : "few");

    std::vector<int> reserved;
    reserved.reserve(1000);
    data = reserved.data();
    bool moved = false;
    for (int i = 0; i < 1000; ++i) {
        reserved.push_back(i);
        moved = moved || reserved.data() != data;
    }
    std::println("with reserve(1000): buffer moved? {}", moved);

    struct Point { int x, y; Point(int a, int b) : x(a), y(b) {} };
    std::vector<Point> pts;
    pts.emplace_back(1, 2);                               // constructed directly inside the vector
    pts.push_back(Point(3, 4));                           // constructed, then moved in
    std::println("{} points, last = ({}, {})", pts.size(), pts.back().x, pts.back().y);
}`,
          },
        ],
        output: `erase_if removed 4 -> [1, 3, 5, 7]
erase-remove 3s -> [1, 2]
active sessions {"b": 5, "d": 2}
1000 push_backs without reserve: many reallocations
with reserve(1000): buffer moved? false
2 points, last = (3, 4)`,
        explain: `- \`std::remove\` doesn't shrink anything: it shifts the kept elements forward and returns the new logical end; \`erase\` then chops the tail. \`std::erase_if\` does both.
- Every reallocation copies (or moves) all elements to a new buffer and frees the old one: any saved pointer, reference or iterator now dangles. Growing by doubling keeps push_back amortized O(1), with about log2(1000) ≈ 10 reallocations here.
- \`reserve\` allocates once up front, so pointers stay valid until you exceed that capacity.`,
      },
    ],
    interview: [
      {
        q: "std::map vs std::unordered_map?",
        a: "`std::map` is a balanced binary search tree (red-black): O(log n) operations, keys kept sorted, supports ordered iteration and range queries (`lower_bound`, `upper_bound`), requires `operator<`, stable iterators. `std::unordered_map` is a hash table with separate chaining: O(1) average (O(n) worst case with bad hashes), unordered, requires `std::hash` and `==`, rehashing invalidates iterators. Use unordered_map for pure lookups, map when you need order or ranges, and consider `flat_map` or a sorted vector for small or read-mostly data.",
        freq: "very-common",
      },
      {
        q: "How does std::vector grow, and what is amortized O(1)?",
        a: "A vector has a size and a capacity. When push_back exceeds capacity it allocates a larger buffer (typically 2x in libstdc++/libc++, 1.5x in MSVC), moves or copies the elements over (moves only if the move constructor is noexcept), destroys the old ones and frees the old buffer. A single push_back can therefore be O(n), but the total work for n push_backs is O(n) because each element is relocated a bounded number of times on average: amortized O(1). `reserve` avoids reallocations when the size is known.",
        freq: "very-common",
      },
      {
        q: "What is iterator invalidation? Give examples.",
        a: "After certain container modifications, existing iterators, pointers or references into the container no longer refer to valid elements; using them is undefined behavior. Vector: any reallocation (push_back past capacity, insert, reserve, shrink_to_fit) invalidates everything; erase/insert invalidate from the position onward. Unordered containers: rehash invalidates iterators. Node-based containers (list, map, set) only invalidate erased elements. Classic bug: erasing inside a range-for loop; fix with `it = c.erase(it)` or `std::erase_if`.",
        freq: "very-common",
      },
      {
        q: "emplace_back vs push_back?",
        a: "`push_back(value)` takes an already-constructed object and copies or moves it into the container. `emplace_back(args...)` forwards the arguments to the element's constructor and constructs it directly in place, avoiding a temporary. For types where move is cheap the difference is small; emplace shines for expensive-to-move types or when constructing from several arguments. Beware: emplace uses explicit constructors, so `v.emplace_back(10)` on a `vector<vector<int>>` creates a vector of 10 elements, which push_back would reject.",
        freq: "common",
      },
      {
        q: "Why is std::vector usually faster than std::list even for insertions in the middle?",
        a: "A list insertion is O(1) only once you have the iterator; finding the position is O(n) pointer chasing, and each node is a separate heap allocation scattered in memory, causing cache misses. A vector's elements are contiguous, so scanning and shifting use the cache and prefetcher efficiently and SIMD-friendly memmoves. For realistic sizes, the vector's O(n) shift often beats the list's cache-missing traversal. Lists win when you need iterator stability or O(1) splicing of large ranges.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What does `m[\"x\"]` do on a std::map when \"x\" isn't present?",
        options: ["Throws", "Returns a null reference", "Inserts \"x\" with a default value and returns it", "Undefined behavior"],
        answer: 2,
        explain: "Use find, contains or at to avoid inserting.",
      },
      {
        q: "Which container keeps keys sorted?",
        options: ["unordered_map", "std::map", "std::vector", "std::stack"],
        answer: 1,
        explain: "std::map and std::set are ordered trees.",
      },
      {
        q: "You saved `int* p = &v[0];` and then push_back exceeds the capacity. p is now...",
        options: ["Still valid", "Dangling", "Pointing to the new buffer", "nullptr"],
        answer: 1,
        explain: "Reallocation frees the old buffer.",
      },
      {
        q: "How do you get a min-heap of ints?",
        options: ["std::priority_queue<int>", "std::priority_queue<int, std::vector<int>, std::greater<>>", "std::set<int>", "std::stack<int>"],
        answer: 1,
        explain: "The default comparator std::less gives a max-heap.",
      },
      {
        q: "What's the safe way to erase from a map while iterating?",
        options: ["map.erase(it); ++it;", "it = map.erase(it);", "Iterate backwards", "You can't"],
        answer: 1,
        explain: "erase returns the iterator after the erased element.",
      },
      {
        q: "What does reserve(n) change?",
        options: ["size()", "capacity() (at least n), avoiding reallocations", "Both", "Nothing"],
        answer: 1,
        explain: "reserve allocates storage but doesn't add elements.",
      },
    ],
    problems: [
      { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "Easy", note: "unordered_map" },
      { title: "Valid Parentheses", url: "https://leetcode.com/problems/valid-parentheses/", difficulty: "Easy", note: "std::stack" },
      { title: "Kth Largest Element in an Array", url: "https://leetcode.com/problems/kth-largest-element-in-an-array/", difficulty: "Medium", note: "min-heap of size k" },
      { title: "Time Based Key-Value Store", url: "https://leetcode.com/problems/time-based-key-value-store/", difficulty: "Medium", note: "map + upper_bound" },
    ],
  },

  // ------------------------------------------------------------------ ALGORITHMS
  {
    id: "cpp-algorithms",
    stage: "Core",
    title: "Algorithms, lambdas and ranges",
    tagline: "The <algorithm> toolbox, lambdas and captures, std::function, and C++20/23 ranges and views for readable data pipelines.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["sorting"],
    concept: `
## Prefer algorithms to raw loops
\`<algorithm>\` and \`<numeric>\` contain over 100 tested, optimized algorithms. A named algorithm says *what* you're doing (\`std::ranges::count_if\`) where a loop makes the reader reverse-engineer it.

| Goal | Algorithm |
|---|---|
| Sort / stable sort / partial | \`sort\`, \`stable_sort\`, \`partial_sort\`, \`nth_element\` |
| Search | \`find\`, \`find_if\`, \`binary_search\`, \`lower_bound\`, \`upper_bound\`, \`equal_range\` |
| Count and test | \`count\`, \`count_if\`, \`all_of\`, \`any_of\`, \`none_of\` |
| Transform | \`transform\`, \`for_each\`, \`replace_if\`, \`fill\`, \`iota\` |
| Aggregate | \`accumulate\`, \`reduce\`, \`transform_reduce\`, \`partial_sum\` (\`<numeric>\`) |
| Rearrange | \`reverse\`, \`rotate\`, \`partition\`, \`unique\`, \`shuffle\` |
| Min/max | \`min_element\`, \`max_element\`, \`minmax_element\`, \`clamp\` |
| Sets on sorted ranges | \`set_union\`, \`set_intersection\`, \`merge\`, \`includes\` |

Since C++20 most have a **\`std::ranges::\`** version that takes the whole container and supports **projections**: \`std::ranges::sort(people, {}, &Person::age)\` sorts by age without writing a comparator.

## Lambdas
\`\`\`cpp
auto is_even = [](int x) { return x % 2 == 0; };
int threshold = 10;
auto above = [threshold](int x) { return x > threshold; };   // capture by value (a copy)
int total = 0;
auto add = [&total](int x) { total += x; };                    // capture by reference
auto counter = [n = 0]() mutable { return ++n; };             // init-capture with its own state
auto twice = [](auto x) { return x * 2; };                     // generic lambda (a template)
\`\`\`
| Capture | Meaning |
|---|---|
| \`[]\` | Nothing |
| \`[x]\` / \`[&x]\` | x by value / by reference |
| \`[=]\` / \`[&]\` | Everything used, by value / by reference |
| \`[this]\` / \`[*this]\` | The current object by pointer / by copy |
| \`[p = std::move(ptr)]\` | Init-capture: move a unique_ptr into the lambda |

**The dangling-capture trap**: a lambda that captures locals **by reference** must not outlive them (stored callbacks, threads, async tasks). Capture by value when the lambda escapes.

A lambda is an object of a unique, unnamed class with an \`operator()\`. To store different callables in one variable, use \`std::function<int(int)>\` (type erasure; may allocate, slightly slower) or a template parameter.

## Ranges and views (C++20/23)
Views are lazy, composable adaptors you chain with \`|\`:
\`\`\`cpp
auto squares_of_evens = numbers
    | std::views::filter([](int x) { return x % 2 == 0; })
    | std::views::transform([](int x) { return x * x; })
    | std::views::take(3);                                 // nothing computed yet
std::vector<int> result = squares_of_evens | std::ranges::to<std::vector>();   // C++23
\`\`\`
Useful views: \`iota\`, \`filter\`, \`transform\`, \`take\`, \`drop\`, \`take_while\`, \`reverse\`, \`keys\`, \`values\`, \`split\`, \`join\`, \`zip\` (C++23), \`enumerate\` and \`chunk\` (C++23, newer compilers). Views don't own data: don't return a view over a local container.

## Complexity matters
\`std::sort\` is O(n log n) (introsort). \`std::list\` can't use it (needs random access; use \`list.sort()\`). \`nth_element\` finds the median in O(n) on average. \`lower_bound\` on a sorted vector is O(log n). Parallel versions take an execution policy: \`std::sort(std::execution::par, ...)\`.
`,
    keyPoints: [
      "Named algorithms beat raw loops for clarity and correctness",
      "std::ranges:: versions take whole containers and support projections",
      "Lambdas capture by value [x] or reference [&x]; [n = 0] mutable keeps state",
      "Never let a by-reference capture outlive the captured locals",
      "std::function stores any callable (type erasure), templates avoid the overhead",
      "Views are lazy pipelines; ranges::to (C++23) materializes them",
      "sort is O(n log n); nth_element O(n); lower_bound O(log n) on sorted data",
    ],
    code: [
      {
        title: "The algorithm toolbox on real data",
        variants: [
          {
            lang: "cpp",
            code: `#include <algorithm>
#include <cstddef>
#include <iterator>
#include <numeric>
#include <print>
#include <string>
#include <vector>

struct Employee {
    std::string name;
    std::string dept;
    int salary;
    int age;
};

int main() {
    std::vector<Employee> staff{
        {"Ada", "Eng", 150, 36}, {"Linus", "Eng", 130, 29}, {"Grace", "Eng", 170, 45},
        {"Ken", "Ops", 110, 52}, {"Barbara", "Sales", 95, 41}, {"Margaret", "Ops", 125, 33}};

    std::ranges::sort(staff, {}, &Employee::salary);                 // projection: sort by salary
    std::print("by salary:");
    for (const auto& e : staff) std::print(" {}", e.name);
    std::println("");

    std::ranges::stable_sort(staff, {}, &Employee::dept);            // keeps salary order within a dept
    std::print("by dept, then salary:");
    for (const auto& e : staff) std::print(" {}/{}", e.dept, e.name);
    std::println("");

    auto over_40 = std::ranges::count_if(staff, [](const Employee& e) { return e.age > 40; });
    int payroll = std::accumulate(staff.begin(), staff.end(), 0, [](int sum, const Employee& e) { return sum + e.salary; });
    auto top = std::ranges::max_element(staff, {}, &Employee::salary);
    bool all_adults = std::ranges::all_of(staff, [](const Employee& e) { return e.age >= 18; });
    std::println("over 40: {}, payroll: {}k, top earner: {}, all adults: {}", over_40, payroll, top->name, all_adults);

    auto it = std::ranges::find(staff, "Ken", &Employee::name);
    std::println("found Ken in {}", it != staff.end() ? it->dept : "nowhere");

    std::vector<int> ages;
    std::ranges::transform(staff, std::back_inserter(ages), &Employee::age);
    std::ranges::sort(ages);
    std::println("sorted ages {}", ages);
    std::println("binary_search(41): {}, first age >= 40 is {}", std::ranges::binary_search(ages, 41), *std::ranges::lower_bound(ages, 40));

    std::vector<int> data{9, 1, 8, 2, 7, 3, 6, 4, 5};
    auto mid = data.begin() + static_cast<std::ptrdiff_t>(data.size() / 2);
    std::ranges::nth_element(data, mid);                              // O(n): median in its sorted spot
    std::println("median {}", *mid);

    std::vector<int> nums(10);
    std::iota(nums.begin(), nums.end(), 1);                           // 1..10
    auto [evens_end, rest_end] = std::ranges::partition(nums, [](int x) { return x % 2 == 0; });
    std::println("evens first: {} even values", std::distance(nums.begin(), evens_end));
    std::vector<int> dupes{1, 1, 2, 3, 3, 3, 4};
    dupes.erase(std::unique(dupes.begin(), dupes.end()), dupes.end());
    std::println("unique {}", dupes);
    std::println("clamp(150, 0, 100) = {}", std::clamp(150, 0, 100));
}`,
          },
        ],
        output: `by salary: Barbara Ken Margaret Linus Ada Grace
by dept, then salary: Eng/Linus Eng/Ada Eng/Grace Ops/Ken Ops/Margaret Sales/Barbara
over 40: 3, payroll: 780k, top earner: Grace, all adults: true
found Ken in Ops
sorted ages [29, 33, 36, 41, 45, 52]
binary_search(41): true, first age >= 40 is 41
median 5
evens first: 5 even values
unique [1, 2, 3, 4]
clamp(150, 0, 100) = 100`,
        explain: `- The \`{}\` in \`std::ranges::sort(staff, {}, &Employee::salary)\` is the default comparator (\`std::ranges::less\`); the third argument is the **projection**.
- \`stable_sort\` keeps equal elements (same department) in their previous order, so sorting by salary then stably by department gives "by department, then salary".
- \`std::ranges::find(staff, "Ken", &Employee::name)\` compares the projected name, with no lambda needed.
- \`partition\` returns the boundary; \`unique\` removes only *adjacent* duplicates, so sort first.
- \`std::back_inserter\` (from \`<iterator>\`) appends to the vector as \`transform\` writes, so you don't have to pre-size it.`,
      },
      {
        title: "Lambdas: captures, state, generic lambdas and std::function",
        variants: [
          {
            lang: "cpp",
            code: `#include <functional>
#include <map>
#include <memory>
#include <print>
#include <string>
#include <vector>

std::function<int()> make_counter(int start) {
    return [n = start]() mutable { return n++; };        // owns its own copy of n
}

auto make_multiplier(int factor) {
    return [factor](int x) { return x * factor; };       // capture by value: safe to return
}

int main() {
    int threshold = 10;
    auto above = [threshold](int x) { return x > threshold; };
    threshold = 100;                                     // the lambda kept a copy: still 10
    std::println("above(50) = {}", above(50));

    int total = 0;
    auto add = [&total](int x) { total += x; };         // by reference: sees and changes total
    for (int x : {1, 2, 3}) add(x);
    std::println("total = {}", total);

    auto counter = make_counter(5);
    int first = counter();
    int second = counter();
    int third = counter();                               // separate statements: order guaranteed
    std::println("counter: {} {} {}", first, second, third);

    auto triple = make_multiplier(3);
    auto twice = [](auto x) { return x + x; };          // generic: works for int, double, string
    std::println("{} {} {} {}", triple(7), twice(21), twice(1.25), twice(std::string("ab")));

    auto owned = std::make_unique<std::string>("moved into the lambda");
    auto holder = [p = std::move(owned)] { return *p; };  // init-capture takes ownership
    std::println("{} (owned is now {})", holder(), owned ? "full" : "empty");

    std::map<std::string, std::function<double(double, double)>> ops{
        {"+", [](double a, double b) { return a + b; }},
        {"*", [](double a, double b) { return a * b; }},
        {"max", [](double a, double b) { return a > b ? a : b; }},
    };
    for (const auto& [name, op] : ops) std::print("{}: {}  ", name, op(6, 7));
    std::println("");

    std::vector<std::function<void()>> callbacks;
    for (int i = 0; i < 3; ++i) callbacks.push_back([i] { std::print("cb{} ", i); });   // capture i BY VALUE
    for (const auto& cb : callbacks) cb();
    std::println("");

    const auto config = [] {                            // immediately-invoked lambda for const init
        std::vector<int> v;
        for (int i = 1; i <= 5; ++i) v.push_back(i * i);
        return v;
    }();
    std::println("config {}", config);
}`,
          },
        ],
        output: `above(50) = true
total = 6
counter: 5 6 7
21 42 2.5 abab
moved into the lambda (owned is now empty)
*: 42  +: 13  max: 7
cb0 cb1 cb2
config [1, 4, 9, 16, 25]`,
        explain: `- \`make_counter\` returns a closure that owns its own \`n\`; each call advances it. The three calls are in separate statements on purpose: the order in which **function arguments** are evaluated is unspecified, so \`println("{} {} {}", counter(), counter(), counter())\` could legally print \`7 6 5\`.
- The callbacks capture \`i\` by value. Capturing \`[&i]\` would leave three lambdas referring to a loop variable that no longer exists: a dangling reference.
- The \`std::map\` iterates keys in sorted order: \`*\` (ASCII 42) sorts before \`+\` (43) and \`max\`.
- The immediately-invoked lambda lets you build a \`const\` value with several statements.`,
      },
      {
        title: "Ranges and views: lazy pipelines (C++20/23)",
        variants: [
          {
            lang: "cpp",
            code: `#include <algorithm>
#include <map>
#include <print>
#include <ranges>
#include <string>
#include <string_view>
#include <vector>

int main() {
    std::vector<int> numbers{5, 12, 7, 8, 21, 14, 3, 30, 9};

    auto pipeline = numbers
        | std::views::filter([](int x) { return x % 2 == 0; })
        | std::views::transform([](int x) { return x * x; })
        | std::views::take(3);                                   // lazy: nothing runs yet
    std::println("first three squares of evens: {}", pipeline);

    std::vector<int> collected = pipeline | std::ranges::to<std::vector>();   // C++23
    std::println("collected into a vector of size {}", collected.size());

    std::println("iota 1..5 reversed: {}", std::views::iota(1, 6) | std::views::reverse);
    std::println("take_while < 10: {}", numbers | std::views::take_while([](int x) { return x < 10; }));
    std::println("drop 6: {}", numbers | std::views::drop(6));

    std::vector<std::string> names{"ada", "linus", "grace"};
    std::vector<int> years{1815, 1969, 1906};
    for (const auto& [name, year] : std::views::zip(names, years)) std::print("{}:{} ", name, year);   // C++23
    std::println("");

    std::map<std::string, int> stock{{"apple", 3}, {"kiwi", 12}, {"pear", 0}};
    std::println("keys {} values {}", stock | std::views::keys, stock | std::views::values);

    std::string_view csv = "id,name,email";
    auto columns = csv | std::views::split(',')
                       | std::views::transform([](auto part) { return std::string(part.begin(), part.end()); })
                       | std::ranges::to<std::vector>();
    std::println("columns {}", columns);

    auto longest = std::ranges::max(names, {}, &std::string::size);   // projection on a member function
    std::println("longest name: {}", longest);

    int calls = 0;
    auto counted = numbers | std::views::filter([&calls](int x) { ++calls; return x > 10; }) | std::views::take(1);
    for (int x : counted) std::println("first > 10 is {}, after testing {} element(s)", x, calls);
}`,
          },
        ],
        output: `first three squares of evens: [144, 64, 196]
collected into a vector of size 3
iota 1..5 reversed: [5, 4, 3, 2, 1]
take_while < 10: [5]
drop 6: [3, 30, 9]
ada:1815 linus:1969 grace:1906
keys ["apple", "kiwi", "pear"] values [3, 12, 0]
columns ["id", "name", "email"]
longest name: linus
first > 10 is 12, after testing 2 element(s)`,
        explain: `- Views compute elements on demand as you iterate: the last pipeline stops after testing just 2 numbers, like Java streams.
- \`take_while\` stops at the first failure (12), so it yields only \`[5]\`; \`filter\` would skip and continue.
- \`std::views::zip\` walks several ranges in lockstep, yielding tuples you can unpack.
- \`std::ranges::max(names, {}, &std::string::size)\` compares names by length; ties keep the first maximum.
- A view stores references or iterators into its source: keep the source alive while you use the view.`,
      },
    ],
    interview: [
      {
        q: "What's the difference between capturing by value and by reference in a lambda?",
        a: "By value (`[x]`, `[=]`) copies the variable into the closure when the lambda is created: later changes to the original aren't seen, and the closure is self-contained (safe to store or return); the copy is const inside unless the lambda is `mutable`. By reference (`[&x]`, `[&]`) stores a reference: the lambda sees current values and can modify them, but must not outlive the variables, or it dangles (classic bugs: returning such a lambda, storing it as a callback, passing it to a thread). Init-captures (`[p = std::move(ptr)]`) move or compute values into the closure.",
        freq: "very-common",
      },
      {
        q: "What is std::function and what does it cost?",
        a: "A type-erased, copyable wrapper for any callable with a given signature (function pointer, lambda, functor, bound member). It allows storing heterogeneous callables in one type (callbacks, maps of handlers). Costs: an indirect call that usually can't be inlined, possible heap allocation when the callable is larger than its small-buffer, and it requires copyable callables (C++23 adds `std::move_only_function`). For performance-critical code, accept callables as template parameters (`auto&& f` or a concept) instead.",
        freq: "common",
      },
      {
        q: "What are C++20 ranges and views?",
        a: "Ranges let algorithms take whole containers (`std::ranges::sort(v)`) with projections and better error messages via concepts. Views are lightweight, lazily evaluated adaptors (`filter`, `transform`, `take`, `reverse`, `split`, `zip`...) composed with `|` into pipelines; they don't own data and compute elements on iteration, so pipelines avoid intermediate containers and can short-circuit. Pitfalls: views referencing destroyed containers dangle, some views (like `filter`) cache state and aren't const-iterable, and `ranges::to` (C++23) is needed to materialize results conveniently.",
        freq: "common",
      },
      {
        q: "sort vs stable_sort vs partial_sort vs nth_element?",
        a: "`sort`: O(n log n) introsort, not stable. `stable_sort`: O(n log n) merge sort, preserves the relative order of equal elements, may allocate. `partial_sort(first, middle, last)`: sorts only the smallest k elements, O(n log k), good for top-k. `nth_element`: puts the element that would be at position n in sorted order there, with smaller elements before and larger after, in O(n) average: ideal for medians and percentiles.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "`int t = 1; auto f = [t]{ return t; }; t = 5;` what does f() return?",
        options: ["1", "5", "Undefined", "Compile error"],
        answer: 0,
        explain: "Captured by value at creation time.",
      },
      {
        q: "Which is dangerous?",
        options: ["Returning a lambda that captures locals by value", "Storing a callback that captures a local by reference after the function returns", "A generic lambda", "A mutable lambda"],
        answer: 1,
        explain: "The reference outlives the variable: dangling.",
      },
      {
        q: "When does `v | std::views::filter(f) | std::views::transform(g)` call f?",
        options: ["Immediately for all elements", "Lazily, as you iterate the result", "Never", "At compile time"],
        answer: 1,
        explain: "Views are lazy.",
      },
      {
        q: "What does std::unique do on [1,1,2,1]?",
        options: ["Removes all duplicates: [1,2]", "Collapses adjacent duplicates: [1,2,1] (then erase the tail)", "Sorts it", "Nothing"],
        answer: 1,
        explain: "unique only handles consecutive equal elements; sort first for full deduplication.",
      },
      {
        q: "Best algorithm to find the median of an unsorted vector efficiently?",
        options: ["std::sort then index", "std::nth_element", "std::find", "std::accumulate"],
        answer: 1,
        explain: "nth_element is O(n) on average.",
      },
    ],
  },

  // ------------------------------------------------------------------ TOOLING
  {
    id: "cpp-tooling",
    stage: "Core",
    title: "Building real projects: CMake, packages, tests and sanitizers",
    tagline: "Project layout, CMake targets, vcpkg and Conan, GoogleTest and Catch2, sanitizers, clang-tidy, clang-format and debuggers.",
    difficulty: "intermediate",
    minutes: 30,
    concept: `
## Project layout
\`\`\`text
my-app/
├── CMakeLists.txt          build definition
├── CMakePresets.json       named configurations (debug, release, asan)
├── vcpkg.json              dependencies (if using vcpkg)
├── include/myapp/          public headers (for libraries)
├── src/                    .cpp files (and private headers)
├── tests/                  unit tests
├── .clang-format           formatting rules
└── .clang-tidy             lint rules
\`\`\`

## CMake: the de facto build system
CMake generates build files (Ninja, Make, Visual Studio, Xcode) from a portable description. **Modern CMake is target-based**: you declare targets (libraries, executables) and attach properties to them.
\`\`\`cmake
add_library(core src/parser.cpp src/store.cpp)
target_include_directories(core PUBLIC include)
target_compile_features(core PUBLIC cxx_std_23)
add_executable(app src/main.cpp)
target_link_libraries(app PRIVATE core)        # app gets core's PUBLIC includes automatically
\`\`\`
- \`PRIVATE\` = only this target needs it; \`PUBLIC\` = this target and anyone linking it; \`INTERFACE\` = only consumers.
- Avoid global commands like \`include_directories()\` and \`add_definitions()\`; avoid \`file(GLOB ...)\` for sources.
- Out-of-source builds: \`cmake -S . -B build\`, then \`cmake --build build\`.
- \`-DCMAKE_EXPORT_COMPILE_COMMANDS=ON\` produces \`compile_commands.json\` for clangd, clang-tidy and IDEs.

## Dependencies
C++ has no single package registry, but two package managers dominate:
- **vcpkg** (Microsoft): a \`vcpkg.json\` manifest; integrates through a CMake toolchain file. Huge catalog.
- **Conan**: a \`conanfile.txt\`/\`.py\`; binary packages, popular in enterprise.
- **CMake \`FetchContent\`**: downloads and builds a dependency from source at configure time. Great for small, header-only or test dependencies.
- System packages (\`apt install libboost-dev\`, \`brew install boost\`) work for development.

## Testing
| Framework | Character |
|---|---|
| **GoogleTest** (+ GoogleMock) | The most widely used; \`TEST\`, \`EXPECT_EQ\`, fixtures, parameterized tests, mocks |
| **Catch2** | Expressive \`REQUIRE(a == b)\`, \`SECTION\`s, BDD style, built-in benchmarks |
| **doctest** | Catch2-like, extremely fast to compile, can live next to the code |
| **Google Benchmark** | Microbenchmarks done right |

Register tests with CTest (\`enable_testing()\`, \`add_test\`, or \`gtest_discover_tests\`) and run \`ctest --test-dir build\`.

## Catching bugs early
- **Warnings**: \`-Wall -Wextra -Wpedantic -Wshadow -Wconversion\`, and \`-Werror\` in CI.
- **Sanitizers** (debug/test builds): AddressSanitizer (\`address\`: out-of-bounds, use-after-free, leaks), UndefinedBehaviorSanitizer (\`undefined\`), ThreadSanitizer (\`thread\`: data races; can't combine with ASan), MemorySanitizer (uninitialized reads, Clang/Linux).
- **Static analysis**: **clang-tidy** (modernize, bugprone, performance and C++ Core Guidelines checks), cppcheck, compiler \`-fanalyzer\` (GCC).
- **Formatting**: **clang-format** with a checked-in \`.clang-format\`; run it in CI.
- **Debuggers**: gdb (Linux), lldb (macOS), Visual Studio; set breakpoints, inspect variables, \`bt\` for a backtrace after a crash.
- **Profilers**: perf (Linux), Instruments (macOS), VTune, Valgrind's callgrind; heaptrack for allocations.

## Build types
\`Debug\` (\`-O0 -g\`: easy debugging), \`Release\` (\`-O3 -DNDEBUG\`: \`assert\` disabled), \`RelWithDebInfo\` (\`-O2 -g\`: profiling production-like builds). Set with \`-DCMAKE_BUILD_TYPE=Release\` (single-config generators).
`,
    keyPoints: [
      "Modern CMake is target-based: add_library/add_executable + target_* commands",
      "PRIVATE / PUBLIC / INTERFACE control how requirements propagate",
      "vcpkg or Conan for dependencies; FetchContent for small ones",
      "GoogleTest or Catch2 for tests, run through CTest",
      "Sanitizers in debug/CI builds: ASan + UBSan, and TSan for threads",
      "clang-tidy for static analysis, clang-format for consistent style",
      "Export compile_commands.json for clangd and tooling",
    ],
    code: [
      {
        title: "A complete modern CMakeLists.txt",
        variants: [
          {
            lang: "cmake",
            code: `cmake_minimum_required(VERSION 3.25)
project(inventory VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)                 # -std=c++23, not gnu++23
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)         # compile_commands.json for clangd/clang-tidy

option(ENABLE_SANITIZERS "Build with ASan + UBSan" OFF)

# Shared warning settings as an INTERFACE target other targets can link to
add_library(project_warnings INTERFACE)
target_compile_options(project_warnings INTERFACE
  $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall -Wextra -Wpedantic -Wshadow -Wconversion>
  $<$<CXX_COMPILER_ID:MSVC>:/W4 /permissive->)

if(ENABLE_SANITIZERS)
  add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer)
  add_link_options(-fsanitize=address,undefined)
endif()

# The library holds the logic, so tests can link it too
add_library(inventory_core src/inventory.cpp src/report.cpp)
target_include_directories(inventory_core PUBLIC include)
target_link_libraries(inventory_core PRIVATE project_warnings)

add_executable(inventory src/main.cpp)
target_link_libraries(inventory PRIVATE inventory_core project_warnings)

# Tests: GoogleTest fetched at configure time
include(FetchContent)
FetchContent_Declare(googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.17.0.zip)
FetchContent_MakeAvailable(googletest)

enable_testing()
add_executable(inventory_tests tests/inventory_test.cpp)
target_link_libraries(inventory_tests PRIVATE inventory_core GTest::gtest_main)
include(GoogleTest)
gtest_discover_tests(inventory_tests)`,
          },
        ],
        explain: `- The logic lives in a library (\`inventory_core\`) linked by both the app and the tests: the standard way to make code testable.
- Generator expressions (\`$<...>\`) pick flags per compiler.
- Pin dependency versions (here a GoogleTest release) so builds are reproducible.`,
      },
      {
        title: "Configure, build, test and analyze",
        variants: [
          {
            lang: "bash",
            code: `# configure + build (Ninja is fastest)
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug -DENABLE_SANITIZERS=ON
cmake --build build -j
ctest --test-dir build --output-on-failure

# release build
cmake -S . -B build-release -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build-release

# static analysis and formatting
clang-tidy -p build src/*.cpp --checks='-*,bugprone-*,modernize-*,performance-*'
clang-format -i src/*.cpp include/**/*.hpp
clang-format --dry-run --Werror src/*.cpp            # in CI: fail if unformatted

# data races: ThreadSanitizer (separate build; can't be combined with ASan)
clang++ -std=c++23 -g -fsanitize=thread -O1 src/*.cpp -o app-tsan && ./app-tsan

# debug a crash
lldb ./build/inventory          # (gdb on Linux)
(lldb) run
(lldb) bt                       # backtrace: where did it crash?
(lldb) frame variable           # locals in the current frame`,
          },
        ],
      },
      {
        title: "A GoogleTest test file",
        variants: [
          {
            lang: "cpp",
            code: `// tests/inventory_test.cpp
#include <gtest/gtest.h>
#include <stdexcept>
#include "inventory/inventory.hpp"

TEST(Inventory, StartsEmpty) {
    Inventory inv;
    EXPECT_EQ(inv.total_items(), 0);
    EXPECT_FALSE(inv.contains("apple"));
}

TEST(Inventory, AddAccumulatesQuantity) {
    Inventory inv;
    inv.add("apple", 3);
    inv.add("apple", 2);
    EXPECT_EQ(inv.quantity("apple"), 5);
}

TEST(Inventory, RemovingMoreThanInStockThrows) {
    Inventory inv;
    inv.add("pear", 1);
    EXPECT_THROW(inv.remove("pear", 2), std::invalid_argument);
    EXPECT_EQ(inv.quantity("pear"), 1);         // unchanged after the failed call
}

// Fixture: shared setup for several tests
class FilledInventory : public ::testing::Test {
protected:
    void SetUp() override {
        inv.add("apple", 10);
        inv.add("kiwi", 4);
    }
    Inventory inv;
};

TEST_F(FilledInventory, LowStockReportsItemsBelowThreshold) {
    auto low = inv.low_stock(5);
    ASSERT_EQ(low.size(), 1u);                  // ASSERT_ stops the test on failure
    EXPECT_EQ(low[0], "kiwi");
}`,
          },
        ],
        explain: `- \`EXPECT_*\` records a failure and continues; \`ASSERT_*\` stops the current test (use it when later checks would crash).
- \`GTest::gtest_main\` provides \`main()\`, so test files contain only tests.
- The Catch2 equivalent reads \`REQUIRE(inv.quantity("apple") == 5);\` inside \`TEST_CASE("...")\`.`,
      },
      {
        title: "Presets, vcpkg manifest and formatting config",
        variants: [
          {
            lang: "json",
            code: `// CMakePresets.json: cmake --preset debug && cmake --build --preset debug
{
  "version": 6,
  "configurePresets": [
    {
      "name": "base",
      "hidden": true,
      "generator": "Ninja",
      "binaryDir": "build/\${presetName}",
      "toolchainFile": "$env{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
    },
    { "name": "debug", "inherits": "base", "cacheVariables": { "CMAKE_BUILD_TYPE": "Debug", "ENABLE_SANITIZERS": "ON" } },
    { "name": "release", "inherits": "base", "cacheVariables": { "CMAKE_BUILD_TYPE": "Release" } }
  ],
  "buildPresets": [
    { "name": "debug", "configurePreset": "debug" },
    { "name": "release", "configurePreset": "release" }
  ]
}`,
          },
          {
            lang: "json",
            code: `// vcpkg.json: dependencies are installed automatically at configure time
{
  "name": "inventory",
  "version": "1.0.0",
  "dependencies": ["fmt", "spdlog", "nlohmann-json", "gtest"]
}`,
          },
          {
            lang: "yaml",
            code: `# .clang-format
BasedOnStyle: Google
IndentWidth: 4
ColumnLimit: 110
AllowShortFunctionsOnASingleLine: Inline
PointerAlignment: Left`,
          },
        ],
        explain: `- With the vcpkg toolchain file, \`find_package(fmt CONFIG REQUIRED)\` and \`target_link_libraries(app PRIVATE fmt::fmt)\` just work.
- Presets let everyone (and CI) build with identical settings using one short command.`,
      },
    ],
    interview: [
      {
        q: "What does modern, target-based CMake look like and why?",
        a: "Each library or executable is a target; you attach requirements to targets with `target_include_directories`, `target_compile_features`, `target_compile_options` and `target_link_libraries`, specifying PRIVATE (needed to build this target), PUBLIC (also needed by consumers) or INTERFACE (only consumers). Linking a target transitively brings its usage requirements, so dependencies compose cleanly without global flags. Dependencies come from `find_package` (with vcpkg/Conan) or `FetchContent`. It avoids the old style of global `include_directories`/`CMAKE_CXX_FLAGS` mutations that leak into every target.",
        freq: "common",
      },
      {
        q: "Which sanitizers do you know and what do they catch?",
        a: "AddressSanitizer: heap/stack/global buffer overflows, use-after-free, use-after-return, double free, and leaks (LeakSanitizer); about 2x slowdown. UndefinedBehaviorSanitizer: signed overflow, invalid shifts, null dereference, misaligned access, bad casts, out-of-range enum values. ThreadSanitizer: data races and some deadlocks (5-15x slowdown, incompatible with ASan). MemorySanitizer: reads of uninitialized memory (Clang, requires instrumented libraries). Run them in CI test builds with `-g -fno-omit-frame-pointer` for readable stack traces.",
        freq: "common",
      },
      {
        q: "How do you manage third-party dependencies in C++?",
        a: "Use a package manager (vcpkg with a `vcpkg.json` manifest and the CMake toolchain file, or Conan) to get pinned, reproducible versions across platforms, or CMake FetchContent for small/header-only deps. Consume them via `find_package` and imported targets. Pin versions (vcpkg baselines, Conan lockfiles), cache binaries in CI, and keep the dependency count small, since every library adds build time and ABI/compatibility concerns.",
        freq: "common",
      },
      {
        q: "Static vs dynamic linking?",
        a: "Static linking copies library code into the executable at link time: a self-contained binary, no runtime dependency issues, possible whole-program optimization, but larger binaries and every app must be relinked to pick up a security fix. Dynamic linking (`.so`/`.dylib`/`.dll`) resolves the library at load time: shared memory across processes, smaller binaries, updates without relinking, but deployment needs the right library versions (ABI compatibility, 'DLL hell'), and calls go through indirection (PLT/GOT).",
      },
    ],
    quiz: [
      {
        q: "In `target_link_libraries(app PRIVATE core)`, what does PRIVATE mean?",
        options: ["core is hidden from app", "Only app needs core; app's consumers don't inherit it", "core is linked statically", "Nothing"],
        answer: 1,
        explain: "PUBLIC would propagate core's requirements to app's consumers too.",
      },
      {
        q: "Which sanitizer finds data races?",
        options: ["AddressSanitizer", "ThreadSanitizer", "UndefinedBehaviorSanitizer", "LeakSanitizer"],
        answer: 1,
        explain: "TSan instruments memory accesses and synchronization.",
      },
      {
        q: "What file do clangd and clang-tidy read to know your compile flags?",
        options: ["Makefile", "compile_commands.json", "CMakeCache.txt", ".clangd only"],
        answer: 1,
        explain: "Enable it with CMAKE_EXPORT_COMPILE_COMMANDS=ON.",
      },
      {
        q: "Why put application logic in a library target separate from main.cpp?",
        options: ["Faster startup", "So test executables can link the same code", "CMake requires it", "To use PUBLIC"],
        answer: 1,
        explain: "Tests link the library; only the tiny main stays untested.",
      },
      {
        q: "What does a Release build usually do to assert()?",
        options: ["Makes it throw", "Disables it via NDEBUG", "Logs it", "Nothing"],
        answer: 1,
        explain: "NDEBUG compiles asserts away.",
      },
    ],
  },
];
