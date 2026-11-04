"use client";

import { scenario, TraceViewer } from "./trace";

const rc = (n: number, extra = "") => `refcount ${n}${extra ? ` · ${extra}` : ""}`;

const SCENARIOS = [
  scenario(
    "Names are labels",
    `a = [1, 2, 3]
b = a
b.append(4)
print(a)
a = a + [5]
print(a, b)
n = 10
m = n
m += 1
print(n, m)`,
    (t) => {
      t.frame("module (globals)");
      t.obj({ id: "L1", title: "list", sub: rc(1), cells: [1, 2, 3] });
      t.point("a", "L1");
      t.step(1, "Python variables are names that point at objects; the object lives on the heap. The list [1, 2, 3] is created, then the name a is bound to it.");
      t.point("b", "L1");
      t.get("L1").sub = rc(2);
      t.step(2, "Assignment never copies. b = a makes a second name for the SAME object: a is b is True, and the list's reference count goes to 2.", "warn");
      t.get("L1").cells = [1, 2, 3, 4];
      t.mark("L1", "hot");
      t.step(3, "b.append(4) mutates the one shared list, so the change is visible through every name that points at it.");
      t.print("[1, 2, 3, 4]");
      t.step(4, "a sees the 4 that was appended through b. This is aliasing: the source of most 'my list changed by itself' bugs.", "bad");
      t.obj({ id: "L2", title: "list", sub: rc(1, "new object"), cells: [1, 2, 3, 4, 5] });
      t.point("a", "L2");
      t.get("L1").sub = rc(1);
      t.step(5, "a + [5] builds a NEW list, then a is rebound to it. Rebinding a name never touches other names: b still points at the old list. (Careful: a += [5] would mutate the old list in place instead, because += on a list calls extend.)");
      t.print("[1, 2, 3, 4, 5] [1, 2, 3, 4]");
      t.step(6, "Two names, two different lists now.");
      t.obj({ id: "I10", title: "int", sub: "immutable · cached small int", cells: [10] });
      t.point("n", "I10");
      t.step(7, "Ints are objects too, but immutable: no operation can change the value inside an int object.");
      t.point("m", "I10");
      t.step(8, "m = n binds m to the same int object. Sharing is harmless here, because nobody can mutate it.");
      t.obj({ id: "I11", title: "int", sub: "immutable", cells: [11] });
      t.point("m", "I11");
      t.step(9, "m += 1 can't change 10 in place, so it computes a new int, 11, and rebinds m. n is unaffected.", "good");
      t.print("10 11");
      t.step(10, "Rule of thumb: mutating an object (append, item assignment, attribute assignment) is seen by every name pointing at it; rebinding a name (=, and += on immutables) affects only that name.", "good");
    },
    { stack: "Names (namespaces)", heap: "Objects (heap)" },
  ),
  scenario(
    "The mutable default argument",
    `def add(item, bucket=[]):
    bucket.append(item)
    return bucket

print(add("a"))
print(add("b"))

def add_fixed(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket

print(add_fixed("a"), add_fixed("b"))`,
    (t) => {
      const g = t.frame("module (globals)");
      t.obj({ id: "D", title: "list (the default)", sub: rc(1, "created once"), cells: [] });
      t.obj({ id: "F", title: "function add", rows: [{ k: "__defaults__[0]", ref: "D" }] });
      t.point("add", "F");
      t.step(1, "`def` is a statement that runs ONCE. It evaluates the default value [] right now and stores that one list on the function object, in add.__defaults__.", "warn");
      t.frame("add('a')");
      t.set("item", "'a'");
      t.point("bucket", "D");
      t.get("D").sub = rc(2);
      t.step(5, "Calling add('a') without a bucket binds the parameter to the stored default object, not to a fresh list.");
      t.get("D").cells = ["'a'"];
      t.mark("D", "hot");
      t.step(2, "append mutates the default list itself.");
      t.pop();
      t.get("D").sub = rc(1);
      t.print("['a']");
      t.step([3, 5], "The first call looks fine.");
      t.frame("add('b')");
      t.set("item", "'b'");
      t.point("bucket", "D");
      t.get("D").sub = rc(2);
      t.step(6, "The second call gets the SAME default list, which still holds 'a'.", "warn");
      t.get("D").cells = ["'a'", "'b'"];
      t.mark("D", "hot");
      t.step(2, "So 'b' is appended next to 'a'.", "bad");
      t.pop();
      t.get("D").sub = rc(1);
      t.print("['a', 'b']");
      t.step([3, 6], "Surprise: ['a', 'b']. Every call that omits bucket shares one list, and it keeps growing for the life of the program. Linters (ruff B006) flag this.", "bad");
      t.obj({ id: "F2", title: "function add_fixed", rows: [{ k: "__defaults__[0]", v: "None" }] });
      t.point("add_fixed", "F2", g);
      t.step(8, "The idiom: default to None (immutable) and create the list inside the function.");
      t.frame("add_fixed('a')");
      t.set("item", "'a'");
      t.set("bucket", "None");
      t.step(14, "Calling add_fixed('a'): bucket starts as None.");
      t.obj({ id: "N1", title: "list", sub: rc(1, "new each call"), cells: [] });
      t.point("bucket", "N1");
      t.step([9, 10], "A brand-new list is created on every call that needs one.", "good");
      t.get("N1").cells = ["'a'"];
      t.step([11, 12], "Append and return it.");
      t.pop();
      t.frame("add_fixed('b')");
      t.set("item", "'b'");
      t.obj({ id: "N2", title: "list", sub: rc(1, "new each call"), cells: [] });
      t.point("bucket", "N2");
      t.step([9, 10], "The second call gets its own list.", "good");
      t.get("N2").cells = ["'b'"];
      t.pop();
      t.print("['a'] ['b']");
      t.step(14, "Independent results. Same rule for {} and set() defaults, and for any mutable class attribute shared by all instances.", "good");
    },
    { stack: "Names (namespaces)", heap: "Objects (heap)" },
  ),
  scenario(
    "Shallow vs deep copy",
    `grid = [[0] * 3] * 3
grid[0][0] = 1
print(grid)
grid = [[0] * 3 for _ in range(3)]
grid[0][0] = 1
print(grid)
import copy
shallow = copy.copy(grid)
deep = copy.deepcopy(grid)
grid[1][1] = 7
print(shallow[1][1], deep[1][1])`,
    (t) => {
      t.frame("module (globals)");
      t.obj({ id: "R", title: "inner list", sub: rc(3), cells: [0, 0, 0] });
      t.obj({ id: "O", title: "outer list", rows: [{ k: "[0]", ref: "R" }, { k: "[1]", ref: "R" }, { k: "[2]", ref: "R" }] });
      t.point("grid", "O");
      t.step(1, "[[0] * 3] * 3 builds ONE inner list, then * 3 copies the reference to it three times. The outer list holds three pointers to the same row.", "warn");
      t.get("R").cells = [1, 0, 0];
      t.mark("R", "hot");
      t.step(2, "Writing grid[0][0] writes into that single row...");
      t.print("[[1, 0, 0], [1, 0, 0], [1, 0, 0]]");
      t.step(3, "...so every 'row' changes. Classic interview gotcha when building a 2D board or DP table.", "bad");
      t.obj({ id: "R1", title: "row 0", sub: rc(1), cells: [0, 0, 0] });
      t.obj({ id: "R2", title: "row 1", sub: rc(1), cells: [0, 0, 0] });
      t.obj({ id: "R3", title: "row 2", sub: rc(1), cells: [0, 0, 0] });
      t.obj({ id: "O2", title: "outer list", rows: [{ k: "[0]", ref: "R1" }, { k: "[1]", ref: "R2" }, { k: "[2]", ref: "R3" }] });
      t.point("grid", "O2");
      t.mark("O", "garbage");
      t.mark("R", "garbage");
      t.step(4, "A comprehension runs [0] * 3 once per row, so each row is a distinct list. The old grid has no names left, so its refcount drops to 0 and it is freed immediately.", "good");
      t.remove("O");
      t.remove("R");
      t.get("R1").cells = [1, 0, 0];
      t.mark("R1", "hot");
      t.step(5, "Now grid[0][0] = 1 only touches row 0.");
      t.print("[[1, 0, 0], [0, 0, 0], [0, 0, 0]]");
      t.step(6, "Correct.", "good");
      t.obj({ id: "S", title: "shallow (new outer)", rows: [{ k: "[0]", ref: "R1" }, { k: "[1]", ref: "R2" }, { k: "[2]", ref: "R3" }] });
      for (const r of ["R1", "R2", "R3"]) t.get(r).sub = rc(2);
      t.point("shallow", "S");
      t.step([7, 8], "copy.copy (like list(grid), grid[:] or grid.copy()) makes a new OUTER list, but its slots point at the same row objects.", "warn");
      t.obj({ id: "D1", title: "deep row 0", sub: rc(1), cells: [1, 0, 0] });
      t.obj({ id: "D2", title: "deep row 1", sub: rc(1), cells: [0, 0, 0] });
      t.obj({ id: "D3", title: "deep row 2", sub: rc(1), cells: [0, 0, 0] });
      t.obj({ id: "DO", title: "deep (new outer)", rows: [{ k: "[0]", ref: "D1" }, { k: "[1]", ref: "D2" }, { k: "[2]", ref: "D3" }] });
      t.point("deep", "DO");
      t.step(9, "copy.deepcopy recursively copies everything reachable (it keeps a memo dict, so shared objects and cycles are copied once).", "good");
      t.get("R2").cells = [0, 7, 0];
      t.mark("R2", "hot");
      t.step(10, "Mutating row 1 through grid changes the row object that shallow also points at.");
      t.print("7 0");
      t.step(11, "shallow sees the 7, deep doesn't. Shallow copies are fine for lists of immutables (ints, strings, tuples of immutables); use deepcopy, or rebuild, for nested mutable data.", "good");
    },
    { stack: "Names (namespaces)", heap: "Objects (heap)" },
  ),
  scenario(
    "Refcounts and cycles",
    `import gc

class Node:
    def __init__(self, name):
        self.name = name
        self.peer = None

a = Node("a")
b = Node("b")
a.peer = b
b.peer = a
del a
del b
gc.collect()`,
    (t) => {
      t.frame("module (globals)");
      t.obj({ id: "A", title: "Node 'a'", sub: rc(1), rows: [{ k: "name", v: "'a'" }, { k: "peer", v: "None" }] });
      t.point("a", "A");
      t.step(8, "Every CPython object carries a reference count: how many references point at it. One name points at Node 'a', so its count is 1.");
      t.obj({ id: "B", title: "Node 'b'", sub: rc(1), rows: [{ k: "name", v: "'b'" }, { k: "peer", v: "None" }] });
      t.point("b", "B");
      t.step(9, "Same for Node 'b'.");
      t.get("A").rows = [{ k: "name", v: "'a'" }, { k: "peer", ref: "B", hot: true }];
      t.get("B").sub = rc(2);
      t.step(10, "a.peer = b adds a second reference to Node 'b' (the name b and the attribute a.peer).");
      t.get("B").rows = [{ k: "name", v: "'b'" }, { k: "peer", ref: "A", hot: true }];
      t.get("A").sub = rc(2);
      t.step(11, "b.peer = a closes a reference cycle: each node keeps the other alive.");
      t.top().vars = t.top().vars.filter((x) => x.name !== "a");
      t.get("A").sub = rc(1, "held by b.peer");
      t.step(12, "del a deletes the NAME a, not the object. The count drops to 1, because b.peer still points at it.", "warn");
      t.top().vars = t.top().vars.filter((x) => x.name !== "b");
      t.get("B").sub = rc(1, "held by a.peer");
      t.mark("A", "garbage");
      t.mark("B", "garbage");
      t.step(13, "Now nothing in the program can reach either node, but both counts are still 1 (they reference each other). Reference counting alone can never free a cycle.", "bad");
      t.mark("A", "freed");
      t.mark("B", "freed");
      t.get("A").sub = "collected";
      t.get("B").sub = "collected";
      t.step(14, "The cyclic garbage collector finds groups of container objects that are only referenced from inside the group, and frees them. It runs automatically based on allocation counts; gc.collect() forces a run.", "good");
      t.step(14, "Takeaways: most objects die the instant their count hits 0 (deterministic, which is why files get closed promptly in CPython); cycles wait for the GC. Use weakref for back-pointers (parent links, observers, caches) so you don't create cycles at all.", "good");
    },
    { stack: "Names (namespaces)", heap: "Objects (heap)" },
  ),
];

export default function PyRefs() {
  return <TraceViewer scenarios={SCENARIOS} />;
}
