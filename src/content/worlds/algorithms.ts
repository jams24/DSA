import type { World } from "../types";

const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export const algorithms: World = {
  id: "algorithms",
  order: 3,
  title: "Algorithm Caverns",
  subtitle: "Sorting, binary search, DP, greedy, backtracking & bits",
  description:
    "The core algorithmic techniques behind almost every coding interview. Learn when each strategy applies — and how to prove your choice to the interviewer.",
  emoji: "⛏️",
  color: "#d97706",
  boss: {
    name: "The Quicksort Golem",
    title: "Partitioner of Heroes",
    emoji: "🗿",
    taunt: "I will partition you into two piles: those who time out, and those who overflow the stack!",
    defeat: "My pivot... was the worst case... crumbling to O(1)...",
  },
  lessons: [
    // ------------------------------------------------------------------ SORTING
    {
      id: "sorting",
      title: "Sorting Algorithms",
      tagline: "Six sorts, their trade-offs, and when sorting is the whole trick.",
      difficulty: "beginner",
      minutes: 16,
      visualizers: ["sorting"],
      concept: `
## Why sorting still matters
You'll rarely implement a sort at work — but interviews test whether you understand *why* algorithms differ, and **"sort first"** is the opening move for a huge number of problems: two pointers, merging intervals, greedy scheduling, binary search, deduplication, anagram grouping.

## The quadratic trio
- **Bubble sort** — repeatedly swap adjacent out-of-order pairs. O(n²). Only use: teaching (and its early-exit O(n) best case).
- **Selection sort** — find the minimum, put it in front. Always O(n²) comparisons but only O(n) swaps (useful when writes are expensive).
- **Insertion sort** — grow a sorted prefix by inserting each new element into place. O(n²) worst case but **O(n) on nearly sorted input**, tiny constants, stable. Real libraries use it for small subarrays (n < ~16–64).

## The O(n log n) workhorses
- **Merge sort** — split in half, sort each, merge. Guaranteed O(n log n), **stable**, needs O(n) extra space. Perfect for linked lists and **external sorting** (data bigger than RAM: sort chunks, k-way merge).
- **Quicksort** — pick a pivot, partition into < pivot and > pivot, recurse. O(n log n) average, **in place**, cache-friendly, fastest in practice. Worst case O(n²) on bad pivots (sorted input + first/last pivot) → randomize the pivot or use median-of-three. **Introsort** (C++ \`std::sort\`) falls back to heap sort when recursion gets too deep.
- **Heap sort** — heapify, then repeatedly move the max to the end. O(n log n) worst case, O(1) space, not stable, poor cache behaviour.

## Beating n log n
Comparison sorts can't beat Ω(n log n) (there are n! orderings; each comparison yields one bit of information → log₂(n!) ≈ n log n comparisons). Non-comparison sorts can, when keys are constrained:
- **Counting sort** — integer keys in a small range k: O(n + k).
- **Radix sort** — sort digit by digit with a stable counting sort: O(d · (n + b)).
- **Bucket sort** — uniformly distributed floats: O(n) expected.

## Stability
A **stable** sort keeps equal keys in their original order. It matters when sorting by multiple keys in passes (sort by first name, then *stably* by last name). Merge, insertion, counting and Timsort are stable; quick, heap and selection aren't.

## What your language actually uses
| Language | Algorithm |
|---|---|
| Python \`sorted\` / \`list.sort\` | Timsort (merge + insertion, exploits runs), stable |
| Java \`Arrays.sort\` primitives | Dual-pivot quicksort |
| Java \`Arrays.sort\` objects / \`Collections.sort\` | Timsort, stable |
| C++ \`std::sort\` / \`std::stable_sort\` | Introsort / merge sort |
| JavaScript \`Array.prototype.sort\` (V8) | Timsort, stable — and **compares as strings by default**: pass \`(a, b) => a - b\` |

## Quickselect
Need only the k-th smallest? Partition once and recurse into **one** side: O(n) average. That's how you find medians and top-k without fully sorting.
`,
      keyPoints: [
        "Comparison sorts are Ω(n log n); counting/radix can be O(n) for bounded keys.",
        "Merge sort: stable, O(n) extra, guaranteed n log n.",
        "Quicksort: in place, fastest on average, randomize the pivot.",
        "Insertion sort is O(n) on nearly sorted data — used inside Timsort.",
        "JS default sort compares strings: always pass a comparator.",
        "Quickselect finds the k-th element in O(n) average.",
      ],
      complexity: [
        { op: "Bubble / Selection / Insertion", time: "O(n²)", space: "O(1)", note: "insertion O(n) if nearly sorted" },
        { op: "Merge sort", time: "O(n log n)", space: "O(n)", note: "stable" },
        { op: "Quicksort", time: "O(n log n) avg / O(n²) worst", space: "O(log n)" },
        { op: "Heap sort", time: "O(n log n)", space: "O(1)" },
        { op: "Counting sort", time: "O(n + k)", space: "O(k)" },
        { op: "Quickselect", time: "O(n) avg", space: "O(1)" },
      ],
      code: [
        {
          title: "Merge sort & quicksort",
          variants: [
            {
              lang: "python",
              code: `
import random

def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left, right = merge_sort(a[:mid]), merge_sort(a[mid:])
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:          # <= keeps it stable
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    return out + left[i:] + right[j:]

def quick_sort(a, lo=0, hi=None):
    if hi is None:
        hi = len(a) - 1
    if lo >= hi:
        return
    r = random.randint(lo, hi)           # random pivot avoids O(n^2) on sorted input
    a[r], a[hi] = a[hi], a[r]
    pivot, i = a[hi], lo
    for j in range(lo, hi):              # Lomuto partition
        if a[j] < pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]
    quick_sort(a, lo, i - 1)
    quick_sort(a, i + 1, hi)
`,
            },
            {
              lang: "javascript",
              code: `
function mergeSort(a) {
  if (a.length <= 1) return a;
  const mid = a.length >> 1;
  const L = mergeSort(a.slice(0, mid)), R = mergeSort(a.slice(mid));
  const out = [];
  let i = 0, j = 0;
  while (i < L.length && j < R.length) out.push(L[i] <= R[j] ? L[i++] : R[j++]);
  return out.concat(L.slice(i), R.slice(j));
}

function quickSort(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return a;
  const r = lo + Math.floor(Math.random() * (hi - lo + 1));
  [a[r], a[hi]] = [a[hi], a[r]];
  const pivot = a[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) if (a[j] < pivot) { [a[i], a[j]] = [a[j], a[i]]; i++; }
  [a[i], a[hi]] = [a[hi], a[i]];
  quickSort(a, lo, i - 1);
  quickSort(a, i + 1, hi);
  return a;
}
`,
            },
            {
              lang: "java",
              code: `
void mergeSort(int[] a, int lo, int hi, int[] tmp) {
    if (hi - lo < 1) return;
    int mid = (lo + hi) >>> 1;
    mergeSort(a, lo, mid, tmp);
    mergeSort(a, mid + 1, hi, tmp);
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
    while (i <= mid) tmp[k++] = a[i++];
    while (j <= hi) tmp[k++] = a[j++];
    System.arraycopy(tmp, lo, a, lo, hi - lo + 1);
}
`,
            },
          ],
        },
        {
          title: "Quickselect: k-th largest in O(n) average",
          variants: [
            {
              lang: "python",
              code: `
import random

def kth_largest(nums, k):
    target = len(nums) - k                # index in sorted order
    lo, hi = 0, len(nums) - 1
    while True:
        r = random.randint(lo, hi)
        nums[r], nums[hi] = nums[hi], nums[r]
        pivot, i = nums[hi], lo
        for j in range(lo, hi):
            if nums[j] < pivot:
                nums[i], nums[j] = nums[j], nums[i]
                i += 1
        nums[i], nums[hi] = nums[hi], nums[i]
        if i == target:
            return nums[i]
        if i < target:
            lo = i + 1
        else:
            hi = i - 1
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Quicksort vs merge sort — which would you use and why?",
          a: "**Quicksort** for in-memory arrays of primitives: in place (O(log n) stack), excellent cache locality, smallest constants — with a randomized/median-of-three pivot to avoid O(n²). **Merge sort** when you need **stability**, a **guaranteed** O(n log n), sorting **linked lists** (merge needs no random access and O(1) extra space for lists), or **external sorting** of data larger than memory. That's why Java uses quicksort for primitives but Timsort (merge-based, stable) for objects.",
          freq: "very-common",
        },
        {
          q: "Sort a 100 GB file of integers on a machine with 4 GB of RAM.",
          a: "**External merge sort.** (1) Read ~3 GB chunks, sort each in memory, write ~34 sorted runs to disk. (2) k-way merge: open all runs, keep a min-heap of the current head of each run, repeatedly pop the min and write it to output, refilling from that run. Buffer reads/writes in large blocks to keep I/O sequential. Total O(n log n) CPU and ~2 passes of disk I/O. If integers are bounded (e.g. 32-bit), counting with a bitmap or bucketing by high bits are alternatives.",
          freq: "common",
        },
        {
          q: "What does it mean for a sort to be stable, and when does it matter?",
          a: "Stable = equal keys keep their original relative order. It matters for **multi-key sorting** in passes (sort transactions by time, then stably by account → grouped by account, time-ordered within) and when the original order carries meaning (UI lists). Radix sort *requires* a stable inner sort.",
          freq: "common",
        },
        {
          q: "Why is quicksort's worst case O(n²) and how do you avoid it?",
          a: "If the pivot is always the min or max (e.g. already-sorted input with the first/last element as pivot), each partition removes only one element: n + (n−1) + … = O(n²), with O(n) recursion depth. Avoid it with a **random pivot** or **median-of-three**, **three-way partitioning** for many duplicates (Dutch national flag), recursing on the smaller side first (O(log n) stack), and introsort's fallback to heap sort.",
          freq: "common",
        },
        {
          q: "Can you sort faster than O(n log n)?",
          a: "Not with comparisons — the decision-tree lower bound is log₂(n!) = Θ(n log n). With **constraints on the keys** you can: counting sort O(n + k) for small integer ranges, radix sort O(d·n) for fixed-width keys, bucket sort O(n) expected for uniform data. Example: sort 10 million ages (0–150) with counting sort in one pass.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which sort is stable, O(n log n) worst case, and needs O(n) extra space?",
          options: ["Quicksort", "Heap sort", "Merge sort", "Selection sort"],
          answer: 2,
          explain: "Merge sort trades extra memory for stability and guaranteed n log n.",
        },
        {
          q: "Quicksort with the last element as pivot on already-sorted input runs in…",
          options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
          answer: 2,
          explain: "Every partition is maximally unbalanced.",
        },
        {
          q: "Which algorithm is fastest on an almost-sorted array?",
          options: ["Selection sort", "Insertion sort", "Heap sort", "Quicksort with first-element pivot"],
          answer: 1,
          explain: "Each element moves only a little: close to O(n).",
        },
        {
          q: "`[10, 9, 1].sort()` in JavaScript returns…",
          options: ["[1, 9, 10]", "[1, 10, 9]", "[10, 9, 1]", "An error"],
          answer: 1,
          explain: "Default sort compares string representations: \"1\" < \"10\" < \"9\".",
        },
        {
          q: "The lower bound for comparison-based sorting is…",
          options: ["Ω(n)", "Ω(n log n)", "Ω(n²)", "Ω(log n)"],
          answer: 1,
          explain: "log₂(n!) comparisons are needed to distinguish all orderings.",
        },
        {
          q: "Finding the k-th smallest element without fully sorting, on average, takes…",
          options: ["O(k)", "O(n)", "O(n log n)", "O(n log k)"],
          answer: 1,
          explain: "Quickselect recurses into only one partition.",
        },
      ],
      problems: [
        { title: "Sort an Array", url: lc("sort-an-array"), difficulty: "Medium" },
        { title: "Sort Colors", url: lc("sort-colors"), difficulty: "Medium", note: "Dutch national flag" },
        { title: "Kth Largest Element in an Array", url: lc("kth-largest-element-in-an-array"), difficulty: "Medium", note: "quickselect" },
        { title: "Largest Number", url: lc("largest-number"), difficulty: "Medium", note: "custom comparator" },
        { title: "Sort List", url: lc("sort-list"), difficulty: "Medium", note: "merge sort on a list" },
        { title: "Maximum Gap", url: lc("maximum-gap"), difficulty: "Medium", note: "bucket sort" },
        { title: "Count of Smaller Numbers After Self", url: lc("count-of-smaller-numbers-after-self"), difficulty: "Hard", note: "merge sort counting" },
      ],
    },

    // ------------------------------------------------------------------ BINARY SEARCH
    {
      id: "binary-search",
      title: "Binary Search",
      tagline: "Halve the search space — on arrays, and on answers.",
      difficulty: "intermediate",
      minutes: 15,
      visualizers: ["binarysearch"],
      concept: `
## The idea
If you can look at the middle of a search space and decide which half **cannot** contain the answer, you can discard it. Each step halves the space: **O(log n)**. 2³⁰ ≈ a billion → at most ~30 steps.

Binary search needs a **monotonic** condition, not necessarily a sorted array. Sorted arrays are just the most common source of monotonicity.

## Three templates — pick one and own it
**1. Exact match** (closed interval):
\`\`\`
lo, hi = 0, n - 1
while lo <= hi:
    mid = lo + (hi - lo) // 2
    if a[mid] == t: return mid
    if a[mid] < t: lo = mid + 1
    else:          hi = mid - 1
return -1          # lo is the insertion point
\`\`\`

**2. Lower bound — first index where \`cond(i)\` is true** (half-open):
\`\`\`
lo, hi = 0, n          # answer in [lo, hi]
while lo < hi:
    mid = (lo + hi) // 2
    if cond(mid): hi = mid     # mid might be the answer
    else:         lo = mid + 1
return lo
\`\`\`
With \`cond(i) = a[i] >= t\` this is \`bisect_left\`; with \`a[i] > t\` it's \`bisect_right\`. First/last occurrence, insert position, and count-in-range all fall out of these two.

**3. Binary search on the answer.** When the question is "minimum X such that feasible(X)" and feasibility is monotonic (if X works, X+1 works), binary search over **X** itself:
- Koko eating bananas — minimum speed
- Capacity to ship packages within D days
- Split array largest sum — minimize the maximum
- Minimum days to make m bouquets, aggressive cows, magnetic balls

The skeleton is template 2 with \`cond = feasible\`; write \`feasible\` as an O(n) greedy check. Total **O(n log(range))**.

## Classic pitfalls
- **Overflow**: \`(lo + hi) / 2\` can overflow 32-bit ints in Java/C++ — use \`lo + (hi - lo) / 2\`.
- **Infinite loops**: with \`lo = mid\` you must round mid **up** (\`(lo + hi + 1) / 2\`).
- **Off-by-one**: be explicit whether \`hi\` is inclusive or exclusive and keep the invariant in a comment.

## Rotated & unusual arrays
- **Rotated sorted array**: one half around \`mid\` is always sorted; check if the target lies in that half's range.
- **Peak element**: compare \`a[mid]\` with \`a[mid+1]\` — climb toward the larger side.
- **2-D matrix** sorted row-wise and column-wise: start at the top-right corner and walk (O(m + n)), or treat a fully sorted matrix as a 1-D array.
- **Median of two sorted arrays**: binary search the partition point of the smaller array: O(log min(m, n)).
`,
      keyPoints: [
        "Needs monotonicity, not necessarily a sorted array.",
        "Use lo + (hi − lo) / 2 to avoid overflow.",
        "Lower-bound template: while lo < hi; cond(mid) ? hi = mid : lo = mid + 1.",
        "'Minimize the maximum' / 'minimum feasible X' ⇒ binary search the answer.",
        "Rotated array: one side of mid is always sorted.",
      ],
      complexity: [
        { op: "Search sorted array", time: "O(log n)", space: "O(1)" },
        { op: "Binary search on answer", time: "O(n · log range)" },
        { op: "Rotated array search", time: "O(log n)" },
        { op: "Median of two sorted arrays", time: "O(log min(m, n))" },
      ],
      code: [
        {
          title: "Lower bound & search in a rotated array",
          variants: [
            {
              lang: "python",
              code: `
def lower_bound(a, t):
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] >= t:
            hi = mid
        else:
            lo = mid + 1
    return lo

def search_rotated(a, t):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == t:
            return mid
        if a[lo] <= a[mid]:                 # left half sorted
            if a[lo] <= t < a[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:                               # right half sorted
            if a[mid] < t <= a[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
`,
            },
            {
              lang: "javascript",
              code: `
function lowerBound(a, t) {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] >= t) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function searchRotated(a, t) {
  let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] === t) return mid;
    if (a[lo] <= a[mid]) {
      if (a[lo] <= t && t < a[mid]) hi = mid - 1; else lo = mid + 1;
    } else {
      if (a[mid] < t && t <= a[hi]) lo = mid + 1; else hi = mid - 1;
    }
  }
  return -1;
}
`,
            },
            {
              lang: "java",
              code: `
int lowerBound(int[] a, int t) {
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] >= t) hi = mid; else lo = mid + 1;
    }
    return lo;
}
`,
            },
          ],
        },
        {
          title: "Binary search on the answer: ship packages in D days",
          variants: [
            {
              lang: "python",
              code: `
def ship_within_days(weights, days):
    def feasible(cap):                     # greedy O(n) check
        need, load = 1, 0
        for w in weights:
            if load + w > cap:
                need, load = need + 1, 0
            load += w
        return need <= days

    lo, hi = max(weights), sum(weights)    # answer is in [lo, hi]
    while lo < hi:
        mid = (lo + hi) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
            },
            {
              lang: "java",
              code: `
int shipWithinDays(int[] w, int days) {
    int lo = 0, hi = 0;
    for (int x : w) { lo = Math.max(lo, x); hi += x; }
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2, need = 1, load = 0;
        for (int x : w) {
            if (load + x > mid) { need++; load = 0; }
            load += x;
        }
        if (need <= days) hi = mid; else lo = mid + 1;
    }
    return lo;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How do you recognize a 'binary search on the answer' problem?",
          a: "Signals: the question asks for a **minimum or maximum value** (\"smallest capacity\", \"minimize the largest sum\", \"maximum minimum distance\"), the answer lies in a known numeric range, and you can write a **monotonic** feasibility check — if X works then every larger (or smaller) X works too. Then binary search X over the range and verify with an O(n) greedy check: O(n log range).",
          freq: "very-common",
        },
        {
          q: "Find the first and last position of a target in a sorted array.",
          a: "Two binary searches: `first = lower_bound(t)` (first index with a[i] ≥ t) and `last = lower_bound(t + 1) − 1` (or an upper-bound search for a[i] > t). If `first == n` or `a[first] != t`, the target is absent. O(log n). A linear scan from one match would be O(n) when the target repeats many times.",
          freq: "very-common",
        },
        {
          q: "Why write `mid = lo + (hi - lo) / 2`?",
          a: "`lo + hi` can overflow a 32-bit integer when both are large (> 2³⁰), turning negative — a famous bug that lived in Java's `Arrays.binarySearch` for nine years. `lo + (hi − lo) / 2` is mathematically equal and safe. (Python ints don't overflow, but interviewers like to hear you know this.)",
          freq: "common",
        },
        {
          q: "Find the minimum in a rotated sorted array.",
          a: "Compare `a[mid]` with `a[hi]`. If `a[mid] > a[hi]`, the rotation point (minimum) is to the right: `lo = mid + 1`. Otherwise the minimum is at mid or to its left: `hi = mid`. When `lo == hi`, that's the minimum. O(log n). With duplicates, when `a[mid] == a[hi]` you can only do `hi -= 1`, degrading to O(n) worst case.",
          freq: "common",
        },
        {
          q: "Median of two sorted arrays in O(log(min(m, n)))?",
          a: "Binary search a cut `i` in the smaller array A; the cut in B is `j = (m + n + 1)/2 − i`, so the left side has half the elements. The partition is correct when `A[i−1] ≤ B[j]` and `B[j−1] ≤ A[i]`. If `A[i−1] > B[j]`, move i left; else move right. The median comes from the max of the left side and the min of the right side (handling odd/even totals and ±∞ sentinels at the edges).",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Max iterations of binary search over 1,000,000 sorted items?",
          options: ["~10", "~20", "~1,000", "~500,000"],
          answer: 1,
          explain: "log₂(10⁶) ≈ 20.",
        },
        {
          q: "Binary search requires the search space to be…",
          options: ["Sorted ascending", "Monotonic with respect to the condition", "Of power-of-two size", "Free of duplicates"],
          answer: 1,
          explain: "Monotonicity is what lets you discard half safely.",
        },
        {
          q: "'Minimum capacity to ship all packages within D days' is solved by…",
          options: ["DP over days", "Binary search on capacity + greedy check", "Sorting packages", "BFS"],
          answer: 1,
          explain: "Feasibility is monotonic in capacity.",
        },
        {
          q: "In a rotated sorted array, at any mid…",
          options: ["Both halves are unsorted", "At least one half is sorted", "The left half is always sorted", "mid is the minimum"],
          answer: 1,
          explain: "The single rotation point can only break one side.",
        },
        {
          q: "With `lo = mid` in a loop `while lo < hi`, you must compute mid as…",
          options: ["(lo + hi) / 2 rounded down", "(lo + hi + 1) / 2 rounded up", "hi − 1", "lo + 1"],
          answer: 1,
          explain: "Rounding down with lo = mid can loop forever when hi = lo + 1.",
        },
      ],
      problems: [
        { title: "Binary Search", url: lc("binary-search"), difficulty: "Easy" },
        { title: "Search Insert Position", url: lc("search-insert-position"), difficulty: "Easy" },
        { title: "Find First and Last Position of Element in Sorted Array", url: lc("find-first-and-last-position-of-element-in-sorted-array"), difficulty: "Medium" },
        { title: "Search in Rotated Sorted Array", url: lc("search-in-rotated-sorted-array"), difficulty: "Medium" },
        { title: "Find Minimum in Rotated Sorted Array", url: lc("find-minimum-in-rotated-sorted-array"), difficulty: "Medium" },
        { title: "Search a 2D Matrix", url: lc("search-a-2d-matrix"), difficulty: "Medium" },
        { title: "Koko Eating Bananas", url: lc("koko-eating-bananas"), difficulty: "Medium" },
        { title: "Capacity To Ship Packages Within D Days", url: lc("capacity-to-ship-packages-within-d-days"), difficulty: "Medium" },
        { title: "Time Based Key-Value Store", url: lc("time-based-key-value-store"), difficulty: "Medium" },
        { title: "Split Array Largest Sum", url: lc("split-array-largest-sum"), difficulty: "Hard" },
        { title: "Median of Two Sorted Arrays", url: lc("median-of-two-sorted-arrays"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ DYNAMIC PROGRAMMING
    {
      id: "dynamic-programming",
      title: "Dynamic Programming",
      tagline: "Define the state, write the recurrence, fill the table.",
      difficulty: "advanced",
      minutes: 22,
      visualizers: ["dp"],
      concept: `
## When is it DP?
Two properties:
1. **Optimal substructure** — the best answer is built from best answers to subproblems.
2. **Overlapping subproblems** — the same subproblems recur (otherwise it's just divide and conquer).

Keywords: *count the number of ways*, *minimum/maximum cost*, *longest/shortest*, *is it possible*, with **choices** at each step that interact.

## The five-step recipe
1. **State**: what does \`dp[i]\` (or \`dp[i][j]\`) mean, in one precise sentence? *"dp[i] = fewest coins that sum to i."*
2. **Recurrence**: how does a state depend on smaller states? *dp[i] = 1 + min(dp[i − c]) over coins c ≤ i.*
3. **Base cases**: dp[0] = 0; impossible states = ∞.
4. **Order**: fill so that dependencies are ready (increasing i, row by row…), or memoize recursion and let it find the order.
5. **Answer**: which cell? Sometimes \`dp[n]\`, sometimes \`max(dp)\`.

Then **optimize space**: if row i only reads row i−1, keep two rows (or one, iterating in the right direction).

## Top-down vs bottom-up
| | Memoization (top-down) | Tabulation (bottom-up) |
|---|---|---|
| Write it | natural recursion + cache | loops over a table |
| Computes | only needed states | all states |
| Risk | recursion depth | getting the order wrong |
| Space tricks | harder | rolling arrays easy |

In interviews: start with the recursion (it's how you discover the recurrence), memoize it, then convert to bottom-up if asked.

## Classic families (see DP Patterns in the Pattern Dungeon for more)
- **1-D linear**: climbing stairs, house robber, decode ways, coin change, word break.
- **2-D grid**: unique paths, minimum path sum, dungeon game.
- **Two sequences**: LCS, edit distance, interleaving strings — \`dp[i][j]\` over prefixes.
- **Knapsack**: 0/1 (each item once; iterate capacity *downward* in 1-D), unbounded (iterate upward), subset sum, partition equal subset, target sum.
- **Intervals**: burst balloons, matrix chain — \`dp[l][r]\` over subarrays, increasing length.
- **LIS**: O(n²) DP, or O(n log n) with patience sorting + binary search.
- **State machines**: stock buy/sell with cooldown/fees — states like holding / not holding.
- **Bitmask**: TSP-style \`dp[mask][i]\` for n ≤ 20.

## Greedy vs DP
Greedy makes one locally optimal choice and never revisits it. It's correct only for problems with the **greedy-choice property**. Coin change with coins [1, 3, 4] and amount 6: greedy takes 4 + 1 + 1 (3 coins); DP finds 3 + 3 (2 coins). When unsure, DP is the safe choice.
`,
      keyPoints: [
        "DP = optimal substructure + overlapping subproblems.",
        "Write the state definition as a sentence before any code.",
        "Recurrence + base cases + fill order + answer cell.",
        "Memoize the recursion first; tabulate and compress space second.",
        "0/1 knapsack in 1-D: iterate capacity backwards.",
      ],
      complexity: [
        { op: "Coin change", time: "O(amount · coins)", space: "O(amount)" },
        { op: "LCS / edit distance", time: "O(m · n)", space: "O(m · n) → O(min(m, n))" },
        { op: "0/1 knapsack", time: "O(n · W)", space: "O(W)" },
        { op: "LIS (patience)", time: "O(n log n)", space: "O(n)" },
      ],
      code: [
        {
          title: "Coin change (min coins) & climbing stairs",
          variants: [
            {
              lang: "python",
              code: `
def coin_change(coins, amount):
    INF = float("inf")
    dp = [0] + [INF] * amount          # dp[a] = fewest coins for a
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    return dp[amount] if dp[amount] != INF else -1

def climb_stairs(n):                    # dp[i] = dp[i-1] + dp[i-2]
    a, b = 1, 1
    for _ in range(n):
        a, b = b, a + b
    return a
`,
            },
            {
              lang: "javascript",
              code: `
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++)
    for (const c of coins)
      if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
  return dp[amount] === Infinity ? -1 : dp[amount];
}
`,
            },
            {
              lang: "java",
              code: `
int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);           // "infinity"
    dp[0] = 0;
    for (int a = 1; a <= amount; a++)
        for (int c : coins)
            if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
    return dp[amount] > amount ? -1 : dp[amount];
}
`,
            },
          ],
        },
        {
          title: "Edit distance — two-sequence DP",
          variants: [
            {
              lang: "python",
              code: `
def edit_distance(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i                       # delete everything
    for j in range(n + 1):
        dp[0][j] = j                       # insert everything
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j],      # delete
                                   dp[i][j - 1],      # insert
                                   dp[i - 1][j - 1])  # replace
    return dp[m][n]
`,
            },
            {
              lang: "javascript",
              code: `
function minDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);   // rolling rows
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    prev = cur;
  }
  return prev[n];
}
`,
            },
          ],
        },
        {
          title: "0/1 knapsack in one dimension",
          variants: [
            {
              lang: "python",
              code: `
def knapsack(weights, values, W):
    dp = [0] * (W + 1)                     # dp[w] = best value with capacity w
    for wt, val in zip(weights, values):
        for w in range(W, wt - 1, -1):     # backwards: each item used at most once
            dp[w] = max(dp[w], dp[w - wt] + val)
    return dp[W]
`,
            },
            {
              lang: "java",
              code: `
int knapsack(int[] wt, int[] val, int W) {
    int[] dp = new int[W + 1];
    for (int i = 0; i < wt.length; i++)
        for (int w = W; w >= wt[i]; w--)
            dp[w] = Math.max(dp[w], dp[w - wt[i]] + val[i]);
    return dp[W];
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How do you approach a DP problem you've never seen?",
          a: "1) Brute-force recursion: what choice do I make at each step? 2) Identify what the recursion depends on — those parameters are the **state**. 3) Notice repeated calls → memoize. 4) Write the recurrence and base cases explicitly. 5) Convert to bottom-up and compress space if needed. Say the state definition out loud as a sentence; most DP bugs are a fuzzy state.",
          freq: "very-common",
        },
        {
          q: "Longest increasing subsequence in O(n log n)?",
          a: "Maintain `tails[k]` = smallest possible tail of an increasing subsequence of length k+1. For each x, binary search the first tail ≥ x and replace it (or append if x is larger than all). `len(tails)` is the LIS length. `tails` is always sorted, so each step is O(log n). (It doesn't store the subsequence itself — track parent indices if needed.)",
          freq: "very-common",
        },
        {
          q: "Why iterate capacity backwards in 1-D 0/1 knapsack?",
          a: "`dp[w]` must use the previous item-row's `dp[w − wt]`. Iterating from high to low capacity guarantees `dp[w − wt]` hasn't been updated for the current item yet, so the item is used at most once. Iterating forwards would let the same item be added repeatedly — which is exactly the **unbounded** knapsack.",
          freq: "common",
        },
        {
          q: "Word Break: can a string be segmented into dictionary words?",
          a: "`dp[i]` = True if `s[:i]` can be segmented. `dp[0] = True`. For each i, check every j < i (or only j within the max word length) with `dp[j] and s[j:i] in words`. O(n · L) checks with a hash set (each check costs O(L) to slice/hash). A trie lets you extend matches from each j without slicing. To list all segmentations (Word Break II), memoize the list of sentences per start index.",
          freq: "common",
        },
        {
          q: "When does a greedy approach fail where DP succeeds?",
          a: "When an early locally-best choice blocks a better global solution. Coin change with [1, 3, 4] for 6 (greedy 4+1+1 vs optimal 3+3); 0/1 knapsack by value/weight ratio; longest path problems. Greedy is correct only when you can prove the greedy-choice property (often via an exchange argument), e.g. interval scheduling by earliest end time or fractional knapsack.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which two properties signal dynamic programming?",
          options: [
            "Sorted input and duplicates",
            "Optimal substructure and overlapping subproblems",
            "Greedy choice and stability",
            "Recursion and hashing",
          ],
          answer: 1,
          explain: "Without overlap it's divide and conquer; without substructure DP doesn't compose.",
        },
        {
          q: "Coins [1, 3, 4], amount 6: the minimum number of coins is…",
          options: ["1", "2", "3", "4"],
          answer: 1,
          explain: "3 + 3. Greedy would take 4 + 1 + 1 = 3 coins.",
        },
        {
          q: "LCS of \"ABCBDAB\" and \"BDCAB\" has length…",
          options: ["3", "4", "5", "2"],
          answer: 1,
          explain: "For example \"BCAB\" or \"BDAB\".",
        },
        {
          q: "Edit distance between strings of lengths m and n runs in…",
          options: ["O(m + n)", "O(m · n)", "O(2^(m+n))", "O(m log n)"],
          answer: 1,
          explain: "One cell per pair of prefixes.",
        },
        {
          q: "In 1-D 0/1 knapsack, iterating capacity forward instead of backward computes…",
          options: ["The same answer", "Unbounded knapsack (items reusable)", "A wrong answer always", "Fractional knapsack"],
          answer: 1,
          explain: "Forward iteration lets dp[w − wt] already include the current item.",
        },
        {
          q: "Knapsack's O(n · W) is called pseudo-polynomial because…",
          options: [
            "It is actually exponential in the number of bits of W",
            "It uses randomization",
            "It only works for small n",
            "W must be prime",
          ],
          answer: 0,
          explain: "W's magnitude, not its bit length, appears in the runtime.",
        },
      ],
      problems: [
        { title: "Climbing Stairs", url: lc("climbing-stairs"), difficulty: "Easy" },
        { title: "House Robber", url: lc("house-robber"), difficulty: "Medium" },
        { title: "Coin Change", url: lc("coin-change"), difficulty: "Medium" },
        { title: "Longest Increasing Subsequence", url: lc("longest-increasing-subsequence"), difficulty: "Medium" },
        { title: "Word Break", url: lc("word-break"), difficulty: "Medium" },
        { title: "Unique Paths", url: lc("unique-paths"), difficulty: "Medium" },
        { title: "Longest Common Subsequence", url: lc("longest-common-subsequence"), difficulty: "Medium" },
        { title: "Partition Equal Subset Sum", url: lc("partition-equal-subset-sum"), difficulty: "Medium" },
        { title: "Edit Distance", url: lc("edit-distance"), difficulty: "Medium" },
        { title: "Burst Balloons", url: lc("burst-balloons"), difficulty: "Hard" },
        { title: "Regular Expression Matching", url: lc("regular-expression-matching"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ GREEDY
    {
      id: "greedy",
      title: "Greedy Algorithms",
      tagline: "Take the best-looking step — but only when you can prove it.",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["greedy"],
      concept: `
## The strategy
A greedy algorithm builds a solution step by step, always making the choice that looks best **right now**, never reconsidering. It's usually simple and fast (often O(n log n) for the sort plus O(n) for the scan) — and wrong surprisingly often.

## When greedy is correct
You need the **greedy-choice property**: some optimal solution starts with the greedy choice. The standard proof is an **exchange argument**: take any optimal solution, swap its first choice for the greedy one, and show it doesn't get worse.

**Interval scheduling** (max non-overlapping meetings): pick the meeting that **ends earliest**. Any optimal schedule's first meeting ends no earlier than ours, so swapping it for ours keeps everything compatible and leaves at least as much room. The visualizer shows how "earliest start" and "shortest first" can both be fooled.

## Greedy classics
| Problem | Greedy rule |
|---|---|
| Max non-overlapping intervals / min arrows to burst balloons | sort by end, take if compatible |
| Jump Game | track the farthest reachable index |
| Jump Game II | BFS-like layers: jumps = number of times you must extend the reach |
| Gas Station | if the tank goes negative, restart after this station |
| Assign cookies / boats to save people | sort, then two pointers matching largest with smallest |
| Task scheduler | the most frequent task dictates idle slots |
| Huffman coding | repeatedly merge the two least frequent nodes (min-heap) |
| Fractional knapsack | highest value/weight ratio first (0/1 knapsack needs DP!) |
| Minimum spanning tree | Kruskal / Prim — cheapest safe edge |
| Dijkstra | closest unvisited node is final |

## How to approach in interviews
1. Brute force or DP first in your head.
2. Hypothesize a greedy rule (sort by what?).
3. **Try to break it** with small counterexamples (that's what interviewers do).
4. If it survives, sketch the exchange argument in one or two sentences.
`,
      keyPoints: [
        "Greedy = locally optimal, never revisited.",
        "Correct only with the greedy-choice property — prove it via exchange argument.",
        "Most greedy solutions = sort by the right key + one linear pass.",
        "Interval scheduling: sort by END time.",
        "If you can't prove it, try to break it; fall back to DP.",
      ],
      complexity: [
        { op: "Sort + scan", time: "O(n log n)", space: "O(1)–O(n)" },
        { op: "Jump game", time: "O(n)", space: "O(1)" },
        { op: "Huffman coding", time: "O(n log n)" },
      ],
      code: [
        {
          title: "Non-overlapping intervals & Jump Game",
          variants: [
            {
              lang: "python",
              code: `
def erase_overlap_intervals(intervals):
    """Min removals so the rest don't overlap = n - max compatible set."""
    intervals.sort(key=lambda iv: iv[1])        # earliest end first
    kept, end = 0, float("-inf")
    for s, e in intervals:
        if s >= end:
            kept += 1
            end = e
    return len(intervals) - kept

def can_jump(nums):
    reach = 0
    for i, step in enumerate(nums):
        if i > reach:
            return False                        # stuck before i
        reach = max(reach, i + step)
    return True
`,
            },
            {
              lang: "javascript",
              code: `
function eraseOverlapIntervals(intervals) {
  intervals.sort((a, b) => a[1] - b[1]);
  let kept = 0, end = -Infinity;
  for (const [s, e] of intervals) if (s >= end) { kept++; end = e; }
  return intervals.length - kept;
}

function canJump(nums) {
  let reach = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > reach) return false;
    reach = Math.max(reach, i + nums[i]);
  }
  return true;
}
`,
            },
            {
              lang: "java",
              code: `
int canCompleteCircuit(int[] gas, int[] cost) {
    int total = 0, tank = 0, start = 0;
    for (int i = 0; i < gas.length; i++) {
        int diff = gas[i] - cost[i];
        total += diff;
        tank += diff;
        if (tank < 0) { start = i + 1; tank = 0; }  // can't start at or before i
    }
    return total >= 0 ? start : -1;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How do you prove a greedy algorithm is correct?",
          a: "Usually an **exchange argument**: assume an optimal solution O that differs from the greedy solution G at the first choice. Show you can replace O's choice with G's without making O worse (and while keeping it valid). Repeating the exchange turns O into G, so G is optimal. Alternatively show greedy \"stays ahead\": after each step, greedy's partial solution is at least as good as any other's.",
          freq: "common",
        },
        {
          q: "Gas station: why does restarting after a failing station work?",
          a: "If starting at s you run out of gas before reaching station i, then every station between s and i also fails as a start: each of them begins with a tank ≥ 0 at that point in the original run, and starting fresh there gives *less* fuel. So jump the start to i + 1. If total gas ≥ total cost, the last start candidate is guaranteed to work. One pass, O(n).",
          freq: "common",
        },
        {
          q: "Minimum number of meeting rooms needed?",
          a: "Not interval scheduling but a related sweep: sort start times and end times separately (or events +1/−1), sweep in time order, and track the maximum number of concurrently open meetings. Or sort by start and keep a min-heap of end times: pop rooms that have freed up before each start; the heap's max size is the answer. O(n log n).",
          freq: "very-common",
        },
        {
          q: "Jump Game II — minimum jumps to reach the end?",
          a: "Greedy BFS over index ranges: keep `curEnd` (farthest reachable with the current number of jumps) and `farthest` (best reachable with one more jump). Scan i; update `farthest = max(farthest, i + nums[i])`; when i reaches `curEnd`, you must jump: `jumps++`, `curEnd = farthest`. O(n), O(1).",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "For maximum non-overlapping intervals, sort by…",
          options: ["Start time", "End time", "Duration", "Random order"],
          answer: 1,
          explain: "Ending earliest leaves the most room for the remaining meetings.",
        },
        {
          q: "Which problem does greedy solve optimally?",
          options: ["0/1 knapsack", "Fractional knapsack", "Coin change with arbitrary coins", "Longest path in a graph"],
          answer: 1,
          explain: "You can take fractions, so highest value density first is optimal.",
        },
        {
          q: "The standard technique to prove a greedy algorithm correct is…",
          options: ["Master theorem", "Exchange argument", "Amortized analysis", "Pigeonhole principle"],
          answer: 1,
          explain: "Swap an optimal solution's choice for the greedy one without loss.",
        },
        {
          q: "Jump Game ([2,3,1,1,4] → can you reach the end?) needs…",
          options: ["Backtracking", "DP over all paths", "Tracking the farthest reachable index", "BFS with a queue of indices"],
          answer: 2,
          explain: "One pass, O(n) time, O(1) space.",
        },
      ],
      problems: [
        { title: "Assign Cookies", url: lc("assign-cookies"), difficulty: "Easy" },
        { title: "Jump Game", url: lc("jump-game"), difficulty: "Medium" },
        { title: "Jump Game II", url: lc("jump-game-ii"), difficulty: "Medium" },
        { title: "Gas Station", url: lc("gas-station"), difficulty: "Medium" },
        { title: "Non-overlapping Intervals", url: lc("non-overlapping-intervals"), difficulty: "Medium" },
        { title: "Minimum Number of Arrows to Burst Balloons", url: lc("minimum-number-of-arrows-to-burst-balloons"), difficulty: "Medium" },
        { title: "Partition Labels", url: lc("partition-labels"), difficulty: "Medium" },
        { title: "Hand of Straights", url: lc("hand-of-straights"), difficulty: "Medium" },
        { title: "Candy", url: lc("candy"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ BACKTRACKING
    {
      id: "backtracking",
      title: "Backtracking",
      tagline: "Explore every choice, prune hopeless branches, undo and retry.",
      difficulty: "advanced",
      minutes: 16,
      visualizers: ["nqueens"],
      concept: `
## A smarter brute force
Backtracking builds candidates one choice at a time. If a partial candidate can't possibly lead to a valid solution, it **prunes** that branch and **undoes** the last choice to try the next one. It's DFS over a tree of decisions.

## The template
\`\`\`
def backtrack(path, choices):
    if is_solution(path):
        result.append(path.copy())     # copy! path keeps changing
        return
    for choice in choices:
        if not valid(path, choice):
            continue                    # prune
        path.append(choice)             # make
        backtrack(path, next_choices)
        path.pop()                      # undo
\`\`\`
Three questions define every backtracking problem: **What's the path? What are the choices at this step? When is it complete?**

## The three shapes
| Shape | Example | Count | Trick |
|---|---|---|---|
| **Subsets** | all subsets of [1,2,3] | 2ⁿ | at each index: include or skip; or loop from \`start\` |
| **Combinations** | choose k of n, combination sum | C(n, k) | pass \`start\` so you never go backwards |
| **Permutations** | all orderings | n! | track \`used[]\`; loop over everything |

**Duplicates in input?** Sort first, then skip \`nums[i] == nums[i-1]\` at the same recursion level (\`i > start\` for combos, \`not used[i-1]\` for permutations).

## Constraint satisfaction
N-Queens, Sudoku, word search on a grid, palindrome partitioning, generate parentheses. Pruning is everything: N-Queens with O(1) column/diagonal sets explores a tiny fraction of the n^n placements (watch the backtrack counter in the visualizer).

## Complexity
Exponential by nature — state it plainly: subsets O(n · 2ⁿ), permutations O(n · n!), each multiplied by the cost of copying a solution. Constraints like n ≤ 15–20 are the hint that exponential is intended.

## Backtracking vs DP
If the recursion only needs a *count* or *best value* and subproblems overlap, memoize → DP. If you must **list every solution**, the output itself is exponential and backtracking is the right tool.
`,
      keyPoints: [
        "Choose → explore → un-choose.",
        "Copy the path when recording a solution.",
        "Subsets/combinations use a start index; permutations use a used[] array.",
        "Sort + skip equal neighbours at the same level to avoid duplicates.",
        "Prune early: invalid partial states should never recurse.",
      ],
      complexity: [
        { op: "Subsets", time: "O(n · 2ⁿ)", space: "O(n) recursion" },
        { op: "Permutations", time: "O(n · n!)", space: "O(n)" },
        { op: "Combinations C(n,k)", time: "O(k · C(n,k))" },
        { op: "N-Queens", time: "O(n!) upper bound", note: "pruning helps a lot" },
      ],
      code: [
        {
          title: "Subsets, permutations, combination sum",
          variants: [
            {
              lang: "python",
              code: `
def subsets(nums):
    res, path = [], []
    def bt(start):
        res.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            bt(i + 1)
            path.pop()
    bt(0)
    return res

def permutations(nums):
    res, path, used = [], [], [False] * len(nums)
    def bt():
        if len(path) == len(nums):
            res.append(path[:])
            return
        for i, x in enumerate(nums):
            if used[i]:
                continue
            used[i] = True; path.append(x)
            bt()
            used[i] = False; path.pop()
    bt()
    return res

def combination_sum(candidates, target):      # reuse allowed
    res, path = [], []
    candidates.sort()
    def bt(start, remain):
        if remain == 0:
            res.append(path[:])
            return
        for i in range(start, len(candidates)):
            if candidates[i] > remain:
                break                          # sorted ⇒ prune the rest
            path.append(candidates[i])
            bt(i, remain - candidates[i])      # i, not i+1: reuse
            path.pop()
    bt(0, target)
    return res
`,
            },
            {
              lang: "javascript",
              code: `
function subsets(nums) {
  const res = [], path = [];
  const bt = (start) => {
    res.push([...path]);
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      bt(i + 1);
      path.pop();
    }
  };
  bt(0);
  return res;
}

function permute(nums) {
  const res = [], path = [], used = new Array(nums.length).fill(false);
  const bt = () => {
    if (path.length === nums.length) return void res.push([...path]);
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(nums[i]);
      bt();
      used[i] = false; path.pop();
    }
  };
  bt();
  return res;
}
`,
            },
            {
              lang: "java",
              code: `
List<List<Integer>> subsetsWithDup(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> res = new ArrayList<>();
    bt(nums, 0, new ArrayList<>(), res);
    return res;
}
void bt(int[] nums, int start, List<Integer> path, List<List<Integer>> res) {
    res.add(new ArrayList<>(path));
    for (int i = start; i < nums.length; i++) {
        if (i > start && nums[i] == nums[i - 1]) continue;   // skip duplicates
        path.add(nums[i]);
        bt(nums, i + 1, path, res);
        path.remove(path.size() - 1);
    }
}
`,
            },
          ],
        },
        {
          title: "N-Queens with O(1) safety checks",
          variants: [
            {
              lang: "python",
              code: `
def solve_n_queens(n):
    res, cols, d1, d2 = [], set(), set(), set()
    board = [["."] * n for _ in range(n)]
    def bt(r):
        if r == n:
            res.append(["".join(row) for row in board])
            return
        for c in range(n):
            if c in cols or (r - c) in d1 or (r + c) in d2:
                continue
            cols.add(c); d1.add(r - c); d2.add(r + c); board[r][c] = "Q"
            bt(r + 1)
            cols.remove(c); d1.remove(r - c); d2.remove(r + c); board[r][c] = "."
    bt(0)
    return res
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How do you avoid duplicate results when the input has duplicates?",
          a: "Sort the input. In combination/subset loops, skip `nums[i]` when `i > start and nums[i] == nums[i-1]` — the same value was already tried at this depth. For permutations, skip when `nums[i] == nums[i-1] and not used[i-1]`, which forces equal values to be used in a fixed order. Using a set of tuples to dedupe afterwards works but wastes exponential time.",
          freq: "very-common",
        },
        {
          q: "What's the time complexity of generating all subsets / permutations?",
          a: "Subsets: 2ⁿ subsets, each copied in O(n) → **O(n · 2ⁿ)**. Permutations: n! permutations, each O(n) to copy → **O(n · n!)**. The recursion depth is O(n). Since the output is that large, you can't do asymptotically better — say so.",
          freq: "common",
        },
        {
          q: "Word Search: does a word exist in a grid of letters?",
          a: "DFS from every cell matching the first letter. At depth k, the cell must equal `word[k]`; mark it visited (temporarily overwrite with `#`), recurse to 4 neighbours for k+1, then restore it (backtrack). Prune immediately on mismatch. O(R · C · 4 · 3^(L−1)) worst case. Optimizations: check letter counts first; start from the rarer end of the word.",
          freq: "common",
        },
        {
          q: "Generate all valid combinations of n pairs of parentheses.",
          a: "Backtrack with counts: add `(` if `open < n`; add `)` if `close < open`. When length is 2n, record. The pruning guarantees every generated string is valid, so the work is proportional to the output: the n-th Catalan number ~ 4ⁿ / (n^1.5 √π).",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Subsets of [1, 2, 3] — how many?",
          options: ["6", "7", "8", "9"],
          answer: 2,
          explain: "2³ = 8, including the empty set.",
        },
        {
          q: "Why append `path[:]` (a copy) instead of `path`?",
          options: ["Speed", "path keeps being mutated; all stored entries would alias the same list", "Python requires it", "To sort it"],
          answer: 1,
          explain: "Without a copy every result ends up identical (and empty).",
        },
        {
          q: "In N-Queens, two queens at (r1, c1) and (r2, c2) share a diagonal if…",
          options: ["r1 + c1 == r2 − c2", "r1 − c1 == r2 − c2 or r1 + c1 == r2 + c2", "r1 == c2", "|r1 − r2| == 1"],
          answer: 1,
          explain: "One diagonal has constant r − c, the other constant r + c.",
        },
        {
          q: "Combination Sum allows reusing a number. The recursive call passes…",
          options: ["i + 1", "i", "0", "start + 1"],
          answer: 1,
          explain: "Staying at i allows the same candidate again, but never earlier ones.",
        },
        {
          q: "Constraints say n ≤ 12. That hints at…",
          options: ["O(n log n)", "O(n²)", "Exponential backtracking is acceptable", "A hash map"],
          answer: 2,
          explain: "Small n means 2ⁿ or even n! may fit the time limit.",
        },
      ],
      problems: [
        { title: "Subsets", url: lc("subsets"), difficulty: "Medium" },
        { title: "Subsets II", url: lc("subsets-ii"), difficulty: "Medium" },
        { title: "Permutations", url: lc("permutations"), difficulty: "Medium" },
        { title: "Combination Sum", url: lc("combination-sum"), difficulty: "Medium" },
        { title: "Combination Sum II", url: lc("combination-sum-ii"), difficulty: "Medium" },
        { title: "Generate Parentheses", url: lc("generate-parentheses"), difficulty: "Medium" },
        { title: "Word Search", url: lc("word-search"), difficulty: "Medium" },
        { title: "Palindrome Partitioning", url: lc("palindrome-partitioning"), difficulty: "Medium" },
        { title: "N-Queens", url: lc("n-queens"), difficulty: "Hard" },
        { title: "Sudoku Solver", url: lc("sudoku-solver"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ BITS
    {
      id: "bit-manipulation",
      title: "Bit Manipulation",
      tagline: "XOR tricks, masks and bitsets — small tools, big wins.",
      difficulty: "intermediate",
      minutes: 11,
      visualizers: ["bits"],
      concept: `
## The operators
| Op | Meaning | Use |
|---|---|---|
| \`a & b\` | 1 where both are 1 | test / clear bits (masking) |
| \`a \\| b\` | 1 where either is 1 | set bits / flags |
| \`a ^ b\` | 1 where they differ | toggle bits, cancel pairs |
| \`~a\` | flip every bit | build "all but" masks |
| \`a << k\` | multiply by 2ᵏ | build masks: \`1 << k\` |
| \`a >> k\` | divide by 2ᵏ | extract bits |

## Must-know idioms
- Test bit k: \`(x >> k) & 1\`  · Set: \`x | (1 << k)\` · Clear: \`x & ~(1 << k)\` · Toggle: \`x ^ (1 << k)\`
- **Drop the lowest set bit**: \`x & (x − 1)\` — power-of-two test: \`x > 0 and x & (x − 1) == 0\`; popcount loop (Brian Kernighan) runs once per 1-bit.
- **Isolate the lowest set bit**: \`x & −x\` (two's complement) — the engine behind Fenwick trees.
- **XOR properties**: \`x ^ x = 0\`, \`x ^ 0 = x\`, commutative and associative → XOR-ing everything cancels pairs.

## XOR puzzles
- **Single Number**: every value appears twice except one → XOR all; the pairs cancel.
- **Missing Number** (0..n with one missing): XOR all indices and values.
- **Single Number III** (two unique values): XOR all to get \`a ^ b\`; any set bit of it splits the numbers into two groups, XOR each group.
- **Swap without temp**: \`a ^= b; b ^= a; a ^= b\` (cute, but don't do it in production).

## Bitmasks as sets
An n-bit integer represents a subset of n items: bit i set ⇒ item i included.
- Iterate all subsets: \`for mask in range(1 << n)\`.
- Iterate submasks of \`m\`: \`s = m; while s: …; s = (s − 1) & m\`.
- **Bitmask DP** for n ≤ ~20: traveling salesman \`dp[mask][last]\`, assigning tasks to workers, partitioning into k equal subsets.

## Language gotchas
- **Python** ints are arbitrary precision: \`~5 == −6\`, and negatives have infinitely many leading 1s — mask with \`& 0xFFFFFFFF\` to emulate 32-bit.
- **Java** has \`>>\` (arithmetic, keeps sign) and \`>>>\` (logical, zero-fill). \`Integer.bitCount\`, \`Long.numberOfTrailingZeros\`.
- **JavaScript** bitwise operators work on **32-bit signed** ints: \`(2**31) | 0 === −2147483648\`. Use \`>>> 0\` for unsigned and BigInt for 64-bit.

## In real systems
Bloom filters and bitmaps (see the Distributed world), permission flags, network subnet masks (\`ip & mask\`), feature flags, compact visited-sets, Redis \`SETBIT\` daily-active-user bitmaps.
`,
      keyPoints: [
        "x & (x − 1) clears the lowest set bit; x & −x isolates it.",
        "XOR cancels pairs: a ^ a = 0, a ^ 0 = a.",
        "An n-bit mask is a subset; 1 << n subsets for n ≤ 20.",
        "Python ints are unbounded — mask with 0xFFFFFFFF for 32-bit behaviour.",
        "Java: >> keeps the sign, >>> zero-fills.",
      ],
      complexity: [
        { op: "Bit test / set / clear", time: "O(1)" },
        { op: "Popcount (Kernighan)", time: "O(number of set bits)" },
        { op: "Enumerate all subsets", time: "O(2ⁿ)" },
        { op: "Bitmask DP (TSP)", time: "O(2ⁿ · n²)" },
      ],
      code: [
        {
          title: "XOR tricks and counting bits",
          variants: [
            {
              lang: "python",
              code: `
from functools import reduce
from operator import xor

def single_number(nums):          # every other value appears twice
    return reduce(xor, nums)

def missing_number(nums):         # values 0..n with one missing
    x = len(nums)
    for i, v in enumerate(nums):
        x ^= i ^ v
    return x

def hamming_weight(n):            # Brian Kernighan
    count = 0
    while n:
        n &= n - 1
        count += 1
    return count

def count_bits(n):                # popcount for 0..n in O(n)
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        dp[i] = dp[i >> 1] + (i & 1)
    return dp
`,
            },
            {
              lang: "javascript",
              code: `
const singleNumber = (nums) => nums.reduce((a, b) => a ^ b, 0);

function hammingWeight(n) {
  let count = 0;
  n = n >>> 0;                    // treat as unsigned 32-bit
  while (n) { n &= n - 1; count++; }
  return count;
}

function reverseBits(n) {
  let r = 0;
  for (let i = 0; i < 32; i++) { r = (r << 1) | (n & 1); n >>>= 1; }
  return r >>> 0;
}
`,
            },
            {
              lang: "java",
              code: `
int singleNumber(int[] nums) {
    int x = 0;
    for (int v : nums) x ^= v;
    return x;
}

boolean isPowerOfTwo(int n) {
    return n > 0 && (n & (n - 1)) == 0;
}

int getSum(int a, int b) {          // add without + : XOR = sum, AND<<1 = carry
    while (b != 0) {
        int carry = (a & b) << 1;
        a ^= b;
        b = carry;
    }
    return a;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Find the element that appears once when every other element appears twice, in O(1) space.",
          a: "XOR all elements. XOR is commutative and associative, `x ^ x = 0` and `x ^ 0 = x`, so every pair cancels and the unique value remains. O(n) time, O(1) space. Variant where others appear **three** times: count each bit position mod 3 (or the ones/twos state-machine trick).",
          freq: "very-common",
        },
        {
          q: "How do you check whether a number is a power of two?",
          a: "`n > 0 && (n & (n - 1)) == 0`. A power of two has exactly one set bit; subtracting 1 flips that bit and sets all lower bits, so the AND is zero. The `n > 0` check excludes 0 (and negatives).",
          freq: "common",
        },
        {
          q: "How would you track daily active users for 100 million users memory-efficiently?",
          a: "A **bitmap** per day: user id = bit index → 100M bits ≈ 12.5 MB per day (Redis `SETBIT`/`BITCOUNT`). DAU = popcount; users active on both days = `AND` of two bitmaps; weekly actives = `OR` of seven. If ids are sparse, use compressed bitmaps (Roaring). For approximate distinct counts across huge ranges, HyperLogLog uses ~12 KB with ~0.8% error.",
          freq: "common",
        },
        {
          q: "Explain two's complement and why `x & -x` isolates the lowest set bit.",
          a: "In two's complement, `-x = ~x + 1`. Inverting flips every bit; adding 1 carries through the trailing 1s (which were trailing 0s in x) and stops at x's lowest set bit, which becomes 1 again while everything above it is inverted. So `x & -x` keeps only that lowest set bit. Fenwick trees use it to jump between ranges.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "What does `x & (x − 1)` do?",
          options: ["Doubles x", "Clears the lowest set bit", "Sets the lowest bit", "Negates x"],
          answer: 1,
          explain: "Subtracting 1 flips the lowest 1-bit and everything below it.",
        },
        {
          q: "XOR of [4, 1, 2, 1, 2] is…",
          options: ["0", "1", "4", "10"],
          answer: 2,
          explain: "1 and 2 cancel in pairs, leaving 4.",
        },
        {
          q: "How many subsets does a 20-bit mask enumeration loop visit?",
          options: ["20", "400", "~1 million (2²⁰)", "20!"],
          answer: 2,
          explain: "2²⁰ = 1,048,576.",
        },
        {
          q: "In JavaScript, `(2 ** 31) | 0` evaluates to…",
          options: ["2147483648", "-2147483648", "0", "NaN"],
          answer: 1,
          explain: "Bitwise operators coerce to 32-bit signed integers.",
        },
        {
          q: "In Java, which shift fills with zeros regardless of sign?",
          options: [">>", ">>>", "<<", "<<<"],
          answer: 1,
          explain: ">>> is the logical (unsigned) right shift.",
        },
      ],
      problems: [
        { title: "Single Number", url: lc("single-number"), difficulty: "Easy" },
        { title: "Number of 1 Bits", url: lc("number-of-1-bits"), difficulty: "Easy" },
        { title: "Counting Bits", url: lc("counting-bits"), difficulty: "Easy" },
        { title: "Missing Number", url: lc("missing-number"), difficulty: "Easy" },
        { title: "Reverse Bits", url: lc("reverse-bits"), difficulty: "Easy" },
        { title: "Sum of Two Integers", url: lc("sum-of-two-integers"), difficulty: "Medium" },
        { title: "Single Number III", url: lc("single-number-iii"), difficulty: "Medium" },
        { title: "Partition to K Equal Sum Subsets", url: lc("partition-to-k-equal-sum-subsets"), difficulty: "Medium", note: "bitmask DP" },
      ],
    },
  ],
};
