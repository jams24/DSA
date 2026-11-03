"use client";

import { scenario, TraceViewer } from "./trace";

const titles = { stack: "Variables", heap: "Objects and vtables" };

const SCENARIOS = [
  scenario(
    "Virtual dispatch",
    `struct Shape  { virtual double area() const = 0;
                virtual ~Shape() = default; };
struct Circle : Shape { double r;  double area() const override; };
struct Square : Shape { double s;  double area() const override; };

std::vector<std::unique_ptr<Shape>> shapes;
shapes.push_back(std::make_unique<Circle>(1.0));
shapes.push_back(std::make_unique<Square>(2.0));
double total = 0;
for (auto& s : shapes) total += s->area();`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "cvt", title: "vtable for Circle", sub: "read-only data, one per class", rows: [{ k: "[0] ~Circle", v: "Circle::~Circle" }, { k: "[1] area", v: "Circle::area" }] });
      t.obj({ id: "svt", title: "vtable for Square", sub: "read-only data, one per class", rows: [{ k: "[0] ~Square", v: "Square::~Square" }, { k: "[1] area", v: "Square::area" }] });
      t.step([1, 2, 3, 4], "Every class with virtual functions gets a vtable: a static table of function pointers, built by the compiler. One table per class, not per object.");
      t.obj({ id: "vec", title: "unique_ptr<Shape>[ ]", sub: "vector's buffer", rows: [] });
      t.point("shapes", "vec", t.top(), "size 0");
      t.step(6, "The vector holds pointers to the base class.");
      t.obj({ id: "c", title: "Circle", sub: "@0xa000 · 16 bytes", rows: [{ k: "vptr", ref: "cvt" }, { k: "r", v: "1.0" }] });
      t.get("vec").rows = [{ k: "[0]", ref: "c" }];
      t.point("shapes", "vec", t.top(), "size 1");
      t.step(7, "Each object gets a hidden first member, the vptr, which the constructor points at its class's vtable. That's the per-object cost of virtual: 8 bytes.");
      t.obj({ id: "q", title: "Square", sub: "@0xa020 · 16 bytes", rows: [{ k: "vptr", ref: "svt" }, { k: "s", v: "2.0" }] });
      t.get("vec").rows = [{ k: "[0]", ref: "c" }, { k: "[1]", ref: "q" }];
      t.point("shapes", "vec", t.top(), "size 2");
      t.step(8, "Same for the Square, with a different vptr.");
      t.set("total", "0");
      t.step(9, "Now loop over the base-class pointers and call area() on each.");
      t.get("c").rows![0].hot = true;
      t.get("cvt").rows![1].hot = true;
      t.set("total", "3.14159");
      t.step(10, "s->area() on element 0: load the object's vptr → Circle's vtable → slot [1] → call Circle::area(). The call site doesn't know the type; the object does.", "good");
      t.get("q").rows![0].hot = true;
      t.get("svt").rows![1].hot = true;
      t.set("total", "7.14159");
      t.step(10, "Element 1: same instructions, different vptr, so Square::area() runs. That's runtime polymorphism. The cost: two dependent loads per call and (usually) no inlining. Hot loops sometimes use templates or std::variant instead.");
    },
    titles,
  ),
  scenario(
    "Object slicing",
    `struct Animal {
    virtual std::string speak() const { return "..."; }
};
struct Dog : Animal {
    std::string name = "Rex";
    std::string speak() const override { return "Woof"; }
};
Dog d;
Animal& r = d;
std::cout << r.speak();   // Woof
Animal a = d;             // copy into an Animal
std::cout << a.speak();   // ...`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "dvt", title: "vtable for Dog", rows: [{ k: "speak", v: "Dog::speak" }] });
      t.obj({ id: "avt", title: "vtable for Animal", rows: [{ k: "speak", v: "Animal::speak" }] });
      t.obj({ id: "d", title: "Dog d", sub: "on the stack", rows: [{ k: "vptr", ref: "dvt" }, { k: "name", v: '"Rex"' }] });
      t.point("d", "d", t.top(), "Dog");
      t.step(8, "A Dog object: vptr to Dog's vtable plus its own name field.");
      t.point("r", "d", t.top(), "Animal&");
      t.step(9, "A reference (or pointer) to the base still refers to the whole Dog.");
      t.get("d").rows![0].hot = true;
      t.get("dvt").rows![0].hot = true;
      t.print("Woof");
      t.step(10, "Virtual dispatch through the reference finds Dog::speak.", "good");
      t.obj({ id: "a", title: "Animal a", sub: "a NEW object, only Animal's part", rows: [{ k: "vptr", ref: "avt" }] });
      t.point("a", "a", t.top(), "Animal");
      t.step(11, "Copying a Dog into an Animal VALUE slices it: only the Animal sub-object is copied, the name is dropped, and a's vptr points at Animal's vtable.", "bad");
      t.get("a").rows![0].hot = true;
      t.get("avt").rows![0].hot = true;
      t.print("...");
      t.step(12, "So a.speak() runs Animal::speak. Polymorphism only works through pointers and references. Pass polymorphic types by reference, and consider deleting the base's copy operations.", "bad");
    },
    titles,
  ),
  scenario(
    "Missing virtual destructor",
    `struct Base {
    ~Base() {}                 // not virtual!
};
struct Derived : Base {
    std::vector<int> data = std::vector<int>(1000);
};
Base* p = new Derived;
delete p;     // undefined behavior`,
    (t) => {
      t.frame("main()");
      t.obj({ id: "buf", title: "int[1000]", sub: "owned by data", cells: [0, 0, 0, "…"] });
      t.obj({ id: "d", title: "Derived", sub: "@0xb000", rows: [{ k: "Base part", v: "(empty)" }, { k: "data", ref: "buf" }] });
      t.point("p", "d", t.top(), "Base*");
      t.step(7, "A Derived object, held through a Base pointer. Fine so far.");
      t.mark("d", "freed");
      t.mark("buf", "leak");
      t.step(8, "delete p calls the destructor through the static type Base. ~Base isn't virtual, so ~Derived never runs: data's buffer leaks. Formally this is undefined behavior.", "bad");
      t.step(1, "Rule: a class meant to be used polymorphically needs a public virtual destructor (virtual ~Base() = default;). Or make it protected and non-virtual if deleting through the base must be impossible.", "good");
    },
    titles,
  ),
];

export default function VTable() {
  return <TraceViewer scenarios={SCENARIOS} />;
}
