"use client";

import { scenario, TraceViewer } from "./trace";

const SCENARIOS = [
  scenario(
    "unique_ptr: one owner",
    `auto a = std::make_unique<Widget>("A");
auto b = std::move(a);   // ownership moves
// auto c = b;           // error: copying is deleted
b.reset();               // runs ~Widget() now`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "w", title: "Widget A", sub: "@0x6000 · exactly one owner", rows: [{ k: "name", v: '"A"' }] });
      t.point("a", "w", t.top(), "unique_ptr");
      t.step(1, "make_unique allocates a Widget and wraps the pointer in a unique_ptr. The unique_ptr OWNS it: when the unique_ptr is destroyed, it deletes the Widget. Zero overhead compared with a raw pointer.");
      t.set("a", "nullptr");
      t.point("b", "w", t.top(), "unique_ptr");
      t.step(2, "std::move transfers ownership. a becomes nullptr, b now owns the Widget. No copy of the Widget is made: only the pointer moves.");
      t.step(3, "Copying a unique_ptr won't compile: two owners would both try to delete the Widget. The type system enforces 'exactly one owner'.", "warn");
      t.mark("w", "freed");
      t.print("~Widget(A)");
      t.set("b", "nullptr");
      t.step(4, "reset() (or b going out of scope) deletes the Widget immediately and deterministically. No garbage collector, no leak, no double free.", "good");
    },
  ),
  scenario(
    "shared_ptr: reference counting",
    `auto s1 = std::make_shared<Widget>("S");
{
    auto s2 = s1;        // copy: count 2
    auto s3 = s1;        // count 3
}                        // s2, s3 destroyed
s1.reset();              // count 0: deleted`,
    (t) => {
      const cb = (n: number, hot = true) => [
        { k: "use_count", v: String(n), hot },
        { k: "weak_count", v: "0" },
        { k: "Widget", v: '"S"' },
      ];
      t.frame("main()");
      t.obj({ id: "s", title: "control block + Widget", sub: "one allocation (make_shared)", rows: cb(1, false) });
      t.point("s1", "s");
      t.step(1, "make_shared allocates the Widget and a control block holding the reference counts, in one allocation. use_count = 1.");
      t.frame("{ inner scope }");
      t.point("s2", "s");
      t.get("s").rows = cb(2);
      t.mark("s", "hot");
      t.step(3, "Copying a shared_ptr increments use_count (atomically, so it's thread-safe but not free).");
      t.point("s3", "s");
      t.get("s").rows = cb(3);
      t.mark("s", "hot");
      t.step(4, "Three owners now.");
      t.pop();
      t.get("s").rows = cb(1);
      t.mark("s", "hot");
      t.step(5, "At the closing brace s2 and s3 are destroyed; each destructor decrements the count. Back to 1.");
      t.get("s").rows = cb(0);
      t.mark("s", "freed");
      t.set("s1", "nullptr");
      t.print("~Widget(S)");
      t.step(6, "The last owner lets go: count hits 0 and the Widget is deleted right there. Prefer unique_ptr by default; use shared_ptr only when ownership is genuinely shared.", "good");
    },
  ),
  scenario(
    "Cycles leak",
    `struct Node { std::shared_ptr<Node> other; };

auto x = std::make_shared<Node>();
auto y = std::make_shared<Node>();
x->other = y;
y->other = x;
// end of scope: x and y are destroyed…`,
    (t) => {
      const node = (count: number, other?: string) => [
        { k: "use_count", v: String(count), hot: true },
        other ? { k: "other", ref: other } : { k: "other", v: "nullptr" },
      ];
      t.frame("main()");
      t.obj({ id: "x", title: "Node X", rows: node(1) });
      t.point("x", "x");
      t.step(3, "x owns Node X (count 1).");
      t.obj({ id: "y", title: "Node Y", rows: node(1) });
      t.point("y", "y");
      t.step(4, "y owns Node Y (count 1).");
      t.get("x").rows = node(1, "y");
      t.get("y").rows = node(2);
      t.step(5, "X now also owns Y: Y's count is 2.");
      t.get("y").rows = node(2, "x");
      t.get("x").rows = node(2, "y");
      t.step(6, "And Y owns X: X's count is 2. They own each other.", "warn");
      t.pop();
      t.get("x").rows = node(1, "y");
      t.get("y").rows = node(1, "x");
      t.mark("x", "leak");
      t.mark("y", "leak");
      t.step(7, "The locals die and each count drops to 1, never 0, because each node keeps the other alive. Both nodes leak. Reference counting can't collect cycles.", "bad");
    },
  ),
  scenario(
    "weak_ptr breaks the cycle",
    `struct Node {
    std::shared_ptr<Node> next;
    std::weak_ptr<Node>   prev;   // doesn't own
};
auto x = std::make_shared<Node>();
auto y = std::make_shared<Node>();
x->next = y;
y->prev = x;
if (auto p = y->prev.lock()) { /* p is a shared_ptr */ }
// end of scope`,
    (t) => {
      const rows = (strong: number, weak: number, next?: string, prev?: string) => [
        { k: "strong / weak", v: `${strong} / ${weak}`, hot: true },
        next ? { k: "next", ref: next } : { k: "next", v: "nullptr" },
        prev ? { k: "prev (weak)", ref: prev } : { k: "prev (weak)", v: "empty" },
      ];
      t.frame("main()");
      t.obj({ id: "x", title: "Node X", rows: rows(1, 0) });
      t.point("x", "x");
      t.obj({ id: "y", title: "Node Y", rows: rows(1, 0) });
      t.point("y", "y");
      t.step([5, 6], "Two nodes, each with one owner.");
      t.get("x").rows = rows(1, 0, "y");
      t.get("y").rows = rows(2, 0);
      t.step(7, "x->next owns Y: Y strong count 2.");
      t.get("y").rows = rows(2, 0, undefined, "x");
      t.get("x").rows = rows(1, 1, "y");
      t.step(8, "y->prev is a weak_ptr: it observes X without owning it. X's STRONG count stays 1; only the weak count goes up.");
      t.step(9, "To use a weak_ptr, call lock(): it returns a shared_ptr if the object is still alive, or an empty one if it's gone. No dangling access possible.", "good");
      t.pop();
      t.get("x").rows = rows(0, 1, "y");
      t.mark("x", "freed");
      t.get("y").rows = rows(0, 0, undefined, "x");
      t.mark("y", "freed");
      t.print("~Node(X)");
      t.print("~Node(Y)");
      t.step(10, "At scope end X's strong count hits 0, so X is destroyed; that destroys x->next, so Y's count hits 0 too. No leak. Rule: parent → child owns (shared/unique), child → parent observes (weak or raw).", "good");
    },
  ),
];

export default function SmartPointers() {
  return <TraceViewer scenarios={SCENARIOS} />;
}
