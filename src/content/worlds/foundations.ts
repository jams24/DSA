import type { World } from "../types";

const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export const foundations: World = {
  id: "foundations",
  order: 1,
  title: "Foundation Fields",
  subtitle: "Big-O, arrays, hashing, lists, stacks & recursion",
  description:
    "Every interview starts here. Learn to reason about cost, then master the building blocks every other structure is made from.",
  emoji: "🌱",
  color: "#a3e635",
  boss: {
    name: "Big-O the Ogre",
    title: "Devourer of Nested Loops",
    emoji: "👹",
    taunt: "Your O(n²) solutions are my favourite snack. Prove you can scale, little coder!",
    defeat: "Impossible... you answered in O(1)!",
  },
  lessons: [
    // ------------------------------------------------------------------ BIG-O
    {
      id: "big-o",
      title: "Big-O & Complexity",
      tagline: "Reason about how code scales before you write it.",
      difficulty: "beginner",
      minutes: 12,
      visualizers: ["bigo"],
      concept: `
## Why interviewers obsess over Big-O
Two solutions can both pass the sample test, yet one finishes in a millisecond on a million items and the other takes a week. **Big-O notation** describes how the running time (or memory) of an algorithm *grows* as the input size **n** grows. It deliberately ignores machine speed and constant factors so we can compare ideas, not hardware.

> In an interview, always state the time **and** space complexity of your solution before you are asked. It signals that you think about scale.

## The four simplification rules
1. **Drop constants.** \`O(2n)\` and \`O(n/2)\` are both \`O(n)\`.
2. **Drop lower-order terms.** \`O(n² + n log n + 100)\` is \`O(n²)\` — for big n the biggest term dominates.
3. **Different inputs get different variables.** Looping over array \`a\` then array \`b\` is \`O(a + b)\`, not \`O(n)\`. Nesting them is \`O(a · b)\`.
4. **Sequential steps add, nested steps multiply.** A loop followed by a loop is \`O(n + n) = O(n)\`; a loop inside a loop is \`O(n · n) = O(n²)\`.

## The complexity ladder
| Class | Name | Typical source |
|---|---|---|
| O(1) | constant | array index, hash lookup, push/pop |
| O(log n) | logarithmic | binary search, balanced-tree ops, heap push |
| O(n) | linear | one pass over the input |
| O(n log n) | linearithmic | efficient sorting, n heap operations |
| O(n²) | quadratic | all pairs, nested loops |
| O(2ⁿ) | exponential | all subsets, naive recursion |
| O(n!) | factorial | all permutations |

**Logarithms = repeated halving.** If each step throws away half the remaining work, you need about log₂(n) steps: a million items → ~20 steps, a billion → ~30.

## Read the constraints like a pro
A modern judge does roughly **10⁸ simple operations per second**. Constraints leak the intended complexity:

| n up to | Aim for |
|---|---|
| 10–12 | O(n!) — permutations |
| 20–25 | O(2ⁿ) — bitmask / subsets |
| 500 | O(n³) |
| 5,000 | O(n²) |
| 10⁶ | O(n log n) or O(n) |
| 10⁹+ | O(log n) or O(1) — math or binary search |

## Best, average, worst and amortized
- **Worst case** is the default in interviews. Quicksort is O(n log n) on average but O(n²) worst case.
- **Average case** assumes typical input. Hash tables are O(1) on average but O(n) if every key collides.
- **Amortized** means "averaged over a sequence of operations". Appending to a dynamic array is occasionally O(n) (resize) but O(1) amortized because the expensive copies are rare.

## Space complexity
Count the *extra* memory your algorithm allocates: new arrays, hash maps, and — the one people forget — the **recursion call stack**. A recursive DFS on a degenerate (linked-list-shaped) tree uses O(n) stack space.

## Big-O, Big-Θ, Big-Ω
Formally, O is an upper bound, Ω a lower bound and Θ a tight bound. In industry and interviews, "Big-O" is used loosely to mean the tight bound — but knowing the difference makes for a great follow-up answer.
`,
      keyPoints: [
        "Drop constants and lower-order terms; keep the dominant term.",
        "Sequential work adds, nested work multiplies.",
        "Use separate variables for separate inputs: O(a + b), O(a·b).",
        "~10⁸ operations per second: use constraints to guess the target complexity.",
        "Recursion depth counts toward space complexity.",
        "Amortized O(1) ≠ every call is O(1) — it is the average over many calls.",
      ],
      complexity: [
        { op: "for i in range(n)", time: "O(n)" },
        { op: "nested loops over n", time: "O(n²)" },
        { op: "i *= 2 until n", time: "O(log n)" },
        { op: "sort then scan", time: "O(n log n)", note: "sorting dominates" },
        { op: "all subsets", time: "O(2ⁿ · n)", note: "n to copy each subset" },
      ],
      code: [
        {
          title: "Spot the complexity",
          note: "Each function is annotated with its time complexity.",
          variants: [
            {
              lang: "python",
              code: `
def first(items):            # O(1): one step regardless of n
    return items[0]

def total(items):            # O(n): touches every item once
    s = 0
    for x in items:
        s += x
    return s

def has_duplicate(items):    # O(n^2): compares every pair
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                return True
    return False

def halvings(n):             # O(log n): n halves each iteration
    steps = 0
    while n > 1:
        n //= 2
        steps += 1
    return steps
`,
            },
            {
              lang: "javascript",
              code: `
function first(items) {          // O(1)
  return items[0];
}

function total(items) {          // O(n)
  let s = 0;
  for (const x of items) s += x;
  return s;
}

function hasDuplicate(items) {   // O(n^2)
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (items[i] === items[j]) return true;
  return false;
}

function hasDuplicateFast(items) { // O(n) time, O(n) space
  return new Set(items).size !== items.length;
}
`,
            },
            {
              lang: "java",
              code: `
int halvings(int n) {            // O(log n)
    int steps = 0;
    while (n > 1) { n /= 2; steps++; }
    return steps;
}

boolean hasDuplicate(int[] a) {  // O(n log n): sorting dominates
    int[] b = a.clone();
    java.util.Arrays.sort(b);
    for (int i = 1; i < b.length; i++)
        if (b[i] == b[i - 1]) return true;
    return false;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What is the time complexity of a loop where `j` runs from `i+1` to `n` inside a loop over `i`?",
          a: "The inner loop runs (n−1) + (n−2) + … + 1 = n(n−1)/2 times. Dropping constants and lower-order terms gives **O(n²)**. A common trap is to think the triangular shape makes it O(n log n) — it doesn't, it is still half of a square.",
          freq: "very-common",
        },
        {
          q: "What does amortized O(1) mean? Give an example.",
          a: "Amortized cost is the total cost of a sequence of operations divided by the number of operations. Appending to a dynamic array (Python `list`, Java `ArrayList`, C++ `vector`) occasionally triggers a resize that copies all n elements, but because capacity doubles, the copies total at most 1 + 2 + 4 + … + n < 2n over n appends. So each append is **O(1) amortized**, even though a single append can be O(n).",
          freq: "very-common",
        },
        {
          q: "Big-O vs Big-Θ vs Big-Ω?",
          a: "**O** is an upper bound (grows no faster than), **Ω** is a lower bound (grows at least as fast as), **Θ** is a tight bound (both). Linear search is O(n) and Ω(1) for the best case; its worst case is Θ(n). In interviews \"Big-O\" usually means the tight worst-case bound.",
          freq: "common",
        },
        {
          q: "What is the space complexity of a recursive function?",
          a: "At least the maximum depth of the call stack times the space per frame. Naive recursive `fib(n)` makes O(2ⁿ) calls but only O(n) of them are on the stack at once, so it is O(2ⁿ) time and **O(n) space**. Iterative rewrites or tail recursion (where supported) can reduce the stack cost.",
          freq: "common",
        },
        {
          q: "Given n ≤ 10⁵, would an O(n²) solution pass?",
          a: "(10⁵)² = 10¹⁰ operations — at ~10⁸ ops/sec that is ~100 seconds, far beyond a typical 1–2s limit. You need **O(n log n)** or better: think sorting, heaps, binary search, hashing or two pointers.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Simplify O(3n² + 10n + 7).",
          options: ["O(3n²)", "O(n²)", "O(n² + n)", "O(n³)"],
          answer: 1,
          explain: "Drop constant factors and lower-order terms; the n² term dominates.",
        },
        {
          q: "What is the complexity of `i = 1; while i < n: i *= 2`?",
          options: ["O(n)", "O(√n)", "O(log n)", "O(1)"],
          answer: 2,
          explain: "i doubles each iteration, so it reaches n after log₂(n) steps.",
        },
        {
          q: "You loop over array A (length a) and, inside, over array B (length b). Complexity?",
          options: ["O(n²)", "O(a + b)", "O(a · b)", "O(max(a, b))"],
          answer: 2,
          explain: "Nested loops multiply, and separate inputs keep separate variables.",
        },
        {
          q: "Roughly the largest n for which an O(n²) algorithm runs in about one second?",
          options: ["~100", "~10⁴", "~10⁶", "~10⁹"],
          answer: 1,
          explain: "(10⁴)² = 10⁸, about one second of simple operations.",
        },
        {
          q: "Appending to a dynamic array is…",
          options: ["Always O(1)", "O(n) every time", "O(1) amortized", "O(log n)"],
          answer: 2,
          explain: "Rare resizes cost O(n) but doubling makes the average per append constant.",
        },
        {
          q: "Recursive DFS on a tree shaped like a linked list of n nodes uses how much stack space?",
          options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
          answer: 2,
          explain: "The recursion goes n levels deep before returning.",
        },
      ],
      problems: [
        { title: "Contains Duplicate", url: lc("contains-duplicate"), difficulty: "Easy", note: "O(n²) → O(n log n) → O(n)" },
        { title: "Two Sum", url: lc("two-sum"), difficulty: "Easy", note: "trade space for time" },
        { title: "Climbing Stairs", url: lc("climbing-stairs"), difficulty: "Easy", note: "exponential → linear" },
      ],
    },

    // ------------------------------------------------------------------ ARRAYS
    {
      id: "arrays",
      title: "Arrays & Dynamic Arrays",
      tagline: "Contiguous memory, O(1) indexing and the doubling trick.",
      difficulty: "beginner",
      minutes: 14,
      visualizers: ["array"],
      concept: `
## Contiguous memory
An array stores elements **side by side** in one block of memory. Because every element has the same size, the address of element i is simply:

\`address(i) = base + i × elementSize\`

That one multiplication is why **indexing is O(1)**. Contiguity also gives arrays excellent **cache locality**: the CPU loads memory in 64-byte cache lines, so scanning an array is dramatically faster in practice than chasing pointers through a linked list, even when both are O(n).

## Static vs dynamic arrays
A static array (C arrays, Java \`int[]\`) has a fixed length. A **dynamic array** (Python \`list\`, Java \`ArrayList\`, C++ \`vector\`, JS \`Array\`) tracks a *size* and a larger *capacity*:

- **push / append**: write at index \`size\` — O(1) — *unless* the array is full.
- **When full**: allocate a new block (typically 1.5×–2× bigger), copy everything over, free the old one. That copy is O(n), but it happens so rarely that appends are **O(1) amortized**: over n appends the copies sum to 1 + 2 + 4 + … + n < 2n.

## Insert and delete in the middle
To insert at index i every element from i onward must **shift right** by one; deleting shifts them left. That is O(n − i), i.e. **O(n)** in the worst case. Inserting/removing at the *end* is cheap; at the *front* it is the most expensive. (Need fast inserts at both ends? Use a deque.)

## Strings are arrays too
Strings are arrays of characters, and in Python, Java, JavaScript and Go they are **immutable**. \`s += c\` inside a loop creates a brand-new string each time → O(n²) total. Build a list and \`"".join()\` it (Python), use \`StringBuilder\` (Java) or \`array.join\` (JS).

## 2-D arrays
A matrix \`grid[r][c]\` is usually stored row-major: row 0, then row 1, … Iterating row by row is cache friendly; column by column is not. Grid problems turn into graph problems with 4-directional neighbours \`(r±1, c)\`, \`(r, c±1)\`.

## The array interview toolkit
- **Hash map alongside the array** for O(1) lookups (Two Sum).
- **Two pointers** on sorted arrays or for in-place partitioning.
- **Sliding window** for contiguous subarrays.
- **Prefix sums** for fast range sums.
- **Sort first** (O(n log n)) when order doesn't matter — it unlocks binary search and two pointers.
- **In-place tricks**: a write pointer that overwrites the array as you scan (Move Zeroes, Remove Duplicates).

> Classic pitfalls: off-by-one errors on bounds, mutating a list while iterating over it, and forgetting empty / single-element inputs.
`,
      keyPoints: [
        "Index i lives at base + i × size → O(1) random access.",
        "Insert/delete in the middle shifts elements → O(n).",
        "Doubling capacity makes append O(1) amortized.",
        "Contiguous memory = cache friendly; real-world speed matters too.",
        "Never build strings with += in a loop in Python/Java/JS.",
      ],
      complexity: [
        { op: "Access a[i]", time: "O(1)", space: "O(1)" },
        { op: "Search (unsorted)", time: "O(n)" },
        { op: "Search (sorted, binary)", time: "O(log n)" },
        { op: "Append / pop end", time: "O(1) amortized" },
        { op: "Insert / delete at i", time: "O(n)", note: "shifts n − i items" },
      ],
      code: [
        {
          title: "A dynamic array from scratch",
          note: "Shows exactly where the amortized O(1) append comes from.",
          variants: [
            {
              lang: "python",
              code: `
class DynamicArray:
    def __init__(self):
        self.size = 0
        self.cap = 1
        self.data = [None] * self.cap

    def get(self, i):
        if not 0 <= i < self.size:
            raise IndexError(i)
        return self.data[i]                  # O(1)

    def append(self, x):
        if self.size == self.cap:            # full: double capacity
            self._resize(2 * self.cap)       # O(n), but rare
        self.data[self.size] = x
        self.size += 1

    def insert(self, i, x):                  # O(n): shift right
        if self.size == self.cap:
            self._resize(2 * self.cap)
        for k in range(self.size, i, -1):
            self.data[k] = self.data[k - 1]
        self.data[i] = x
        self.size += 1

    def _resize(self, new_cap):
        new = [None] * new_cap
        for k in range(self.size):
            new[k] = self.data[k]
        self.data, self.cap = new, new_cap
`,
            },
            {
              lang: "javascript",
              code: `
class DynamicArray {
  constructor() {
    this.size = 0;
    this.cap = 1;
    this.data = new Array(1);
  }
  get(i) {
    if (i < 0 || i >= this.size) throw new RangeError("index " + i);
    return this.data[i];
  }
  push(x) {
    if (this.size === this.cap) this.#resize(this.cap * 2);
    this.data[this.size++] = x;
  }
  insert(i, x) {
    if (this.size === this.cap) this.#resize(this.cap * 2);
    for (let k = this.size; k > i; k--) this.data[k] = this.data[k - 1];
    this.data[i] = x;
    this.size++;
  }
  #resize(cap) {
    const next = new Array(cap);
    for (let k = 0; k < this.size; k++) next[k] = this.data[k];
    this.data = next;
    this.cap = cap;
  }
}
`,
            },
            {
              lang: "java",
              code: `
class DynamicArray {
    private int[] data = new int[1];
    private int size = 0;

    int get(int i) {
        if (i < 0 || i >= size) throw new IndexOutOfBoundsException();
        return data[i];
    }

    void add(int x) {
        if (size == data.length) data = java.util.Arrays.copyOf(data, size * 2);
        data[size++] = x;
    }

    void insert(int i, int x) {
        if (size == data.length) data = java.util.Arrays.copyOf(data, size * 2);
        System.arraycopy(data, i, data, i + 1, size - i); // shift right
        data[i] = x;
        size++;
    }
}
`,
            },
          ],
        },
        {
          title: "In-place write pointer: Move Zeroes",
          note: "O(n) time, O(1) extra space — a pattern that appears constantly.",
          variants: [
            {
              lang: "python",
              code: `
def move_zeroes(nums):
    write = 0
    for x in nums:
        if x != 0:
            nums[write] = x
            write += 1
    for i in range(write, len(nums)):
        nums[i] = 0
`,
            },
            {
              lang: "javascript",
              code: `
function moveZeroes(nums) {
  let write = 0;
  for (const x of nums) if (x !== 0) nums[write++] = x;
  while (write < nums.length) nums[write++] = 0;
}
`,
            },
            {
              lang: "java",
              code: `
void moveZeroes(int[] nums) {
    int write = 0;
    for (int x : nums) if (x != 0) nums[write++] = x;
    while (write < nums.length) nums[write++] = 0;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why is array indexing O(1)?",
          a: "Elements are stored contiguously and are all the same size, so the address of element `i` is `base + i * size` — one multiplication and one addition regardless of n. Linked lists can't do this because nodes are scattered in memory.",
          freq: "very-common",
        },
        {
          q: "ArrayList vs LinkedList — when would you pick each?",
          a: "Pick an **array list** almost always: O(1) indexing, amortized O(1) append and far better cache locality. Pick a **linked list** when you need O(1) insert/delete at a position you already hold a reference to (e.g. the doubly linked list inside an LRU cache), or for a queue/deque without amortized resize spikes. Note: Java's `LinkedList.add(i, x)` is still O(n) because it must walk to i.",
          freq: "very-common",
        },
        {
          q: "How would you rotate an array right by k in O(1) extra space?",
          a: "Use the **reversal trick**: reverse the whole array, then reverse the first `k % n` elements, then reverse the rest. Example `[1,2,3,4,5]`, k=2 → reverse all `[5,4,3,2,1]` → reverse first 2 `[4,5,3,2,1]` → reverse rest `[4,5,1,2,3]`. O(n) time, O(1) space.",
          freq: "common",
        },
        {
          q: "Why is building a string with `+=` in a loop slow?",
          a: "Strings are immutable in Python, Java, JS and Go, so each `+=` allocates a new string and copies everything so far: 1 + 2 + … + n = O(n²). Collect pieces in a list and join once (`''.join(parts)`), or use a `StringBuilder`.",
          freq: "common",
        },
        {
          q: "What is the growth factor of Python lists / Java ArrayList and why not grow by a constant?",
          a: "CPython over-allocates by about 1.125× plus a constant; Java's ArrayList grows 1.5×; many C++ `vector` implementations use 2× (MSVC uses 1.5×). Any **geometric** factor gives amortized O(1). Growing by a constant c would make n appends cost O(n²/c) = O(n²). Smaller factors waste less memory; larger factors copy less often.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Inserting at index 0 of a dynamic array with n elements costs…",
          options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
          answer: 2,
          explain: "All n elements shift one slot to the right.",
        },
        {
          q: "Why does doubling capacity give amortized O(1) appends?",
          options: [
            "Copies never happen",
            "Total copies over n appends are < 2n",
            "Memory is allocated lazily",
            "The CPU caches the array",
          ],
          answer: 1,
          explain: "1 + 2 + 4 + … + n < 2n, so the average cost per append is constant.",
        },
        {
          q: "Which is usually fastest in practice to iterate over n items?",
          options: ["Linked list", "Array", "Both identical", "Hash set"],
          answer: 1,
          explain: "Both are O(n), but arrays are contiguous and cache-friendly.",
        },
        {
          q: "Best way to build a long string from many pieces in Python?",
          options: ["s += piece in a loop", "''.join(pieces)", "str.format in a loop", "Recursion"],
          answer: 1,
          explain: "join computes the final size once and copies each piece once: O(total length).",
        },
        {
          q: "Rotate [1,2,3,4,5] right by 2 using three reversals. What is the result?",
          options: ["[3,4,5,1,2]", "[4,5,1,2,3]", "[2,1,5,4,3]", "[5,4,1,2,3]"],
          answer: 1,
          explain: "Reverse all → [5,4,3,2,1]; reverse first 2 → [4,5,…]; reverse rest → [4,5,1,2,3].",
        },
      ],
      problems: [
        { title: "Two Sum", url: lc("two-sum"), difficulty: "Easy" },
        { title: "Best Time to Buy and Sell Stock", url: lc("best-time-to-buy-and-sell-stock"), difficulty: "Easy" },
        { title: "Move Zeroes", url: lc("move-zeroes"), difficulty: "Easy" },
        { title: "Merge Sorted Array", url: lc("merge-sorted-array"), difficulty: "Easy" },
        { title: "Rotate Array", url: lc("rotate-array"), difficulty: "Medium" },
        { title: "Product of Array Except Self", url: lc("product-of-array-except-self"), difficulty: "Medium" },
        { title: "Maximum Subarray", url: lc("maximum-subarray"), difficulty: "Medium", note: "Kadane's algorithm" },
        { title: "Spiral Matrix", url: lc("spiral-matrix"), difficulty: "Medium" },
      ],
    },

    // ------------------------------------------------------------------ HASH TABLES
    {
      id: "hash-tables",
      title: "Hash Tables",
      tagline: "The O(1) lookup that solves half of all interview problems.",
      difficulty: "beginner",
      minutes: 15,
      visualizers: ["hashtable"],
      concept: `
## The idea
A hash table stores key → value pairs in an array of **buckets**. A **hash function** turns any key into a big integer; taking it modulo the number of buckets picks where the key lives:

\`bucket = hash(key) mod m\`

Insert, lookup and delete then go straight to one bucket: **O(1) on average**.

## Collisions are inevitable
Different keys can land in the same bucket (pigeonhole principle). Two families of fixes:

- **Separate chaining** — each bucket holds a small list of entries. Java's \`HashMap\` and C++'s \`unordered_map\` do this; Java even converts long chains (≥ 8) into red-black trees so the worst case becomes O(log n).
- **Open addressing** — every entry lives directly in the array; on collision, *probe* for another slot (linear probing \`i+1, i+2…\`, quadratic, or double hashing). Python's \`dict\` uses open addressing. Deletions need **tombstones** so later probe chains don't break.

## Load factor and resizing
The **load factor** α = n / m (entries / buckets) controls collision rates. When α passes a threshold (Java: 0.75; open addressing usually lower), the table **doubles and rehashes** every key — O(n) once, O(1) amortized, exactly like dynamic arrays.

## What makes a good hash function
Deterministic, fast, and **spreads keys uniformly**. Keys must be **immutable** (or at least their hash must never change) — that's why Python refuses \`list\` keys and why in Java you must override \`equals\` and \`hashCode\` together: equal objects must have equal hashes.

> Security aside: if attackers can choose keys that all collide, lookups degrade to O(n) ("hash flooding"). Languages defend with randomized, keyed hash functions such as SipHash.

## Hash map vs tree map
| | Hash map | Tree map (balanced BST) |
|---|---|---|
| Lookup | O(1) avg, O(n) worst | O(log n) guaranteed |
| Ordered iteration | ✗ | ✓ |
| Range queries / floor / ceiling | ✗ | ✓ |

## Patterns that use hashing
- **Complement lookup** — Two Sum: for each x, has \`target − x\` been seen?
- **Counting** — frequencies, anagrams, majority element.
- **Grouping by a canonical key** — group anagrams by sorted letters.
- **Dedup / seen-set** — cycle detection, visited sets in graph search.
- **Prefix sum + map** — count subarrays with sum k.
- **Memoization** — cache results of a recursive function.
`,
      keyPoints: [
        "bucket = hash(key) mod m → O(1) average operations.",
        "Collisions: chaining (lists per bucket) or open addressing (probing).",
        "Keep load factor low; resize + rehash when it grows.",
        "Keys must be immutable; equals and hashCode must agree.",
        "Worst case is O(n); use a tree map when you need order or guarantees.",
      ],
      complexity: [
        { op: "Insert", time: "O(1) avg", note: "O(n) worst" },
        { op: "Lookup", time: "O(1) avg", note: "O(n) worst" },
        { op: "Delete", time: "O(1) avg" },
        { op: "Resize / rehash", time: "O(n)", note: "amortized away" },
        { op: "Iterate in key order", time: "O(n log n)", note: "must sort" },
      ],
      code: [
        {
          title: "Two Sum — complement lookup",
          variants: [
            {
              lang: "python",
              code: `
def two_sum(nums, target):
    seen = {}                      # value -> index
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []
`,
            },
            {
              lang: "javascript",
              code: `
function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
`,
            },
            {
              lang: "java",
              code: `
int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        Integer j = seen.get(target - nums[i]);
        if (j != null) return new int[]{j, i};
        seen.put(nums[i], i);
    }
    return new int[0];
}
`,
            },
          ],
        },
        {
          title: "Group anagrams — canonical keys",
          variants: [
            {
              lang: "python",
              code: `
from collections import defaultdict

def group_anagrams(words):
    groups = defaultdict(list)
    for w in words:
        groups["".join(sorted(w))].append(w)   # or a 26-count tuple
    return list(groups.values())
`,
            },
            {
              lang: "javascript",
              code: `
function groupAnagrams(words) {
  const groups = new Map();
  for (const w of words) {
    const key = [...w].sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  return [...groups.values()];
}
`,
            },
            {
              lang: "java",
              code: `
List<List<String>> groupAnagrams(String[] words) {
    Map<String, List<String>> groups = new HashMap<>();
    for (String w : words) {
        char[] c = w.toCharArray();
        Arrays.sort(c);
        groups.computeIfAbsent(new String(c), k -> new ArrayList<>()).add(w);
    }
    return new ArrayList<>(groups.values());
}
`,
            },
          ],
        },
        {
          title: "A tiny hash map with separate chaining",
          variants: [
            {
              lang: "python",
              code: `
class ChainedHashMap:
    def __init__(self, m=8):
        self.buckets = [[] for _ in range(m)]
        self.n = 0

    def _bucket(self, key):
        return self.buckets[hash(key) % len(self.buckets)]

    def put(self, key, value):
        b = self._bucket(key)
        for pair in b:
            if pair[0] == key:
                pair[1] = value
                return
        b.append([key, value])
        self.n += 1
        if self.n / len(self.buckets) > 0.75:
            self._rehash()

    def get(self, key):
        for k, v in self._bucket(key):
            if k == key:
                return v
        raise KeyError(key)

    def _rehash(self):
        old = [p for b in self.buckets for p in b]
        self.buckets = [[] for _ in range(2 * len(self.buckets))]
        for k, v in old:
            self._bucket(k).append([k, v])
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How does a HashMap work internally?",
          a: "It keeps an array of buckets. `put(k, v)` computes `hash(k)`, maps it to an index (`hash & (m-1)` when m is a power of two), and stores the entry there. On collision, Java chains entries in a linked list (converted to a red-black tree beyond 8 entries); Python's dict probes for another open slot. When size / capacity exceeds the load factor (0.75 in Java) it doubles the array and rehashes all entries. Lookups repeat the hash, go to the bucket and compare keys with `equals`.",
          freq: "very-common",
        },
        {
          q: "Is a hash map lookup really O(1)?",
          a: "**Average** O(1) assuming a good hash function and bounded load factor. **Worst case** O(n) when many keys collide (bad hash or adversarial input). Java 8+ caps the worst case at O(log n) per bucket via treeification. Also note hashing the key itself costs O(length of key) — hashing a 1 MB string is not free.",
          freq: "very-common",
        },
        {
          q: "Why must you override `hashCode` when you override `equals` in Java?",
          a: "The contract says equal objects must have equal hash codes. HashMap first uses `hashCode` to choose the bucket, then `equals` to find the key inside it. If two equal objects hash differently, they land in different buckets and `get` will never find the entry you `put`.",
          freq: "common",
        },
        {
          q: "When would you choose a TreeMap over a HashMap?",
          a: "When you need keys in **sorted order**, range queries (`subMap`), or nearest-key lookups (`floorKey`, `ceilingKey`) — e.g. a calendar booking system or a leaderboard. You also get a guaranteed O(log n) worst case instead of O(1) average / O(n) worst.",
          freq: "common",
        },
        {
          q: "Design a HashMap without using built-in hash tables.",
          a: "Array of buckets of size m (power of two). `index = hash(key) & (m - 1)`. Each bucket is a linked list of `(key, value)` nodes. `put` updates in place if the key exists, else prepends a node; `get` scans the bucket; `remove` unlinks. Track size; when `size / m > 0.75`, allocate 2m buckets and reinsert. Discuss the hash function (e.g. multiply-shift), and alternatives like open addressing with tombstones.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "With 8 buckets, which bucket does a key with hash 43 go to?",
          options: ["3", "5", "8", "43"],
          answer: 0,
          explain: "43 mod 8 = 3.",
        },
        {
          q: "Why does open addressing use tombstones on delete?",
          options: [
            "To save memory",
            "So probe sequences for other keys are not cut short",
            "To speed up resizing",
            "Because keys are immutable",
          ],
          answer: 1,
          explain: "An empty slot stops a probe; a tombstone says 'keep searching past me'.",
        },
        {
          q: "What happens when the load factor exceeds the threshold?",
          options: ["Lookups fail", "The table grows and rehashes all keys", "Keys are evicted", "It switches to a BST"],
          answer: 1,
          explain: "Resizing keeps chains short so operations stay O(1) on average.",
        },
        {
          q: "Worst-case lookup in a hash table with chaining (no treeification)?",
          options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
          answer: 2,
          explain: "If every key lands in one bucket, you scan a list of n entries.",
        },
        {
          q: "Which is a valid canonical key to group anagrams?",
          options: ["The word's length", "The sorted letters of the word", "The first letter", "hash(word)"],
          answer: 1,
          explain: "All anagrams share the same sorted letters (or the same 26-letter count vector).",
        },
      ],
      problems: [
        { title: "Two Sum", url: lc("two-sum"), difficulty: "Easy" },
        { title: "Valid Anagram", url: lc("valid-anagram"), difficulty: "Easy" },
        { title: "Group Anagrams", url: lc("group-anagrams"), difficulty: "Medium" },
        { title: "Top K Frequent Elements", url: lc("top-k-frequent-elements"), difficulty: "Medium" },
        { title: "Longest Consecutive Sequence", url: lc("longest-consecutive-sequence"), difficulty: "Medium" },
        { title: "Subarray Sum Equals K", url: lc("subarray-sum-equals-k"), difficulty: "Medium" },
        { title: "Design HashMap", url: lc("design-hashmap"), difficulty: "Easy" },
        { title: "Insert Delete GetRandom O(1)", url: lc("insert-delete-getrandom-o1"), difficulty: "Medium" },
      ],
    },

    // ------------------------------------------------------------------ LINKED LISTS
    {
      id: "linked-lists",
      title: "Linked Lists",
      tagline: "Pointer surgery: insert, delete and reverse without shifting.",
      difficulty: "beginner",
      minutes: 14,
      visualizers: ["linkedlist"],
      concept: `
## Nodes and pointers
A linked list is a chain of **nodes**; each node holds a value and a pointer to the next node. The list itself is just a pointer to the first node, the **head**. The last node points to \`null\`.

- **Singly linked**: \`next\` only.
- **Doubly linked**: \`prev\` and \`next\` — O(1) removal of a node you hold a reference to.
- **Circular**: the tail points back to the head.

## Trade-offs vs arrays
| | Array | Linked list |
|---|---|---|
| Access i-th | O(1) | O(n) — must walk |
| Insert/delete at known node | O(n) shift | **O(1)** relink |
| Insert at head | O(n) | **O(1)** |
| Memory | compact, cache-friendly | extra pointer per node, scattered |

Real systems use linked lists where O(1) splicing matters: the **LRU cache** (hash map + doubly linked list), OS free lists, adjacency lists, undo stacks, and Linux's kernel lists.

## Techniques that crack 90% of list problems
1. **Dummy (sentinel) head** — create \`dummy.next = head\` so inserting/removing the first node isn't a special case. Return \`dummy.next\`.
2. **Two pointers, different speeds** — slow moves 1, fast moves 2:
   - fast reaches the end → slow is at the **middle**;
   - fast meets slow → there's a **cycle** (Floyd's algorithm).
3. **Two pointers, fixed gap** — move \`fast\` k steps first, then move both: when fast hits the end, slow is **k-th from the end** (one pass).
4. **In-place reversal** — three pointers \`prev, curr, next\`. Memorize it; it's a building block for "reverse in k-groups", "palindrome list" and "reorder list".
5. **Merge** — merging two sorted lists with a dummy head is O(n + m) and the core of merge sort on lists.

## Reversal, line by line
\`\`\`
prev = null, curr = head
while curr:
    next = curr.next     # 1. save the rest
    curr.next = prev     # 2. flip the arrow
    prev = curr          # 3. advance prev
    curr = next          # 4. advance curr
return prev              # new head
\`\`\`

> Draw the boxes and arrows. Interviewers *expect* you to sketch pointer problems, and it prevents losing the rest of the list.
`,
      keyPoints: [
        "No random access: reaching index i is O(n).",
        "O(1) insert/delete once you hold the node (or its predecessor).",
        "Dummy head removes edge cases at the front.",
        "Fast/slow pointers find middles and cycles in O(1) space.",
        "Reverse with prev/curr/next — save next before flipping.",
      ],
      complexity: [
        { op: "Access / search", time: "O(n)" },
        { op: "Insert / delete at head", time: "O(1)" },
        { op: "Insert / delete after known node", time: "O(1)" },
        { op: "Append without tail pointer", time: "O(n)" },
        { op: "Reverse", time: "O(n)", space: "O(1)" },
      ],
      code: [
        {
          title: "Reverse a linked list (iterative & recursive)",
          variants: [
            {
              lang: "python",
              code: `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

def reverse(head):
    prev, curr = None, head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev, curr = curr, nxt
    return prev

def reverse_rec(head):
    if not head or not head.next:
        return head
    new_head = reverse_rec(head.next)
    head.next.next = head      # the node after me points back to me
    head.next = None
    return new_head
`,
            },
            {
              lang: "javascript",
              code: `
function reverse(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}

function reverseRec(head) {
  if (!head || !head.next) return head;
  const newHead = reverseRec(head.next);
  head.next.next = head;
  head.next = null;
  return newHead;
}
`,
            },
            {
              lang: "java",
              code: `
ListNode reverse(ListNode head) {
    ListNode prev = null, curr = head;
    while (curr != null) {
        ListNode next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}
`,
            },
          ],
        },
        {
          title: "Merge two sorted lists with a dummy head",
          variants: [
            {
              lang: "python",
              code: `
def merge(a, b):
    dummy = tail = ListNode()
    while a and b:
        if a.val <= b.val:
            tail.next, a = a, a.next
        else:
            tail.next, b = b, b.next
        tail = tail.next
    tail.next = a or b
    return dummy.next
`,
            },
            {
              lang: "javascript",
              code: `
function merge(a, b) {
  const dummy = { next: null };
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) { tail.next = a; a = a.next; }
    else { tail.next = b; b = b.next; }
    tail = tail.next;
  }
  tail.next = a ?? b;
  return dummy.next;
}
`,
            },
            {
              lang: "java",
              code: `
ListNode merge(ListNode a, ListNode b) {
    ListNode dummy = new ListNode(0), tail = dummy;
    while (a != null && b != null) {
        if (a.val <= b.val) { tail.next = a; a = a.next; }
        else { tail.next = b; b = b.next; }
        tail = tail.next;
    }
    tail.next = (a != null) ? a : b;
    return dummy.next;
}
`,
            },
          ],
        },
        {
          title: "Remove the n-th node from the end in one pass",
          variants: [
            {
              lang: "python",
              code: `
def remove_nth_from_end(head, n):
    dummy = ListNode(0, head)
    fast = slow = dummy
    for _ in range(n + 1):      # open a gap of n nodes
        fast = fast.next
    while fast:
        fast, slow = fast.next, slow.next
    slow.next = slow.next.next   # slow is just before the target
    return dummy.next
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How do you detect a cycle in a linked list? Can you find where it starts?",
          a: "**Floyd's tortoise and hare**: slow moves 1 step, fast 2. If fast hits null there's no cycle; if they meet, there is. To find the start, reset one pointer to the head and move both 1 step at a time — they meet at the cycle entrance. Why: if the distance head→entrance is a and meeting point is b into the cycle of length c, then 2(a+b) = a+b+kc ⇒ a = kc − b, so walking a steps from the meeting point lands on the entrance. O(n) time, O(1) space (a hash set works too but costs O(n) space).",
          freq: "very-common",
        },
        {
          q: "Why does an LRU cache use a doubly linked list plus a hash map?",
          a: "The hash map gives O(1) lookup from key → node. The doubly linked list keeps nodes in recency order and allows O(1) removal of an arbitrary node (we have its `prev` pointer) and O(1) insertion at the front. On `get`, move the node to the front; on `put` when full, evict the tail. A singly linked list can't remove an arbitrary node in O(1) without its predecessor.",
          freq: "very-common",
        },
        {
          q: "Reverse a linked list — iterative vs recursive complexity?",
          a: "Both are O(n) time. Iterative uses **O(1)** extra space; recursive uses **O(n)** call-stack space and can overflow on very long lists (Python's default recursion limit is 1000). Prefer iterative in production; know both for interviews.",
          freq: "very-common",
        },
        {
          q: "How do you find the middle of a linked list in one pass?",
          a: "Slow/fast pointers: slow moves 1, fast moves 2. When fast reaches the end, slow is at the middle. For even length, starting both at head gives the second middle; start fast at `head.next` to get the first middle (useful for splitting in merge sort).",
          freq: "common",
        },
        {
          q: "How would you check if a linked list is a palindrome in O(1) space?",
          a: "Find the middle (fast/slow), reverse the second half in place, compare the two halves node by node, then (politely) reverse the second half back to restore the list. O(n) time, O(1) space.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Accessing the 1000th node of a singly linked list is…",
          options: ["O(1)", "O(log n)", "O(n)", "Impossible"],
          answer: 2,
          explain: "You must follow next pointers one by one.",
        },
        {
          q: "When reversing, why save `next = curr.next` first?",
          options: [
            "For speed",
            "Because flipping curr.next would lose the rest of the list",
            "To detect cycles",
            "Python requires it",
          ],
          answer: 1,
          explain: "After curr.next = prev, the only reference to the remainder is gone unless saved.",
        },
        {
          q: "What does a dummy head node buy you?",
          options: ["Faster traversal", "No special case when the head changes", "Less memory", "Thread safety"],
          answer: 1,
          explain: "Insertions/removals at the front become ordinary operations on dummy.next.",
        },
        {
          q: "Floyd's cycle detection uses how much extra space?",
          options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
          answer: 0,
          explain: "Just two pointers.",
        },
        {
          q: "Deleting a node you hold a reference to is O(1) in a…",
          options: ["Singly linked list always", "Doubly linked list", "Array", "None of these"],
          answer: 1,
          explain: "With prev available you can relink neighbours directly.",
        },
      ],
      problems: [
        { title: "Reverse Linked List", url: lc("reverse-linked-list"), difficulty: "Easy" },
        { title: "Merge Two Sorted Lists", url: lc("merge-two-sorted-lists"), difficulty: "Easy" },
        { title: "Linked List Cycle", url: lc("linked-list-cycle"), difficulty: "Easy" },
        { title: "Middle of the Linked List", url: lc("middle-of-the-linked-list"), difficulty: "Easy" },
        { title: "Remove Nth Node From End of List", url: lc("remove-nth-node-from-end-of-list"), difficulty: "Medium" },
        { title: "Reorder List", url: lc("reorder-list"), difficulty: "Medium" },
        { title: "Add Two Numbers", url: lc("add-two-numbers"), difficulty: "Medium" },
        { title: "Copy List with Random Pointer", url: lc("copy-list-with-random-pointer"), difficulty: "Medium" },
        { title: "LRU Cache", url: lc("lru-cache"), difficulty: "Medium" },
        { title: "Merge k Sorted Lists", url: lc("merge-k-sorted-lists"), difficulty: "Hard" },
        { title: "Reverse Nodes in k-Group", url: lc("reverse-nodes-in-k-group"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ STACKS & QUEUES
    {
      id: "stacks-queues",
      title: "Stacks & Queues",
      tagline: "LIFO and FIFO — the engines behind DFS, BFS and undo.",
      difficulty: "beginner",
      minutes: 12,
      visualizers: ["stackqueue"],
      concept: `
## Stack — last in, first out
Think of a stack of plates: you only touch the top. Operations \`push\`, \`pop\` and \`peek\` are all **O(1)**. Implement with a dynamic array (push/pop at the end) or a linked list (push/pop at the head).

**Where stacks hide:**
- The **call stack** — every function call pushes a frame; recursion *is* a stack.
- **Undo/redo**, browser back button.
- **Matching** brackets, HTML tags, nested structures.
- **Expression evaluation** (Reverse Polish Notation, shunting-yard).
- **Iterative DFS** — replace recursion with an explicit stack.
- **Monotonic stacks** — "next greater element" style problems in O(n) (see the Patterns world).

## Queue — first in, first out
A line at a coffee shop: enqueue at the back, dequeue at the front, both **O(1)** when implemented properly:
- **Circular buffer** — an array with \`head\` and \`tail\` indices that wrap around with modulo (watch the visualizer).
- **Linked list** with head and tail pointers.

> ⚠️ \`list.pop(0)\` in Python and \`array.shift()\` in JavaScript are **O(n)** — they shift every element. Use \`collections.deque\` (Python) or an index pointer / proper queue class.

**Where queues hide:** BFS and level-order traversal, task schedulers, rate limiters, producer/consumer pipelines, message brokers (Kafka, SQS — see System Design).

## Deque and priority queue
- A **deque** (double-ended queue) supports O(1) push/pop at both ends — the tool for sliding-window maximum.
- A **priority queue** pops the *smallest* (or largest) item rather than the oldest. It is implemented with a **heap** (Trees & Graphs world): O(log n) push/pop.

## Two classic designs
- **Queue from two stacks**: push onto \`in\`; to dequeue, if \`out\` is empty pour everything from \`in\` into \`out\` (reversing the order), then pop \`out\`. Each element moves at most twice → **amortized O(1)**.
- **Min stack**: alongside each value, store the minimum *at the time it was pushed*. \`getMin()\` is then just a peek: O(1).
`,
      keyPoints: [
        "Stack = LIFO (push/pop top); queue = FIFO (enqueue back, dequeue front).",
        "All core operations are O(1) with the right implementation.",
        "Recursion is an implicit stack; BFS needs a queue.",
        "Avoid list.pop(0) / array.shift() for queues — they're O(n).",
        "Queue via two stacks is amortized O(1); min stack stores running minimums.",
      ],
      complexity: [
        { op: "push / pop / peek (stack)", time: "O(1)" },
        { op: "enqueue / dequeue (ring buffer / deque)", time: "O(1)" },
        { op: "search", time: "O(n)" },
        { op: "queue via two stacks", time: "O(1) amortized" },
      ],
      code: [
        {
          title: "Valid parentheses",
          variants: [
            {
              lang: "python",
              code: `
def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack
`,
            },
            {
              lang: "javascript",
              code: `
function isValid(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    } else stack.push(ch);
  }
  return stack.length === 0;
}
`,
            },
            {
              lang: "java",
              code: `
boolean isValid(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    for (char ch : s.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') stack.push(ch);
        else {
            if (stack.isEmpty()) return false;
            char open = stack.pop();
            if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{'))
                return false;
        }
    }
    return stack.isEmpty();
}
`,
            },
          ],
        },
        {
          title: "Min stack in O(1)",
          variants: [
            {
              lang: "python",
              code: `
class MinStack:
    def __init__(self):
        self.items = []                 # (value, min_so_far)

    def push(self, x):
        cur_min = min(x, self.items[-1][1]) if self.items else x
        self.items.append((x, cur_min))

    def pop(self):
        return self.items.pop()[0]

    def top(self):
        return self.items[-1][0]

    def get_min(self):
        return self.items[-1][1]
`,
            },
            {
              lang: "javascript",
              code: `
class MinStack {
  items = []; // [value, minSoFar]
  push(x) {
    const m = this.items.length ? Math.min(x, this.items.at(-1)[1]) : x;
    this.items.push([x, m]);
  }
  pop() { return this.items.pop()[0]; }
  top() { return this.items.at(-1)[0]; }
  getMin() { return this.items.at(-1)[1]; }
}
`,
            },
          ],
        },
        {
          title: "Queue using two stacks (amortized O(1))",
          variants: [
            {
              lang: "python",
              code: `
class MyQueue:
    def __init__(self):
        self.inbox, self.outbox = [], []

    def push(self, x):
        self.inbox.append(x)

    def pop(self):
        self.peek()
        return self.outbox.pop()

    def peek(self):
        if not self.outbox:               # pour only when empty
            while self.inbox:
                self.outbox.append(self.inbox.pop())
        return self.outbox[-1]
`,
            },
            {
              lang: "java",
              code: `
class MyQueue {
    private final Deque<Integer> in = new ArrayDeque<>(), out = new ArrayDeque<>();
    void push(int x) { in.push(x); }
    int pop() { peek(); return out.pop(); }
    int peek() {
        if (out.isEmpty()) while (!in.isEmpty()) out.push(in.pop());
        return out.peek();
    }
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Implement a queue using two stacks. What is the complexity?",
          a: "Push onto `inbox`. On pop/peek, if `outbox` is empty, move every element from `inbox` to `outbox` (this reverses order so the oldest is on top), then pop from `outbox`. A single pop can be O(n), but each element is moved at most once from inbox to outbox, so n operations cost O(n) total → **O(1) amortized** per operation.",
          freq: "very-common",
        },
        {
          q: "Design a stack that returns the minimum element in O(1).",
          a: "Store pairs `(value, minSoFar)` or keep a second stack of minimums (push onto it when the new value ≤ current min; pop it when popping that value). `getMin` is a peek at the top: O(1) time, O(n) extra space worst case.",
          freq: "very-common",
        },
        {
          q: "Why shouldn't you use a Python list as a queue?",
          a: "`list.pop(0)` and `list.insert(0, x)` shift every remaining element → O(n). A BFS on a large graph then becomes O(V²). Use `collections.deque`, whose `popleft` / `appendleft` are O(1) (it's a doubly linked list of fixed-size blocks).",
          freq: "common",
        },
        {
          q: "What is the difference between the stack and the heap (memory)?",
          a: "Different concept from the data structures! The **call stack** holds function frames (locals, return addresses); allocation is just moving a pointer, it's freed automatically on return, and it's small (often 1–8 MB) — deep recursion causes *stack overflow*. The **heap** holds dynamically allocated objects with arbitrary lifetimes, managed by `malloc/free` or a garbage collector. The heap *data structure* (priority queue) is unrelated.",
          freq: "common",
        },
        {
          q: "Evaluate an expression in Reverse Polish Notation.",
          a: "Scan tokens. Push numbers. On an operator, pop `b` then `a` (order matters!), compute `a op b`, push the result. The final stack item is the answer. For division, many problems want truncation toward zero (`int(a / b)` in Python, not `//`). O(n) time and space.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which structure does BFS rely on?",
          options: ["Stack", "Queue", "Heap", "Hash set only"],
          answer: 1,
          explain: "BFS explores nodes in the order discovered — FIFO.",
        },
        {
          q: "Complexity of `list.pop(0)` in Python?",
          options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
          answer: 2,
          explain: "Every remaining element shifts left one slot.",
        },
        {
          q: "In a circular buffer of capacity 8, tail is 7. After one enqueue tail becomes…",
          options: ["8", "0", "7", "1"],
          answer: 1,
          explain: "(7 + 1) mod 8 = 0 — it wraps around.",
        },
        {
          q: "Queue via two stacks: amortized cost per operation?",
          options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
          answer: 0,
          explain: "Each element is moved between stacks at most once.",
        },
        {
          q: "For input \"([)]\" the bracket checker…",
          options: ["Returns valid", "Fails at ')' because top is '['", "Fails at the end", "Fails at '('"],
          answer: 1,
          explain: "When ')' arrives the top of the stack is '[', which doesn't match.",
        },
      ],
      problems: [
        { title: "Valid Parentheses", url: lc("valid-parentheses"), difficulty: "Easy" },
        { title: "Implement Queue using Stacks", url: lc("implement-queue-using-stacks"), difficulty: "Easy" },
        { title: "Min Stack", url: lc("min-stack"), difficulty: "Medium" },
        { title: "Evaluate Reverse Polish Notation", url: lc("evaluate-reverse-polish-notation"), difficulty: "Medium" },
        { title: "Daily Temperatures", url: lc("daily-temperatures"), difficulty: "Medium", note: "monotonic stack" },
        { title: "Decode String", url: lc("decode-string"), difficulty: "Medium" },
        { title: "Asteroid Collision", url: lc("asteroid-collision"), difficulty: "Medium" },
        { title: "Sliding Window Maximum", url: lc("sliding-window-maximum"), difficulty: "Hard", note: "monotonic deque" },
      ],
    },

    // ------------------------------------------------------------------ RECURSION
    {
      id: "recursion",
      title: "Recursion & Memoization",
      tagline: "Trust the recursive call — then stop it from repeating work.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["recursion"],
      concept: `
## The recipe
A recursive function solves a problem by calling itself on a **smaller** version of the same problem. Every correct recursion has:
1. **Base case(s)** — inputs small enough to answer directly.
2. **Recursive case** — break the problem down and combine the sub-answers.
3. **Progress** — every call moves toward a base case (otherwise: infinite recursion → stack overflow).

## The leap of faith
Don't trace the whole call tree in your head. *Assume* the recursive call works for smaller input, and only ask: "given the answer for n−1 (or for each half / each child), how do I build the answer for n?" Proof by induction, in code.

## What it costs
Each call pushes a **stack frame**. Time ≈ (number of calls) × (work per call); space ≈ **maximum depth** × (frame size). Default limits matter: Python stops at ~1000 frames, the JVM and V8 at roughly 10k–20k depending on frame size.

### Recursion trees and the Master theorem
For divide-and-conquer recurrences \`T(n) = a·T(n/b) + f(n)\`, memorize the common results:

| Recurrence | Example | Result |
|---|---|---|
| T(n) = T(n/2) + O(1) | binary search | O(log n) |
| T(n) = 2T(n/2) + O(1) | tree traversal | O(n) |
| T(n) = 2T(n/2) + O(n) | merge sort | O(n log n) |
| T(n) = T(n−1) + O(1) | linear recursion | O(n) |
| T(n) = 2T(n−1) + O(1) | naive Fibonacci / subsets | O(2ⁿ) |

## Overlapping subproblems → memoization
Naive \`fib(n) = fib(n−1) + fib(n−2)\` recomputes the same values exponentially many times (fib(5) computes fib(2) three times — watch the visualizer). **Memoization** caches each result the first time it's computed; every later call is an O(1) lookup. Fibonacci drops from O(2ⁿ) to **O(n)**.

This is **top-down dynamic programming**. Its sibling, **bottom-up tabulation**, fills a table from the base cases upward with loops — no recursion depth limit and often less overhead. (Deep dive in the Algorithms world.)

## Recursion vs iteration
Anything recursive can be written iteratively with an explicit stack. Prefer recursion when the structure is naturally recursive (trees, divide & conquer, backtracking) and depth is bounded (e.g. balanced trees: O(log n) depth). Prefer iteration for long linear chains. Python, Java and JavaScript (in practice) do **not** optimize tail calls, so tail recursion doesn't save stack there.
`,
      keyPoints: [
        "Base case + smaller subproblem + progress toward the base.",
        "Space = maximum recursion depth (the call stack).",
        "Draw the recursion tree to count calls.",
        "Overlapping subproblems? Memoize: exponential → polynomial.",
        "Python's default recursion limit is ~1000 — go iterative for deep chains.",
      ],
      complexity: [
        { op: "Naive fib(n)", time: "O(2ⁿ)", space: "O(n)" },
        { op: "Memoized fib(n)", time: "O(n)", space: "O(n)" },
        { op: "Bottom-up fib(n)", time: "O(n)", space: "O(1)" },
        { op: "Fast power x^n", time: "O(log n)", space: "O(log n)" },
      ],
      code: [
        {
          title: "Fibonacci three ways",
          variants: [
            {
              lang: "python",
              code: `
from functools import lru_cache

def fib_naive(n):                 # O(2^n) time
    return n if n < 2 else fib_naive(n - 1) + fib_naive(n - 2)

@lru_cache(maxsize=None)          # memoization: O(n) time
def fib_memo(n):
    return n if n < 2 else fib_memo(n - 1) + fib_memo(n - 2)

def fib_iter(n):                  # tabulation, O(1) space
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
`,
            },
            {
              lang: "javascript",
              code: `
const fibNaive = (n) => (n < 2 ? n : fibNaive(n - 1) + fibNaive(n - 2));

function fibMemo(n, memo = new Map()) {
  if (n < 2) return n;
  if (memo.has(n)) return memo.get(n);
  const v = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  memo.set(n, v);
  return v;
}

function fibIter(n) {
  let [a, b] = [0, 1];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
`,
            },
            {
              lang: "java",
              code: `
long fibMemo(int n, long[] memo) {
    if (n < 2) return n;
    if (memo[n] != 0) return memo[n];
    return memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
}

long fibIter(int n) {
    long a = 0, b = 1;
    for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }
    return a;
}
`,
            },
          ],
        },
        {
          title: "Fast exponentiation — divide and conquer",
          note: "x^n = (x^(n/2))² — halving n each call gives O(log n).",
          variants: [
            {
              lang: "python",
              code: `
def my_pow(x, n):
    if n < 0:
        return 1 / my_pow(x, -n)
    if n == 0:
        return 1.0
    half = my_pow(x, n // 2)
    return half * half if n % 2 == 0 else half * half * x
`,
            },
            {
              lang: "javascript",
              code: `
function myPow(x, n) {
  if (n < 0) return 1 / myPow(x, -n);
  if (n === 0) return 1;
  const half = myPow(x, Math.floor(n / 2));
  return n % 2 === 0 ? half * half : half * half * x;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Memoization vs tabulation — what's the difference?",
          a: "Both are dynamic programming. **Memoization** is top-down: write the natural recursion and cache results; only the subproblems actually needed get computed, but you pay recursion overhead and depth limits. **Tabulation** is bottom-up: iterate from base cases and fill a table; no recursion, easy to reduce space (keep only the last row), but you must figure out a valid evaluation order and may compute unneeded states.",
          freq: "very-common",
        },
        {
          q: "What causes a stack overflow and how do you avoid it?",
          a: "Each call consumes stack space; unbounded or very deep recursion exhausts it (missing base case, or depth ~n for large n). Fixes: make sure the base case is reachable, convert to iteration with an explicit stack/queue, reduce depth (divide in halves rather than peel one element at a time), or raise the limit (`sys.setrecursionlimit`) as a last resort.",
          freq: "common",
        },
        {
          q: "What is the time complexity of naive recursive Fibonacci, precisely?",
          a: "The number of calls satisfies C(n) = C(n−1) + C(n−2) + 1, which grows like φⁿ ≈ 1.618ⁿ. It's commonly quoted as O(2ⁿ) (a valid upper bound); the tight bound is Θ(φⁿ). Space is O(n) for the deepest path.",
          freq: "common",
        },
        {
          q: "Does tail recursion help in Python/Java/JavaScript?",
          a: "Not in practice. Tail-call optimization reuses the current frame when the recursive call is the last action, giving O(1) stack — Scheme, Scala (`@tailrec`), Kotlin (`tailrec`) and C/C++ compilers (often) do it. CPython deliberately doesn't, the JVM doesn't, and among JS engines only Safari implements proper tail calls. Rewrite as a loop instead.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Which recurrence describes merge sort?",
          options: ["T(n) = T(n/2) + 1", "T(n) = 2T(n/2) + n", "T(n) = T(n−1) + n", "T(n) = 2T(n−1) + 1"],
          answer: 1,
          explain: "Two halves recursively, plus a linear merge → O(n log n).",
        },
        {
          q: "Memoizing fib(n) changes its time complexity from O(2ⁿ) to…",
          options: ["O(n²)", "O(n log n)", "O(n)", "O(1)"],
          answer: 2,
          explain: "Each of the n distinct subproblems is computed once.",
        },
        {
          q: "The space complexity of recursion is governed by…",
          options: ["Total number of calls", "Maximum recursion depth", "Number of base cases", "Input size only"],
          answer: 1,
          explain: "Only the frames currently on the stack occupy memory at once.",
        },
        {
          q: "Fast exponentiation computing x^n by halving n runs in…",
          options: ["O(n)", "O(log n)", "O(√n)", "O(1)"],
          answer: 1,
          explain: "n halves each call: T(n) = T(n/2) + O(1).",
        },
        {
          q: "Python's default maximum recursion depth is about…",
          options: ["100", "1,000", "100,000", "Unlimited"],
          answer: 1,
          explain: "sys.getrecursionlimit() is 1000 by default.",
        },
      ],
      problems: [
        { title: "Fibonacci Number", url: lc("fibonacci-number"), difficulty: "Easy" },
        { title: "Climbing Stairs", url: lc("climbing-stairs"), difficulty: "Easy" },
        { title: "Pow(x, n)", url: lc("powx-n"), difficulty: "Medium" },
        { title: "Subsets", url: lc("subsets"), difficulty: "Medium" },
        { title: "Permutations", url: lc("permutations"), difficulty: "Medium" },
        { title: "Letter Combinations of a Phone Number", url: lc("letter-combinations-of-a-phone-number"), difficulty: "Medium" },
        { title: "Decode Ways", url: lc("decode-ways"), difficulty: "Medium" },
        { title: "K-th Symbol in Grammar", url: lc("k-th-symbol-in-grammar"), difficulty: "Medium" },
      ],
    },
  ],
};
