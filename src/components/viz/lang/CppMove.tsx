"use client";

import { scenario, TraceViewer } from "./trace";

const SCENARIOS = [
  scenario(
    "Copy vs move",
    `std::vector<int> a = {1, 2, 3, 4};
std::vector<int> b = a;             // copy
std::vector<int> c = std::move(a);  // move
a.push_back(5);                     // still usable`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "b1", title: "int buffer", sub: "@0x7000 · 16 bytes", cells: [1, 2, 3, 4] });
      t.point("a", "b1", t.top(), "size 4 cap 4");
      t.step(1, "A vector is a small object on the stack (pointer, size, capacity) that owns a buffer on the heap.");
      t.obj({ id: "b2", title: "int buffer", sub: "@0x7100 · fresh copy", cells: [1, 2, 3, 4] });
      t.point("b", "b2", t.top(), "size 4 cap 4");
      t.step(2, "Copy: allocate a new buffer and copy every element. O(n) time and memory. For a 1 GB vector, that's 1 GB more.", "warn");
      t.point("c", "b1", t.top(), "size 4 cap 4");
      t.set("a", "size 0 cap 0 (nullptr)");
      t.step(3, "Move: c simply takes a's pointer, then a is set to empty. O(1), no allocation, no element copied. std::move itself does nothing; it just casts a to an rvalue (T&&) so the move constructor is chosen.", "good");
      t.obj({ id: "b3", title: "int buffer", sub: "@0x7200", cells: [5] });
      t.point("a", "b3", t.top(), "size 1 cap 1");
      t.step(4, "A moved-from object is in a 'valid but unspecified' state. For std::vector it's empty in practice: you may reuse or destroy it, but don't read its old contents.");
    },
  ),
  scenario(
    "Growth with a noexcept move",
    `std::vector<std::string> v;
v.reserve(2);
v.push_back("alpha");
v.push_back("bravo");
v.push_back("charlie");   // full: grow`,
    (t) => {
      t.frame("main()");
      t.set("v", "size 0 cap 0");
      t.step(1, "An empty vector owns no buffer.");
      t.obj({ id: "old", title: "string[2]", sub: "@0x8000", cells: [null, null] });
      t.point("v", "old", t.top(), "size 0 cap 2");
      t.step(2, "reserve(2) allocates room for two strings, but size stays 0.");
      t.get("old").cells = ["alpha", null];
      t.point("v", "old", t.top(), "size 1 cap 2");
      t.step(3, "First push_back constructs 'alpha' in place.");
      t.get("old").cells = ["alpha", "bravo"];
      t.point("v", "old", t.top(), "size 2 cap 2");
      t.step(4, "Second fills the capacity.");
      t.obj({ id: "new", title: "string[4]", sub: "@0x8400 · doubled", cells: [null, null, null, null] });
      t.step(5, "No room for 'charlie': the vector allocates a bigger buffer (libstdc++ and libc++ double it).", "warn");
      t.get("new").cells = ["alpha", "bravo", null, null];
      t.get("old").cells = ['""', '""'];
      t.mark("old", "hot");
      t.step(5, "std::string's move constructor is noexcept, so the vector MOVES the existing elements: each move steals a pointer. Moves: 2, copies: 0.", "good");
      t.get("new").cells = ["alpha", "bravo", "charlie", null];
      t.mark("old", "freed");
      t.point("v", "new", t.top(), "size 3 cap 4");
      t.step(5, "Then it constructs 'charlie' and frees the old buffer. Amortized O(1) per push_back. Note: every pointer, reference and iterator into the old buffer is now invalid.");
    },
  ),
  scenario(
    "Growth without noexcept",
    `struct Big {
    Big() = default;
    Big(const Big&) = default;
    Big(Big&&) { /* may throw */ }
};
std::vector<Big> v;
v.reserve(2);
v.emplace_back(); v.emplace_back();
v.emplace_back();   // grow: copies!`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "old", title: "Big[2]", sub: "@0x9000", cells: ["Big#1", "Big#2"] });
      t.point("v", "old", t.top(), "size 2 cap 2");
      t.step([7, 8], "Two Big objects fill the capacity.");
      t.obj({ id: "new", title: "Big[4]", sub: "@0x9800", cells: ["copy #1", "copy #2", null, null] });
      t.step(9, "The move constructor isn't marked noexcept. If a move threw halfway through, the old buffer would already be half-gutted, and vector promises the 'strong exception guarantee' (on failure, nothing changes). So it uses std::move_if_noexcept and COPIES instead. Moves: 0, copies: 2.", "bad");
      t.get("new").cells = ["copy #1", "copy #2", "Big#3", null];
      t.mark("old", "freed");
      t.point("v", "new", t.top(), "size 3 cap 4");
      t.step(9, "Fix: declare move constructors noexcept (Big(Big&&) noexcept), or follow the rule of zero and let the compiler generate them; they're noexcept when the members' are.", "good");
    },
  ),
];

export default function CppMove() {
  return <TraceViewer scenarios={SCENARIOS} />;
}
