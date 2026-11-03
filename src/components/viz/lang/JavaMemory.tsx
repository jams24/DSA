"use client";

import { scenario, TraceViewer } from "./trace";

const point = (x: number, y: number) => [
  { k: "x", v: String(x) },
  { k: "y", v: String(y) },
];

const SCENARIOS = [
  scenario(
    "References & aliasing",
    `Point a = new Point(1, 2);
Point b = a;          // copies the reference
b.x = 10;
System.out.println(a.x);
b = new Point(5, 5);
a = null;`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "p1", title: "Point", sub: "@1b6d3586", rows: point(1, 2) });
      t.point("a", "p1");
      t.step(1, "new Point(1, 2) allocates an object on the heap. The variable a lives on main's stack frame and holds only a reference (think: an address) to it.");
      t.point("b", "p1");
      t.step(2, "b = a copies the reference, not the object. There is still exactly one Point; a and b are two names for it. This is called aliasing.");
      t.get("p1").rows![0] = { k: "x", v: "10", hot: true };
      t.mark("p1", "hot");
      t.step(3, "b.x = 10 follows b's reference and changes the shared object.");
      t.print("10");
      t.step(4, "So a.x prints 10. Changing an object through one reference is visible through every reference to it.", "warn");
      t.obj({ id: "p2", title: "Point", sub: "@4554617c", rows: point(5, 5) });
      t.point("b", "p2");
      t.step(5, "Assigning b a new object only re-points b. a still refers to the first Point.");
      t.set("a", "null");
      t.mark("p1", "garbage");
      t.step(6, "a = null drops the last reference to the first Point. Nothing can reach it any more, so the garbage collector may reclaim it. You never free memory yourself in Java.", "good");
    },
  ),
  scenario(
    "Pass-by-value",
    `static void bump(int n) { n++; }
static void move(Point p) {
    p.x = 99;
    p = new Point(0, 0);
}

int count = 1;
Point pt = new Point(1, 2);
bump(count);
move(pt);
System.out.println(count + " " + pt.x);`,
    (t) => {
      const main = t.frame("main()");
      t.set("count", "1");
      t.step(7, "A primitive int lives directly in the stack frame. No heap object is involved.");
      t.obj({ id: "p1", title: "Point", sub: "@7852e922", rows: point(1, 2) });
      t.point("pt", "p1");
      t.step(8, "pt holds a reference to a Point on the heap.");
      t.frame("bump(int n)");
      t.set("n", "1");
      t.step(1, "Calling bump(count) pushes a new frame. Java copies the VALUE of count into the parameter n. n and count are separate slots.");
      t.set("n", "2");
      t.step(1, "n++ changes only bump's copy.");
      t.pop();
      t.step(9, "bump returns and its frame is popped. count is still 1. A method can never reassign the caller's variables.", "warn");
      t.frame("move(Point p)");
      t.point("p", "p1");
      t.step(2, "move(pt) also copies a value: the reference. p and pt now point at the same Point. Java is ALWAYS pass-by-value; for objects, the value happens to be a reference.");
      t.get("p1").rows![0] = { k: "x", v: "99", hot: true };
      t.mark("p1", "hot");
      t.step(3, "p.x = 99 follows the copied reference and mutates the caller's object. This change IS visible to main.");
      t.obj({ id: "p2", title: "Point", sub: "@4e25154f", rows: point(0, 0) });
      t.point("p", "p2");
      t.step(4, "p = new Point(0, 0) re-points the local copy only. main's pt still refers to the original Point.");
      t.pop();
      t.mark("p2", "garbage");
      t.step(10, "move returns. Nothing references the Point(0, 0) any more, so it becomes garbage.");
      void main;
      t.print("1 99");
      t.step(11, "Prints 1 99: the primitive was untouched, the object was mutated, and the reassignment inside move was invisible. That's the whole pass-by-value rule.", "good");
    },
  ),
  scenario(
    "Strings are immutable",
    `String s1 = "hi";
String s2 = "hi";
String s3 = new String("hi");
System.out.println(s1 == s2);
System.out.println(s1 == s3);
System.out.println(s1.equals(s3));
s1 = s1 + "!";`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "lit", title: '"hi"', sub: "string pool (interned literal)" });
      t.point("s1", "lit");
      t.step(1, 'String literals are interned: the JVM keeps one shared "hi" in the string pool.');
      t.point("s2", "lit");
      t.step(2, 'A second "hi" literal reuses the pooled object, so s1 and s2 hold the same reference.');
      t.obj({ id: "nw", title: '"hi"', sub: "new String: a separate object" });
      t.point("s3", "nw");
      t.step(3, "new String(...) always creates a fresh object, even with identical characters.");
      t.print("true");
      t.step(4, "== compares references: s1 and s2 are the same object, so true.");
      t.print("false");
      t.step(5, "s1 == s3 is false: same text, different objects. This is the classic Java bug when comparing strings with ==.", "bad");
      t.print("true");
      t.step(6, "equals() compares the characters. Always use equals() for strings (and for objects in general).", "good");
      t.obj({ id: "cat", title: '"hi!"', sub: "new object from concatenation" });
      t.point("s1", "cat");
      t.step(7, 'Strings are immutable: s1 + "!" builds a NEW string and re-points s1. The pooled "hi" is unchanged, and s2 still sees it. In a loop, use StringBuilder to avoid creating a new string per iteration.', "good");
    },
  ),
];

export default function JavaMemory() {
  return <TraceViewer scenarios={SCENARIOS} />;
}
