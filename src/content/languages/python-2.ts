import type { Lesson } from "../types";

// Python track, part 2: Core.

export const pyCore: Lesson[] = [
  // ------------------------------------------------------------------ OOP
  {
    id: "py-oop",
    stage: "Core",
    title: "Classes, dataclasses and the data model",
    tagline: "Classes and instances, properties, dunder methods that make your objects feel built-in, dataclasses, inheritance and the MRO, ABCs vs protocols, and enums.",
    difficulty: "intermediate",
    minutes: 40,
    concept: `
## Classes and instances
\`\`\`python
class Account:
    interest_rate = 0.02              # class attribute: shared by all instances

    def __init__(self, owner, balance=0):
        self.owner = owner            # instance attributes: stored per object
        self.balance = balance

    def deposit(self, amount):        # a method: self is the instance
        self.balance += amount
\`\`\`
\`Account("ada")\` creates an object and calls \`__init__\` on it. \`self\` is nothing magic: \`acct.deposit(5)\` is just \`Account.deposit(acct, 5)\`. Instance attributes live in a per-object dict (\`vars(acct)\`); attribute lookup checks the instance first, then the class, then the base classes.

Python has no \`private\`. By convention, \`_name\` means internal; \`__name\` triggers **name mangling** (\`_Account__name\`) to avoid clashes in subclasses, not to hide anything. Expose computed or validated attributes with \`@property\` instead of writing getters and setters: you can start with a plain attribute and turn it into a property later without changing callers.

- \`@classmethod\` receives the class (\`cls\`): use it for **alternative constructors** like \`Account.from_csv(line)\`; they work for subclasses too.
- \`@staticmethod\` receives nothing: a plain function namespaced in the class.

## The data model: dunder methods
Python's syntax calls special methods, so your classes can behave like built-ins:

| You write | Python calls |
|---|---|
| \`repr(x)\`, the REPL | \`x.__repr__()\` (unambiguous, for developers) |
| \`str(x)\`, \`print(x)\`, f-strings | \`x.__str__()\` (falls back to \`__repr__\`) |
| \`x == y\` / \`x < y\` | \`__eq__\` / \`__lt__\` |
| \`hash(x)\`, dict keys, sets | \`__hash__\` (equal objects must hash equal) |
| \`x + y\`, \`3 * x\` | \`__add__\`, \`__mul__\`, then the reflected \`__radd__\`, \`__rmul__\` |
| \`len(x)\`, \`bool(x)\` | \`__len__\`, \`__bool__\` |
| \`for i in x\`, unpacking | \`__iter__\` |
| \`x[k]\`, \`k in x\` | \`__getitem__\`, \`__contains__\` |
| \`x()\` | \`__call__\` |
| \`with x:\` | \`__enter__\`, \`__exit__\` |

Return \`NotImplemented\` (not \`False\`) from a binary method when you don't know how to handle the other type: Python then tries the other operand. If you define \`__eq__\`, define \`__hash__\` too (or the class becomes unhashable), and only make objects hashable if they're immutable.

## Dataclasses: classes for data, without boilerplate
\`@dataclass\` generates \`__init__\`, \`__repr__\` and \`__eq__\` from annotated fields. Options:
- \`frozen=True\`: immutable and hashable; change it with \`dataclasses.replace(obj, field=...)\`.
- \`slots=True\`: uses \`__slots__\` instead of a per-instance dict: less memory, faster attribute access, no accidental new attributes.
- \`order=True\`: generates \`<\`, \`>\`... comparing fields in order. \`kw_only=True\`: keyword-only constructor.
- \`field(default_factory=list)\` for mutable defaults; \`field(repr=False, compare=False)\` to tune each field.
- \`__post_init__\` for validation and derived fields.

Choose between record types like this: **dataclass** for most internal data; **NamedTuple** when tuple behaviour (unpacking, immutability) helps; **pydantic** when data comes from outside and must be validated and converted (see the typing chapter); **attrs** if you need its extra features.

## Inheritance, super() and the MRO
\`class Square(Rectangle):\` inherits everything and can override methods. Call the parent's version with \`super().method()\`. With multiple inheritance, Python computes a **method resolution order** (MRO, the C3 linearization, visible in \`Cls.__mro__\`) and \`super()\` means "the next class in the MRO", not "my parent". That makes **mixins** composable: each one calls \`super()\` and they all run, in MRO order.

Use inheritance for true "is-a" relationships and small mixins; prefer **composition** (an object holding other objects) for everything else. Deep hierarchies are rare in idiomatic Python.

## Abstract base classes vs protocols
- **ABC** (\`abc.ABC\` + \`@abstractmethod\`): nominal typing. Subclasses must implement the abstract methods or they can't be instantiated. Good for frameworks and plugin bases.
- **Protocol** (\`typing.Protocol\`): structural typing, checked by mypy/pyright. Any class with matching methods is accepted, without inheriting anything: Python's duck typing, made type-safe. This is how the standard library's \`Iterable\`, \`Sized\` and friends work.

## Enums
\`Enum\` gives named constants with identity: \`Color.RED\`. \`StrEnum\` and \`IntEnum\` members **are** strings or ints, so they serialize to JSON and databases naturally (\`Status.PAID == "paid"\`). \`auto()\` assigns values for you. Enums work well with \`match\`.
`,
    keyPoints: [
      "self is just the instance: obj.m(x) is Class.m(obj, x)",
      "Use @property instead of getters and setters",
      "Dunder methods (__repr__, __eq__, __hash__, __add__, __iter__...) plug into Python syntax",
      "@dataclass generates __init__, __repr__ and __eq__; frozen=True, slots=True",
      "super() follows the MRO, which makes mixins cooperate",
      "Protocols give type-checked duck typing without inheritance",
    ],
    code: [
      {
        title: "A class that behaves like a built-in type",
        variants: [{ lang: "python", code: `import math


class Vector:
    """A 2D vector that behaves like a built-in type, thanks to special ("dunder") methods."""

    __match_args__ = ("x", "y")  # lets \`case Vector(x, y)\` match positionally

    def __init__(self, x: float = 0.0, y: float = 0.0) -> None:
        self._x = float(x)  # leading underscore: "internal, please don't touch"
        self._y = float(y)

    @classmethod
    def from_polar(cls, r: float, degrees: float) -> "Vector":  # an alternative constructor
        rad = math.radians(degrees)
        return cls(round(r * math.cos(rad), 10), round(r * math.sin(rad), 10))

    @property  # read-only attribute computed from the underscored fields
    def x(self) -> float:
        return self._x

    @property
    def y(self) -> float:
        return self._y

    def __repr__(self) -> str:  # unambiguous, for developers: shown in the REPL and in lists
        return f"Vector({self._x!r}, {self._y!r})"

    def __str__(self) -> str:  # friendly, for users: used by print() and f-strings
        return f"({self._x:g}, {self._y:g})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Vector):
            return NotImplemented  # let Python try the other operand, then fall back to False
        return (self._x, self._y) == (other._x, other._y)

    def __hash__(self) -> int:  # equal objects must hash equally; immutable, so hashable
        return hash((self._x, self._y))

    def __add__(self, other: "Vector") -> "Vector":
        return Vector(self._x + other._x, self._y + other._y)

    def __mul__(self, k: float) -> "Vector":  # v * 3
        return Vector(self._x * k, self._y * k)

    __rmul__ = __mul__  # 3 * v: Python calls int.__mul__ first, it fails, then v.__rmul__(3)

    def __abs__(self) -> float:
        return math.hypot(self._x, self._y)

    def __bool__(self) -> bool:
        return bool(abs(self))

    def __iter__(self):  # makes unpacking work: x, y = v
        yield self._x
        yield self._y


v = Vector(3, 4)
w = Vector.from_polar(2, 90)
print(repr(v), str(v), f"{w}", [v, w])
print(v + w, v * 2, 2 * v, abs(v), bool(Vector()), v == Vector(3, 4), v is Vector(3, 4))
x, y = v
print(x, y, {v, Vector(3, 4)}, len({v: "a", Vector(3.0, 4.0): "b"}))

match v:
    case Vector(0, 0):
        print("origin")
    case Vector(x, 0) | Vector(0, x):
        print("on an axis at", x)
    case Vector(x, y):
        print(f"somewhere else: {x=}, {y=}")

try:
    v.x = 10
except AttributeError as e:
    print("AttributeError:", "property" in str(e))` }],
        explain: `- \`__init__\` stores coordinates in underscored attributes; the \`x\`/\`y\` **properties** expose them read-only, so \`v.x = 10\` raises \`AttributeError\`.
- \`from_polar\` is a **classmethod** used as an alternative constructor; \`cls(...)\` means a subclass would get an instance of itself.
- \`__repr__\` vs \`__str__\`: the list \`[v, w]\` uses \`repr\` for its elements, \`print\` and f-strings use \`str\`.
- \`__eq__\` returns \`NotImplemented\` for other types, and \`__hash__\` hashes the same tuple \`__eq__\` compares, so equal vectors collapse to one entry in a set or dict.
- \`__add__\`, \`__mul__\` and \`__rmul__\` make \`v + w\`, \`v * 2\` and \`2 * v\` work. For \`2 * v\`, Python first tries \`int.__mul__(2, v)\`, gets \`NotImplemented\`, then calls \`v.__rmul__(2)\`.
- \`__abs__\` and \`__bool__\` power \`abs(v)\` and truthiness (the zero vector is falsy). \`__iter__\` makes \`x, y = v\` unpacking work.
- \`__match_args__\` tells \`match\` which attributes positional class patterns refer to, so \`case Vector(x, 0)\` works.`,
        output: `Vector(3.0, 4.0) (3, 4) (0, 2) [Vector(3.0, 4.0), Vector(0.0, 2.0)]
(3, 6) (6, 8) (6, 8) 5.0 False True False
3.0 4.0 {Vector(3.0, 4.0)} 1
somewhere else: x=3.0, y=4.0
AttributeError: True`,
      },
      {
        title: "Dataclasses: frozen, slots, ordering and validation",
        variants: [{ lang: "python", code: `from dataclasses import asdict, dataclass, field, replace
from decimal import Decimal


@dataclass(frozen=True, slots=True)  # immutable (hashable) and memory-lean
class Money:
    amount: Decimal
    currency: str = "USD"

    def __post_init__(self) -> None:  # validation after the generated __init__
        if self.amount < 0:
            raise ValueError(f"negative money: {self.amount}")

    def __add__(self, other: "Money") -> "Money":
        if other.currency != self.currency:
            raise ValueError("currency mismatch")
        return Money(self.amount + other.amount, self.currency)


@dataclass(order=True)  # generates <, <=, >, >= comparing fields in order
class LineItem:
    sku: str
    quantity: int = 1
    unit_price: Money = field(default_factory=lambda: Money(Decimal("0")), compare=False)

    @property
    def total(self) -> Money:
        return Money(self.unit_price.amount * self.quantity, self.unit_price.currency)


@dataclass(kw_only=True)
class Order:
    id: int
    customer: str
    items: list[LineItem] = field(default_factory=list)  # never items: list = []
    notes: str = field(default="", repr=False)

    def total(self) -> Money:
        result = Money(Decimal("0"))
        for item in self.items:
            result = result + item.total
        return result


price = Money(Decimal("19.99"))
order = Order(id=1, customer="ada", items=[LineItem("BOOK", 2, price), LineItem("PEN", 3, Money(Decimal("1.50")))])
print(order)
print(order.total(), sorted(order.items)[0].sku)
print(price == Money(Decimal("19.99")), hash(price) == hash(Money(Decimal("19.99"))))

try:
    price.amount = Decimal("0")
except AttributeError as e:  # FrozenInstanceError is a subclass of AttributeError
    print(type(e).__name__)
try:
    Money(Decimal("-1"))
except ValueError as e:
    print("ValueError:", e)

cheaper = replace(price, amount=Decimal("9.99"))  # frozen? make a modified copy instead
print(cheaper, asdict(order)["items"][1])
print(hasattr(price, "__dict__"), Money.__slots__)` }],
        explain: `- \`Money\` is \`frozen=True\` (immutable and hashable: equal values hash the same) and \`slots=True\` (no per-instance \`__dict__\`, as the last line shows). \`__post_init__\` validates after the generated \`__init__\`. It uses \`Decimal\`, never float, for money.
- \`LineItem\` has \`order=True\`, so items sort by \`sku\` then \`quantity\`; \`compare=False\` leaves the price out of comparisons. Its \`total\` is a property.
- \`Order\` is \`kw_only=True\` (every argument must be named, which is readable for records with many fields), uses \`field(default_factory=list)\` for the mutable default, and hides \`notes\` from the repr.
- The generated \`__repr__\` prints the whole object graph, which is very handy when debugging.
- Assigning to a frozen field raises \`FrozenInstanceError\`; \`dataclasses.replace\` returns a modified copy instead. \`asdict\` converts recursively to plain dicts (for JSON).`,
        output: `Order(id=1, customer='ada', items=[LineItem(sku='BOOK', quantity=2, unit_price=Money(amount=Decimal('19.99'), currency='USD')), LineItem(sku='PEN', quantity=3, unit_price=Money(amount=Decimal('1.50'), currency='USD'))])
Money(amount=Decimal('44.48'), currency='USD') BOOK
True True
FrozenInstanceError
ValueError: negative money: -1
Money(amount=Decimal('9.99'), currency='USD') {'sku': 'PEN', 'quantity': 3, 'unit_price': {'amount': Decimal('1.50'), 'currency': 'USD'}}
False ('amount', 'currency')`,
      },
      {
        title: "Inheritance, ABCs, the MRO and protocols",
        variants: [{ lang: "python", code: `from abc import ABC, abstractmethod
from typing import Protocol


class Shape(ABC):  # an abstract base class: can't be instantiated
    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def area(self) -> float: ...

    def describe(self) -> str:  # concrete method shared by all subclasses
        return f"{self.name} with area {self.area():.2f}"


class Rectangle(Shape):
    def __init__(self, w: float, h: float) -> None:
        super().__init__("rectangle")  # run the parent's initializer
        self.w, self.h = w, h

    def area(self) -> float:
        return self.w * self.h


class Square(Rectangle):
    def __init__(self, side: float) -> None:
        super().__init__(side, side)
        self.name = "square"


class Circle(Shape):
    def __init__(self, r: float) -> None:
        super().__init__("circle")
        self.r = r

    def area(self) -> float:
        return 3.14159 * self.r**2


for s in [Rectangle(2, 3), Square(2), Circle(1)]:
    print(s.describe())  # polymorphism: each object answers area() its own way
print(isinstance(Square(1), Rectangle), issubclass(Circle, Shape), Square.__mro__[1].__name__)
try:
    Shape("blob")
except TypeError as e:
    print("TypeError:", "abstract" in str(e))


# Cooperative multiple inheritance: super() follows the MRO, not "the parent".
class Base:
    def save(self) -> list[str]:
        return ["Base"]


class TimestampMixin(Base):
    def save(self) -> list[str]:
        return ["Timestamp"] + super().save()


class AuditMixin(Base):
    def save(self) -> list[str]:
        return ["Audit"] + super().save()


class Document(TimestampMixin, AuditMixin):
    def save(self) -> list[str]:
        return ["Document"] + super().save()


print([c.__name__ for c in Document.__mro__])  # C3 linearization
print(Document().save())


# Protocols: structural typing ("if it quacks like a duck"). No inheritance needed.
class SupportsClose(Protocol):
    def close(self) -> None: ...


class Connection:  # doesn't mention SupportsClose at all
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


def shutdown(resources: list[SupportsClose]) -> int:  # a type checker accepts any object with close()
    for r in resources:
        r.close()
    return len(resources)


print(shutdown([Connection(), Connection()]))` }],
        explain: `- \`Shape\` is an **abstract base class**: \`area\` is abstract, so \`Shape("blob")\` raises \`TypeError\`. \`describe\` is shared code that calls whichever \`area\` the subclass provides: polymorphism.
- \`super().__init__(...)\` runs the parent's initializer. \`Square.__mro__[1]\` is \`Rectangle\`.
- In the diamond \`Document → TimestampMixin, AuditMixin → Base\`, the MRO is Document, TimestampMixin, AuditMixin, Base, object. Each \`save\` calls \`super().save()\`, which means "next in the MRO", so **every** mixin runs exactly once and \`Base\` runs last.
- \`Connection\` never mentions \`SupportsClose\`, yet \`shutdown\` accepts it: a **Protocol** describes the methods needed, and a type checker verifies them structurally. At runtime, duck typing just calls \`close()\`.`,
        output: `rectangle with area 6.00
square with area 4.00
circle with area 3.14
True True Rectangle
TypeError: True
['Document', 'TimestampMixin', 'AuditMixin', 'Base', 'object']
['Document', 'Timestamp', 'Audit', 'Base']
2`,
      },
      {
        title: "Properties, class vs instance attributes, and enums",
        variants: [{ lang: "python", code: `from enum import Enum, IntEnum, StrEnum, auto


class Account:
    interest_rate = 0.02  # CLASS attribute: shared by every instance
    _next_id = 1

    def __init__(self, owner: str, balance: float = 0.0) -> None:
        self.owner = owner  # INSTANCE attributes: one per object
        self.balance = balance  # goes through the property setter below
        self.id = Account._next_id
        Account._next_id += 1
        self.__pin = "1234"  # double underscore: name-mangled to _Account__pin

    @property
    def balance(self) -> float:
        return self._balance

    @balance.setter
    def balance(self, value: float) -> None:  # validation without changing the public API
        if value < 0:
            raise ValueError("balance can't be negative")
        self._balance = value

    @classmethod
    def from_csv(cls, line: str) -> "Account":  # alternative constructor; works for subclasses
        owner, balance = line.split(",")
        return cls(owner, float(balance))

    @staticmethod
    def is_valid_owner(name: str) -> bool:  # a plain function namespaced in the class
        return name.isalpha()

    def __repr__(self) -> str:
        return f"Account(#{self.id}, {self.owner!r}, {self.balance:.2f})"


a = Account("ada", 100)
b = Account.from_csv("bob,50.5")
b.interest_rate = 0.05  # creates an instance attribute that shadows the class one
print(a, b, a.interest_rate, b.interest_rate, Account.interest_rate)
print(Account.is_valid_owner("ada"), Account.is_valid_owner("r2d2"))
try:
    a.balance = -5
except ValueError as e:
    print("ValueError:", e)
print(sorted(k for k in vars(a)), a._Account__pin)


class Status(StrEnum):  # members ARE strings: great for JSON and databases
    PENDING = auto()  # auto() gives the lowercased name for StrEnum
    PAID = auto()
    SHIPPED = auto()


class Priority(IntEnum):
    LOW = 1
    HIGH = 2


class Color(Enum):
    RED = "#ff0000"
    GREEN = "#00ff00"


print(Status.PAID, Status("shipped").name, Status.PAID == "paid", [s.value for s in Status])
print(Priority.HIGH > Priority.LOW, Color.RED.value, Color("#00ff00"), Color.RED in Color)


def next_status(s: Status) -> Status | None:
    match s:
        case Status.PENDING:
            return Status.PAID
        case Status.PAID:
            return Status.SHIPPED
        case _:
            return None


print(next_status(Status.PENDING), next_status(Status.SHIPPED))` }],
        explain: `- \`interest_rate\` is a **class attribute**. \`b.interest_rate = 0.05\` doesn't change the class: it creates an instance attribute on \`b\` that shadows it. \`a\` and the class still see 0.02.
- \`_next_id\` is shared state on the class, used to number accounts.
- The \`balance\` property validates in its setter, and \`__init__\` goes through it too (\`self.balance = balance\`), so invalid objects can't be created.
- \`from_csv\` is a classmethod constructor; \`is_valid_owner\` a staticmethod.
- \`vars(a)\` shows the instance dict: note \`_Account__pin\`, the **mangled** name of \`__pin\`. Mangling avoids clashes with subclasses; it doesn't make anything private.
- \`StrEnum\` members are real strings (\`Status.PAID == "paid"\`, and they print as their value). \`Status("shipped")\` looks a member up by value. \`IntEnum\` members compare like ints. A plain \`Enum\` is neither: \`Color.RED.value\` gives its value.
- \`match\` on enum members gives a readable state machine.`,
        output: `Account(#1, 'ada', 100.00) Account(#2, 'bob', 50.50) 0.02 0.05 0.02
True False
ValueError: balance can't be negative
['_Account__pin', '_balance', 'id', 'owner'] 1234
paid SHIPPED True ['pending', 'paid', 'shipped']
True #ff0000 Color.GREEN True
paid None`,
      },
    ],
    interview: [
      {
        q: "What's the difference between __str__ and __repr__?",
        a: `\`__repr__\` should be **unambiguous**, aimed at developers, ideally valid Python that recreates the object (\`Vector(3.0, 4.0)\`); the REPL, debuggers, logs and containers use it. \`__str__\` is **readable**, for end users, used by \`print()\` and \`str()\`. If you define only one, define \`__repr__\`: \`__str__\` falls back to it. Dataclasses generate \`__repr__\` for you.`,
        freq: "very-common",
      },
      {
        q: "What do @staticmethod, @classmethod and @property do?",
        a: `- \`@classmethod\`: the method receives the class (\`cls\`) instead of an instance. Used for alternative constructors (\`datetime.fromisoformat\`, \`dict.fromkeys\`) that should also work for subclasses.
- \`@staticmethod\`: receives neither; a plain function grouped in the class's namespace.
- \`@property\`: turns a method into a computed attribute (\`obj.area\`), optionally with a setter for validation. It lets you start with public attributes and add logic later without changing callers, which is why Python code doesn't need Java-style getters and setters.`,
        freq: "very-common",
      },
      {
        q: "What is the MRO, and how does super() work with multiple inheritance?",
        a: `The **method resolution order** is the order in which Python searches classes for an attribute, computed with the **C3 linearization**: children before parents, and the left-to-right order of the bases preserved (\`Cls.__mro__\`). \`super()\` returns a proxy for the **next class in the MRO of the instance's type**, not simply the parent. If every class in a diamond calls \`super().method()\`, each runs exactly once, which makes cooperative mixins possible. It also means the methods should accept and pass on \`**kwargs\` when their signatures differ.`,
        freq: "common",
      },
      {
        q: "When would you use a dataclass, a NamedTuple, a plain class or a pydantic model?",
        a: `**Dataclass** for internal records with little behaviour: you get \`__init__\`, \`__repr__\` and \`__eq__\`, plus optional immutability, ordering and slots. **NamedTuple** when you want tuple semantics (unpacking, immutability, use as a dict key). A **plain class** when behaviour and invariants dominate and you want full control. **pydantic** at system boundaries (HTTP bodies, configuration, files), because it validates and converts untrusted input and serializes back.`,
        freq: "common",
      },
      {
        q: "If you override __eq__, what else do you need to think about?",
        a: `\`__hash__\`. Defining \`__eq__\` without \`__hash__\` sets \`__hash__\` to \`None\`, making instances unhashable (they can't be dict keys or set members). If the object is immutable, define \`__hash__\` from the same fields that \`__eq__\` compares, because equal objects **must** have equal hashes. If it's mutable, leave it unhashable: a hash that changes while the object sits in a set breaks the set. Also return \`NotImplemented\` for unknown types instead of \`False\`.`,
        freq: "common",
      },
      {
        q: "What's the difference between an ABC and a Protocol?",
        a: `An **ABC** is nominal: a class must explicitly inherit from it (or be registered), and instantiating a subclass that misses an abstract method fails at runtime. A **Protocol** is structural: any class with the right methods and attributes satisfies it, without inheriting anything, and type checkers verify that statically (\`@runtime_checkable\` adds a basic \`isinstance\` check). Use ABCs for frameworks where you control the base class and want shared implementation; use Protocols to describe what a function needs from its arguments, especially for third-party types.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "class A: items = []. Two instances do a1.items.append(1). What does a2.items contain?",
        options: ["[]", "[1]", "AttributeError", "None"],
        answer: 1,
        explain: "items is a class attribute shared by every instance; append mutates that single list. Create per-instance lists in __init__ or with field(default_factory=list).",
      },
      {
        q: "What does @dataclass(frozen=True) give you?",
        options: ["Faster attribute access only", "Immutable instances that are also hashable", "A class that can't be subclassed", "Automatic JSON serialization"],
        answer: 1,
        explain: "Assigning to a field raises FrozenInstanceError, and with eq=True (the default) a __hash__ is generated, so instances can be set members and dict keys.",
      },
      {
        q: "For 3 * v, where v is a Vector with __mul__ and __rmul__, which method finally runs?",
        options: ["v.__mul__(3)", "v.__rmul__(3)", "int.__mul__(3, v) succeeds", "TypeError always"],
        answer: 1,
        explain: "int.__mul__ returns NotImplemented for a Vector, so Python tries the reflected method on the right operand.",
      },
      {
        q: "Inside class Account, self.__pin = 1 is stored under which attribute name?",
        options: ["__pin", "_pin", "_Account__pin", "It's truly private and not stored in __dict__"],
        answer: 2,
        explain: "Double-underscore names are mangled with the class name to avoid subclass clashes. They're still accessible.",
      },
      {
        q: "In a diamond D(B, C) where B and C both inherit from A and every method calls super(), how many times does A's method run?",
        options: ["0", "1", "2", "It depends on the order of calls"],
        answer: 1,
        explain: "The MRO is D, B, C, A, object; super() walks it in order, so each class runs exactly once.",
      },
    ],
  },

  // ------------------------------------------------------------------ ERRORS
  {
    id: "py-errors",
    stage: "Core",
    title: "Exceptions, context managers, files and logging",
    tagline: "try/except/else/finally, custom exception hierarchies, chaining and exception groups, with statements and contextlib, pathlib, JSON and CSV, and logging done right.",
    difficulty: "intermediate",
    minutes: 40,
    concept: `
## Exceptions: Python's error channel
Errors in Python are **exceptions**: objects that propagate up the call stack until something catches them. If nothing does, the program prints a traceback and exits.
\`\`\`python
try:
    value = risky()
except (KeyError, IndexError) as e:   # catch specific types
    handle(e)
except ValueError:
    raise                             # re-raise the same exception
else:
    use(value)                        # only if no exception
finally:
    cleanup()                         # always
\`\`\`
Rules of thumb:
- Catch the **narrowest** exception you can actually handle. Never use a bare \`except:\` (it even catches \`KeyboardInterrupt\` and \`SystemExit\`); \`except Exception:\` only at the top level of a request or job, together with logging.
- Keep the \`try\` block small, so you don't accidentally catch errors from unrelated lines.
- Python favours **EAFP** ("easier to ask forgiveness than permission"): try \`d[key]\` and catch \`KeyError\`, rather than checking first (LBYL). It's faster when failures are rare and avoids race conditions between the check and the use.

## The hierarchy and custom exceptions
\`BaseException\` is the root; \`SystemExit\`, \`KeyboardInterrupt\` and \`GeneratorExit\` derive directly from it; everything you should normally catch derives from \`Exception\`. Build a small hierarchy for your application (\`AppError\` → \`NotFoundError\`, \`ValidationError\`) so callers can catch broadly or precisely, and store structured data on the exception (ids, field names), not just a message. That's how web frameworks map domain errors to HTTP status codes.

## Chaining
\`raise NewError(...) from e\` records the original as \`__cause__\` and the traceback shows both ("The above exception was the direct cause of..."). Raising inside an \`except\` block without \`from\` chains implicitly (\`__context__\`). \`from None\` hides the internal error when it's just noise. Since 3.11, \`e.add_note("while importing row 7")\` attaches context, and **exception groups** (\`ExceptionGroup\` + \`except*\`) carry several errors at once, which is what \`asyncio.TaskGroup\` raises when tasks fail.

## Context managers: guaranteed cleanup
The \`with\` statement guarantees cleanup no matter how the block exits:
\`\`\`python
with open("data.txt", encoding="utf-8") as f:   # f.close() is guaranteed
    text = f.read()
\`\`\`
Anything with \`__enter__\` and \`__exit__\` is a context manager: files, locks (\`with lock:\`), database transactions, temporary directories, timers, mocks. \`__exit__\` receives the exception (if any) and can suppress it by returning \`True\`. The easiest way to write one is \`@contextlib.contextmanager\`: code before \`yield\` is the setup, code after is the teardown (put it in \`try/finally\` or \`except/else\`). Also in \`contextlib\`: \`suppress(Exc)\`, \`closing(obj)\`, \`ExitStack\` (a dynamic number of contexts), \`nullcontext()\`, and async versions for \`async with\`.

## Files and paths
Use **pathlib**: \`Path("data") / "users.csv"\`, \`.read_text()\`, \`.write_text()\`, \`.exists()\`, \`.glob("*.log")\`, \`.mkdir(parents=True, exist_ok=True)\`. Open files with \`with path.open(mode, encoding="utf-8") as f:\`. Always pass an encoding for text: the default depends on the platform (\`PYTHONUTF8=1\` makes UTF-8 the default, and PEP 686 makes that the standard from Python 3.15). Iterate a file object to read it line by line in constant memory. Modes: \`r\` read, \`w\` write (truncates!), \`a\` append, \`x\` create-only, plus \`b\` for bytes.

The standard library covers common formats: \`json\`, \`csv\` (always \`newline=""\`), \`tomllib\` (read TOML), \`configparser\`, \`sqlite3\`, \`gzip\`/\`zipfile\`/\`tarfile\`, \`pickle\` (never unpickle untrusted data: it can execute code), and \`tempfile\` for scratch files.

## Logging, not print
\`print\` is for programs whose output **is** the result. Services and libraries use \`logging\`: levels (\`DEBUG\` < \`INFO\` < \`WARNING\` < \`ERROR\` < \`CRITICAL\`), a logger per module (\`logging.getLogger(__name__)\`), and configuration in one place (format, destination, level). Pass values as arguments (\`log.info("user %s", uid)\`) so they're only formatted if the message is emitted. Inside \`except\`, \`log.exception("...")\` records the traceback.
`,
    keyPoints: [
      "Catch the narrowest exception you can handle; never a bare except:",
      "else runs on success, finally always runs",
      "raise ... from e keeps the cause; build an AppError hierarchy",
      "with guarantees cleanup; @contextmanager makes writing one easy",
      "pathlib + encoding=\"utf-8\" for files; iterate files line by line",
      "Use logging with per-module loggers instead of print in services",
    ],
    code: [
      {
        title: "Exceptions: hierarchy, chaining, else and finally",
        variants: [{ lang: "python", code: `class AppError(Exception):
    """Base class for this application's errors: callers can catch them all at once."""


class NotFoundError(AppError):
    def __init__(self, kind: str, key: object) -> None:
        super().__init__(f"{kind} {key!r} not found")
        self.kind, self.key = kind, key  # structured data for handlers, not just a message


class ValidationError(AppError):
    pass


USERS = {1: {"name": "ada", "age": "36"}, 2: {"name": "bob", "age": "unknown"}}


def find_user(user_id: int) -> dict:
    try:
        return USERS[user_id]  # EAFP: try it, handle the failure
    except KeyError:
        raise NotFoundError("user", user_id) from None  # hide the internal KeyError


def user_age(user_id: int) -> int:
    raw = find_user(user_id)["age"]
    try:
        return int(raw)
    except ValueError as e:
        raise ValidationError(f"user {user_id} has a bad age") from e  # keep the cause


for uid in [1, 2, 3]:
    try:
        age = user_age(uid)
    except NotFoundError as e:
        print(f"404: {e} (kind={e.kind}, key={e.key})")
    except ValidationError as e:
        print(f"422: {e}; caused by {type(e.__cause__).__name__}: {e.__cause__}")
    else:  # runs only if the try block raised nothing
        print(f"200: user {uid} is {age}")
    finally:  # always runs: success, handled error, or an error flying through
        print(f"   done with {uid}")


def order_of_events() -> str:
    try:
        print("try")
        return "from try"  # finally still runs before the function actually returns
    finally:
        print("finally")


print(order_of_events())

try:
    try:
        1 / 0
    except ZeroDivisionError:
        raise RuntimeError("report failed")  # raised while handling: chained implicitly
except RuntimeError as e:
    print(repr(e), "| context:", repr(e.__context__))

try:
    raise ValueError("price must be positive")
except ValueError as e:
    e.add_note("while importing row 7 of prices.csv")  # 3.11+: extra context in the traceback
    print(e, e.__notes__)

print(issubclass(KeyboardInterrupt, Exception), issubclass(NotFoundError, AppError))` }],
        explain: `- \`AppError\` is the base of the application's exceptions; \`NotFoundError\` stores **structured** fields (\`kind\`, \`key\`) that a handler can use, for example to build a 404 response.
- \`find_user\` is EAFP: it tries the dict lookup and translates \`KeyError\` into a domain error. \`from None\` hides the irrelevant internal \`KeyError\` from the traceback.
- \`user_age\` uses \`from e\`, so the \`ValueError\` from \`int("unknown")\` is preserved as \`__cause__\`.
- In the loop, exactly one of the \`except\`/\`else\` branches runs for each id, and \`finally\` runs every time.
- \`order_of_events\` shows that \`finally\` runs even when the \`try\` block returns; the return value is delivered afterwards.
- Raising inside an \`except\` block chains implicitly: the \`RuntimeError\`'s \`__context__\` is the \`ZeroDivisionError\`.
- \`add_note\` (3.11+) attaches extra context that's printed in the traceback.
- \`KeyboardInterrupt\` is **not** an \`Exception\` subclass, so \`except Exception\` doesn't stop Ctrl-C.`,
        output: `200: user 1 is 36
   done with 1
422: user 2 has a bad age; caused by ValueError: invalid literal for int() with base 10: 'unknown'
   done with 2
404: user 3 not found (kind=user, key=3)
   done with 3
try
finally
from try
RuntimeError('report failed') | context: ZeroDivisionError('division by zero')
price must be positive ['while importing row 7 of prices.csv']
False True`,
      },
      {
        title: "Context managers: class-based, @contextmanager, ExitStack",
        variants: [{ lang: "python", code: `import contextlib
from contextlib import ExitStack, contextmanager, suppress


class Resource:
    """A class-based context manager: __enter__ on the way in, __exit__ on the way out."""

    def __init__(self, name: str) -> None:
        self.name = name

    def __enter__(self) -> "Resource":
        print(f"open {self.name}")
        return self  # bound by \`as\`

    def __exit__(self, exc_type, exc, tb) -> bool:
        print(f"close {self.name}" + (f" after {exc_type.__name__}: {exc}" if exc_type else ""))
        return False  # False: don't swallow the exception


with Resource("db") as r:
    print("using", r.name)

try:
    with Resource("file"):
        raise OSError("disk full")
except OSError:
    print("the error still reached the caller")


@contextmanager  # a generator-based context manager: code before yield = enter, after = exit
def transaction(log: list[str]):
    log.append("BEGIN")
    try:
        yield log
    except Exception:
        log.append("ROLLBACK")
        raise
    else:
        log.append("COMMIT")


log: list[str] = []
with transaction(log):
    log.append("UPDATE accounts ...")
try:
    with transaction(log):
        log.append("UPDATE stock ...")
        raise ValueError("out of stock")
except ValueError as e:
    log.append(f"handled: {e}")
print(log)

with suppress(FileNotFoundError):  # explicitly ignore one exception type
    open("/definitely/not/here.txt")
print("suppressed")

with ExitStack() as stack:  # a dynamic number of context managers, closed in reverse order
    resources = [stack.enter_context(Resource(f"conn{i}")) for i in range(3)]
    stack.callback(print, "callbacks run too")
    print("got", len(resources))


class Pool:
    def close(self) -> None:
        print("pool closed")


with contextlib.closing(Pool()):  # call .close() on exit for objects without __exit__
    print("working")` }],
        explain: `- \`Resource.__enter__\` runs at the start of the \`with\` block and its return value is bound by \`as\`. \`__exit__\` always runs, receiving the exception type, value and traceback if the block failed. Returning \`False\` lets the exception continue to the caller.
- \`transaction\` is a generator-based context manager: setup before \`yield\`, then either \`COMMIT\` (the \`else\` branch) or \`ROLLBACK\` plus re-raise when the block fails. This is exactly how database libraries implement \`with session.begin():\`.
- \`suppress(FileNotFoundError)\` replaces a \`try/except: pass\` that ignores one specific error.
- \`ExitStack\` manages a number of context managers decided at runtime and closes them in **reverse** order (last opened, first closed); \`callback\` registers extra cleanup functions.
- \`closing()\` adapts objects that have \`close()\` but no \`__exit__\`.`,
        output: `open db
using db
close db
open file
close file after OSError: disk full
the error still reached the caller
['BEGIN', 'UPDATE accounts ...', 'COMMIT', 'BEGIN', 'UPDATE stock ...', 'ROLLBACK', 'handled: out of stock']
suppressed
open conn0
open conn1
open conn2
got 3
callbacks run too
close conn2
close conn1
close conn0
working
pool closed`,
      },
      {
        title: "Files with pathlib, JSON and CSV",
        variants: [{ lang: "python", code: `import csv
import json
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as tmp:  # deleted, with its contents, on exit
    root = Path(tmp)
    notes = root / "notes.txt"  # / joins paths
    notes.write_text("first line\\nsecond line\\nthird line\\n", encoding="utf-8")  # always pass the encoding
    print(notes.name, notes.suffix, notes.stem, notes.exists(), notes.stat().st_size, "bytes")

    with notes.open(encoding="utf-8") as f:  # files are iterable, line by line (memory-friendly)
        for number, line in enumerate(f, start=1):
            print(number, line.rstrip("\\n"))

    with notes.open("a", encoding="utf-8") as f:  # modes: r, w (truncate), a (append), x (create), + b for bytes
        f.write("fourth line\\n")
    print(len(notes.read_text(encoding="utf-8").splitlines()), "lines now")

    config = {"debug": True, "workers": 4, "allowed_hosts": ["localhost", "example.com"]}
    (root / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    loaded = json.loads((root / "config.json").read_text(encoding="utf-8"))
    print(loaded["allowed_hosts"][1], loaded == config)

    rows = [{"name": "ada", "lang": "python", "years": 9}, {"name": "linus", "lang": "c", "years": 30}]
    with (root / "devs.csv").open("w", newline="", encoding="utf-8") as f:  # newline="" for csv
        writer = csv.DictWriter(f, fieldnames=["name", "lang", "years"])
        writer.writeheader()
        writer.writerows(rows)
    with (root / "devs.csv").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            print(row["name"], int(row["years"]) * 12, "months")  # csv gives strings: convert

    (root / "data").mkdir()
    for name in ["b.log", "a.log", "c.txt"]:
        (root / "data" / name).touch()
    print(sorted(p.name for p in (root / "data").glob("*.log")))
    print(sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()))
print("temporary directory removed:", not root.exists())` }],
        explain: `- \`TemporaryDirectory()\` gives a scratch folder that's deleted when the \`with\` block ends: ideal for tests and processing jobs.
- \`root / "notes.txt"\` builds paths with the \`/\` operator; \`name\`, \`suffix\`, \`stem\` and \`stat()\` inspect them.
- Opening a file and looping over it reads one line at a time, so it works for files bigger than memory. Lines keep their \`\\n\`, hence \`rstrip("\\n")\`.
- Mode \`"a"\` appends. \`read_text().splitlines()\` is fine for small files.
- \`json.dumps(..., indent=2)\` pretty-prints; \`json.loads\` round-trips to an equal dict.
- \`csv.DictWriter\`/\`DictReader\` map rows to dicts. Open CSV files with \`newline=""\` (the csv module handles line endings itself) and remember every value comes back as a **string**.
- \`glob("*.log")\` matches in one directory, \`rglob("*")\` recursively. \`relative_to\` and \`as_posix\` give portable relative paths.`,
        output: `notes.txt .txt notes True 34 bytes
1 first line
2 second line
3 third line
4 lines now
example.com True
ada 108 months
linus 360 months
['a.log', 'b.log']
['config.json', 'data/a.log', 'data/b.log', 'data/c.txt', 'devs.csv', 'notes.txt']
temporary directory removed: True`,
      },
      {
        title: "Exception groups and except* (3.11+)",
        variants: [{ lang: "python", code: `import asyncio

# 3.11+: an ExceptionGroup carries several unrelated exceptions at once,
# for example from concurrent tasks or from validating many fields.


def validate(user: dict) -> None:
    errors: list[Exception] = []
    if not user.get("email", "").count("@") == 1:
        errors.append(ValueError("email: must contain exactly one @"))
    age = user.get("age")
    if not isinstance(age, int):
        errors.append(TypeError("age: must be an int"))
    elif age < 0:
        errors.append(ValueError("age: must not be negative"))
    if errors:
        raise ExceptionGroup("invalid user", errors)


try:
    validate({"email": "ada-at-example.com", "age": "36"})
except* ValueError as group:  # except* handles the matching PART of the group
    for e in group.exceptions:
        print("value problem:", e)
except* TypeError as group:  # ...and another clause handles the rest
    for e in group.exceptions:
        print("type problem:", e)


async def fetch(name: str, fail: bool) -> str:
    await asyncio.sleep(0.01)
    if fail:
        raise ConnectionError(f"{name} unreachable")
    return name


async def main() -> None:
    try:
        async with asyncio.TaskGroup() as tg:  # TaskGroup raises an ExceptionGroup of task failures
            tg.create_task(fetch("api", fail=False))
            tg.create_task(fetch("cache", fail=True))
            tg.create_task(fetch("search", fail=True))
    except* ConnectionError as group:
        print(sorted(str(e) for e in group.exceptions))


asyncio.run(main())

eg = ExceptionGroup("batch", [KeyError("a"), ValueError("b"), KeyError("c")])
match_keys, rest = eg.split(KeyError)
print(len(match_keys.exceptions), [type(e).__name__ for e in rest.exceptions])` }],
        explain: `- \`validate\` collects **every** problem instead of stopping at the first one, then raises them together in an \`ExceptionGroup\`.
- \`except* ValueError\` handles the \`ValueError\`s inside the group, and \`except* TypeError\` handles the \`TypeError\`s; **both** clauses can run for the same group. Anything unmatched would propagate as a smaller group.
- \`asyncio.TaskGroup\` uses the same mechanism: when tasks fail, the group cancels the remaining tasks and raises an \`ExceptionGroup\` of the failures, and \`except* ConnectionError\` catches them.
- \`eg.split(KeyError)\` divides a group into a matching part and the rest.`,
        output: `value problem: email: must contain exactly one @
type problem: age: must be an int
['cache unreachable', 'search unreachable']
2 ['ValueError']`,
      },
      {
        title: "Logging instead of print",
        variants: [{ lang: "python", code: `import logging
import sys

# Configure once, at the program's entry point. Real services also add %(asctime)s
# and often emit JSON (python-json-logger, structlog) for the log pipeline.
logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(levelname)-7s %(name)s: %(message)s")

log = logging.getLogger("shop.orders")  # one logger per module: logging.getLogger(__name__)


def place_order(order_id: int, qty: int) -> bool:
    log.debug("validating order %s", order_id)  # below INFO: filtered out, and never formatted
    if qty <= 0:
        log.warning("order %s rejected: quantity %d", order_id, qty)  # lazy %-args, not f-strings
        return False
    try:
        if order_id == 3:
            raise ConnectionError("payment gateway timeout")
        log.info("order %s placed (%d items)", order_id, qty)
        return True
    except ConnectionError as e:
        # log.exception(...) would also print the traceback; in an except block it's the usual choice
        log.error("order %s failed: %s", order_id, e)
        return False


results = [place_order(1, 2), place_order(2, 0), place_order(3, 1)]
print(results)

logging.getLogger("shop").setLevel(logging.WARNING)  # loggers form a dotted hierarchy
place_order(4, 1)  # INFO from shop.orders is now dropped
log.warning("still visible")` }],
        explain: `- \`basicConfig\` configures the root logger once, at startup: destination, minimum level and format. Libraries never call it; they just create loggers.
- \`getLogger("shop.orders")\` (normally \`getLogger(__name__)\`) creates a named logger. Names are hierarchical, so setting the \`"shop"\` logger to \`WARNING\` also silences \`"shop.orders"\` INFO messages, as the last lines show.
- The \`debug\` call produces nothing because the level is \`INFO\`, and since the arguments are passed separately (\`"%s", order_id\`), the message isn't even formatted.
- In production you'd add timestamps, send JSON to stdout for the platform's log collector, and use \`log.exception(...)\` inside \`except\` to include the traceback.`,
        output: `INFO    shop.orders: order 1 placed (2 items)
WARNING shop.orders: order 2 rejected: quantity 0
ERROR   shop.orders: order 3 failed: payment gateway timeout
[True, False, False]
WARNING shop.orders: still visible`,
      },
    ],
    interview: [
      {
        q: "What's the difference between except Exception and a bare except:?",
        a: `A bare \`except:\` catches **everything**, including \`BaseException\` subclasses that aren't errors: \`KeyboardInterrupt\` (Ctrl-C), \`SystemExit\` (\`sys.exit()\`), \`GeneratorExit\` and asyncio's \`CancelledError\`. That makes programs impossible to stop and breaks cancellation. \`except Exception:\` catches only real errors. Even that belongs only at top-level boundaries (a request handler, a job runner), with logging; everywhere else catch specific types.`,
        freq: "common",
      },
      {
        q: "When do the else and finally clauses of a try statement run?",
        a: `\`else\` runs only if the \`try\` block completed **without** an exception; put code there that should run on success but whose own exceptions you don't want caught by the preceding \`except\` clauses. \`finally\` runs **always**: after success, after a handled exception, when an exception propagates, and even when the \`try\` block executes \`return\`, \`break\` or \`continue\`. Use it for cleanup, or better, use a context manager.`,
        freq: "common",
      },
      {
        q: "How do you write a context manager? Give two ways.",
        a: `1. A class with \`__enter__\` (returns the resource bound by \`as\`) and \`__exit__(exc_type, exc, tb)\` (cleanup; return \`True\` to suppress the exception).
2. A generator decorated with \`@contextlib.contextmanager\`: code before \`yield\` is setup, the yielded value is bound by \`as\`, and code after is teardown; wrap the \`yield\` in \`try/finally\` so cleanup runs on errors.
\`\`\`python
@contextmanager
def timer(label):
    start = time.perf_counter()
    try:
        yield
    finally:
        print(f"{label}: {time.perf_counter() - start:.3f}s")
\`\`\`
For async resources use \`__aenter__\`/\`__aexit__\` or \`@asynccontextmanager\` with \`async with\`.`,
        freq: "very-common",
      },
      {
        q: "What is EAFP vs LBYL?",
        a: `**LBYL** ("look before you leap") checks first: \`if key in d: value = d[key]\`. **EAFP** ("easier to ask forgiveness than permission") tries and handles failure: \`try: value = d[key] except KeyError: ...\`. Python favours EAFP: it's fast when failures are rare, reads naturally, and avoids race conditions between checking and acting (a file can disappear between \`os.path.exists\` and \`open\`). Use LBYL when failure is common or the check is cheap and clear (\`d.get(key)\` is often best of both).`,
        freq: "occasional",
      },
      {
        q: "Why should you always pass encoding when opening text files?",
        a: `Without it, Python uses the platform's locale encoding: UTF-8 on most Linux and macOS systems, but often a legacy code page like cp1252 on Windows. The same code then reads or writes different bytes on different machines and can crash with \`UnicodeDecodeError\`. Pass \`encoding="utf-8"\` explicitly (or enable UTF-8 mode with \`PYTHONUTF8=1\`; PEP 686 makes it the default from 3.15). Binary data uses \`"rb"\`/\`"wb"\` and \`bytes\`.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "def f(): try: return 1 finally: print('x'). What happens when f() is called?",
        options: ["Returns 1, prints nothing", "Prints x, then returns 1", "Returns None", "SyntaxError"],
        answer: 1,
        explain: "finally runs before the function actually returns, even after a return statement.",
      },
      {
        q: "Which exception does `except Exception:` NOT catch?",
        options: ["ValueError", "KeyError", "KeyboardInterrupt", "ZeroDivisionError"],
        answer: 2,
        explain: "KeyboardInterrupt derives from BaseException, not Exception, so Ctrl-C still stops the program.",
      },
      {
        q: "What does `raise ConfigError(...) from e` do?",
        options: ["Suppresses e", "Stores e as __cause__ so both appear in the traceback", "Re-raises e", "Converts e into a warning"],
        answer: 1,
        explain: "Explicit chaining records the original exception as the cause. Use `from None` to hide it.",
      },
      {
        q: "In a @contextmanager generator, where does teardown code belong so it runs even if the with block raises?",
        options: ["Before the yield", "After the yield, in a finally block", "In __init__", "It can't run on errors"],
        answer: 1,
        explain: "The exception is thrown into the generator at the yield; a try/finally around the yield guarantees cleanup.",
      },
      {
        q: "Opening a CSV file for the csv module, which argument should you pass?",
        options: ["mode='rb'", "newline=''", "buffering=0", "errors='ignore'"],
        answer: 1,
        explain: "The csv module handles line endings itself; newline='' stops Python from translating them (which can create blank rows on Windows).",
      },
      {
        q: "In logging, why write log.info(\"user %s\", uid) instead of log.info(f\"user {uid}\")?",
        options: ["f-strings aren't allowed in logging", "Formatting is skipped if the message is filtered out, and aggregators can group by template", "It's required for thread safety", "It's faster to type"],
        answer: 1,
        explain: "Lazy %-style arguments are only formatted when the record is emitted, and the constant message template groups well in log tools.",
      },
    ],
  },

  // ------------------------------------------------------------------ ITERATORS
  {
    id: "py-iterators",
    stage: "Core",
    title: "Iterators, generators and itertools",
    tagline: "The iteration protocol behind every for loop, lazy generators and pipelines that process huge data in constant memory, yield from, and the itertools toolbox.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["pygen"],
    concept: `
## Iterables and iterators
Two small protocols power every \`for\` loop in Python:
- An **iterable** has \`__iter__()\`, which returns an iterator. Lists, strings, dicts, sets, files, ranges and generators are iterable.
- An **iterator** has \`__next__()\`, which returns the next item or raises \`StopIteration\`, and an \`__iter__()\` that returns itself.

\`for x in xs:\` calls \`iter(xs)\` once, then \`next()\` repeatedly until \`StopIteration\`. Iterators are **one-shot**: once exhausted, they stay empty. Containers are re-iterable because each \`iter()\` call creates a fresh iterator.

## Generators: iterators the easy way
A function containing \`yield\` becomes a **generator function**: calling it returns a generator object and runs nothing. Each \`next()\` resumes the function until the next \`yield\`, which hands out a value and pauses, keeping all local variables. When the function returns, the generator raises \`StopIteration\`.

Generators are **lazy**: they compute values on demand. That gives you:
- **Constant memory**: process a 50 GB log file line by line; a generator object takes about 200 bytes no matter how many items it will produce.
- **Pipelines**: chain stages (\`read → parse → filter → aggregate\`) where each stage pulls from the previous one; nothing is computed until the consumer asks.
- **Infinite sequences**: \`itertools.count()\`, a stream of events, an ID generator.
- **Early exit for free**: if the consumer stops after 3 results, the producers stop too.

A **generator expression** \`(f(x) for x in xs if cond)\` is the lazy cousin of a list comprehension. Pass it directly to a consumer: \`sum(x * x for x in nums)\`, \`any(...)\`, \`max(...)\`, \`"".join(...)\`.

## yield from and generator return values
\`yield from sub()\` re-yields every value of another iterable or generator, which makes recursive generators (tree walks, flattening) natural. If the sub-generator \`return\`s a value, that becomes the value of the \`yield from\` expression. Generators can also receive values with \`gen.send(x)\`, the origin of coroutines; today \`async def\` coroutines (asyncio) replace that use.

## itertools: the iterator algebra
| Function | Does | Example |
|---|---|---|
| \`count\`, \`cycle\`, \`repeat\` | infinite streams | \`zip(count(1), names)\` |
| \`islice(it, n)\` | slice any iterator | first 10 of a generator |
| \`chain\`, \`chain.from_iterable\` | concatenate | flatten one level |
| \`accumulate\` | running totals (or max, product) | prefix sums |
| \`pairwise\` | consecutive pairs (3.10+) | differences, edges of a path |
| \`batched(it, n)\` | chunks of n (3.12+) | bulk database inserts |
| \`groupby\` | runs of equal keys (sort first!) | group log lines by service |
| \`takewhile\`, \`dropwhile\`, \`filterfalse\`, \`compress\` | filtering | |
| \`product\`, \`permutations\`, \`combinations\` | combinatorics | brute force, backtracking checks |
| \`zip_longest\`, \`tee\`, \`starmap\` | zipping and splitting | |

Also remember the built-ins that consume iterators: \`sum\`, \`min\`, \`max\`, \`any\`, \`all\`, \`sorted\`, \`list\`, \`dict\`, \`set\`, \`enumerate\`, \`zip\`, \`map\`, \`filter\`, \`reversed\`, and \`next(it, default)\`.

## When not to use a generator
If you need \`len()\`, indexing, or several passes over the data, materialize a list. Remember that a generator can only be consumed once: passing the same generator to two functions is a classic bug.
`,
    keyPoints: [
      "for calls iter() once, then next() until StopIteration",
      "Iterators are one-shot; containers create a fresh iterator each time",
      "yield turns a function into a lazy generator that pauses and resumes",
      "Generator pipelines process huge inputs in constant memory",
      "yield from delegates to a sub-generator and receives its return value",
      "itertools: islice, chain, groupby (sort first), pairwise, batched, product, combinations",
    ],
    code: [
      {
        title: "The iteration protocol, by hand and with a generator",
        variants: [{ lang: "python", code: `class Countdown:
    """An ITERABLE: __iter__ returns a fresh iterator, so it can be looped over many times."""

    def __init__(self, start: int) -> None:
        self.start = start

    def __iter__(self) -> "CountdownIterator":
        return CountdownIterator(self.start)


class CountdownIterator:
    """An ITERATOR: __next__ returns the next value or raises StopIteration; __iter__ returns self."""

    def __init__(self, current: int) -> None:
        self.current = current

    def __iter__(self) -> "CountdownIterator":
        return self

    def __next__(self) -> int:
        if self.current <= 0:
            raise StopIteration
        self.current -= 1
        return self.current + 1


c = Countdown(3)
print(list(c), list(c))  # iterable: works twice

# What a for loop really does:
it = iter(c)
while True:
    try:
        n = next(it)
    except StopIteration:
        break
    print("got", n)


def countdown(start: int):  # the same thing as a GENERATOR function: far less code
    while start > 0:
        yield start  # pause here, hand out a value, resume on the next next()
        start -= 1


gen = countdown(3)
print(type(gen).__name__, next(gen), next(gen), list(gen), list(gen))  # generators are one-shot iterators
print(next(countdown(0), "empty"))  # next() with a default instead of StopIteration

nums = [1, 2, 3]
it = iter(nums)
print(next(it), list(it), list(it))  # an iterator over a list is also used up after one pass
print(sum(x * x for x in countdown(4)), max(countdown(5)), 2 in countdown(3))` }],
        explain: `- \`Countdown\` is an **iterable**: each \`iter()\` returns a new \`CountdownIterator\`, so \`list(c)\` works twice.
- The \`while True\` loop is exactly what a \`for\` loop does under the hood: \`iter()\`, then \`next()\` until \`StopIteration\`.
- The generator function \`countdown\` produces the same values in four lines: \`yield\` hands out a value and **pauses**, keeping \`start\` alive until the next \`next()\`.
- A generator **is** an iterator, so it's one-shot: after \`next\`, \`next\` and \`list\`, the second \`list(gen)\` is empty. The same is true of \`iter(nums)\`.
- \`next(iterator, default)\` returns the default instead of raising when the iterator is exhausted.
- Consumers like \`sum\`, \`max\` and \`in\` work on any iterator.`,
        output: `[3, 2, 1] [3, 2, 1]
got 3
got 2
got 1
generator 3 2 [1] []
empty
1 [2, 3] []
30 5 True`,
      },
      {
        title: "Lazy pipelines over a million lines",
        variants: [{ lang: "python", code: `import sys


lines_read = 0


def read_lines(n: int):
    """Pretend to stream a huge log file one line at a time."""
    global lines_read
    for i in range(1, n + 1):
        lines_read += 1
        status = 500 if i % 7 == 0 else 404 if i % 5 == 0 else 200
        yield f"GET /page/{i % 4} {status} {i * 3}ms"


def parse(lines):
    for line in lines:
        method, path, status, ms = line.split()
        yield {"path": path, "status": int(status), "ms": int(ms.removesuffix("ms"))}


def errors(records):
    return (r for r in records if r["status"] >= 500)  # a generator expression in a function


# Building the pipeline does NO work yet: each stage is lazy.
pipeline = errors(parse(read_lines(1_000_000)))
print("pipeline built, lines read:", lines_read)

first_three = [next(pipeline) for _ in range(3)]  # pulls only as many lines as needed
print(first_three)
print("lines read:", lines_read, "of 1,000,000")

# Memory: a list holds every element, a generator holds only its current state.
squares_list = [n * n for n in range(1_000_000)]
squares_gen = (n * n for n in range(1_000_000))
print(sys.getsizeof(squares_list) > 8_000_000, sys.getsizeof(squares_gen) < 500)
print(sum(squares_gen) == sum(squares_list))

# Practical pattern: process a file in fixed-size chunks without loading it
import itertools

records = parse(read_lines(25))
for batch in itertools.batched(records, 10):  # 3.12+
    slow = sum(1 for r in batch if r["ms"] > 30)
    print(f"batch of {len(batch)}: {slow} slow")` }],
        explain: `- Each stage (\`read_lines\`, \`parse\`, \`errors\`) takes an iterable and yields results; chaining them builds a **pipeline**.
- Building it reads **zero** lines: generators don't start until someone asks for a value.
- Asking for the first three errors pulls just 21 of the million lines (errors are on every 7th line). The rest is never generated.
- A million squares in a list take about 8 MB of pointers (plus the int objects); the generator object is a couple of hundred bytes whatever its length.
- \`itertools.batched(records, 10)\` (3.12+) groups a stream into chunks: the usual way to do bulk inserts or API calls in batches.`,
        output: `pipeline built, lines read: 0
[{'path': '/page/3', 'status': 500, 'ms': 21}, {'path': '/page/2', 'status': 500, 'ms': 42}, {'path': '/page/1', 'status': 500, 'ms': 63}]
lines read: 21 of 1,000,000
True True
True
batch of 10: 0 slow
batch of 10: 10 slow
batch of 5: 5 slow`,
      },
      {
        title: "The itertools tour",
        variants: [{ lang: "python", code: `import itertools as it
import operator

print(list(it.islice(it.count(10, 5), 4)))  # infinite counter, sliced lazily
print(list(it.islice(it.cycle("AB"), 5)), list(it.repeat("x", 3)))
print(list(it.chain([1, 2], (3, 4), "ab")), list(it.chain.from_iterable([[1], [2, 3]])))
print(list(it.accumulate([1, 2, 3, 4])), list(it.accumulate([3, 1, 4, 1, 5], max)))  # running sum / max
print(list(it.pairwise([1, 4, 9, 16])))  # consecutive pairs (3.10+)
print(list(it.batched(range(7), 3)))  # fixed-size chunks (3.12+)
print(list(it.takewhile(lambda x: x < 3, [1, 2, 3, 1])), list(it.dropwhile(lambda x: x < 3, [1, 2, 3, 1])))
print(list(it.compress("abcdef", [1, 0, 1, 0, 1, 1])), list(it.zip_longest("ab", "xyz", fillvalue="-")))

# groupby groups CONSECUTIVE equal keys: sort by the same key first
logs = [("api", 3), ("db", 7), ("api", 5), ("db", 1), ("cache", 2)]
logs.sort(key=operator.itemgetter(0))
for service, group in it.groupby(logs, key=operator.itemgetter(0)):
    print(service, sum(ms for _, ms in group), end="; ")
print()

# combinatorics: the interview favourites
print(list(it.product("ab", [0, 1])))
print(list(it.permutations([1, 2, 3], 2)))
print(list(it.combinations("abcd", 2)), len(list(it.combinations(range(10), 3))))
print(list(it.combinations_with_replacement("ab", 2)))

a, b = it.tee(iter([1, 2, 3]))  # split one iterator into two independent ones
print(list(a), list(b))
print(list(it.starmap(pow, [(2, 3), (3, 2)])), list(it.filterfalse(str.isdigit, "a1b2")))` }],
        explain: `- \`count\` and \`cycle\` are infinite, so \`islice\` takes a finite piece lazily.
- \`chain\` concatenates iterables of any kind; \`accumulate\` gives running sums, or running maxima with \`max\`.
- \`pairwise\` yields neighbours (great for differences or path edges), \`batched\` yields fixed-size tuples with a shorter last one.
- \`takewhile\` stops at the first failure; \`dropwhile\` skips until the first failure and then yields everything.
- \`groupby\` only groups **consecutive** equal keys, which is why the logs are sorted by service first. Each group is an iterator, consumed here by \`sum\`.
- \`product\` is nested loops, \`permutations\` order matters, \`combinations\` order doesn't: C(10, 3) = 120.
- \`tee\` splits one iterator into independent copies (it buffers values one copy has seen and the other hasn't).`,
        output: `[10, 15, 20, 25]
['A', 'B', 'A', 'B', 'A'] ['x', 'x', 'x']
[1, 2, 3, 4, 'a', 'b'] [1, 2, 3]
[1, 3, 6, 10] [3, 3, 4, 4, 5]
[(1, 4), (4, 9), (9, 16)]
[(0, 1, 2), (3, 4, 5), (6,)]
[1, 2] [3, 1]
['a', 'c', 'e', 'f'] [('a', 'x'), ('b', 'y'), ('-', 'z')]
api 8; cache 2; db 8; 
[('a', 0), ('a', 1), ('b', 0), ('b', 1)]
[(1, 2), (1, 3), (2, 1), (2, 3), (3, 1), (3, 2)]
[('a', 'b'), ('a', 'c'), ('a', 'd'), ('b', 'c'), ('b', 'd'), ('c', 'd')] 120
[('a', 'a'), ('a', 'b'), ('b', 'b')]
[1, 2, 3] [1, 2, 3]
[8, 9] ['a', 'b']`,
      },
      {
        title: "yield from, recursive generators and send()",
        variants: [{ lang: "python", code: `from dataclasses import dataclass, field


@dataclass
class Node:
    value: str
    children: list["Node"] = field(default_factory=list)


def walk(node: Node, depth: int = 0):
    """Depth-first traversal as a recursive generator."""
    yield depth, node.value
    for child in node.children:
        yield from walk(child, depth + 1)  # delegate: re-yield everything the sub-generator yields


tree = Node("src", [Node("app", [Node("main.py"), Node("db.py")]), Node("tests", [Node("test_db.py")])])
for depth, name in walk(tree):
    print("  " * depth + name)
print([name for _, name in walk(tree) if name.endswith(".py")])


def flatten(items):
    for item in items:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item


print(list(flatten([1, [2, [3, [4, 5]], 6], [[7]]])))


def read_until_blank(lines):
    count = 0
    for line in lines:
        if not line:
            return count  # a generator's return value travels inside StopIteration...
        count += 1
        yield line.upper()


def with_summary(lines):
    n = yield from read_until_blank(lines)  # ...and becomes the value of yield from
    yield f"[{n} lines]"


print(list(with_summary(["a", "b", "", "ignored"])))


def running_average():
    """A generator you SEND values into: a coroutine in the original sense."""
    total, count, average = 0.0, 0, None
    while True:
        value = yield average
        total += value
        count += 1
        average = total / count


avg = running_average()
next(avg)  # prime it: run to the first yield
print([avg.send(x) for x in [10, 20, 60]])` }],
        explain: `- \`walk\` traverses a tree depth-first; \`yield from walk(child, depth + 1)\` passes along everything the recursive call yields. The caller sees one flat stream of \`(depth, name)\` pairs and can filter it.
- \`flatten\` handles arbitrarily nested lists the same way.
- A generator's \`return count\` value rides inside \`StopIteration\`; \`yield from\` catches it and makes it the value of the expression, so \`with_summary\` can append \`[2 lines]\`. Note that \`"ignored"\` after the blank line is never read.
- \`running_average\` receives values with \`send()\`: \`value = yield average\` hands out the current average and waits for the next number. The first \`next()\` "primes" the generator by running it to its first \`yield\`. This is the ancestor of \`async def\` coroutines.`,
        output: `src
  app
    main.py
    db.py
  tests
    test_db.py
['main.py', 'db.py', 'test_db.py']
[1, 2, 3, 4, 5, 6, 7]
['A', 'B', '[2 lines]']
[10.0, 15.0, 30.0]`,
      },
    ],
    interview: [
      {
        q: "What's the difference between an iterable and an iterator?",
        a: `An **iterable** can produce an iterator: it implements \`__iter__\` (or the legacy \`__getitem__\` protocol). Lists, dicts, strings and files are iterables. An **iterator** produces values one at a time with \`__next__\`, raises \`StopIteration\` when done, and its \`__iter__\` returns itself. Containers are re-iterable because each \`iter()\` call returns a new iterator; an iterator (including any generator) is exhausted after one pass.`,
        freq: "very-common",
      },
      {
        q: "What is a generator and why would you use one?",
        a: `A function containing \`yield\`. Calling it returns a generator object without running the body; each \`next()\` runs until the next \`yield\`, then pauses with all local state intact. Use generators for **lazy** sequences: streaming large files or query results in constant memory, infinite sequences, and pipelines where each stage pulls from the previous one and work stops as soon as the consumer has enough. Generator expressions \`(x for x in xs)\` are the inline form.`,
        freq: "very-common",
      },
      {
        q: "List comprehension or generator expression: how do you choose?",
        a: `A list comprehension builds the whole list immediately: use it when you need the results more than once, need \`len\`/indexing, or the data is small. A generator expression produces items on demand: use it when you consume the values once, especially in a reducing function (\`sum\`, \`any\`, \`max\`, \`"".join\`) or over large or infinite data. \`any(check(x) for x in xs)\` can also stop early, while \`any([check(x) for x in xs])\` evaluates every check first.`,
        freq: "common",
      },
      {
        q: "What does yield from do?",
        a: `\`yield from iterable\` yields every item of the iterable, so a generator can delegate to another one (recursive tree walks, flattening). With a sub-generator it also forwards \`send()\` and \`throw()\` calls, and the sub-generator's \`return\` value becomes the value of the \`yield from\` expression. Before \`async\`/\`await\`, this delegation was how asyncio coroutines were chained.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "g = (x * 2 for x in range(3)); list(g); list(g). What does the second list(g) return?",
        options: ["[0, 2, 4]", "[]", "None", "StopIteration is raised"],
        answer: 1,
        explain: "A generator is a one-shot iterator: after the first list() consumes it, it yields nothing.",
      },
      {
        q: "When does the body of a generator function start running?",
        options: ["When the function is called", "On the first next() (or for-loop iteration)", "When the generator is garbage collected", "At import time"],
        answer: 1,
        explain: "Calling a generator function only creates the generator object; execution starts at the first next().",
      },
      {
        q: "Why sort before itertools.groupby?",
        options: ["groupby only accepts lists", "groupby only groups consecutive items with equal keys", "To make it faster", "groupby sorts descending otherwise"],
        answer: 1,
        explain: "Unsorted input produces several groups for the same key, one per run.",
      },
      {
        q: "Which expression uses the least memory to sum the squares of 10 million numbers?",
        options: ["sum([n * n for n in range(10**7)])", "sum(n * n for n in range(10**7))", "sum(list(map(lambda n: n * n, range(10**7))))", "They use the same memory"],
        answer: 1,
        explain: "The generator expression never builds a list; it produces one square at a time.",
      },
      {
        q: "What does itertools.pairwise([1, 4, 9]) yield?",
        options: ["(1, 4), (9, None)", "(1, 4), (4, 9)", "(1, 4, 9)", "[1, 4], [4, 9]"],
        answer: 1,
        explain: "pairwise yields overlapping consecutive pairs.",
      },
    ],
  },

  // ------------------------------------------------------------------ TYPING
  {
    id: "py-typing",
    stage: "Core",
    title: "Type hints, mypy and pydantic",
    tagline: "Annotate code so tools catch bugs before it runs: unions, generics with the 3.12 syntax, TypedDict, Protocol, overloads, and runtime validation with pydantic.",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## Optional static typing
Python is dynamically typed, but since 3.5 you can **annotate** code with types:
\`\`\`python
def find_user(user_id: int, active_only: bool = True) -> User | None: ...
\`\`\`
The interpreter **does not check** annotations: it stores them (\`func.__annotations__\`) and moves on. A separate **type checker** reads them and reports errors before the code runs:
- **mypy**: the original, configurable from lenient to \`--strict\`.
- **pyright** (and Pylance in VS Code): fast, powers editor completions and errors as you type.
- **ty** and **pyrefly**: newer, very fast checkers written in Rust, from Astral and Meta.

Why bother? Type hints catch whole classes of bugs (None handling, wrong argument types, typos in attribute names), make refactoring safe, document intent, and power editor autocompletion. Large Python codebases (Instagram, Dropbox, most of PyPI's popular libraries) are typed. Add hints gradually: start with function signatures.

## The vocabulary
| Hint | Meaning |
|---|---|
| \`int\`, \`str\`, \`bool\`, \`bytes\`, \`None\` | the type itself |
| \`list[int]\`, \`dict[str, float]\`, \`set[str]\`, \`tuple[int, str]\`, \`tuple[int, ...]\` | built-in generics (3.9+) |
| \`int \\| None\` | a union (3.10+); same as \`Optional[int]\` |
| \`Sequence[T]\`, \`Iterable[T]\`, \`Mapping[K, V]\`, \`Callable[[int], str]\` | abstract types from \`collections.abc\`: accept the widest type you can |
| \`Any\` | turn checking off for this value |
| \`Literal["r", "w"]\` | only these exact values |
| \`Final\` / \`ClassVar\` | can't be reassigned / belongs to the class |
| \`TypedDict\` | the shape of a dict (JSON payloads) |
| \`Protocol\` | structural interface: "anything with these methods" |
| \`Self\` | the current class, for fluent methods |
| \`@overload\` | several signatures for one function |
| \`@override\` (3.12) | assert that a method overrides a parent's |
| \`NewType("UserId", int)\` | a distinct type for the checker, an int at runtime |

## Generics with the 3.12 syntax
\`\`\`python
def first[T](items: Sequence[T]) -> T: ...      # T is a type parameter
class Stack[T]: ...                              # generic class
type Pair[K, V] = tuple[K, V]                    # generic type alias
def largest[T: (int, float)](xs: list[T]) -> T  # constrained
\`\`\`
Before 3.12 you declared \`T = TypeVar("T")\` and inherited from \`Generic[T]\`; you'll still see that in older code.

## Runtime validation with pydantic
Type checkers can't check data that arrives at runtime: JSON bodies, environment variables, CSV rows, LLM outputs. **pydantic** uses the same annotations to **validate and convert** data when it enters your program:
\`\`\`python
class SignUp(BaseModel):
    username: str = Field(min_length=3)
    age: int = Field(ge=13)
user = SignUp.model_validate_json(body)   # raises ValidationError with every problem listed
\`\`\`
It converts compatible input (\`"36"\` becomes \`36\`, an ISO string becomes a \`date\`), reports every invalid field with a location and an error type, serializes back with \`model_dump()\`/\`model_dump_json()\`, and generates JSON Schema. Its core is written in Rust, so it's fast. FastAPI, the OpenAI and Anthropic SDKs, LangChain and many others are built on it. **pydantic-settings** reads typed configuration from environment variables.

## Which record type?
| | Validation | Conversion | Speed | Use for |
|---|---|---|---|---|
| \`dataclass\` | none (add \`__post_init__\`) | none | fastest | internal data |
| \`TypedDict\` | static only | none | it's a dict | typing JSON-like dicts |
| \`NamedTuple\` | none | none | fast | small immutable records |
| \`pydantic.BaseModel\` | yes | yes | fast (Rust core) | data crossing a boundary: APIs, config, files |
| \`attrs\` | optional validators | optional converters | fast | dataclasses with more features |
| \`msgspec.Struct\` | yes | yes | fastest | high-throughput JSON/MessagePack |
`,
    keyPoints: [
      "Hints are checked by tools (mypy, pyright), never by the interpreter",
      "Use int | None, list[str], dict[str, int]; accept Sequence/Iterable, return concrete types",
      "3.12 generics: def first[T](xs: Sequence[T]) -> T and type Alias = ...",
      "TypedDict for dict shapes, Protocol for structural interfaces, Literal for fixed values",
      "pydantic validates and converts untrusted data at the boundaries",
      "Add hints gradually, starting with function signatures",
    ],
    code: [
      {
        title: "A typed toolkit: generics, aliases, TypedDict, Protocol, overload",
        note: "Uses the Python 3.12 syntax for type parameters.",
        variants: [{ lang: "python", code: `from collections.abc import Callable, Iterable, Iterator, Sequence
from typing import Literal, NotRequired, Protocol, TypedDict, overload

# Built-in generics and unions need no imports: list[int], dict[str, float], int | None.
def mean(values: Sequence[float]) -> float | None:
    return sum(values) / len(values) if values else None


# PEP 695 (3.12+): type parameters in brackets, no TypeVar boilerplate.
def first[T](items: Iterable[T], default: T) -> T:
    for item in items:
        return item
    return default


class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def __iter__(self) -> Iterator[T]:
        return reversed(self._items)


type Handler = Callable[[str], str]  # a type alias statement (3.12+)
type Pair[K, V] = tuple[K, V]


def apply_all(text: str, handlers: list[Handler]) -> str:
    for handle in handlers:
        text = handle(text)
    return text


class Movie(TypedDict):  # the shape of a dict, e.g. parsed JSON
    title: str
    year: int
    rating: NotRequired[float]


Mode = Literal["r", "w", "a"]  # only these exact values


def open_log(path: str, mode: Mode = "r") -> str:
    return f"opening {path} in {mode!r} mode"


class Greeter(Protocol):
    def greet(self, name: str) -> str: ...


class English:
    def greet(self, name: str) -> str:
        return f"Hello, {name}"


def welcome(g: Greeter, name: str) -> str:  # any object with a matching greet() is accepted
    return g.greet(name)


@overload
def parse(raw: str) -> int: ...
@overload
def parse(raw: bytes) -> str: ...
def parse(raw: str | bytes) -> int | str:  # the real implementation
    return int(raw) if isinstance(raw, str) else raw.decode()


s = Stack[int]()
for n in (1, 2, 3):
    s.push(n)
pair: Pair[str, int] = ("answer", 42)
movie: Movie = {"title": "Arrival", "year": 2016}
print(mean([1.5, 2.5]), mean([]), first([], default="none"), first("xyz", "?"))
print(s.pop(), list(s), pair, movie.get("rating", "unrated"))
print(apply_all("  Hello  ", [str.strip, str.upper]), open_log("app.log", "a"))
print(welcome(English(), "Ada"), parse("41") + 1, parse(b"bytes"))
print(first.__type_params__, Stack.__type_params__, Handler.__value__)` }],
        explain: `- \`mean\` accepts any \`Sequence[float]\` (a list, tuple...) and returns \`float | None\`: a checker will force callers to handle the \`None\`.
- \`first[T]\` and \`Stack[T]\` use the 3.12 **type parameter** syntax. A checker knows \`first(["a"], "?")\` returns a \`str\` and that \`Stack[int]().pop()\` returns an \`int\`. At runtime, \`Stack[int]()\` just creates a Stack.
- \`type Handler = Callable[[str], str]\` declares an alias lazily (\`Handler.__value__\`); \`type Pair[K, V]\` is a generic alias.
- \`Movie\` is a \`TypedDict\`: still a plain dict at runtime, but the checker knows its keys and value types, and \`NotRequired\` marks optional keys.
- \`Literal["r", "w", "a"]\` lets the checker reject \`open_log("x", "rw")\`.
- \`Greeter\` is a Protocol: \`English\` satisfies it without inheriting.
- \`@overload\` tells the checker that a \`str\` argument gives an \`int\` and \`bytes\` gives a \`str\`; only the last, undecorated definition runs.`,
        output: `2.0 None none x
3 [2, 1] ('answer', 42) unrated
HELLO opening app.log in 'a' mode
Hello, Ada 42 bytes
(T,) (T,) collections.abc.Callable[[str], str]`,
      },
      {
        title: "Hints aren't enforced at runtime",
        variants: [{ lang: "python", code: `from typing import get_type_hints


def greet(name: str, times: int = 1) -> str:
    return ("Hello, " + name + "! ") * times


# Hints are NOT checked when the program runs. All of these execute:
print(greet("Ada", 2))
print(greet("Ada", times=True))  # bool is a subclass of int

try:
    greet(42)  # fails INSIDE the function, at the + operator: no early, clear error
except TypeError as e:
    print("TypeError:", e)

# Hints are just metadata that tools (and libraries like pydantic or FastAPI) read:
print(get_type_hints(greet))


def total_price(prices: list[float]) -> float:
    total = 0
    for p in prices:
        total += p
    return total


print(total_price([1.5, 2.25]), total_price([]))  # returns the int 0 for an empty list` }],
        explain: `Python happily runs every one of these calls; only \`greet(42)\` fails, and only deep inside the function at the \`+\`. A type checker would have reported the problems before running anything. With mypy, the output looks like:
\`\`\`text
not_enforced.py:13: error: Argument 1 to "greet" has incompatible type "int"; expected "str"  [arg-type]
\`\`\`
\`greet("Ada", times=True)\` is accepted even by mypy, because \`bool\` is a subclass of \`int\`.

\`total_price([])\` returns the **int** \`0\` although the hint promises a float, because \`total\` starts as \`0\`. Starting with \`total = 0.0\`, or just \`return sum(prices, 0.0)\`, fixes it.

\`get_type_hints\` shows that annotations are ordinary runtime data: this is what pydantic, FastAPI, dataclasses and typer read to do their magic.`,
        output: `Hello, Ada! Hello, Ada! 
Hello, Ada! 
TypeError: can only concatenate str (not "int") to str
{'name': <class 'str'>, 'times': <class 'int'>, 'return': <class 'str'>}
3.75 0`,
      },
      {
        title: "Validating untrusted data with pydantic",
        variants: [{ lang: "python", code: `from datetime import date

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator


class Address(BaseModel):
    city: str
    country: str = Field(min_length=2, max_length=2, description="ISO country code")


class SignUp(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=r"^[a-z0-9_]+$")
    email: str
    age: int = Field(ge=13, le=130)
    birthday: date | None = None
    tags: list[str] = []  # safe in pydantic: defaults are copied per instance
    address: Address | None = None
    password: str = Field(min_length=8, repr=False)
    password_again: str = Field(repr=False)

    @field_validator("email")
    @classmethod
    def email_has_at(cls, v: str) -> str:
        if v.count("@") != 1:
            raise ValueError("must contain one @")
        return v.lower()

    @model_validator(mode="after")  # runs after all fields are validated: cross-field checks
    def passwords_match(self) -> "SignUp":
        if self.password != self.password_again:
            raise ValueError("passwords don't match")
        return self


raw_json = """{"username": "ada_l", "email": "Ada@Example.com", "age": "36",
               "birthday": "1990-12-10", "address": {"city": "London", "country": "GB"},
               "password": "correct horse", "password_again": "correct horse"}"""
user = SignUp.model_validate_json(raw_json)  # parse + validate + convert in one step
print(user)
print(user.age + 1, user.birthday.year, user.address.city)  # "36" became 36, the string became a date
print(user.model_dump(include={"username", "email", "address"}))
print(user.model_dump_json(exclude={"password", "password_again"}))

try:
    SignUp(username="A!", email="nope", age=8, password="short", password_again="short")
except ValidationError as e:
    print(e.error_count(), "errors")
    for err in e.errors():
        print(" ", ".".join(map(str, err["loc"])), "->", err["type"])

try:
    SignUp(username="bob", email="b@x.io", age=30, password="12345678", password_again="87654321")
except ValidationError as e:
    print(e.errors()[0]["msg"])

print(list(SignUp.model_json_schema()["properties"])[:4])  # JSON Schema for free (FastAPI uses this)` }],
        explain: `- Each field's type **and** \`Field(...)\` constraints describe valid input: lengths, a regex pattern, numeric bounds.
- \`@field_validator\` adds custom per-field logic (and can normalize, here lowercasing the email). \`@model_validator(mode="after")\` checks rules that span fields, like matching passwords.
- \`model_validate_json\` parses JSON **and** validates in one fast step (the core is written in Rust). Compatible values are converted: the string \`"36"\` becomes the int 36, \`"1990-12-10"\` becomes a \`date\`, and the nested dict becomes an \`Address\`.
- \`repr=False\` keeps the passwords out of the printed model and logs. \`model_dump\`/\`model_dump_json\` serialize back, with \`include\`/\`exclude\`.
- Invalid input raises **one** \`ValidationError\` listing every failing field with its location and an error type, which is exactly what an API should return to the client. (FastAPI does this for you with status 422.)
- \`model_json_schema()\` generates JSON Schema from the model; FastAPI uses it for the OpenAPI docs. For email fields, pydantic also offers \`EmailStr\` with the \`pydantic[email]\` extra.`,
        output: `username='ada_l' email='ada@example.com' age=36 birthday=datetime.date(1990, 12, 10) tags=[] address=Address(city='London', country='GB')
37 1990 London
{'username': 'ada_l', 'email': 'ada@example.com', 'address': {'city': 'London', 'country': 'GB'}}
{"username":"ada_l","email":"ada@example.com","age":36,"birthday":"1990-12-10","tags":[],"address":{"city":"London","country":"GB"}}
4 errors
  username -> string_too_short
  email -> value_error
  age -> greater_than_equal
  password -> string_too_short
Value error, passwords don't match
['username', 'email', 'age', 'birthday']`,
      },
    ],
    interview: [
      {
        q: "Does Python enforce type hints? Then why use them?",
        a: `No. The interpreter stores annotations and ignores them (apart from libraries that read them on purpose, like pydantic and FastAPI). They're checked statically by tools like mypy and pyright, in the editor and in CI. Benefits: bugs (wrong types, unhandled \`None\`, typos in attribute names) are caught before running; refactoring large codebases becomes safe; signatures document themselves; editors autocomplete accurately. They cost nothing at runtime.`,
        freq: "very-common",
      },
      {
        q: "What's the difference between Optional[int], int | None, and a parameter with a default of None?",
        a: `\`Optional[int]\` and \`int | None\` (3.10+) mean the same thing: the value may be an \`int\` or \`None\`. That says nothing about whether an argument is **required**. A parameter \`x: int | None\` without a default must still be passed; \`x: int | None = None\` can be omitted. Modern code prefers the \`|\` syntax.`,
        freq: "common",
      },
      {
        q: "What is a Protocol, and how is it different from inheriting from a base class?",
        a: `\`typing.Protocol\` defines an interface **structurally**: any class whose methods and attributes match is considered compatible, even if it never mentions the protocol. It's static duck typing. Inheritance (or ABCs) is **nominal**: the class must declare the relationship. Protocols are ideal for describing what a function needs from its argument ("anything with \`read()\`"), including third-party classes you can't modify.`,
        freq: "common",
      },
      {
        q: "Why use pydantic if you already have type hints and dataclasses?",
        a: `Type checkers only verify your own code. Data from outside (HTTP bodies, environment variables, files, message queues, LLM output) arrives at runtime as untyped JSON or strings. pydantic **validates and converts** it against your models when it enters, raising a detailed error listing every invalid field, and serializes back. Dataclasses do no validation. Use pydantic at the edges of the system and plain dataclasses inside.`,
        freq: "common",
      },
      {
        q: "How would you introduce typing into a large untyped codebase?",
        a: `Gradually. Add mypy or pyright to CI in a lenient mode, so unannotated functions aren't checked. Annotate the most-used modules and public function signatures first, plus new code. Use \`reveal_type\` and \`# type: ignore[code]\` sparingly, install stubs for third-party libraries (\`types-requests\`), and tighten settings module by module (\`[[tool.mypy.overrides]]\` with \`disallow_untyped_defs = true\`) until you can turn on \`strict\` everywhere.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "def f(x: int) -> int: return x * 2. What does f(\"ab\") do at runtime?",
        options: ["Raises TypeError before running", "Returns \"abab\"", "Returns 0", "Raises ValueError"],
        answer: 1,
        explain: "Hints are not enforced at runtime; str * 2 is string repetition. A type checker would flag the call.",
      },
      {
        q: "Which is the Python 3.12 way to write a generic function?",
        options: ["def first<T>(xs: list<T>) -> T", "def first[T](xs: list[T]) -> T", "def first(xs: list[T]) -> T with no declaration", "@generic(T) def first(xs) -> T"],
        answer: 1,
        explain: "PEP 695 puts type parameters in square brackets after the name; older code used TypeVar.",
      },
      {
        q: "What should you use to describe the keys and value types of a JSON-like dict?",
        options: ["dict[str, Any]", "TypedDict", "NamedTuple", "Protocol"],
        answer: 1,
        explain: "TypedDict declares the shape of a dict for type checkers while keeping it a plain dict at runtime.",
      },
      {
        q: "A pydantic model has age: int and receives {\"age\": \"36\"}. What happens by default?",
        options: ["ValidationError", "age becomes the int 36", "age stays the string \"36\"", "age becomes None"],
        answer: 1,
        explain: "pydantic's default (lax) mode converts compatible values. Use strict mode or StrictInt to reject strings.",
      },
      {
        q: "Which parameter type is the most flexible for a function that only loops over its input once?",
        options: ["list[int]", "Iterable[int]", "tuple[int, ...]", "set[int]"],
        answer: 1,
        explain: "Accept the most general type you need (Iterable), and return concrete types. That lets callers pass lists, tuples, sets or generators.",
      },
    ],
  },

  // ------------------------------------------------------------------ TESTING
  {
    id: "py-testing",
    stage: "Core",
    title: "Testing with pytest, and the project toolchain",
    tagline: "Write fast, readable tests with pytest: parametrize, fixtures, tmp_path, monkeypatch, mocks and fakes. Then set up a real project with pyproject.toml, uv, ruff and mypy.",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## Why tests matter even more in Python
With no compiler checking types, a typo in a rarely-run branch only shows up when that branch runs, maybe in production. Tests are how Python teams get confidence. The standard library has \`unittest\` (xUnit style, with classes), but the community standard is **pytest**: plain functions, plain \`assert\`, and powerful fixtures.

## pytest essentials
- Files named \`test_*.py\`, functions named \`test_*\`: pytest discovers them automatically (\`pytest\`, \`pytest -q\`, \`pytest -k slug\`, \`pytest tests/test_api.py::test_create -x\`).
- **Plain \`assert\`**: pytest rewrites asserts to show both sides on failure (\`assert 'hello-world' == 'hello_world'\` with a diff).
- \`pytest.raises(ValueError, match="...")\` checks for exceptions; \`pytest.approx\` compares floats.
- \`@pytest.mark.parametrize\` turns one test into many cases, each reported separately.
- Marks: \`skip\`, \`skipif(condition, reason=...)\`, \`xfail\` (expected to fail), and custom marks (\`@pytest.mark.slow\`) selected with \`-m\`.

## Fixtures
A fixture is a function that provides something a test needs; a test asks for it by naming it as a parameter. Code before \`yield\` is setup, after is teardown (it runs even if the test fails). Fixtures can use other fixtures, have a **scope** (\`function\` by default, or \`module\`, \`session\` for expensive things like a database container), and live in \`conftest.py\` to be shared by a whole directory. Built-in fixtures you'll use constantly:
| Fixture | Gives you |
|---|---|
| \`tmp_path\` | a fresh temporary directory (\`pathlib.Path\`) |
| \`monkeypatch\` | set env vars, attributes, dict items; undone after the test |
| \`capsys\` / \`caplog\` | captured stdout/stderr / log records |

## Test doubles: mocks, stubs and fakes
Unit tests shouldn't hit the network, the clock or a real payment provider. Options, from most to least preferred:
1. **Design for injection**: pass collaborators in (\`WeatherService(client)\`), then pass a **fake**: a tiny in-memory implementation.
2. **\`unittest.mock.Mock\`**: a recording object. Set \`return_value\` or \`side_effect\` (a function, an exception, or a list of values), then assert how it was called (\`assert_called_once_with\`, \`call_args_list\`). Always use \`spec=\`/\`autospec=True\` so a typo'd method name fails instead of silently returning another Mock.
3. **\`patch("module.name")\`**: temporarily replace a name **where it's looked up**. If \`myapp/service.py\` does \`from requests import get\`, patch \`"myapp.service.get"\`: patching \`"requests.get"\` is too late, because the service module already holds its own reference to the original function.

Over-mocking makes tests pass while production breaks. Prefer testing behaviour (inputs → outputs) over implementation details, and back unit tests with a few integration tests against real dependencies (a real PostgreSQL in Docker via testcontainers, an HTTP app via a test client).

## More testing tools
- **coverage.py** / **pytest-cov**: which lines ran (\`pytest --cov=src --cov-report=term-missing\`).
- **hypothesis**: property-based testing; generates hundreds of inputs and shrinks failures to a minimal example.
- **pytest-asyncio** or **anyio**: test \`async def\` code. **pytest-xdist**: run tests in parallel (\`-n auto\`).
- **freezegun** / **time-machine**: control the clock. **respx** / **responses**: mock HTTP for httpx / requests.
- **tox** / **nox**: run the suite against several Python versions.

## The project toolchain
A modern Python project is described by **pyproject.toml** (PEP 621): name, version, Python requirement, dependencies, console scripts, build backend, and every tool's settings. Typical tools:
| Job | Tool |
|---|---|
| Environments, dependencies, lock file, Python versions | **uv** (or pip + venv, Poetry, PDM, Hatch) |
| Format + lint | **ruff** |
| Type check | **mypy** or **pyright** |
| Test | **pytest** (+ pytest-cov) |
| Git hooks | **pre-commit** |
| Build and publish a package | \`uv build\` / \`python -m build\`, then \`uv publish\` / \`twine upload\` |

Use the **src layout** (\`src/yourpkg/\`), so tests run against the installed package rather than whatever happens to be in the current directory.
`,
    keyPoints: [
      "pytest: test_*.py files, test_* functions, plain assert",
      "parametrize turns one test into many cases",
      "Fixtures provide setup and teardown; tmp_path, monkeypatch and capsys are built in",
      "Prefer injecting fakes; use Mock(spec=...) and patch where the name is looked up",
      "pyproject.toml holds metadata, dependencies and tool config",
      "uv for environments, ruff to lint and format, mypy to type check, all in CI",
    ],
    code: [
      {
        title: "Your first pytest suite: assert, parametrize, raises, approx",
        note: "Run with pytest -q. The test runner checks that every test passes.",
        variants: [{ lang: "python", code: `# Code and tests in one file for the demo; in a project the tests live in tests/test_text.py.
# Run with:  pytest -q test_slugify.py
import re
import unicodedata

import pytest


def slugify(title: str, max_length: int = 50) -> str:
    """'Hello, World!' -> 'hello-world'"""
    if max_length < 1:
        raise ValueError("max_length must be positive")
    ascii_text = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:max_length].rstrip("-")


def test_basic():
    assert slugify("Hello, World!") == "hello-world"  # plain assert: pytest shows both sides on failure


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("Python 3.14 is out", "python-3-14-is-out"),
        ("  spaces   everywhere ", "spaces-everywhere"),
        ("Crème brûlée", "creme-brulee"),
        ("!!!", ""),
    ],
    ids=["digits", "whitespace", "accents", "only-punctuation"],
)
def test_many_inputs(title, expected):  # one test function, four test cases
    assert slugify(title) == expected


def test_truncates_without_trailing_dash():
    assert slugify("a long title here", max_length=7) == "a-long"


def test_rejects_bad_length():
    with pytest.raises(ValueError, match="positive"):
        slugify("x", max_length=0)


def test_floats_need_approx():
    assert 0.1 + 0.2 == pytest.approx(0.3)` }],
        explain: `- \`slugify\` normalizes accents away (\`unicodedata.normalize("NFKD", ...)\` splits "é" into "e" plus an accent, which the ASCII encode drops), replaces runs of other characters with dashes, and trims.
- \`test_basic\` is just a function with an \`assert\`. If it fails, pytest prints both values and a diff.
- \`@pytest.mark.parametrize\` runs \`test_many_inputs\` four times, reported as \`test_many_inputs[digits]\`, \`[accents]\`...: one failing case doesn't hide the others.
- \`pytest.raises(..., match=...)\` asserts an exception and checks its message with a regex.
- \`pytest.approx\` compares floats with a tolerance.

Running it:
\`\`\`text
$ pytest -q test_slugify.py
........                                                       [100%]
8 passed in 0.01s
\`\`\``,
      },
      {
        title: "Fixtures: setup, teardown, scopes and the built-ins",
        variants: [{ lang: "python", code: `import json
import os

import pytest


class Database:
    def __init__(self) -> None:
        self.rows: dict[int, str] = {}
        self.open = True

    def insert(self, key: int, value: str) -> None:
        self.rows[key] = value

    def close(self) -> None:
        self.open = False


def load_settings(path) -> dict:
    data = json.loads(path.read_text())
    data["env"] = os.environ.get("APP_ENV", "dev")
    return data


def report(rows: dict[int, str]) -> None:
    for key in sorted(rows):
        print(f"{key}: {rows[key]}")


@pytest.fixture
def db():
    database = Database()  # setup
    database.insert(1, "ada")
    yield database  # the test runs here
    database.close()  # teardown runs even if the test failed


@pytest.fixture(scope="module")  # built once and shared by every test in this file
def config_template():
    return {"workers": 4}


def test_insert(db):  # ask for a fixture by naming it as a parameter
    db.insert(2, "bob")
    assert db.rows == {1: "ada", 2: "bob"}


def test_isolated(db):  # a fresh Database: the previous test's insert is gone
    assert list(db.rows) == [1]


def test_settings_file(tmp_path, monkeypatch, config_template):
    path = tmp_path / "settings.json"  # tmp_path: a unique, empty directory per test
    path.write_text(json.dumps(config_template))
    monkeypatch.setenv("APP_ENV", "prod")  # undone automatically after the test
    assert load_settings(path) == {"workers": 4, "env": "prod"}


def test_report_output(capsys):  # capsys captures stdout and stderr
    report({2: "b", 1: "a"})
    assert capsys.readouterr().out == "1: a\\n2: b\\n"


class TestDatabase:  # group related tests; fixtures work the same way
    def test_starts_open(self, db):
        assert db.open

    @pytest.mark.skipif(os.name == "nt", reason="POSIX-only behaviour")
    def test_posix_only(self):
        assert os.sep == "/"` }],
        explain: `- \`db\` is a fixture: tests receive it by naming a parameter \`db\`. Code after \`yield\` is teardown and runs even when the test fails.
- Each test gets a **fresh** \`db\` (function scope), so \`test_isolated\` doesn't see \`test_insert\`'s row: tests must not depend on each other's state or order.
- \`config_template\` has \`scope="module"\`: created once for the file. Use wider scopes for expensive resources, like a database container (and reset its state between tests).
- \`tmp_path\` gives each test its own empty directory; \`monkeypatch.setenv\` changes an environment variable and restores it afterwards.
- \`capsys.readouterr()\` returns what the code printed.
- Tests can be grouped in a \`Test*\` class (no \`__init__\`); \`skipif\` skips a test conditionally.`,
      },
      {
        title: "Mocks, side effects, patch and fakes",
        variants: [{ lang: "python", code: `from unittest.mock import Mock, call, patch

import pytest


class HttpClient:
    def get_json(self, url: str) -> dict:
        raise RuntimeError("real network call: never in unit tests")


class WeatherService:
    def __init__(self, client: HttpClient, api: str = "https://weather.example") -> None:
        self.client = client  # dependency injection: the test passes a fake
        self.api = api

    def temperature(self, city: str) -> float:
        data = self.client.get_json(f"{self.api}/now?city={city}")
        return round(data["temp_c"], 1)

    def warmest(self, cities: list[str]) -> str:
        return max(cities, key=self.temperature)


def test_temperature_uses_the_client():
    client = Mock(spec=HttpClient)  # spec: calling a method HttpClient doesn't have is an error
    client.get_json.return_value = {"temp_c": 21.456}
    service = WeatherService(client)

    assert service.temperature("Oslo") == 21.5
    client.get_json.assert_called_once_with("https://weather.example/now?city=Oslo")


def test_warmest_with_side_effect():
    client = Mock(spec=HttpClient)
    temps = {"Oslo": 4.0, "Rome": 19.5, "Cairo": 31.2}
    client.get_json.side_effect = lambda url: {"temp_c": temps[url.split("=")[1]]}  # computed per call
    assert WeatherService(client).warmest(["Oslo", "Rome", "Cairo"]) == "Cairo"
    assert client.get_json.call_count == 3
    assert client.get_json.call_args_list[0] == call("https://weather.example/now?city=Oslo")


def test_errors_propagate():
    client = Mock(spec=HttpClient)
    client.get_json.side_effect = TimeoutError("slow")  # an exception instance is raised
    with pytest.raises(TimeoutError):
        WeatherService(client).temperature("Lima")


def test_patch_a_method():
    # patch replaces an attribute for the duration of the with block (or decorated test)
    with patch.object(HttpClient, "get_json", return_value={"temp_c": -3.04}) as fake:
        assert WeatherService(HttpClient()).temperature("Nuuk") == -3.0
    fake.assert_called_once()


def test_fake_object_instead_of_mock():
    class FakeClient(HttpClient):  # often clearer than a Mock: a tiny in-memory implementation
        def get_json(self, url: str) -> dict:
            return {"temp_c": 12.0}

    assert WeatherService(FakeClient()).temperature("Lisbon") == 12.0` }],
        explain: `- \`WeatherService\` receives its HTTP client in \`__init__\` (**dependency injection**), so tests can pass a double without patching anything.
- \`Mock(spec=HttpClient)\` only allows \`HttpClient\`'s attributes, so a typo like \`client.get_jsno\` fails loudly. \`return_value\` sets what calls return; \`assert_called_once_with\` checks the URL that was built.
- \`side_effect\` can be a function (computing a response per call), an exception (raised when called), or a list of return values.
- \`patch.object(HttpClient, "get_json", ...)\` replaces a method only inside the \`with\` block. In real code you'd usually patch a module attribute: \`patch("myapp.weather.HttpClient")\`.
- The last test uses a hand-written **fake** subclass: often clearer and less brittle than a mock, especially when several tests need the same double.`,
      },
      {
        title: "pyproject.toml for a real project",
        variants: [{ lang: "toml", code: `[project]
name = "weather"
version = "0.1.0"
description = "Weather lookups with caching"
readme = "README.md"
requires-python = ">=3.12"
dependencies = ["httpx>=0.28", "pydantic>=2.10"]

[project.scripts]
weather = "weather.cli:main"   # installs a \`weather\` command

[dependency-groups]
dev = ["pytest>=8", "pytest-cov", "ruff", "mypy"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM"]   # pycodestyle, pyflakes, isort, bugbear, pyupgrade, simplify

[tool.mypy]
strict = true` }],
        explain: `- \`[project]\` (PEP 621) holds the metadata that installers read: name, version, minimum Python, runtime dependencies with version ranges.
- \`[project.scripts]\` creates a \`weather\` command that calls \`weather.cli:main\` when the package is installed.
- \`[dependency-groups]\` (PEP 735) lists development-only tools; \`uv sync\` installs them, and \`uv sync --no-dev\` leaves them out of production images.
- \`[build-system]\` names the backend that builds wheels (hatchling here; setuptools, flit-core, pdm-backend and uv_build are alternatives).
- \`[tool.*]\` sections configure pytest, ruff and mypy in the same file.

The everyday commands:
\`\`\`bash
uv sync                       # create .venv and install everything from uv.lock
uv add httpx                  # add a dependency (updates pyproject.toml and uv.lock)
uv run pytest --cov=weather   # run tests with coverage
uv run ruff format . && uv run ruff check --fix .
uv run mypy src
uv build                      # build sdist + wheel into dist/
\`\`\``,
      },
    ],
    interview: [
      {
        q: "What is a pytest fixture, and how is it different from setUp in unittest?",
        a: `A fixture is a function that provides a resource to tests that **request it by name**. It can do setup, \`yield\` the resource, then tear down; it can depend on other fixtures; and it has a scope (function, class, module, package, session) controlling how often it's created. Compared with \`unittest\`'s \`setUp\`/\`tearDown\`, fixtures are explicit per test, composable, reusable across files via \`conftest.py\`, and only built for the tests that need them.`,
        freq: "common",
      },
      {
        q: "When do you mock, and what are the risks?",
        a: `Mock what's slow, nondeterministic or external: the network, payment providers, the clock, randomness, email. Prefer designing code so collaborators are **injected** and pass fakes. Risks: mocks that drift from the real interface (use \`spec\`/\`autospec\`), tests coupled to implementation details (asserting every internal call), and suites that pass while the integration is broken. Balance them with integration tests against real dependencies (a test database, a recorded HTTP fixture, a contract test).`,
        freq: "common",
      },
      {
        q: "Where do you patch a function imported with from module import func?",
        a: `Where it's **looked up**, not where it's defined. If \`app/service.py\` does \`from requests import get\`, the service module has its own name \`get\` bound to the function, so you must patch \`"app.service.get"\`. Patching \`"requests.get"\` changes the attribute on the \`requests\` module, which the service no longer consults. If the service does \`import requests\` and calls \`requests.get\`, patching \`"requests.get"\` works.`,
        freq: "common",
      },
      {
        q: "How would you set up a new Python project today?",
        a: `\`uv init\` (or a template) with a **src layout** and **pyproject.toml**; dependencies added with \`uv add\` and locked in \`uv.lock\`; dev tools in a dependency group: pytest (+ pytest-cov), ruff (format + lint), mypy or pyright. Pre-commit hooks for ruff; CI running \`ruff check\`, \`ruff format --check\`, \`mypy\`, and \`pytest\` on the supported Python versions; Dependabot or Renovate for updates; a Dockerfile based on a slim Python image for services.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "How does a test function get a fixture?",
        options: ["By calling it directly", "By declaring a parameter with the fixture's name", "By inheriting from TestCase", "Through a global variable"],
        answer: 1,
        explain: "pytest matches parameter names to fixtures and injects the values.",
      },
      {
        q: "A fixture yields a database connection. When does the code after the yield run?",
        options: ["Never", "Only if the test passes", "After the test, whether it passed or failed", "Before the test"],
        answer: 2,
        explain: "Teardown after yield always runs, like a finally block.",
      },
      {
        q: "What's the advantage of Mock(spec=SomeClass)?",
        options: ["It runs faster", "Accessing attributes SomeClass doesn't have raises AttributeError", "It calls the real methods", "It records timing"],
        answer: 1,
        explain: "Without a spec, a Mock happily invents any attribute, so typos silently pass.",
      },
      {
        q: "service.py does `from time import sleep`. What should a test patch to skip the sleeps?",
        options: ["\"time.sleep\"", "\"service.sleep\"", "\"builtins.sleep\"", "\"sleep\""],
        answer: 1,
        explain: "Patch where the name is looked up: the service module has its own reference named sleep.",
      },
      {
        q: "Which file declares a modern project's dependencies and tool settings?",
        options: ["setup.cfg only", "requirements.txt only", "pyproject.toml", "Pipfile"],
        answer: 2,
        explain: "pyproject.toml (PEP 518/621) is the standard home for metadata, dependencies, the build backend and tool configuration.",
      },
    ],
  },
];
