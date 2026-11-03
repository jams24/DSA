import type { Lesson } from "../types";

// C++ track, part 3: Advanced.

export const cppAdvanced: Lesson[] = [
  // ------------------------------------------------------------------ MOVE SEMANTICS
  {
    id: "cpp-move",
    stage: "Advanced",
    title: "Move semantics, value categories and the rule of zero",
    tagline: "Why C++ can transfer resources instead of copying them: rvalue references, std::move, noexcept, copy elision, the rules of 0/3/5 and perfect forwarding.",
    difficulty: "advanced",
    minutes: 40,
    visualizers: ["cppmove"],
    concept: `
## The problem moves solve
Copying a \`std::vector\` of a million elements allocates and copies a million elements. But often the source is about to die anyway (a temporary, a local being returned). **Moving** lets the new object *steal* the source's resources (its heap pointer) in O(1), leaving the source empty but valid.

## Value categories, simplified
Every expression is either:
- an **lvalue**: has a name and an address you can take (\`x\`, \`v[0]\`, \`*ptr\`). It will live on, so it must be **copied** from.
- an **rvalue**: a temporary or something marked as expiring (\`std::string("hi")\`, \`a + b\`, \`f()\` returning by value, \`std::move(x)\`). Nobody else will use it, so it may be **moved** from.

(Formally: rvalues split into **prvalues**, pure temporaries, and **xvalues**, "expiring" objects such as \`std::move(x)\`.)

An **rvalue reference** \`T&&\` binds only to rvalues. That's how overloads choose: \`push_back(const T&)\` copies, \`push_back(T&&)\` moves.

## std::move doesn't move
\`std::move(x)\` is just a **cast** to \`T&&\`: "I'm done with x, you may steal from it". The actual move happens in the move constructor or move assignment that receives it. After a move, the source is in a **valid but unspecified** state: you may destroy it or assign a new value, but don't rely on its contents.

## The special member functions
\`\`\`cpp
class Buffer {
public:
    Buffer(const Buffer& other);              // copy constructor
    Buffer& operator=(const Buffer& other);   // copy assignment
    Buffer(Buffer&& other) noexcept;          // move constructor
    Buffer& operator=(Buffer&& other) noexcept; // move assignment
    ~Buffer();                                // destructor
};
\`\`\`
- **Rule of zero** (the goal): build classes from members that manage themselves (\`std::string\`, \`std::vector\`, \`std::unique_ptr\`) and declare **none** of the five. The compiler generates correct ones.
- **Rule of five**: if you must manage a raw resource and write one of them, think about all five.
- **Trap**: declaring a destructor (even an empty one) or a copy operation **suppresses the implicit move operations**. "Moves" then silently become copies.

## noexcept matters
When \`std::vector\` grows, it must keep its strong exception guarantee. It uses \`std::move_if_noexcept\`: it **moves** elements only if the move constructor is \`noexcept\`, otherwise it **copies** them. Always mark move operations \`noexcept\` (they normally just swap pointers).

## Copy elision
- **Guaranteed (C++17)**: initializing from a prvalue of the same type constructs the object directly in its final place: \`Buffer b = Buffer(10);\` and \`return Buffer(10);\` perform no copy and no move at all.
- **NRVO** (named return value optimization): \`Buffer b(10); return b;\` is usually elided too, and if not, the return is an implicit move.
- So **don't write \`return std::move(local);\`**: it prevents NRVO.

## Perfect forwarding
In a template, \`T&&\` where \`T\` is deduced is a **forwarding reference** (a "universal reference"): it binds to lvalues and rvalues. Inside the function, though, the parameter has a name, so it's an lvalue. \`std::forward<T>(arg)\` restores the original category. That's how \`std::make_unique\` and \`emplace_back\` pass arguments to constructors without extra copies.
`,
    keyPoints: [
      "lvalues have identity and must be copied from; rvalues may be moved from",
      "std::move is only a cast to T&&; the move constructor does the work",
      "A moved-from object is valid but unspecified: assign to it or destroy it",
      "Rule of zero: let members manage resources and declare no special members",
      "A user-declared destructor silently disables implicit moves",
      "Mark move operations noexcept, or vector growth copies instead of moving",
      "Returning a local or a prvalue is elided or moved: never return std::move(local)",
      "Forwarding references (T&& with deduced T) + std::forward preserve categories",
    ],
    code: [
      {
        title: "An instrumented buffer: copy, move, elision and copy-and-swap",
        variants: [
          {
            lang: "cpp",
            code: `#include <algorithm>
#include <cstddef>
#include <print>
#include <utility>

class Buffer {
public:
    explicit Buffer(std::size_t n) : size_(n), data_(new int[n]{}) {
        std::println("    allocate {} ints", n);
    }
    ~Buffer() {
        if (data_) std::println("    free {} ints", size_);
        delete[] data_;
    }
    Buffer(const Buffer& other) : size_(other.size_), data_(new int[other.size_]) {   // deep copy
        std::copy(other.data_, other.data_ + size_, data_);
        std::println("    COPY: allocate {} ints and copy them", size_);
    }
    Buffer(Buffer&& other) noexcept                                                   // steal
        : size_(std::exchange(other.size_, 0)), data_(std::exchange(other.data_, nullptr)) {
        std::println("    MOVE: steal the pointer ({} ints, no allocation)", size_);
    }
    Buffer& operator=(Buffer other) noexcept {    // copy-and-swap: one function for copy AND move assignment
        std::swap(size_, other.size_);
        std::swap(data_, other.data_);
        return *this;
    }                                             // other now holds our old buffer and frees it
    std::size_t size() const { return size_; }

private:
    std::size_t size_;
    int* data_;
};

Buffer make_buffer(std::size_t n) {
    return Buffer(n);                             // prvalue: built directly in the caller's variable
}

void take(Buffer b) { std::println("    take() got {} ints", b.size()); }

int main() {
    std::println("1. Buffer a(1000);");
    Buffer a(1000);
    std::println("2. Buffer b = a;  (a is an lvalue: copy)");
    Buffer b = a;
    std::println("3. Buffer c = std::move(a);  (an rvalue: move)");
    Buffer c = std::move(a);
    std::println("    a.size() is now {}", a.size());
    std::println("4. Buffer d = make_buffer(500);  (guaranteed elision)");
    Buffer d = make_buffer(500);
    std::println("5. b = d;  (copy assignment)");
    b = d;
    std::println("6. b = Buffer(10);  (assignment from a temporary)");
    b = Buffer(10);
    std::println("7. take(std::move(c));");
    take(std::move(c));
    std::println("8. end of main: destructors run in reverse order");
}`,
          },
        ],
        output: `1. Buffer a(1000);
    allocate 1000 ints
2. Buffer b = a;  (a is an lvalue: copy)
    COPY: allocate 1000 ints and copy them
3. Buffer c = std::move(a);  (an rvalue: move)
    MOVE: steal the pointer (1000 ints, no allocation)
    a.size() is now 0
4. Buffer d = make_buffer(500);  (guaranteed elision)
    allocate 500 ints
5. b = d;  (copy assignment)
    COPY: allocate 500 ints and copy them
    free 1000 ints
6. b = Buffer(10);  (assignment from a temporary)
    allocate 10 ints
    free 500 ints
7. take(std::move(c));
    MOVE: steal the pointer (1000 ints, no allocation)
    take() got 1000 ints
    free 1000 ints
8. end of main: destructors run in reverse order
    free 500 ints
    free 10 ints`,
        explain: `- **Step 4**: \`make_buffer\` returns a prvalue, so the buffer is constructed directly in \`d\`: one allocation, no copy, no move. That's guaranteed since C++17.
- **Step 5**: copy-and-swap takes its parameter **by value**. Passing the lvalue \`d\` copies into the parameter, we swap, and the parameter leaves with b's old 1000 ints and frees them. If the copy throws, \`b\` is untouched: the strong exception guarantee for free.
- **Step 6**: the temporary initializes the parameter directly (elision again), so assignment from a temporary costs nothing but a swap.
- **Step 8**: \`a\` and \`c\` were moved from (null data), so only \`d\` (500) and \`b\` (10) free anything.
- In real code, prefer the rule of zero: a \`std::vector<int>\` member would give you all of this for free.`,
      },
      {
        title: "noexcept and vector growth, and the destructor trap",
        variants: [
          {
            lang: "cpp",
            code: `#include <print>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

struct Fast {
    Fast() = default;
    Fast(const Fast&) { ++copies; }
    Fast(Fast&&) noexcept { ++moves; }           // noexcept: vector will move
    inline static int copies = 0;
    inline static int moves = 0;
};

struct Slow {
    Slow() = default;
    Slow(const Slow&) { ++copies; }
    Slow(Slow&&) { ++moves; }                    // may throw: vector copies instead, to stay exception-safe
    inline static int copies = 0;
    inline static int moves = 0;
};

template <typename T>
void grow(const char* label) {
    std::vector<T> v;
    for (int i = 0; i < 5; ++i) v.emplace_back();   // capacity 1 -> 2 -> 4 -> 8: relocates 1 + 2 + 4 elements
    std::println("{}: {} moves, {} copies while growing to {}", label, T::moves, T::copies, v.size());
}

struct RuleOfZero {                  // members manage themselves: all five special members generated
    std::string name;
    std::vector<int> data;
};

struct DeclaresDestructor {
    std::vector<int> data;
    ~DeclaresDestructor() {}         // user-declared destructor: implicit move constructor NOT generated
};

int main() {
    grow<Fast>("noexcept move");
    grow<Slow>("throwing move");
    std::println("is_nothrow_move_constructible: Fast={} Slow={}",
                 std::is_nothrow_move_constructible_v<Fast>, std::is_nothrow_move_constructible_v<Slow>);

    RuleOfZero a{"a", std::vector<int>(1000)};
    RuleOfZero b = std::move(a);
    std::println("RuleOfZero:         moved {} ints, source now holds {}", b.data.size(), a.data.size());

    DeclaresDestructor c{std::vector<int>(1000)};
    DeclaresDestructor d = std::move(c);         // falls back to the copy constructor!
    std::println("DeclaresDestructor: 'moved' {} ints, source still holds {}", d.data.size(), c.data.size());
}`,
          },
        ],
        output: `noexcept move: 7 moves, 0 copies while growing to 5
throwing move: 0 moves, 7 copies while growing to 5
is_nothrow_move_constructible: Fast=true Slow=false
RuleOfZero:         moved 1000 ints, source now holds 0
DeclaresDestructor: 'moved' 1000 ints, source still holds 1000`,
        explain: `- Growing to 5 elements reallocates three times (to capacities 2, 4 and 8, with libc++ and libstdc++'s doubling), relocating 1 + 2 + 4 = 7 elements. Only the \`noexcept\` type gets moved.
- Why copy? If a move threw halfway through a reallocation, some elements would already be gutted and the vector couldn't be restored. Copies leave the originals intact.
- \`DeclaresDestructor\` shows the most common silent performance bug: a harmless-looking empty destructor turned every move into a copy. Delete the destructor (rule of zero), or add \`DeclaresDestructor(DeclaresDestructor&&) noexcept = default;\` and friends.`,
      },
      {
        title: "Perfect forwarding with std::forward",
        variants: [
          {
            lang: "cpp",
            code: `#include <memory>
#include <print>
#include <string>
#include <utility>

void sink(const std::string& s) { std::println("    sink(const std::string&): must copy '{}'", s); }
void sink(std::string&& s) { std::println("    sink(std::string&&):      may steal '{}'", s); }

template <typename T>
void relay(T&& arg) {                    // forwarding reference: binds to lvalues AND rvalues
    sink(std::forward<T>(arg));          // passes it on with its original category
}

template <typename T>
void relay_broken(T&& arg) {
    sink(arg);                           // a named parameter is an lvalue: always picks the copy overload
}

template <typename T, typename... Args>
std::unique_ptr<T> my_make_unique(Args&&... args) {        // how std::make_unique is written
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

struct Person {
    std::string name;
    int age;
    Person(std::string n, int a) : name(std::move(n)), age(a) {}   // sink parameter: take by value, then move
};

int main() {
    std::string name = "lvalue";
    std::println("relay:");
    relay(name);
    relay(std::string("temporary"));
    std::println("relay_broken:");
    relay_broken(name);
    relay_broken(std::string("temporary"));

    auto p = my_make_unique<Person>("Ada", 36);
    std::println("my_make_unique<Person> -> {} ({})", p->name, p->age);

    std::string s = "abc";
    std::string&& r = std::move(s);       // just a cast: nothing has moved yet
    std::println("after the std::move cast, s is still '{}'", s);
    std::string stolen = std::move(r);    // the move constructor runs here
    s = "reused";                         // a moved-from string may be assigned a new value
    std::println("stolen = '{}', s = '{}'", stolen, s);
}`,
          },
        ],
        output: `relay:
    sink(const std::string&): must copy 'lvalue'
    sink(std::string&&):      may steal 'temporary'
relay_broken:
    sink(const std::string&): must copy 'lvalue'
    sink(const std::string&): must copy 'temporary'
my_make_unique<Person> -> Ada (36)
after the std::move cast, s is still 'abc'
stolen = 'abc', s = 'reused'`,
        explain: `- With \`relay(name)\`, \`T\` is deduced as \`std::string&\`, and \`T&&\` collapses to \`std::string&\` (**reference collapsing**). With a temporary, \`T\` is \`std::string\` and the parameter is \`std::string&&\`. \`std::forward<T>\` casts back to an rvalue only in the second case.
- \`relay_broken\` loses the rvalue-ness: the temporary gets copied.
- **Sink parameters**: a constructor that stores a string takes it **by value** and moves it into place. Callers passing a temporary pay one move; callers passing an lvalue pay one copy, which they'd pay anyway.
- The \`std::move(s)\` line proves \`std::move\` changes nothing by itself.`,
      },
    ],
    interview: [
      {
        q: "What does std::move do?",
        a: "Nothing at run time: it's a cast (`static_cast<T&&>`) that turns its argument into an xvalue, signalling that the object may be moved from. Overload resolution then picks move constructors/assignments (taking `T&&`) instead of copy ones. The actual resource transfer happens in those functions. If the type has no move operations, or the object is const (`const T&&` binds to the copy constructor), `std::move` results in a copy.",
        freq: "very-common",
      },
      {
        q: "Explain the rule of zero, three and five.",
        a: "Rule of three (C++98): if a class needs a user-defined destructor, copy constructor or copy assignment (because it manages a resource), it probably needs all three. Rule of five (C++11): add the move constructor and move assignment; declaring any of the copy operations or the destructor suppresses the implicit moves. Rule of zero (the modern goal): don't manage resources directly in ordinary classes; use RAII members like std::string, std::vector, std::unique_ptr, so the compiler-generated special members are correct and you declare none of them. Only small dedicated resource classes follow the rule of five.",
        freq: "very-common",
      },
      {
        q: "Why should move constructors be noexcept?",
        a: "Containers like std::vector provide the strong exception guarantee on reallocation. They use `std::move_if_noexcept`: if the element's move constructor might throw (and a copy constructor exists), they copy instead, because a move that throws midway would leave the original elements already modified. Marking moves `noexcept` (usually trivially true, since they just swap pointers) lets the container move, which can be dramatically faster. The defaulted move constructor is noexcept automatically if all members' moves are.",
        freq: "very-common",
      },
      {
        q: "What is copy elision / RVO? Should you return std::move(x)?",
        a: "Copy elision constructs an object directly in its final location instead of creating a temporary and copying or moving it. Since C++17 it's guaranteed for prvalues (`return T(...)`, `T x = T(...)`), and the type doesn't even need to be copyable or movable. NRVO (returning a named local) is permitted but optional; compilers almost always do it, and when they can't, the return is treated as an rvalue and moved automatically. Writing `return std::move(local);` disables NRVO and forces a move, so it's a pessimization (compilers warn with -Wpessimizing-move).",
        freq: "common",
      },
      {
        q: "What's a forwarding (universal) reference, and std::forward vs std::move?",
        a: "`T&&` where T is a deduced template parameter (or `auto&&`) is a forwarding reference: when passed an lvalue, T deduces to `U&` and reference collapsing makes the parameter `U&`; when passed an rvalue, T is `U` and the parameter is `U&&`. Since a named parameter is always an lvalue, `std::forward<T>(arg)` conditionally casts back to an rvalue only if the original argument was one. `std::move` casts unconditionally. Use move for rvalue references you own, forward for forwarding references you pass on.",
        freq: "common",
      },
      {
        q: "What state is a moved-from object in?",
        a: "For standard library types: valid but unspecified. Its invariants hold, so you can destroy it, assign to it, or call functions without preconditions (`size()`, `empty()`, `clear()`), but you can't assume a particular value. Some types do specify it: a moved-from `std::unique_ptr` or `std::shared_ptr` is guaranteed null. Your own types should leave moved-from objects destructible and assignable, typically empty.",
      },
    ],
    quiz: [
      {
        q: "`std::string b = std::move(a);` When does the actual move happen?",
        options: ["Inside std::move", "In std::string's move constructor", "At the end of the scope", "Never"],
        answer: 1,
        explain: "std::move only casts; the constructor does the transfer.",
      },
      {
        q: "A class with a std::vector member declares `~Widget() {}` and nothing else. Moving a Widget...",
        options: ["Moves the vector", "Copies the vector", "Doesn't compile", "Leaves both empty"],
        answer: 1,
        explain: "The user-declared destructor suppresses the implicit move constructor; copy is used.",
      },
      {
        q: "Why does vector copy elements on growth when the move constructor isn't noexcept?",
        options: ["Performance", "To keep the strong exception guarantee", "It's a bug", "Moves are illegal there"],
        answer: 1,
        explain: "A throwing move could leave the old elements half-moved.",
      },
      {
        q: "What's wrong with `return std::move(result);` for a local `result`?",
        options: ["Nothing", "It disables NRVO and can be slower", "It returns a dangling reference", "It doesn't compile"],
        answer: 1,
        explain: "Locals are already moved or elided on return.",
      },
      {
        q: "In `template<class T> void f(T&& x)`, what is x inside the function body?",
        options: ["Always an rvalue", "An lvalue (it has a name)", "A copy", "A pointer"],
        answer: 1,
        explain: "Hence std::forward<T>(x) to restore the original category.",
      },
      {
        q: "Since C++17, `Buffer b = Buffer(10);` performs...",
        options: ["One copy", "One move", "Neither: guaranteed elision", "A copy and a move"],
        answer: 2,
        explain: "A prvalue initializes b directly.",
      },
    ],
  },

  // ------------------------------------------------------------------ TEMPLATES
  {
    id: "cpp-templates",
    stage: "Advanced",
    title: "Templates, concepts and compile-time programming",
    tagline: "Generic functions and classes, class template argument deduction, specialization, C++20 concepts, variadic templates, fold expressions and constexpr.",
    difficulty: "advanced",
    minutes: 40,
    concept: `
## Templates are code generators
A template is a recipe the compiler uses to stamp out a version of a function or class for each set of arguments you use (**instantiation**). \`std::vector<int>\` and \`std::vector<std::string>\` are two different classes generated from one template.
\`\`\`cpp
template <typename T>
T largest(const std::vector<T>& items);         // T is deduced from the argument

template <typename T, std::size_t N>            // type AND non-type (value) parameters
class RingBuffer { std::array<T, N> data_; };
\`\`\`
- Template definitions usually live in **headers**: the compiler needs the full definition at each place it instantiates one.
- Benefits: zero-overhead generic code, everything can be inlined. Costs: compile time, code size ("template bloat"), and historically terrible error messages.
- **CTAD** (class template argument deduction, C++17): \`std::vector v{1, 2, 3};\` deduces \`std::vector<int>\`; \`std::pair p{"x", 1};\` deduces \`std::pair<const char*, int>\`.

## Specialization
A **full specialization** provides a custom implementation for one specific type: \`template <> struct Hash<MyType> { ... };\`. Class templates also allow **partial specialization** (\`template <typename T> struct IsPointer<T*>\`). For functions, prefer **overloading** to specialization.

## Concepts (C++20): constraints with names
Before C++20, templates accepted any type and failed deep inside with pages of errors. Concepts state requirements up front:
\`\`\`cpp
template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template <Numeric T> T average(...);                        // constrained template parameter
auto twice(Numeric auto x) { return x * 2; }                // abbreviated function template
template <typename T> requires std::copyable<T> void f(T);  // requires clause

template <typename T>
concept Printable = requires(const T& t) {                  // requires expression: "this must compile"
    { t.to_string() } -> std::convertible_to<std::string>;
};
\`\`\`
- Errors now say "constraint not satisfied: Printable<int>".
- Overloads can be chosen by constraints: a more constrained overload (\`std::signed_integral\`) beats a less constrained one (\`std::integral\`).
- The standard library provides many: \`std::integral\`, \`std::floating_point\`, \`std::same_as\`, \`std::convertible_to\`, \`std::copyable\`, \`std::invocable\`, \`std::ranges::range\`, \`std::totally_ordered\`...

## Variadic templates and folds
\`template <typename... Args>\` accepts any number of types. A **fold expression** applies an operator over the whole pack: \`(args + ...)\`, \`(std::cout << ... << args)\`, \`((v.push_back(args)), ...)\`. \`sizeof...(Args)\` counts them.

## Compile-time programming
| Keyword | Meaning |
|---|---|
| \`constexpr\` (function) | *Can* run at compile time when given constant inputs |
| \`constexpr\` (variable) | Must be computed at compile time |
| \`consteval\` | *Must* run at compile time (an immediate function) |
| \`constinit\` | A static variable must be initialized at compile time (avoids static init order bugs) |
| \`if constexpr\` | Branch chosen at compile time; the other branch isn't even instantiated |
| \`static_assert\` | Compile-time check with a message |

Modern constexpr allows loops, local variables, \`std::vector\` and \`std::string\` (transiently), so whole lookup tables can be computed by the compiler.

## Older techniques you'll still meet
- **SFINAE** and \`std::enable_if\`: the pre-concepts way to constrain templates. Read it, write concepts.
- **Type traits** (\`<type_traits>\`): \`std::is_integral_v<T>\`, \`std::remove_cvref_t<T>\`, \`std::conditional_t<B, A, B>\`.
- **CRTP** (\`class Derived : public Base<Derived>\`): static polymorphism and mixins without virtual calls. C++23's "deducing this" replaces many uses.
`,
    keyPoints: [
      "Templates are instantiated per set of arguments; definitions go in headers",
      "Non-type template parameters take values (std::array<int, 5>)",
      "CTAD deduces class template arguments from constructor arguments",
      "Concepts name requirements, give clear errors and allow overloading by constraint",
      "Variadic templates + fold expressions process any number of arguments",
      "constexpr may run at compile time, consteval must; if constexpr discards branches",
      "Prefer overloading to function template specialization",
    ],
    code: [
      {
        title: "Function and class templates, CTAD and specialization",
        variants: [
          {
            lang: "cpp",
            code: `#include <array>
#include <cstddef>
#include <print>
#include <stdexcept>
#include <string>
#include <vector>

template <typename T>
T largest(const std::vector<T>& items) {             // works for any T with operator<
    if (items.empty()) throw std::invalid_argument("largest() of an empty vector");
    T best = items[0];
    for (const T& item : items)
        if (best < item) best = item;
    return best;
}

template <typename T, std::size_t Capacity>         // a type parameter and a value parameter
class RingBuffer {
public:
    void push(const T& value) {
        data_[head_] = value;
        head_ = (head_ + 1) % Capacity;
        if (size_ < Capacity) ++size_;
    }
    std::size_t size() const { return size_; }
    const T& oldest() const { return data_[(head_ + Capacity - size_) % Capacity]; }
    static constexpr std::size_t capacity() { return Capacity; }

private:
    std::array<T, Capacity> data_{};                  // the size is part of the type: no heap
    std::size_t head_ = 0;
    std::size_t size_ = 0;
};

template <typename A, typename B>
struct Pair {
    A first;
    B second;
};

template <typename T>
std::string describe(const T&) { return "something"; }
template <>
std::string describe<int>(const int& x) { return "the int " + std::to_string(x); }   // full specialization
std::string describe(const std::string& s) { return "the string '" + s + "'"; }      // an overload (preferred style)

int main() {
    std::println("{}", largest(std::vector<int>{3, 9, 2}));                         // T = int
    std::println("{}", largest(std::vector<std::string>{"pear", "apple", "zucchini", "fig"}));
    std::println("{}", largest<double>({1.5, -2.0, 0.25}));                          // T given explicitly

    RingBuffer<int, 3> recent;
    for (int x : {1, 2, 3, 4, 5}) recent.push(x);
    std::println("ring holds {} of {}, oldest {}", recent.size(), RingBuffer<int, 3>::capacity(), recent.oldest());

    Pair p{"answer", 42};            // CTAD: Pair<const char*, int>
    std::vector v{1.5, 2.5};         // CTAD: std::vector<double>
    std::println("{} = {}, v has {} doubles", p.first, p.second, v.size());

    std::println("{} | {} | {}", describe(3.5), describe(42), describe(std::string("hi")));
}`,
          },
        ],
        output: `9
zucchini
1.5
ring holds 3 of 3, oldest 3
answer = 42, v has 2 doubles
something | the int 42 | the string 'hi'`,
        explain: `- \`largest\` was instantiated three times (for \`int\`, \`std::string\` and \`double\`). With \`{1.5, -2.0, 0.25}\` the compiler can't deduce \`T\` from a braced list, so we wrote \`largest<double>\`.
- \`RingBuffer<int, 3>\` and \`RingBuffer<int, 4>\` are different types. The capacity is known at compile time, so the storage is a plain \`std::array\`.
- \`describe(3.5)\` uses the primary template, \`describe(42)\` the specialization, and \`describe(std::string)\` the overload, which always wins over a template when it matches exactly.`,
      },
      {
        title: "Concepts: named requirements and overloading by constraint",
        variants: [
          {
            lang: "cpp",
            code: `#include <concepts>
#include <format>
#include <print>
#include <string>
#include <vector>

template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template <Numeric T>
double mean(const std::vector<T>& xs) {
    if (xs.empty()) return 0.0;
    double total = 0;
    for (T x : xs) total += static_cast<double>(x);
    return total / static_cast<double>(xs.size());
}

template <typename T>
concept Printable = requires(const T& t) {          // "t.to_string() must compile and give a string"
    { t.to_string() } -> std::convertible_to<std::string>;
};

struct Money {
    long cents;
    std::string to_string() const { return std::format("\${}.{:02}", cents / 100, cents % 100); }
};

struct Temperature {
    double celsius;
    std::string to_string() const { return std::format("{:.1f}°C", celsius); }
};

void show(const Printable auto& item) { std::println("  {}", item.to_string()); }   // abbreviated template

template <typename T>
std::string kind(const T&) { return "something else"; }
template <std::integral T>
std::string kind(const T&) { return "an integral"; }
template <std::signed_integral T>                  // more constrained: preferred when both match
std::string kind(const T&) { return "a signed integral"; }

int main() {
    std::println("mean of ints {}, mean of doubles {}", mean(std::vector{1, 2, 3, 4}), mean(std::vector{0.5, 1.5}));
    // mean(std::vector<std::string>{"a"});   // error: 'std::string' does not satisfy 'Numeric'

    std::println("Printable things:");
    show(Money{1999});
    show(Temperature{21.5});
    // show(42);                               // error: 'int' does not satisfy 'Printable'

    std::println("Numeric<int>={} Numeric<std::string>={} Printable<Money>={} Printable<int>={}",
                 Numeric<int>, Numeric<std::string>, Printable<Money>, Printable<int>);
    std::println("42 is {}, 42u is {}, 2.5 is {}", kind(42), kind(42u), kind(2.5));
}`,
          },
        ],
        output: `mean of ints 2.5, mean of doubles 1
Printable things:
  $19.99
  21.5°C
Numeric<int>=true Numeric<std::string>=false Printable<Money>=true Printable<int>=false
42 is a signed integral, 42u is an integral, 2.5 is something else`,
        explain: `- A concept is a compile-time boolean predicate on types; you can print it like any \`bool\`.
- The \`requires\` expression lists operations that must be valid. It never runs; it's checked when the template is used.
- \`kind(42)\` matches all three overloads, and the compiler picks the **most constrained** one: \`std::signed_integral\` is defined as \`std::integral<T> && std::is_signed_v<T>\`, so it subsumes \`std::integral\`.
- Uncomment the error lines to see how short concept error messages are.`,
      },
      {
        title: "Variadic templates, folds, if constexpr and constexpr",
        variants: [
          {
            lang: "cpp",
            code: `#include <array>
#include <cstddef>
#include <format>
#include <print>
#include <string>
#include <type_traits>

template <typename... Args>
auto sum(Args... args) { return (args + ...); }               // fold: a1 + (a2 + (a3 + ...))

template <typename... Args>
void print_all(const Args&... args) {
    std::size_t i = 0;
    ((std::print("{}{}", i++ == 0 ? "" : ", ", args)), ...);  // comma fold: once per argument, in order
    std::println("  ({} arguments)", sizeof...(Args));
}

struct Robot {
    std::string name() const { return "R2-D2"; }
};

template <typename T>
std::string to_text(const T& value) {
    if constexpr (std::is_same_v<T, std::string>) return "'" + value + "'";
    else if constexpr (std::is_arithmetic_v<T>) return std::format("{}", value);
    else if constexpr (requires { value.name(); }) return "robot " + value.name();
    else return "?";                                           // discarded branches aren't even compiled for T
}

constexpr unsigned long long factorial(unsigned n) { return n <= 1 ? 1 : n * factorial(n - 1); }

constexpr auto factorials = [] {                                // a lookup table built by the compiler
    std::array<unsigned long long, 21> table{};
    for (unsigned i = 0; i < table.size(); ++i) table[i] = factorial(i);
    return table;
}();
static_assert(factorials[10] == 3'628'800, "the compiler checks this");

constexpr long long fib(int n) {
    long long a = 0, b = 1;
    for (int i = 0; i < n; ++i) {
        long long next = a + b;
        a = b;
        b = next;
    }
    return a;
}

consteval int square(int x) { return x * x; }                 // only callable at compile time

int main() {
    std::println("sum(1, 2, 3, 4) = {}", sum(1, 2, 3, 4));
    std::println("sum(1.5, 2, 3) = {}", sum(1.5, 2, 3));
    print_all("id", 7, 2.5, true);
    std::println("{} | {} | {} | {}", to_text(std::string("hi")), to_text(42), to_text(2.5), to_text(Robot{}));

    std::println("20! = {} (from a table computed at compile time)", factorials[20]);
    constexpr long long f50 = fib(50);                          // forced to compile time
    std::println("fib(50) = {}", f50);
    int n = 30;
    std::println("fib(30) = {} (same function, called at run time)", fib(n));
    constexpr int sq = square(12);
    std::println("square(12) = {}", sq);
    // square(n);   // error: n isn't a constant expression
}`,
          },
        ],
        output: `sum(1, 2, 3, 4) = 10
sum(1.5, 2, 3) = 6.5
id, 7, 2.5, true  (4 arguments)
'hi' | 42 | 2.5 | robot R2-D2
20! = 2432902008176640000 (from a table computed at compile time)
fib(50) = 12586269025
fib(30) = 832040 (same function, called at run time)
square(12) = 144`,
        explain: `- \`(args + ...)\` expands to \`1 + (2 + (3 + 4))\` for the first call. The comma fold in \`print_all\` runs one expression per argument, left to right.
- \`if constexpr\` is what makes \`to_text\` compile at all: for \`Robot\`, the \`value + ...\` and \`std::format\` branches are discarded, not instantiated.
- The factorial table, \`f50\` and \`sq\` are computed by the compiler; the binary just contains the numbers. \`static_assert\` fails the build if a compile-time check is false.
- \`fib\` is \`constexpr\`, not \`consteval\`, so it also works with a run-time argument.`,
      },
    ],
    interview: [
      {
        q: "Why are templates usually defined in header files?",
        a: "A template isn't code until it's instantiated with concrete arguments, and instantiation happens in each translation unit that uses it, so the compiler needs the full definition there, not just a declaration. If the definition is in a .cpp file, other files can't instantiate it and you get linker errors. Alternatives: explicit instantiation (`template class Foo<int>;`) in one .cpp for a known set of types, or C++20 modules.",
        freq: "very-common",
      },
      {
        q: "What are concepts and what problem do they solve?",
        a: "Concepts (C++20) are named compile-time predicates on template arguments (`template<class T> concept Sortable = ...`), checked when the template is used. They replace SFINAE/enable_if hacks with readable constraints, produce short errors at the call site ('T does not satisfy Numeric') instead of deep instantiation failures, document requirements in the interface, and enable overloading by constraint, where the most constrained viable overload is chosen through subsumption.",
        freq: "common",
      },
      {
        q: "constexpr vs consteval vs constinit?",
        a: "`constexpr` on a function means it can be evaluated at compile time if called with constant arguments in a context that requires a constant, and otherwise runs at run time; on a variable it requires compile-time initialization and makes it const. `consteval` (C++20) makes a function an immediate function: every call must produce a compile-time constant. `constinit` (C++20) requires a static or thread-local variable to be initialized at compile time (avoiding the static initialization order fiasco) without making it const.",
        freq: "common",
      },
      {
        q: "What is SFINAE?",
        a: "Substitution Failure Is Not An Error: when substituting template arguments into a function template's signature produces an invalid type or expression, that template is silently removed from the overload set instead of causing a compile error. Pre-C++20 code used it (often via `std::enable_if_t<cond, int> = 0` or `decltype` tricks) to enable overloads only for types with certain properties. Concepts and `if constexpr` replace most uses with clearer code.",
      },
      {
        q: "What is CRTP?",
        a: "The Curiously Recurring Template Pattern: `class Derived : public Base<Derived>`. The base knows the derived type at compile time and can call its methods via `static_cast<Derived&>(*this)`, giving static polymorphism (no vtable, inlinable) and mixins that add functionality (e.g. comparison operators, counters, `enable_shared_from_this`). Downsides: no common runtime base type and more complex code. C++23 deducing this (`this auto& self`) covers many CRTP uses more simply.",
      },
    ],
    quiz: [
      {
        q: "Why does `largest({1.5, 2.0})` fail to deduce T for `template<class T> T largest(const std::vector<T>&)`?",
        options: ["Doubles aren't supported", "A braced list has no type to deduce T from", "The function is private", "It works fine"],
        answer: 1,
        explain: "Specify largest<double>(...) or pass a std::vector.",
      },
      {
        q: "Which overload is chosen for kind(42) given std::integral and std::signed_integral versions?",
        options: ["std::integral", "std::signed_integral (more constrained)", "Ambiguous", "Neither"],
        answer: 1,
        explain: "Subsumption picks the most constrained matching overload.",
      },
      {
        q: "What does `(args + ...)` do?",
        options: ["Concatenates strings only", "Folds + over every element of the parameter pack", "Counts arguments", "Declares a variadic"],
        answer: 1,
        explain: "It's a unary right fold.",
      },
      {
        q: "A consteval function is called with a run-time variable. What happens?",
        options: ["It runs at run time", "Compile error", "It returns 0", "Undefined behavior"],
        answer: 1,
        explain: "consteval calls must be constant expressions.",
      },
      {
        q: "What's special about the branch not taken by `if constexpr` in a template?",
        options: ["It's executed anyway", "It isn't instantiated, so it may contain code invalid for that T", "It's optimized away only in release", "Nothing"],
        answer: 1,
        explain: "That's why one function can handle very different types.",
      },
    ],
  },

  // ------------------------------------------------------------------ CONCURRENCY
  {
    id: "cpp-concurrency",
    stage: "Advanced",
    title: "Concurrency: threads, mutexes, atomics and futures",
    tagline: "std::jthread, data races and the memory model, mutexes and locks, condition variables, atomics, async and futures, and avoiding deadlock.",
    difficulty: "advanced",
    minutes: 45,
    concept: `
## Threads
\`\`\`cpp
std::thread t(work, arg1, arg2);   // starts immediately; arguments are COPIED (use std::ref for references)
t.join();                          // wait for it. Forgetting join/detach: std::terminate when t is destroyed!

std::jthread jt(work);             // C++20: joins automatically in its destructor, supports stop requests
\`\`\`
Prefer **\`std::jthread\`**. \`detach()\` lets a thread run on unsupervised, which is rarely what you want (it may outlive the data it uses).

## Data races are undefined behavior
If two threads access the same memory, at least one writes, and nothing orders the accesses, that's a **data race**: undefined behavior, not just a wrong count. (\`++counter\` is a read, an add and a write; two threads can interleave them and lose updates.) The fixes: a **mutex**, an **atomic**, or not sharing (give each thread its own data and combine at the end).

## Mutexes and locks
| Tool | Use |
|---|---|
| \`std::mutex\` | Mutual exclusion; never call \`lock()\`/\`unlock()\` by hand |
| \`std::lock_guard\` | RAII: locks in the constructor, unlocks in the destructor |
| \`std::unique_lock\` | Like lock_guard, but movable and unlockable: needed for condition variables |
| \`std::scoped_lock\` | Locks **several** mutexes at once without deadlock |
| \`std::shared_mutex\` + \`std::shared_lock\` | Many readers OR one writer |

Keep critical sections short. Never call unknown code (callbacks) while holding a lock.

## Condition variables
Wait efficiently until some condition is true. **Always wait with a predicate**: \`cv.wait(lock, [&]{ return !queue.empty(); });\`. Waits can wake up spuriously, and the predicate re-check also handles notifications that happened before you started waiting.

## Atomics
\`std::atomic<int>\` makes single operations (\`load\`, \`store\`, \`fetch_add\`, \`compare_exchange\`) indivisible, without a lock. The **memory order** controls what other memory effects become visible:
- \`seq_cst\` (the default): one global order everyone agrees on. Use this unless you have measured a problem.
- \`acquire\`/\`release\`: a release store "publishes" all earlier writes to a thread that acquire-loads the value. The basis of lock-free handoffs.
- \`relaxed\`: atomicity only, no ordering: fine for statistics counters.

## Deadlock
Thread 1 holds A and waits for B while thread 2 holds B and waits for A: both wait forever. Avoid it by locking multiple mutexes together with \`std::scoped_lock(a, b)\`, always acquiring locks in a **global order**, and never holding a lock while waiting on something that may need it.

## Tasks and futures
- \`std::async(std::launch::async, f, args...)\` runs \`f\` on another thread and returns a \`std::future\`; \`future.get()\` waits and returns the result **or rethrows its exception**.
- \`std::promise\` is the writing end of a future: another thread calls \`set_value\` or \`set_exception\`.
- C++20 adds \`std::latch\`, \`std::barrier\` and \`std::counting_semaphore\`. C++26 adds \`std::execution\` (senders and receivers), a standard model for async pipelines and thread pools.

**Tools**: compile with \`-fsanitize=thread\` (ThreadSanitizer) to find data races. Real projects use thread pools (Boost.Asio, Intel oneTBB, Taskflow) instead of creating a thread per task.
`,
    keyPoints: [
      "Prefer std::jthread: it joins automatically and supports stop tokens",
      "A data race is undefined behavior: protect shared data or don't share it",
      "Lock with RAII (lock_guard / unique_lock / scoped_lock), never by hand",
      "condition_variable::wait always takes a predicate",
      "Atomics for single variables; default seq_cst, relaxed for pure counters",
      "scoped_lock or a global lock order prevents deadlock",
      "future.get() returns the value or rethrows the task's exception",
      "ThreadSanitizer (-fsanitize=thread) finds races",
    ],
    code: [
      {
        title: "Threads, a mutex and an atomic counter",
        variants: [
          {
            lang: "cpp",
            code: `#include <atomic>
#include <functional>
#include <mutex>
#include <print>
#include <thread>
#include <vector>

void fill(std::vector<int>& out, int start, int count) {
    for (int i = 0; i < count; ++i) out.push_back(start + i);
}

int main() {
    // 1. Each thread gets its own data: no sharing, no locks needed.
    std::vector<int> part1, part2;
    {
        std::jthread a(fill, std::ref(part1), 0, 3);     // std::ref: otherwise the thread fills a copy
        std::jthread b(fill, std::ref(part2), 100, 3);
    }                                                   // jthreads join here automatically
    std::println("parts: {} and {}", part1, part2);

    // 2. Shared counters: one protected by a mutex, one atomic.
    constexpr int kThreads = 4;
    constexpr int kIncrements = 100'000;
    long with_mutex = 0;
    std::mutex m;
    std::atomic<long> atomic_count{0};
    {
        std::vector<std::jthread> workers;
        for (int t = 0; t < kThreads; ++t) {
            workers.emplace_back([&] {
                for (int i = 0; i < kIncrements; ++i) {
                    {
                        std::lock_guard lock(m);                   // locked until the end of this block
                        ++with_mutex;
                    }
                    atomic_count.fetch_add(1, std::memory_order_relaxed);   // indivisible, no lock
                }
            });
        }
    }                                                   // all four joined
    std::println("expected {}", kThreads * kIncrements);
    std::println("mutex-protected counter {}", with_mutex);
    std::println("atomic counter          {}", atomic_count.load());

    // A plain long incremented by all four threads without the mutex would be a DATA RACE:
    // undefined behavior. In practice it loses updates (e.g. 231876), and the result changes every run.
}`,
          },
        ],
        output: `parts: [0, 1, 2] and [100, 101, 102]
expected 400000
mutex-protected counter 400000
atomic counter          400000`,
        explain: `- \`std::thread\`/\`std::jthread\` copy their arguments into the new thread. To pass a reference, wrap it in \`std::ref\`, and make sure the referenced object outlives the thread.
- The lambdas capture \`[&]\` safely here because every thread is joined before the captured variables go out of scope.
- The racy version is described, not run: undefined behavior has no "expected output". Compile a racy version with \`-fsanitize=thread\` and TSan reports the exact two lines that race.`,
      },
      {
        title: "Producer/consumer with a condition variable, and stop tokens",
        variants: [
          {
            lang: "cpp",
            code: `#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <mutex>
#include <optional>
#include <print>
#include <queue>
#include <stop_token>
#include <thread>
#include <utility>
#include <vector>

template <typename T>
class BlockingQueue {
public:
    explicit BlockingQueue(std::size_t capacity) : capacity_(capacity) {}

    void push(T value) {
        std::unique_lock lock(mutex_);
        not_full_.wait(lock, [&] { return items_.size() < capacity_; });   // back-pressure
        items_.push(std::move(value));
        not_empty_.notify_one();
    }

    std::optional<T> pop() {                       // an empty optional means "closed and drained"
        std::unique_lock lock(mutex_);
        not_empty_.wait(lock, [&] { return !items_.empty() || closed_; });
        if (items_.empty()) return std::nullopt;
        T value = std::move(items_.front());
        items_.pop();
        not_full_.notify_one();
        return value;
    }

    void close() {
        {
            std::lock_guard lock(mutex_);
            closed_ = true;
        }
        not_empty_.notify_all();                   // wake every waiting consumer
    }

private:
    std::mutex mutex_;
    std::condition_variable not_empty_;
    std::condition_variable not_full_;
    std::queue<T> items_;
    std::size_t capacity_;
    bool closed_ = false;
};

int main() {
    BlockingQueue<int> queue(16);
    std::atomic<long> total{0};
    std::atomic<int> count{0};
    {
        std::vector<std::jthread> consumers;
        for (int c = 0; c < 3; ++c) {
            consumers.emplace_back([&] {
                while (auto item = queue.pop()) {
                    total += *item;
                    ++count;
                }
            });
        }
        {
            std::jthread producer1([&] { for (int i = 1; i <= 500; ++i) queue.push(i); });
            std::jthread producer2([&] { for (int i = 501; i <= 1000; ++i) queue.push(i); });
        }                                           // both producers finished
        queue.close();
    }                                               // consumers drain the queue, exit and are joined
    std::println("consumed {} items, sum {}", count.load(), total.load());

    std::atomic<bool> saw_stop{false};
    {
        std::jthread worker([&](std::stop_token token) {      // jthread passes its stop token
            while (!token.stop_requested()) std::this_thread::sleep_for(std::chrono::milliseconds(1));
            saw_stop = true;
        });
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }                                               // ~jthread: request_stop(), then join()
    std::println("worker saw the stop request and exited: {}", saw_stop.load());
}`,
          },
        ],
        output: `consumed 1000 items, sum 500500
worker saw the stop request and exited: true`,
        explain: `- Which consumer gets which item changes every run, but the total doesn't: 1 + 2 + ... + 1000 = 500500. Tests of concurrent code should check results like this, not orderings.
- \`wait(lock, predicate)\` releases the mutex while sleeping and re-acquires it before checking the predicate again, so spurious wake-ups are harmless.
- The bounded capacity gives **back-pressure**: fast producers block instead of filling memory.
- \`std::jthread\`'s destructor calls \`request_stop()\` and then \`join()\`: cooperative cancellation without a hand-rolled flag.`,
      },
      {
        title: "async, futures, promises and deadlock-free locking",
        variants: [
          {
            lang: "cpp",
            code: `#include <exception>
#include <future>
#include <mutex>
#include <print>
#include <stdexcept>
#include <thread>
#include <vector>

bool is_prime(int n) {
    if (n < 2) return false;
    for (int d = 2; d * d <= n; ++d)
        if (n % d == 0) return false;
    return true;
}

int count_primes(int from, int to) {
    int count = 0;
    for (int n = from; n < to; ++n) count += is_prime(n) ? 1 : 0;
    return count;
}

struct Account {
    std::mutex m;
    long balance = 0;
};

void transfer(Account& from, Account& to, long amount) {
    std::scoped_lock lock(from.m, to.m);       // locks both with a deadlock-avoidance algorithm
    from.balance -= amount;
    to.balance += amount;
}

int main() {
    constexpr int N = 100'000;
    std::vector<std::future<int>> parts;
    for (int i = 0; i < 4; ++i)
        parts.push_back(std::async(std::launch::async, count_primes, i * N / 4, (i + 1) * N / 4));
    int total = 0;
    for (auto& part : parts) total += part.get();            // waits for each task
    std::println("primes below {}: {} (counted by 4 tasks)", N, total);

    std::promise<int> promise;
    std::future<int> result = promise.get_future();
    std::jthread worker([p = std::move(promise)]() mutable {
        try {
            throw std::runtime_error("disk full");
        } catch (...) {
            p.set_exception(std::current_exception());       // ship the exception to the waiting thread
        }
    });
    try {
        result.get();
    } catch (const std::exception& e) {
        std::println("future.get() rethrew: {}", e.what());
    }

    Account a, b;
    a.balance = 1000;
    b.balance = 1000;
    {
        std::jthread t1([&] { for (int i = 0; i < 1000; ++i) transfer(a, b, 1); });   // locks a, b
        std::jthread t2([&] { for (int i = 0; i < 1000; ++i) transfer(b, a, 1); });   // locks b, a
    }
    std::println("balances {} + {} = {} (no deadlock)", a.balance, b.balance, a.balance + b.balance);
}`,
          },
        ],
        output: `primes below 100000: 9592 (counted by 4 tasks)
future.get() rethrew: disk full
balances 1000 + 1000 = 2000 (no deadlock)`,
        explain: `- \`std::launch::async\` forces a new thread. Without it the implementation may defer the call until \`get()\`, running it on the calling thread.
- Exceptions cross threads through futures: \`get()\` rethrows whatever the task threw.
- The two transfer threads lock the same two mutexes in **opposite orders**. With two separate \`lock_guard\`s that's a classic deadlock waiting to happen; \`std::scoped_lock\` acquires both safely, whatever the order.
- Note the \`std::future\` returned by \`std::async\` blocks in its destructor until the task finishes, so a discarded \`std::async(...)\` call runs synchronously.`,
      },
    ],
    interview: [
      {
        q: "What is a data race and why is it undefined behavior in C++?",
        a: "Two threads access the same memory location concurrently, at least one access is a write, and there is no happens-before ordering between them (no mutex, atomic or other synchronization). The C++ memory model declares such programs undefined so compilers and CPUs can reorder, cache in registers and split memory operations freely in single-threaded code. Consequences go beyond lost updates: torn reads, loops that never see a flag change, and arbitrary behavior. Fix with mutexes, atomics, or by not sharing mutable data.",
        freq: "very-common",
      },
      {
        q: "mutex vs atomic: when do you use each?",
        a: "Atomics make individual operations on a single variable indivisible and lock-free (when the hardware supports it): counters, flags, pointers in lock-free structures, reference counts. A mutex protects an invariant spanning multiple variables or a multi-step operation (update a map and a counter together, check-then-act). Atomics don't compose: two atomic operations in a row aren't atomic together. Lock-free code built on atomics is notoriously hard to get right, so prefer mutexes unless profiling shows contention.",
        freq: "very-common",
      },
      {
        q: "How do you prevent deadlocks?",
        a: "Acquire multiple locks together with `std::scoped_lock`/`std::lock` (which uses a deadlock-avoidance algorithm), or always acquire locks in a single global order (e.g. by account id). Keep lock scopes small, never call unknown code (callbacks, virtual functions from other modules) while holding a lock, avoid waiting on futures or joins while holding a lock, and consider lock hierarchies or try_lock with backoff. Tools: ThreadSanitizer detects lock-order inversions.",
        freq: "very-common",
      },
      {
        q: "Why must condition_variable::wait use a predicate?",
        a: "Waits can return spuriously (without notify), and a notify can happen before the waiter starts waiting (a lost wake-up). The predicate overload `cv.wait(lock, pred)` loops: it checks the condition under the lock and only sleeps while it's false, re-checking after every wake-up. The shared state the predicate reads must be modified under the same mutex, or the notification can race with the check.",
        freq: "common",
      },
      {
        q: "Explain memory_order_acquire and memory_order_release.",
        a: "They create a happens-before relationship through an atomic variable. A release store (e.g. `ready.store(true, release)`) guarantees that all writes made by that thread before the store are visible to any thread that performs an acquire load (`ready.load(acquire)`) reading that value. That's enough to publish data from a producer to a consumer without seq_cst's total ordering. `relaxed` gives atomicity without ordering (fine for counters), and `seq_cst` (the default) adds a single total order of all seq_cst operations.",
        freq: "common",
      },
      {
        q: "std::thread vs std::jthread vs std::async?",
        a: "std::thread is a raw OS thread: you must join or detach it before destruction or std::terminate is called. std::jthread (C++20) joins automatically in its destructor and carries a std::stop_token for cooperative cancellation, so it's the safer default. std::async runs a callable as a task and returns a std::future for its result or exception; with std::launch::async it uses a new thread, with the default policy the implementation may defer it. For many small tasks use a thread pool instead of one thread per task.",
      },
    ],
    quiz: [
      {
        q: "A std::thread object is destroyed while still joinable. What happens?",
        options: ["It joins automatically", "It detaches", "std::terminate is called", "Nothing"],
        answer: 2,
        explain: "std::jthread fixes this by joining in its destructor.",
      },
      {
        q: "Two threads run `++count` on a plain int without synchronization. This is...",
        options: ["Fine on x86", "A data race: undefined behavior", "Slow but correct", "A deadlock"],
        answer: 1,
        explain: "Use std::atomic<int> or a mutex.",
      },
      {
        q: "Which locks two mutexes without risking deadlock?",
        options: ["Two lock_guards", "std::scoped_lock(a, b)", "a.lock(); b.lock();", "std::shared_lock"],
        answer: 1,
        explain: "scoped_lock uses std::lock's deadlock-avoidance algorithm.",
      },
      {
        q: "What does future.get() do if the task threw an exception?",
        options: ["Returns a default value", "Rethrows the exception", "Returns nullptr", "Terminates"],
        answer: 1,
        explain: "Exceptions travel across threads through the shared state.",
      },
      {
        q: "How do you pass a variable by reference to a std::thread's function?",
        options: ["Just pass it", "Wrap it in std::ref", "Use a pointer cast", "It's impossible"],
        answer: 1,
        explain: "Thread arguments are copied by default.",
      },
      {
        q: "Which tool finds data races at run time?",
        options: ["AddressSanitizer", "ThreadSanitizer", "clang-format", "gdb"],
        answer: 1,
        explain: "-fsanitize=thread.",
      },
    ],
  },

  // ------------------------------------------------------------------ MODERN
  {
    id: "cpp-modern",
    stage: "Advanced",
    title: "Modern C++: optional, expected, C++20/23 and coroutines",
    tagline: "Error handling with std::optional and std::expected, the most useful C++20 and C++23 features, coroutines from scratch, and what C++26 brings.",
    difficulty: "advanced",
    minutes: 35,
    concept: `
## Vocabulary types for "maybe" and "or"
| Type | Holds | Use for |
|---|---|---|
| \`std::optional<T>\` | A T or nothing | A value that may be absent (lookup misses) |
| \`std::expected<T, E>\` (C++23) | A T or an error E | Operations that can fail in expected ways |
| \`std::variant<A, B, C>\` | Exactly one of several types | Closed sets (see the OOP chapter) |
| \`std::any\` | Anything (type-erased) | Rarely: plugin data, heterogeneous properties |

## Exceptions or expected?
- **Exceptions**: for errors the immediate caller can't handle (out of memory, broken invariants, I/O failures deep in a call stack). Zero cost when not thrown, expensive when thrown.
- **\`std::expected\`**: for failures that are a *normal* outcome the caller must handle (parsing user input, validation). The error is part of the return type, so it can't be ignored silently, and there's no unwinding cost. Some codebases (games, embedded, Google) disable exceptions entirely.

Both \`optional\` and \`expected\` have **monadic operations** (C++23) for chaining without nested ifs:
- \`and_then(f)\`: if there's a value, call \`f\`, which returns another optional/expected.
- \`transform(f)\`: if there's a value, map it.
- \`or_else(f)\`: if empty or an error, produce a fallback.

## C++20 highlights (beyond what you've seen)
Concepts, ranges, \`std::span\`, \`std::format\`, \`<=>\` and \`std::jthread\` are covered in earlier chapters. Also: **designated initializers** (\`Config{.port = 8080}\`), \`std::source_location\`, \`<bit>\` (\`popcount\`, \`bit_ceil\`), \`contains()\` on maps and sets, \`starts_with\`/\`ends_with\` on strings, \`consteval\`/\`constinit\`, **coroutines** and **modules**.

## C++23 highlights
\`std::print\`/\`println\`, \`std::expected\`, monadic \`optional\`, \`std::ranges::to\`, \`views::zip\`/\`enumerate\`/\`chunk\`, \`std::flat_map\`, \`std::mdspan\` (multi-dimensional views with \`grid[i, j]\`), **deducing this** (explicit object parameters), \`std::to_underlying\`, \`string::contains\`, \`std::generator\`, \`import std;\`.

## Coroutines
A function containing \`co_await\`, \`co_yield\` or \`co_return\` is a **coroutine**: it can suspend and later resume where it left off, with its local variables kept in a heap-allocated **coroutine frame**. The language provides the mechanics; a library type (its \`promise_type\`) decides the behavior. Uses: **generators** (lazy sequences), **async I/O** without callback hell (Boost.Asio, cppcoro, libcoro), and state machines. C++23's \`std::generator\` is a ready-made generator; the sample builds one by hand to show how it works.

## Modules
\`import std;\` (C++23) and your own \`export module mylib;\` replace textual \`#include\`: faster builds, no macro leakage, no include-order issues. Support has arrived in recent compilers and CMake (3.28+), but the ecosystem is still migrating, so most code you meet still uses headers.

## C++26
Finalized in 2025-26, with compiler support arriving now. The headline features: **static reflection** (inspect types and generate code at compile time with \`^^T\`), **contracts** (\`pre\`, \`post\` and \`contract_assert\`), **\`std::execution\`** (senders and receivers for async work), \`std::inplace_vector\`, \`#embed\` for binary files, pack indexing, saturating arithmetic and \`= delete("reason")\`.
`,
    keyPoints: [
      "optional<T> for maybe-absent values; expected<T, E> for recoverable failures",
      "Exceptions for exceptional errors; expected when failure is a normal outcome",
      "and_then / transform / or_else chain optional and expected without nested ifs",
      "std::from_chars parses numbers fast, without exceptions or locales",
      "Designated initializers, flat_map, mdspan and deducing this modernize everyday code",
      "Coroutines suspend and resume with their frame on the heap; a promise_type defines behavior",
      "C++26: reflection, contracts and std::execution",
    ],
    code: [
      {
        title: "optional, expected and monadic chaining",
        variants: [
          {
            lang: "cpp",
            code: `#include <charconv>
#include <expected>
#include <map>
#include <optional>
#include <print>
#include <string>
#include <string_view>
#include <system_error>

std::optional<std::string> find_email(const std::map<std::string, std::string>& users, const std::string& name) {
    auto it = users.find(name);
    if (it == users.end()) return std::nullopt;           // "no value"
    return it->second;
}

enum class ParseError { Empty, NotANumber, OutOfRange };

std::string_view to_string(ParseError e) {
    switch (e) {
        case ParseError::Empty: return "empty input";
        case ParseError::NotANumber: return "not a number";
        case ParseError::OutOfRange: return "out of range";
    }
    return "unknown";
}

std::expected<int, ParseError> parse_int(std::string_view text) {
    if (text.empty()) return std::unexpected(ParseError::Empty);
    int value = 0;
    const char* end = text.data() + text.size();
    auto [ptr, ec] = std::from_chars(text.data(), end, value);   // no exceptions, no locale, no allocation
    if (ec == std::errc::result_out_of_range) return std::unexpected(ParseError::OutOfRange);
    if (ec != std::errc{} || ptr != end) return std::unexpected(ParseError::NotANumber);
    return value;
}

std::expected<int, ParseError> parse_port(std::string_view text) {
    return parse_int(text).and_then([](int n) -> std::expected<int, ParseError> {   // runs only on success
        if (n < 1 || n > 65535) return std::unexpected(ParseError::OutOfRange);
        return n;
    });
}

int main() {
    std::map<std::string, std::string> users{{"ada", "ada@example.com"}};
    std::println("ada: {}", find_email(users, "ada").value_or("(none)"));
    std::println("bob: {}", find_email(users, "bob").value_or("(none)"));
    auto domain = find_email(users, "ada").transform([](const std::string& email) {
        return email.substr(email.find('@') + 1);
    });
    std::println("ada's domain: {}", domain.value_or("?"));

    for (std::string_view input : {"8080", "", "80a", "99999999999", "70000"}) {
        auto port = parse_port(input);
        if (port) std::println("'{}' -> port {}", input, *port);
        else std::println("'{}' -> error: {}", input, to_string(port.error()));
    }

    auto doubled = parse_int("21").transform([](int n) { return n * 2; });
    std::println("transform: {}", doubled.value());
    auto fallback = parse_int("oops").or_else([](ParseError) -> std::expected<int, ParseError> { return 0; });
    std::println("or_else fallback: {}", *fallback);
}`,
          },
        ],
        output: `ada: ada@example.com
bob: (none)
ada's domain: example.com
'8080' -> port 8080
'' -> error: empty input
'80a' -> error: not a number
'99999999999' -> error: out of range
'70000' -> error: out of range
transform: 42
or_else fallback: 0`,
        explain: `- \`std::expected\` puts the error in the type signature. The caller can't use the value without checking (\`*port\` on an error is undefined; \`.value()\` throws \`bad_expected_access\`).
- \`and_then\` chains a second fallible step: "70000" parses fine and then fails the range check, all without an \`if\` in \`parse_port\`'s caller.
- \`std::from_chars\` is the fastest standard way to parse numbers: it reports errors through its return value and tells you where it stopped (\`ptr\`), which is how "80a" is rejected.
- The \`switch\` has no \`default\`, so \`-Wswitch\` warns if someone adds an enumerator and forgets this function.`,
      },
      {
        title: "A tour of C++20 and C++23 conveniences",
        variants: [
          {
            lang: "cpp",
            code: `#include <bit>
#include <cstdint>
#include <flat_map>
#include <mdspan>
#include <numeric>
#include <print>
#include <string>
#include <utility>
#include <vector>

struct ServerConfig {
    std::string host = "localhost";
    int port = 8080;
    bool tls = false;
};

enum class Permission : std::uint8_t { Read = 1, Write = 2, Admin = 4 };

int main() {
    ServerConfig cfg{.port = 9000, .tls = true};              // C++20 designated initializers
    std::println("config {}:{} tls={}", cfg.host, cfg.port, cfg.tls);

    std::flat_map<std::string, int> stock{{"pear", 3}, {"apple", 7}, {"kiwi", 0}};   // C++23: sorted vectors
    stock["fig"] = 2;
    std::print("flat_map:");
    for (const auto& [fruit, n] : stock) std::print(" {}={}", fruit, n);
    std::println("  (keys stored contiguously: {})", stock.keys());

    std::vector<int> cells(12);
    std::iota(cells.begin(), cells.end(), 0);
    std::mdspan grid(cells.data(), 3, 4);                     // C++23: view a flat buffer as 3 x 4
    std::println("grid is {}x{}, grid[1, 2] = {}", grid.extent(0), grid.extent(1), grid[1, 2]);

    auto fib = [](this auto self, int n) -> long long {      // C++23 deducing this: a recursive lambda
        return n < 2 ? n : self(n - 1) + self(n - 2);
    };
    std::println("fib(20) = {}", fib(20));

    std::println("Admin as a number: {}", std::to_underlying(Permission::Admin));   // C++23
    std::uint32_t flags = 0b1011'0000;
    std::println("popcount={} has_single_bit(64)={} bit_width(1000)={} bit_ceil(100)={}",
                 std::popcount(flags), std::has_single_bit(64u), std::bit_width(1000u), std::bit_ceil(100u));

    std::string url = "https://dsa.example/worlds/cpp";
    std::println("starts_with https: {}, ends_with /cpp: {}, contains 'worlds': {}",
                 url.starts_with("https://"), url.ends_with("/cpp"), url.contains("worlds"));
}`,
          },
        ],
        output: `config localhost:9000 tls=true
flat_map: apple=7 fig=2 kiwi=0 pear=3  (keys stored contiguously: ["apple", "fig", "kiwi", "pear"])
grid is 3x4, grid[1, 2] = 6
fib(20) = 6765
Admin as a number: 4
popcount=3 has_single_bit(64)=true bit_width(1000)=10 bit_ceil(100)=128
starts_with https: true, ends_with /cpp: true, contains 'worlds': true`,
        explain: `- Designated initializers name the fields you set; the rest keep their default member initializers. The names must appear in declaration order.
- \`std::flat_map\` keeps keys and values in two sorted vectors: lookups are binary searches over contiguous memory (fast and cache-friendly), but inserting in the middle is O(n). It's ideal for maps built once and read often.
- \`std::mdspan\` doesn't own data; it maps \`[row, col]\` onto the flat buffer (row-major: 1 * 4 + 2 = 6). C++23 allows commas inside \`[]\`.
- With **deducing this**, a lambda can receive itself as a parameter (\`self\`), so it can recurse without \`std::function\`.`,
      },
      {
        title: "Coroutines from scratch: a lazy generator",
        variants: [
          {
            lang: "cpp",
            code: `#include <coroutine>
#include <print>
#include <utility>

template <typename T>
class Generator {
public:
    struct promise_type;                                   // the coroutine's control center
    using Handle = std::coroutine_handle<promise_type>;

    struct promise_type {
        T current{};
        Generator get_return_object() { return Generator(Handle::from_promise(*this)); }
        std::suspend_always initial_suspend() noexcept { return {}; }   // lazy: don't start until asked
        std::suspend_always final_suspend() noexcept { return {}; }     // keep the frame until we destroy it
        std::suspend_always yield_value(T value) noexcept {             // called by co_yield
            current = std::move(value);
            return {};
        }
        void return_void() noexcept {}
        void unhandled_exception() { throw; }
    };

    explicit Generator(Handle h) : handle_(h) {}
    Generator(Generator&& other) noexcept : handle_(std::exchange(other.handle_, {})) {}
    Generator(const Generator&) = delete;
    Generator& operator=(const Generator&) = delete;
    Generator& operator=(Generator&&) = delete;
    ~Generator() {
        if (handle_) handle_.destroy();                    // frees the coroutine frame (RAII again)
    }

    bool next() {                                          // run until the next co_yield or the end
        handle_.resume();
        return !handle_.done();
    }
    const T& value() const { return handle_.promise().current; }

private:
    Handle handle_;
};

Generator<long long> fibonacci() {                         // an infinite sequence, computed lazily
    long long a = 0, b = 1;
    while (true) {
        co_yield a;
        a = std::exchange(b, a + b);
    }
}

Generator<int> traced() {
    std::println("  [coroutine] started");
    co_yield 1;
    std::println("  [coroutine] resumed after yielding 1");
    co_yield 2;
    std::println("  [coroutine] finishing");
}

int main() {
    auto fib = fibonacci();                                // creates the frame; runs nothing yet
    std::print("first 10 Fibonacci numbers:");
    for (int i = 0; i < 10 && fib.next(); ++i) std::print(" {}", fib.value());
    std::println("");

    auto t = traced();
    std::println("created the coroutine (its body hasn't started)");
    while (t.next()) std::println("caller got {}", t.value());
    std::println("done");
}`,
          },
        ],
        output: `first 10 Fibonacci numbers: 0 1 1 2 3 5 8 13 21 34
created the coroutine (its body hasn't started)
  [coroutine] started
caller got 1
  [coroutine] resumed after yielding 1
caller got 2
  [coroutine] finishing
done`,
        explain: `- The traced output shows control passing back and forth: each \`next()\` resumes the coroutine until it suspends at the next \`co_yield\`, and its local variables survive in between.
- The infinite \`fibonacci()\` is fine because it's lazy: we only resume it 10 times, then the destructor frees the suspended frame.
- The compiler turns the coroutine into a state machine and talks to \`promise_type\` at each step: \`get_return_object\` makes the \`Generator\`, \`initial_suspend\` decides whether the body starts immediately, and \`yield_value\` receives each \`co_yield\`.
- In production use C++23 \`std::generator<T>\` (also range-for compatible) or a library: the hand-written version is about understanding the machinery.`,
      },
    ],
    interview: [
      {
        q: "When would you use std::optional, std::expected and exceptions?",
        a: "std::optional when absence is a normal, unexplained outcome (cache miss, lookup not found). std::expected<T, E> when an operation can fail for reasons the caller needs to know and is expected to handle immediately (parsing, validation, protocol errors), keeping errors explicit in the type with no unwinding cost. Exceptions for exceptional, non-local failures that the immediate caller can't handle sensibly (resource exhaustion, broken invariants, I/O failures deep in a call stack), and in constructors, which can't return errors. Avoid using exceptions for control flow.",
        freq: "common",
      },
      {
        q: "What are the costs of exceptions in C++?",
        a: "Modern implementations use table-based 'zero-cost' exception handling: no run-time cost on the non-throwing path (aside from some code size and lost optimizations around calls that may throw). Throwing is expensive: allocating the exception object, looking up unwind tables and unwinding stack frames calling destructors, often microseconds. They also make control flow less visible. This is why latency-critical and embedded code often disables them (-fno-exceptions) and uses error codes or expected.",
        freq: "common",
      },
      {
        q: "What is a coroutine in C++20 and how is it implemented?",
        a: "A function that uses co_await, co_yield or co_return. The compiler transforms it into a state machine whose locals and resume point live in a coroutine frame (usually heap-allocated, sometimes elided). The return type's `promise_type` customizes behavior: whether it starts suspended, what happens on co_yield/co_return, exception handling. A `std::coroutine_handle` resumes or destroys it. C++20 coroutines are stackless: they can only suspend at their own top level, not from nested ordinary calls. Libraries (std::generator, Asio, cppcoro) provide the user-facing types.",
        freq: "common",
      },
      {
        q: "What does std::string_view give you, and what's its main danger?",
        a: "A non-owning (pointer, length) view of characters, cheap to copy and pass by value, that accepts std::string, literals and substrings without allocation; `substr` is O(1). The danger is lifetime: it doesn't keep the characters alive, so returning a string_view to a local string, storing one from a temporary (`std::string_view sv = get_string();`), or keeping one after the string is modified or reallocated leaves it dangling. Also it isn't null-terminated, so it can't be passed to C APIs expecting a char*.",
        freq: "common",
      },
      {
        q: "Name some C++20/23/26 features you'd use in a new codebase.",
        a: "C++20: concepts, ranges, std::span, std::format, the spaceship operator, designated initializers, std::jthread and stop tokens, coroutines (via a library), consteval/constinit, contains/starts_with. C++23: std::print, std::expected, monadic optional, ranges::to and zip, flat_map, mdspan, deducing this, import std where the toolchain supports it. C++26: static reflection (serialization and enum-to-string without macros), contracts, std::execution for async pipelines, inplace_vector, #embed.",
      },
    ],
    quiz: [
      {
        q: "Which type represents 'a value or an error explaining why not'?",
        options: ["std::optional<T>", "std::expected<T, E>", "std::any", "std::pair<T, bool>"],
        answer: 1,
        explain: "optional only says 'nothing', expected carries the error.",
      },
      {
        q: "What does optional::transform(f) do on an empty optional?",
        options: ["Calls f with a default value", "Returns an empty optional without calling f", "Throws", "Undefined behavior"],
        answer: 1,
        explain: "Monadic operations skip the function when there's no value.",
      },
      {
        q: "Why use std::from_chars instead of std::stoi?",
        options: ["It supports more types", "No exceptions, no locale, no allocation, and it reports where parsing stopped", "It's older", "It parses JSON"],
        answer: 1,
        explain: "That ptr result is how trailing garbage gets detected.",
      },
      {
        q: "Where do a C++20 coroutine's local variables live while it's suspended?",
        options: ["On the caller's stack", "In the coroutine frame (usually on the heap)", "In registers", "They're destroyed"],
        answer: 1,
        explain: "The frame keeps locals alive between resumptions.",
      },
      {
        q: "What does std::flat_map trade compared to std::map?",
        options: ["Faster inserts, slower lookups", "Faster, cache-friendly lookups and iteration for O(n) inserts", "No ordering", "Thread safety"],
        answer: 1,
        explain: "It stores keys and values in sorted contiguous vectors.",
      },
    ],
  },
];
