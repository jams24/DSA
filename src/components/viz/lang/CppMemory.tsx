"use client";

import { scenario, TraceViewer } from "./trace";

const SCENARIOS = [
  scenario(
    "Stack, heap, new & delete",
    `int x = 5;
int* p = &x;         // p holds x's address
*p = 7;              // write through the pointer
int* h = new int(42);
delete h;            // memory returned
h = nullptr;`,
    (t) => {
      t.frame("main()");
      t.set("x", "5  @0x7ffe10");
      t.step(1, "x is a local variable: it lives in main's stack frame at some address (here 0x7ffe10). It's destroyed automatically when the scope ends.");
      t.set("p", "0x7ffe10 → x");
      t.step(2, "&x takes x's address. p is a pointer: a variable whose value is an address.");
      t.set("x", "7  @0x7ffe10");
      t.step(3, "*p dereferences the pointer: 'the int at that address'. Writing *p = 7 changes x.");
      t.obj({ id: "h", title: "int", sub: "@0x5600a0 (heap)", rows: [{ k: "value", v: "42" }] });
      t.point("h", "h", t.top(), "0x5600a0");
      t.step(4, "new int(42) allocates on the heap and returns its address. Heap memory lives until YOU delete it, no matter which scope ends.");
      t.mark("h", "freed");
      const hv = t.v("h");
      hv.bad = true;
      hv.value = "0x5600a0";
      hv.hot = true;
      t.step(5, "delete h gives the memory back, but h still holds the old address. h is now a dangling pointer: reading or deleting it again is undefined behavior.", "bad");
      t.remove("h");
      t.set("h", "nullptr");
      t.step(6, "Setting it to nullptr makes the mistake detectable. Better still: don't call new/delete yourself. Use std::unique_ptr or a container and let RAII free it.", "good");
    },
  ),
  scenario(
    "Memory leak",
    `void work() {
    int* buf = new int[3]{1, 2, 3};
    if (failed()) return;     // early exit!
    delete[] buf;
}

work();`,
    (t) => {
      t.frame("main()");
      t.frame("work()");
      t.step(7, "main calls work(), which gets its own stack frame.");
      t.obj({ id: "buf", title: "int[3]", sub: "@0x5610c0 (heap, 12 bytes)", cells: [1, 2, 3] });
      t.point("buf", "buf", t.top(), "0x5610c0");
      t.step(2, "new int[3] allocates an array on the heap. The only thing that knows where it is: the local pointer buf.");
      t.step(3, "failed() returns true, so we return early and skip the delete[].", "warn");
      t.pop();
      t.mark("buf", "leak");
      t.step(3, "work's frame is popped, and buf (the only pointer) is gone with it. The array is still allocated but unreachable: a memory leak. Do this in a loop and the process grows until it's killed.", "bad");
      t.step(7, "The fix is RAII: std::vector<int> buf{1, 2, 3}; or auto buf = std::make_unique<int[]>(3);. Their destructors free the memory on EVERY exit path, including early returns and exceptions.", "good");
    },
  ),
  scenario(
    "Returning a dangling pointer",
    `int* make() {
    int local = 10;
    return &local;    // address of a local!
}

int* p = make();
std::cout << *p;     // undefined behavior`,
    (t) => {
      t.frame("main()");
      t.frame("make()");
      t.set("local", "10  @0x7ffd40");
      t.step(2, "local lives in make's stack frame.");
      t.step(3, "We return its address. Compilers warn here (-Wreturn-stack-address / -Wreturn-local-addr): listen to them.", "warn");
      t.pop();
      t.set("p", "0x7ffd40");
      const pv = t.v("p");
      pv.bad = true;
      t.step(6, "make's frame is gone, but p still holds the address of the dead variable. The next function call will reuse that stack memory.", "bad");
      t.step(7, "*p is undefined behavior: it may print 10, garbage, or crash, and it can change with optimization level. Fix: return the int by value. Copies of small values are free.", "bad");
    },
  ),
  scenario(
    "References vs pointers",
    `int a = 1;
int& r = a;       // r is another name for a
r = 5;            // a is now 5
int b = 9;
r = b;            // copies 9 into a!
int* q = &a;
q = &b;           // pointers can be re-seated`,
    (t) => {
      t.frame("main()");
      t.set("a", "1");
      t.step(1, "a plain int on the stack.");
      t.set("r", "alias of a");
      t.step(2, "A reference is an alias: it must be bound when declared, can't be null, and can never be re-bound to something else.");
      t.set("a", "5");
      t.step(3, "Assigning through r assigns to a.");
      t.set("b", "9");
      t.step(4, "b is another int on the stack.");
      t.set("a", "9");
      t.step(5, "r = b does NOT re-bind r to b. It copies b's value into a. r still refers to a.", "warn");
      t.set("q", "&a");
      t.step(6, "A pointer holds an address and can be null.");
      t.set("q", "&b");
      t.step(7, "Unlike a reference, a pointer can be re-pointed. Rule of thumb: use references for parameters that must exist, pointers (or std::optional) when 'nothing' is a valid answer.", "good");
    },
  ),
];

export default function CppMemory() {
  return <TraceViewer scenarios={SCENARIOS} />;
}
