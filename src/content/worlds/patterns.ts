import type { World } from "../types";

const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export const patterns: World = {
  id: "patterns",
  order: 4,
  title: "Pattern Dungeon",
  subtitle: "The 9 coding patterns behind most LeetCode problems",
  description:
    "Interviewers recycle a small set of patterns. Learn to recognize the signal in the problem statement, reach for the right template, and adapt it under pressure.",
  emoji: "🗝️",
  color: "#f472b6",
  boss: {
    name: "The Sliding Specter",
    title: "Haunter of Off-by-One Errors",
    emoji: "👻",
    taunt: "Your window is too wide... your pointers are crossed... your loop runs n+1 times. Boo!",
    defeat: "Noooo... you recognized the pattern... I fade into O(1)...",
  },
  lessons: [
    // ------------------------------------------------------------------ TWO POINTERS
    {
      id: "two-pointers",
      title: "Two Pointers",
      tagline: "Two indices, one pass: turn O(n²) pair checks into O(n).",
      difficulty: "beginner",
      minutes: 12,
      visualizers: ["twopointers"],
      concept: `
## Recognize it
- The input is **sorted** (or you can sort it) and you need a **pair/triplet** with some sum or property.
- You must modify an array **in place** (remove, partition, dedupe, move zeroes).
- You compare elements from **both ends** (palindromes, reversing, container with most water).
- Merging two sorted sequences.

## Three flavours
**1. Opposite ends, moving inward.** Sorted pair sum: if the sum is too small, only moving L right can increase it; too big, move R left. Each move rules out a whole row/column of pairs, so O(n) total.

**2. Same direction (slow/fast or read/write).** A \`write\` pointer marks where the next kept element goes while \`read\` scans: remove duplicates, remove element, move zeroes, compress strings.

**3. One pointer per sequence.** Merge two sorted arrays/lists, is-subsequence, intersection of sorted arrays.

## Templates
\`\`\`
# opposite ends
l, r = 0, n - 1
while l < r:
    if good(l, r): record / return
    if need_bigger: l += 1
    else:           r -= 1

# read / write
w = 0
for r in range(n):
    if keep(a[r]):
        a[w] = a[r]; w += 1
return w
\`\`\`

## 3Sum and k-Sum
Sort, fix the first element i, then run opposite-end two pointers on the rest: O(n²) total. Skip duplicates for i and after each found triplet. k-Sum generalizes recursively to O(n^(k−1)).

## Why it's correct (say this in interviews)
For sorted pair-sum: when \`a[l] + a[r] < target\`, **every** pair \`(l, j)\` with \`j ≤ r\` is also too small, so \`l\` can never be part of the answer — discard it. That one-sentence argument is what separates a memorized trick from understanding.
`,
      keyPoints: [
        "Sorted + pairs → opposite-end pointers.",
        "In-place filtering → read/write pointers.",
        "Each pointer moves at most n times → O(n).",
        "3Sum = sort + fix one + two pointers → O(n²).",
        "Justify each move: what does it rule out?",
      ],
      complexity: [
        { op: "Pair sum (sorted)", time: "O(n)", space: "O(1)" },
        { op: "3Sum", time: "O(n²)", space: "O(1) extra" },
        { op: "Remove duplicates in place", time: "O(n)", space: "O(1)" },
      ],
      code: [
        {
          title: "Two Sum II, 3Sum and Valid Palindrome",
          variants: [
            {
              lang: "python",
              code: `
def two_sum_sorted(a, target):
    l, r = 0, len(a) - 1
    while l < r:
        s = a[l] + a[r]
        if s == target:
            return [l, r]
        if s < target:
            l += 1
        else:
            r -= 1
    return []

def three_sum(nums):
    nums.sort()
    res = []
    for i in range(len(nums) - 2):
        if i and nums[i] == nums[i - 1]:
            continue                          # skip duplicate anchors
        l, r = i + 1, len(nums) - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s < 0:
                l += 1
            elif s > 0:
                r -= 1
            else:
                res.append([nums[i], nums[l], nums[r]])
                l += 1
                while l < r and nums[l] == nums[l - 1]:
                    l += 1                    # skip duplicate seconds
    return res

def is_palindrome(s):
    l, r = 0, len(s) - 1
    while l < r:
        if not s[l].isalnum(): l += 1
        elif not s[r].isalnum(): r -= 1
        elif s[l].lower() != s[r].lower(): return False
        else: l, r = l + 1, r - 1
    return True
`,
            },
            {
              lang: "javascript",
              code: `
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue;
    let l = i + 1, r = nums.length - 1;
    while (l < r) {
      const s = nums[i] + nums[l] + nums[r];
      if (s < 0) l++;
      else if (s > 0) r--;
      else {
        res.push([nums[i], nums[l], nums[r]]);
        l++;
        while (l < r && nums[l] === nums[l - 1]) l++;
      }
    }
  }
  return res;
}

function maxArea(h) {
  let l = 0, r = h.length - 1, best = 0;
  while (l < r) {
    best = Math.max(best, (r - l) * Math.min(h[l], h[r]));
    if (h[l] < h[r]) l++; else r--;
  }
  return best;
}
`,
            },
            {
              lang: "java",
              code: `
int removeDuplicates(int[] a) {
    if (a.length == 0) return 0;
    int w = 1;
    for (int r = 1; r < a.length; r++)
        if (a[r] != a[w - 1]) a[w++] = a[r];
    return w;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why can you discard the left element when the sorted pair sum is too small?",
          a: "Because `a[r]` is the largest value still in play, `a[l] + a[r]` is the largest sum that `a[l]` can make. If even that is below the target, no pair using `a[l]` can work, so moving `l` right loses nothing. The symmetric argument justifies moving `r` left when the sum is too big. That's why the algorithm examines O(n) pairs yet never misses the answer.",
          freq: "very-common",
        },
        {
          q: "3Sum: how do you avoid duplicate triplets without a set?",
          a: "Sort first. Skip an anchor `i` if `nums[i] == nums[i-1]`. After recording a triplet, move `l` forward past equal values (and/or `r` backward). Because the array is sorted, equal values are adjacent, so this dedupes in O(1) per skip. Complexity stays O(n²) with O(1) extra space (ignoring the sort).",
          freq: "very-common",
        },
        {
          q: "Trapping Rain Water with two pointers?",
          a: "Water above index i = `min(maxLeft, maxRight) − h[i]`. Move pointers inward from both ends, tracking `leftMax` and `rightMax`. Always advance the side with the **smaller** max: that side's water level is fully determined by its own max (the other side is at least as tall). O(n) time, O(1) space — versus O(n) space for the prefix-max arrays approach.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Sorted [1, 3, 4, 6, 9], target 10, L at 1 and R at 9. Sum = 10. Next?",
          options: ["Move L", "Move R", "Return the pair", "Restart"],
          answer: 2,
          explain: "1 + 9 = 10 matches the target.",
        },
        {
          q: "In Container With Most Water, which pointer do you move?",
          options: ["The taller wall", "The shorter wall", "Both", "Alternate"],
          answer: 1,
          explain: "Keeping the shorter wall can only reduce width without raising the min height.",
        },
        {
          q: "3Sum with sorting + two pointers runs in…",
          options: ["O(n)", "O(n log n)", "O(n²)", "O(n³)"],
          answer: 2,
          explain: "n anchors × O(n) two-pointer scan.",
        },
        {
          q: "Removing duplicates from a sorted array in place uses…",
          options: ["Opposite-end pointers", "A read pointer and a write pointer", "A hash set", "Binary search"],
          answer: 1,
          explain: "Write each new value at the write index.",
        },
      ],
      problems: [
        { title: "Valid Palindrome", url: lc("valid-palindrome"), difficulty: "Easy" },
        { title: "Two Sum II - Input Array Is Sorted", url: lc("two-sum-ii-input-array-is-sorted"), difficulty: "Medium" },
        { title: "3Sum", url: lc("3sum"), difficulty: "Medium" },
        { title: "Container With Most Water", url: lc("container-with-most-water"), difficulty: "Medium" },
        { title: "Remove Duplicates from Sorted Array", url: lc("remove-duplicates-from-sorted-array"), difficulty: "Easy" },
        { title: "Sort Colors", url: lc("sort-colors"), difficulty: "Medium" },
        { title: "Boats to Save People", url: lc("boats-to-save-people"), difficulty: "Medium" },
        { title: "Trapping Rain Water", url: lc("trapping-rain-water"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ SLIDING WINDOW
    {
      id: "sliding-window",
      title: "Sliding Window",
      tagline: "Contiguous subarrays and substrings in linear time.",
      difficulty: "intermediate",
      minutes: 15,
      visualizers: ["slidingwindow"],
      concept: `
## Recognize it
- **Contiguous** subarray or substring (not subsequence!).
- "Longest / shortest / maximum / count of windows" **satisfying a constraint**: at most k distinct, no repeats, sum ≥ target, contains all of t, at most k replacements.
- Brute force would check all O(n²) windows.

## Fixed-size window
Size k is given (max average of k elements, anagram of p in s). Add the entering element, remove the leaving one, update the answer. O(n).

## Variable-size window (the important one)
\`\`\`
l = 0
for r in range(n):
    add(s[r])                       # expand
    while window_invalid():         # shrink until valid again
        remove(s[l]); l += 1
    best = max(best, r - l + 1)     # record (for "longest")
\`\`\`
For "**shortest** window that satisfies X", flip it: shrink **while** the window is valid, recording the answer inside the loop.

Each index enters once and leaves once → **O(n)** even though there's a nested \`while\`.

## What to track in the window
- A **hash map of counts** (characters, distinct elements).
- A running **sum** (only valid when all numbers are **non-negative** — otherwise shrinking doesn't monotonically decrease the sum; use prefix sums + hash map instead).
- A **deque** for window max/min (sliding window maximum).
- A counter of "requirements satisfied" (minimum window substring) to avoid comparing maps every step.

## The "at most k" trick
"Exactly k distinct" is hard to window directly. Compute **atMost(k) − atMost(k − 1)** — both are standard variable windows.

## Longest repeating character replacement
Window is valid if \`window_length − max_count ≤ k\` (the non-majority characters can be replaced). Keep \`max_count\` as a historical max — it never needs to decrease for the answer to be correct.
`,
      keyPoints: [
        "Contiguous + constraint + longest/shortest ⇒ sliding window.",
        "Expand right always; shrink left while invalid.",
        "Each element enters and leaves once: O(n).",
        "Negative numbers break sum-based windows → prefix sums instead.",
        "Exactly k = atMost(k) − atMost(k − 1).",
      ],
      complexity: [
        { op: "Fixed or variable window", time: "O(n)", space: "O(k) or O(Σ)" },
        { op: "Sliding window maximum (deque)", time: "O(n)", space: "O(k)" },
        { op: "Minimum window substring", time: "O(|s| + |t|)", space: "O(Σ)" },
      ],
      code: [
        {
          title: "Longest substring without repeating characters",
          variants: [
            {
              lang: "python",
              code: `
def length_of_longest_substring(s):
    last = {}                  # char -> last index seen
    l = best = 0
    for r, ch in enumerate(s):
        if ch in last and last[ch] >= l:
            l = last[ch] + 1   # jump past the previous occurrence
        last[ch] = r
        best = max(best, r - l + 1)
    return best
`,
            },
            {
              lang: "javascript",
              code: `
function lengthOfLongestSubstring(s) {
  const last = new Map();
  let l = 0, best = 0;
  for (let r = 0; r < s.length; r++) {
    if (last.has(s[r]) && last.get(s[r]) >= l) l = last.get(s[r]) + 1;
    last.set(s[r], r);
    best = Math.max(best, r - l + 1);
  }
  return best;
}
`,
            },
            {
              lang: "java",
              code: `
int lengthOfLongestSubstring(String s) {
    int[] last = new int[128];
    Arrays.fill(last, -1);
    int l = 0, best = 0;
    for (int r = 0; r < s.length(); r++) {
        char c = s.charAt(r);
        if (last[c] >= l) l = last[c] + 1;
        last[c] = r;
        best = Math.max(best, r - l + 1);
    }
    return best;
}
`,
            },
          ],
        },
        {
          title: "Minimum window substring",
          variants: [
            {
              lang: "python",
              code: `
from collections import Counter

def min_window(s, t):
    need = Counter(t)
    missing = len(t)                     # chars still required
    l = 0
    best = (0, float("inf"))
    for r, ch in enumerate(s):
        if need[ch] > 0:
            missing -= 1
        need[ch] -= 1
        while missing == 0:              # valid: try to shrink
            if r - l < best[1] - best[0]:
                best = (l, r)
            need[s[l]] += 1
            if need[s[l]] > 0:
                missing += 1
            l += 1
    return "" if best[1] == float("inf") else s[best[0]:best[1] + 1]
`,
            },
          ],
        },
        {
          title: "Sliding window maximum with a monotonic deque",
          variants: [
            {
              lang: "python",
              code: `
from collections import deque

def max_sliding_window(nums, k):
    dq, out = deque(), []                # indices, values decreasing
    for i, x in enumerate(nums):
        while dq and nums[dq[-1]] <= x:
            dq.pop()                     # smaller values can never be a max again
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()                 # left the window
        if i >= k - 1:
            out.append(nums[dq[0]])
    return out
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "When does a sliding window NOT work for subarray sums?",
          a: "When the array contains **negative numbers**. The window technique relies on monotonicity: expanding increases the sum, shrinking decreases it. With negatives, a longer window can have a smaller sum, so you can't decide which side to move. Use **prefix sums + a hash map** (Subarray Sum Equals K) or a monotonic deque over prefix sums (Shortest Subarray with Sum at Least K).",
          freq: "very-common",
        },
        {
          q: "Count subarrays with exactly K distinct integers.",
          a: "Directly windowing 'exactly K' is awkward because a valid window can become invalid by both expanding and shrinking. Instead `exactly(K) = atMost(K) − atMost(K − 1)`. `atMost(K)`: standard variable window with a count map; for each r, after shrinking until distinct ≤ K, add `r − l + 1` (number of valid windows ending at r). O(n).",
          freq: "common",
        },
        {
          q: "Longest Repeating Character Replacement: why can maxCount be stale?",
          a: "Window validity is `len − maxCount ≤ k`. We only care about finding a *longer* valid window than the best so far, which requires a *larger* maxCount than any seen. So keeping the historical maximum (never decreasing it when shrinking) can't produce a wrong longer answer — it may keep an invalid window temporarily, but the window never shrinks below the best length. O(n) with a 26-length count array.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Which problem is a sliding-window problem?",
          options: ["Longest increasing subsequence", "Longest substring with at most 2 distinct characters", "Two Sum (unsorted)", "Number of islands"],
          answer: 1,
          explain: "Contiguous substring + a constraint on its contents.",
        },
        {
          q: "Why is the variable window O(n) despite the nested while loop?",
          options: ["The while loop runs once", "Each index is added once and removed once", "It's actually O(n²)", "Hash maps are O(1)"],
          answer: 1,
          explain: "l and r each move forward at most n times in total.",
        },
        {
          q: "Max sum subarray of size k with an array containing negatives — sliding window still works?",
          options: ["Yes, for a FIXED size k", "No, never", "Only if sorted", "Only for k = 1"],
          answer: 0,
          explain: "Fixed windows just add/remove; it's variable-size windows that rely on monotonic sums.",
        },
        {
          q: "Exactly K distinct = …",
          options: ["atMost(K) + atMost(K − 1)", "atMost(K) − atMost(K − 1)", "atLeast(K) − atMost(K)", "atMost(K) × 2"],
          answer: 1,
          explain: "Windows with ≤ K distinct minus those with ≤ K − 1 leave exactly K.",
        },
      ],
      problems: [
        { title: "Best Time to Buy and Sell Stock", url: lc("best-time-to-buy-and-sell-stock"), difficulty: "Easy" },
        { title: "Longest Substring Without Repeating Characters", url: lc("longest-substring-without-repeating-characters"), difficulty: "Medium" },
        { title: "Longest Repeating Character Replacement", url: lc("longest-repeating-character-replacement"), difficulty: "Medium" },
        { title: "Permutation in String", url: lc("permutation-in-string"), difficulty: "Medium" },
        { title: "Find All Anagrams in a String", url: lc("find-all-anagrams-in-a-string"), difficulty: "Medium" },
        { title: "Minimum Size Subarray Sum", url: lc("minimum-size-subarray-sum"), difficulty: "Medium" },
        { title: "Fruit Into Baskets", url: lc("fruit-into-baskets"), difficulty: "Medium" },
        { title: "Minimum Window Substring", url: lc("minimum-window-substring"), difficulty: "Hard" },
        { title: "Sliding Window Maximum", url: lc("sliding-window-maximum"), difficulty: "Hard" },
        { title: "Subarrays with K Different Integers", url: lc("subarrays-with-k-different-integers"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ FAST & SLOW
    {
      id: "fast-slow-pointers",
      title: "Fast & Slow Pointers",
      tagline: "Floyd's tortoise and hare: cycles, middles and more.",
      difficulty: "intermediate",
      minutes: 10,
      visualizers: ["fastslow"],
      concept: `
## The trick
Move one pointer 1 step and another 2 steps through a sequence defined by "next":
- If there's **no cycle**, fast hits the end first.
- If there **is** a cycle, both get trapped in it and fast gains 1 node per step on slow, so they **must meet** within one lap.

O(n) time, **O(1) space** — the reason to prefer it over a visited hash set.

## Finding where the cycle starts
Let a = distance from head to cycle start, b = distance from cycle start to the meeting point, c = cycle length. At the meeting point slow walked a + b, fast walked 2(a + b), and the difference a + b is a multiple of c. So **a ≡ c − b (mod c)**: walking a steps from the head and a steps from the meeting point lands both pointers on the cycle start. Reset one pointer to the head, move both one step at a time, and they meet at the entrance.

## Where it applies
- **Linked List Cycle I / II** — detection / entrance.
- **Middle of a linked list** — when fast reaches the end, slow is in the middle (split for merge sort, palindrome check).
- **Happy Number** — the "next" function is the sum of squared digits; a cycle that doesn't contain 1 means unhappy.
- **Find the Duplicate Number** (values 1..n in n+1 slots, O(1) space, read-only): treat \`i → nums[i]\` as a linked list; the duplicate is the cycle entrance.
- **Circular array loop** — detect cycles in "jump by nums[i]" with direction constraints.

## Gap pointers (cousin pattern)
Move \`fast\` k steps ahead, then move both: when fast hits the end, slow is k from the end (Remove Nth Node From End). Same family: two pointers moving at related speeds over a sequence.
`,
      keyPoints: [
        "Slow +1, fast +2: they meet iff there's a cycle.",
        "Reset one to head and step both by 1 → meet at the cycle start.",
        "Fast at end ⇒ slow at middle.",
        "Any 'next' function works: arrays (Find the Duplicate), numbers (Happy Number).",
        "O(1) space beats a hash set's O(n).",
      ],
      complexity: [
        { op: "Cycle detection", time: "O(n)", space: "O(1)" },
        { op: "Cycle start", time: "O(n)", space: "O(1)" },
        { op: "Middle of list", time: "O(n)", space: "O(1)" },
      ],
      code: [
        {
          title: "Cycle start & Find the Duplicate Number",
          variants: [
            {
              lang: "python",
              code: `
def detect_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
        if slow is fast:
            slow = head
            while slow is not fast:
                slow, fast = slow.next, fast.next
            return slow                  # cycle entrance
    return None

def find_duplicate(nums):                # values in 1..n, len n+1
    slow = fast = nums[0]
    while True:
        slow, fast = nums[slow], nums[nums[fast]]
        if slow == fast:
            break
    slow = nums[0]
    while slow != fast:
        slow, fast = nums[slow], nums[fast]
    return slow

def is_happy(n):
    nxt = lambda x: sum(int(d) ** 2 for d in str(x))
    slow, fast = n, nxt(n)
    while fast != 1 and slow != fast:
        slow, fast = nxt(slow), nxt(nxt(fast))
    return fast == 1
`,
            },
            {
              lang: "javascript",
              code: `
function detectCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      slow = head;
      while (slow !== fast) { slow = slow.next; fast = fast.next; }
      return slow;
    }
  }
  return null;
}
`,
            },
            {
              lang: "java",
              code: `
ListNode middleNode(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;     // second middle for even lengths
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Prove that the fast and slow pointers must meet if there's a cycle.",
          a: "Once both are inside the cycle, consider the distance from slow to fast measured along the cycle direction. Each step fast moves 2 and slow moves 1, so the gap shrinks by exactly 1 per step. Starting from some gap d < c, it reaches 0 after d steps — they can't 'jump over' each other because the gap changes by 1. So they meet within one lap of slow.",
          freq: "common",
        },
        {
          q: "Find the duplicate number in [1..n] with n+1 elements, O(1) space, without modifying the array.",
          a: "Interpret index i → nums[i] as a 'next' pointer. Because there are n+1 indices but only values 1..n, two indices point to the same value, which creates a cycle whose **entrance** is the duplicate value (index 0 is never pointed to, so it's a safe start). Run Floyd's algorithm: detect the meeting point, then reset one pointer to the start and step both until they meet. O(n) time, O(1) space. (Binary search on the value range counting ≤ mid is an O(n log n) alternative.)",
          freq: "common",
        },
        {
          q: "Palindrome linked list in O(1) space?",
          a: "Find the middle with fast/slow, reverse the second half in place, compare the halves node by node, then restore the second half. O(n) time, O(1) space.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "If there's no cycle, fast/slow terminates when…",
          options: ["slow == fast", "fast or fast.next is null", "slow is null", "after n² steps"],
          answer: 1,
          explain: "The hare reaches the end of the list.",
        },
        {
          q: "After the meeting point, to find the cycle start you…",
          options: ["Double fast's speed", "Reset one pointer to head and move both 1 step", "Reverse the list", "Count the cycle length with a hash map"],
          answer: 1,
          explain: "head→start equals meet→start modulo the cycle length.",
        },
        {
          q: "Happy Number uses fast/slow pointers on…",
          options: ["The digits array", "The sequence n → sum of squared digits", "A binary tree", "A hash map"],
          answer: 1,
          explain: "That sequence either reaches 1 or loops forever.",
        },
        {
          q: "Extra space used by Floyd's algorithm?",
          options: ["O(1)", "O(log n)", "O(n)", "O(cycle length)"],
          answer: 0,
          explain: "Two pointers, nothing else.",
        },
      ],
      problems: [
        { title: "Linked List Cycle", url: lc("linked-list-cycle"), difficulty: "Easy" },
        { title: "Middle of the Linked List", url: lc("middle-of-the-linked-list"), difficulty: "Easy" },
        { title: "Happy Number", url: lc("happy-number"), difficulty: "Easy" },
        { title: "Palindrome Linked List", url: lc("palindrome-linked-list"), difficulty: "Easy" },
        { title: "Linked List Cycle II", url: lc("linked-list-cycle-ii"), difficulty: "Medium" },
        { title: "Find the Duplicate Number", url: lc("find-the-duplicate-number"), difficulty: "Medium" },
        { title: "Circular Array Loop", url: lc("circular-array-loop"), difficulty: "Medium" },
      ],
    },

    // ------------------------------------------------------------------ PREFIX SUMS
    {
      id: "prefix-sums",
      title: "Prefix Sums",
      tagline: "Precompute once, answer any range in O(1).",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["prefixsum"],
      concept: `
## The identity
Define \`P[0] = 0\` and \`P[i+1] = P[i] + a[i]\`. Then

**sum(a[l..r]) = P[r + 1] − P[l]**

O(n) to build, O(1) per query. The extra leading zero removes every \`if l == 0\` special case.

## Prefix sum + hash map (the big one)
"Count subarrays with sum = k": a subarray \`(j, i]\` sums to k iff \`P[i] − P[j] = k\` ⇔ \`P[j] = P[i] − k\`. Scan once, keeping a **count of prefix sums seen so far**; at each i add \`count[P[i] − k]\`. Seed \`count[0] = 1\` (the empty prefix).

Works with **negative numbers**, unlike sliding window. Variants:
- **Longest** subarray with sum k → store the **first** index of each prefix sum.
- Subarray sum **divisible by k** → key by \`P[i] mod k\` (normalize negatives).
- **Contiguous array** (equal 0s and 1s) → map 0 to −1 and look for prefix sums that repeat.
- **Continuous subarray sum** (multiple of k, length ≥ 2) → first index per remainder.

## 2-D prefix sums
\`P[r+1][c+1] = a[r][c] + P[r][c+1] + P[r+1][c] − P[r][c]\`; any rectangle sum is four lookups (inclusion–exclusion). Used for image integral images, matrix block sums, counting submatrices.

## Difference arrays (the inverse)
To add v to every element in [l, r] many times, write \`D[l] += v, D[r+1] −= v\`, then take the prefix sum once at the end: O(1) per update, O(n) to materialize. Car pooling, corporate flight bookings, range addition.

## Related: products
Product of Array Except Self = prefix products × suffix products (no division, O(1) extra space if you reuse the output array).
`,
      keyPoints: [
        "sum(l..r) = P[r+1] − P[l] with P[0] = 0.",
        "Count subarrays with sum k: hash map of prefix-sum counts, seeded with {0: 1}.",
        "Works with negatives where sliding window fails.",
        "2-D prefix sums: inclusion–exclusion with four lookups.",
        "Difference arrays: O(1) range updates, one prefix pass to materialize.",
      ],
      complexity: [
        { op: "Build prefix array", time: "O(n)", space: "O(n)" },
        { op: "Range sum query", time: "O(1)" },
        { op: "Subarray sum = k (count)", time: "O(n)", space: "O(n)" },
        { op: "2-D rectangle sum", time: "O(1) after O(R·C) build" },
      ],
      code: [
        {
          title: "Subarray Sum Equals K & Range Sum Query",
          variants: [
            {
              lang: "python",
              code: `
from collections import defaultdict
from itertools import accumulate

def subarray_sum(nums, k):
    count = defaultdict(int)
    count[0] = 1                     # empty prefix
    total = running = 0
    for x in nums:
        running += x
        total += count[running - k]  # earlier prefixes that make a sum of k
        count[running] += 1
    return total

class NumArray:
    def __init__(self, nums):
        self.P = [0, *accumulate(nums)]

    def sum_range(self, l, r):
        return self.P[r + 1] - self.P[l]
`,
            },
            {
              lang: "javascript",
              code: `
function subarraySum(nums, k) {
  const count = new Map([[0, 1]]);
  let total = 0, running = 0;
  for (const x of nums) {
    running += x;
    total += count.get(running - k) ?? 0;
    count.set(running, (count.get(running) ?? 0) + 1);
  }
  return total;
}
`,
            },
            {
              lang: "java",
              code: `
int[] productExceptSelf(int[] nums) {
    int n = nums.length;
    int[] out = new int[n];
    out[0] = 1;
    for (int i = 1; i < n; i++) out[i] = out[i - 1] * nums[i - 1];  // prefix products
    int suffix = 1;
    for (int i = n - 1; i >= 0; i--) {
        out[i] *= suffix;                                         // times suffix products
        suffix *= nums[i];
    }
    return out;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why seed the hash map with {0: 1} in Subarray Sum Equals K?",
          a: "It represents the empty prefix before index 0. Without it, subarrays that start at index 0 (where `P[i] == k`, so `P[i] − k == 0`) wouldn't be counted. Equivalent to writing `P[0] = 0` in the explicit prefix array.",
          freq: "very-common",
        },
        {
          q: "Find the longest subarray with equal numbers of 0s and 1s.",
          a: "Replace 0 with −1; now you want the longest subarray with sum 0. Two prefix sums are equal exactly when the subarray between them sums to 0. Store the **first** index where each prefix sum appears (seed `{0: -1}`), and at each index i with prefix p, if p was seen at j, candidate length is `i − j`. O(n).",
          freq: "common",
        },
        {
          q: "How do you handle many 'add v to range [l, r]' updates followed by queries?",
          a: "Use a **difference array**: each update is `D[l] += v; D[r+1] -= v` in O(1); after all updates, one prefix-sum pass reconstructs the values in O(n). If updates and queries interleave, switch to a **Fenwick tree** (BIT) or **segment tree** for O(log n) each.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "With P = [0, 3, 7, 0, 3], sum of a[1..2] (0-indexed, inclusive) is…",
          options: ["4", "−3", "7", "0"],
          answer: 1,
          explain: "P[3] − P[1] = 0 − 3 = −3.",
        },
        {
          q: "Counting subarrays that sum to k when the array has negatives — best approach?",
          options: ["Sliding window", "Prefix sums + hash map", "Sorting + two pointers", "Binary search"],
          answer: 1,
          explain: "Negatives break window monotonicity; prefix sums don't care.",
        },
        {
          q: "A difference array makes range updates…",
          options: ["O(n) each", "O(1) each, with an O(n) pass to read values", "O(log n)", "Impossible"],
          answer: 1,
          explain: "Mark the start and one-past-the-end, then prefix-sum once.",
        },
        {
          q: "A rectangle sum on a 2-D prefix array needs how many lookups?",
          options: ["1", "2", "4", "R × C"],
          answer: 2,
          explain: "Inclusion–exclusion: whole − top − left + overlap.",
        },
      ],
      problems: [
        { title: "Range Sum Query - Immutable", url: lc("range-sum-query-immutable"), difficulty: "Easy" },
        { title: "Find Pivot Index", url: lc("find-pivot-index"), difficulty: "Easy" },
        { title: "Subarray Sum Equals K", url: lc("subarray-sum-equals-k"), difficulty: "Medium" },
        { title: "Contiguous Array", url: lc("contiguous-array"), difficulty: "Medium" },
        { title: "Continuous Subarray Sum", url: lc("continuous-subarray-sum"), difficulty: "Medium" },
        { title: "Subarray Sums Divisible by K", url: lc("subarray-sums-divisible-by-k"), difficulty: "Medium" },
        { title: "Range Sum Query 2D - Immutable", url: lc("range-sum-query-2d-immutable"), difficulty: "Medium" },
        { title: "Car Pooling", url: lc("car-pooling"), difficulty: "Medium", note: "difference array" },
        { title: "Product of Array Except Self", url: lc("product-of-array-except-self"), difficulty: "Medium" },
      ],
    },

    // ------------------------------------------------------------------ MONOTONIC STACK
    {
      id: "monotonic-stack",
      title: "Monotonic Stack",
      tagline: "Next greater element and friends in a single pass.",
      difficulty: "advanced",
      minutes: 12,
      visualizers: ["monostack"],
      concept: `
## Recognize it
"For each element, find the **next/previous greater/smaller** element" — or anything derived from that: how many days until warmer, how far a bar extends, stock span, visible people in a queue, the largest rectangle under a histogram.

Brute force scans right from each element: O(n²). A **monotonic stack** does it in **O(n)**.

## The mechanism
Keep a stack of indices whose values are **monotonic** (e.g. decreasing from bottom to top). When a new element arrives:
\`\`\`
for i, x in enumerate(a):
    while stack and a[stack[-1]] < x:   # x is the "next greater" for these
        j = stack.pop()
        answer[j] = i                    # or x, or i - j …
    stack.append(i)
\`\`\`
Every index is pushed once and popped at most once → O(n). Elements left on the stack at the end have no next greater element.

## Choosing the direction and comparison
| Want | Stack holds | Pop while |
|---|---|---|
| next greater | decreasing values | \`a[top] < x\` |
| next smaller | increasing values | \`a[top] > x\` |
| previous greater | decreasing; answer = top **after** popping | \`a[top] <= x\` |
| circular array | iterate 2n indices using \`i % n\` | |

Strict vs non-strict comparisons decide how **duplicates** are handled — matters for counting problems (sum of subarray minimums uses < on one side and ≤ on the other to avoid double counting).

## Largest rectangle in a histogram
For each bar, the widest rectangle using its height extends until the first smaller bar on each side. An increasing stack finds both boundaries: when a bar is popped by a smaller bar at i, its right boundary is i and its left boundary is the new stack top. Append a sentinel 0 to flush the stack. O(n). Maximal Rectangle in a binary matrix applies this row by row.

## Monotonic deque
The same idea with pops from both ends gives the **sliding window maximum** (see Sliding Window) and optimizes some DP transitions.
`,
      keyPoints: [
        "Next/previous greater/smaller ⇒ monotonic stack.",
        "Store indices, not values — you usually need distances.",
        "Each index pushed and popped once: O(n).",
        "Leftovers on the stack have no answer (often 0 or −1).",
        "Histogram: popped bar's width = i − new_top − 1.",
      ],
      complexity: [
        { op: "Next greater element (all)", time: "O(n)", space: "O(n)" },
        { op: "Largest rectangle in histogram", time: "O(n)", space: "O(n)" },
        { op: "Sum of subarray minimums", time: "O(n)", space: "O(n)" },
      ],
      code: [
        {
          title: "Daily temperatures & largest rectangle",
          variants: [
            {
              lang: "python",
              code: `
def daily_temperatures(t):
    ans, stack = [0] * len(t), []          # stack of indices, temps decreasing
    for i, x in enumerate(t):
        while stack and t[stack[-1]] < x:
            j = stack.pop()
            ans[j] = i - j
        stack.append(i)
    return ans

def largest_rectangle(heights):
    stack, best = [], 0                     # indices, heights increasing
    for i, h in enumerate(heights + [0]):   # sentinel flushes the stack
        while stack and heights[stack[-1]] > h:
            height = heights[stack.pop()]
            left = stack[-1] if stack else -1
            best = max(best, height * (i - left - 1))
        stack.append(i)
    return best
`,
            },
            {
              lang: "javascript",
              code: `
function nextGreaterElements(nums) {        // circular array
  const n = nums.length, ans = new Array(n).fill(-1), stack = [];
  for (let k = 0; k < 2 * n; k++) {
    const i = k % n;
    while (stack.length && nums[stack.at(-1)] < nums[i]) ans[stack.pop()] = nums[i];
    if (k < n) stack.push(i);
  }
  return ans;
}
`,
            },
            {
              lang: "java",
              code: `
int[] dailyTemperatures(int[] t) {
    int[] ans = new int[t.length];
    Deque<Integer> stack = new ArrayDeque<>();
    for (int i = 0; i < t.length; i++) {
        while (!stack.isEmpty() && t[stack.peek()] < t[i]) {
            int j = stack.pop();
            ans[j] = i - j;
        }
        stack.push(i);
    }
    return ans;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why is the monotonic stack O(n) even though there's a while loop inside a for loop?",
          a: "Amortized analysis: each index is pushed exactly once and popped at most once over the entire run. The total number of while-loop iterations across all i is therefore ≤ n, so the whole algorithm is O(n) — same reasoning as the sliding window.",
          freq: "common",
        },
        {
          q: "Walk through Largest Rectangle in Histogram.",
          a: "Maintain indices with increasing heights. When the current bar is shorter than the top, the top bar can't extend further right — pop it; its rectangle height is its own height, its right boundary is i (exclusive) and its left boundary is the new top (exclusive), so width = `i − top − 1` (or i if the stack is empty). Track the max area. A trailing 0-height sentinel pops everything at the end. O(n).",
          freq: "common",
        },
        {
          q: "Remove K Digits to make the smallest number — what's the pattern?",
          a: "Greedy + monotonic increasing stack: scan digits; while k > 0 and the top is larger than the current digit, pop it (removing a larger digit earlier in the number makes it smaller). Push the current digit. If k remains, remove from the end. Strip leading zeros. O(n).",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "To find the next GREATER element for each index, the stack holds values that are…",
          options: ["Increasing bottom→top", "Decreasing bottom→top", "Sorted globally", "Random"],
          answer: 1,
          explain: "A larger arrival pops all smaller waiting values — they found their answer.",
        },
        {
          q: "Daily temperatures [73, 74, 75, 71, 69, 72, 76, 73] — answer for 71 (index 3)?",
          options: ["1", "2", "3", "4"],
          answer: 1,
          explain: "Next warmer is 72 at index 5: 5 − 3 = 2.",
        },
        {
          q: "How do you handle a circular array for next greater element?",
          options: ["Sort it", "Iterate 2n times using i % n", "Use two stacks", "It's impossible"],
          answer: 1,
          explain: "The second pass lets elements near the end see elements from the start.",
        },
        {
          q: "Total pops across the whole algorithm are at most…",
          options: ["n", "n log n", "n²", "2ⁿ"],
          answer: 0,
          explain: "Each index can be popped once.",
        },
      ],
      problems: [
        { title: "Next Greater Element I", url: lc("next-greater-element-i"), difficulty: "Easy" },
        { title: "Daily Temperatures", url: lc("daily-temperatures"), difficulty: "Medium" },
        { title: "Next Greater Element II", url: lc("next-greater-element-ii"), difficulty: "Medium" },
        { title: "Online Stock Span", url: lc("online-stock-span"), difficulty: "Medium" },
        { title: "Remove K Digits", url: lc("remove-k-digits"), difficulty: "Medium" },
        { title: "Sum of Subarray Minimums", url: lc("sum-of-subarray-minimums"), difficulty: "Medium" },
        { title: "Largest Rectangle in Histogram", url: lc("largest-rectangle-in-histogram"), difficulty: "Hard" },
        { title: "Maximal Rectangle", url: lc("maximal-rectangle"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ INTERVALS
    {
      id: "intervals",
      title: "Intervals",
      tagline: "Sort by start, sweep, merge — and count overlaps.",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["intervals"],
      concept: `
## Recognize it
Input is a list of \`[start, end]\` pairs: meetings, bookings, time ranges, genomic regions, CPU tasks. Questions: merge them, insert one, find free time, count rooms, remove the fewest to avoid overlap.

## Overlap test
Two intervals \`[a, b]\` and \`[c, d]\` overlap iff **\`a < d and c < b\`** (use ≤ if touching endpoints count). Their intersection is \`[max(a, c), min(b, d)]\` when non-empty.

## Merge intervals
1. Sort by start.
2. Sweep: if the current interval starts **after** the last merged end, start a new one; otherwise extend the last end to \`max(lastEnd, curEnd)\`.
O(n log n). Don't forget the \`max\` — a short interval fully inside a long one must not shrink it.

## Insert interval
Already sorted and non-overlapping: copy everything that ends before the new one, merge everything that overlaps it, copy the rest. O(n), no sort needed.

## How many overlap at once? (meeting rooms II)
**Sweep line**: turn each interval into events \`(start, +1)\` and \`(end, −1)\`, sort (ends before starts at the same time if touching is allowed), and track the running count's max. Or sort by start and use a **min-heap of end times**. O(n log n).

## Which to keep? (non-overlapping intervals)
Greedy by **earliest end** (Greedy lesson): keep the interval that ends first, drop overlaps. Minimum removals = n − kept.

## Two sorted interval lists
Interval list intersections: two pointers; the intersection of the current pair is \`[max(starts), min(ends)]\`; advance the pointer whose interval ends first. O(m + n).

## Systems angle
Calendar booking (TreeMap floor/ceiling for O(log n) inserts), rate-limit windows, compaction of SSTable key ranges, merging time-series ranges in monitoring systems.
`,
      keyPoints: [
        "Overlap iff a < d and c < b.",
        "Merge: sort by start, extend end with max().",
        "Max simultaneous overlaps: sweep line or min-heap of ends.",
        "Fewest removals: greedy by earliest end.",
        "Insert into a sorted list: O(n), three phases.",
      ],
      complexity: [
        { op: "Merge intervals", time: "O(n log n)", space: "O(n)" },
        { op: "Insert interval (sorted input)", time: "O(n)" },
        { op: "Meeting rooms II", time: "O(n log n)", space: "O(n)" },
        { op: "Interval list intersections", time: "O(m + n)" },
      ],
      code: [
        {
          title: "Merge intervals & meeting rooms II",
          variants: [
            {
              lang: "python",
              code: `
import heapq

def merge(intervals):
    intervals.sort(key=lambda iv: iv[0])
    out = []
    for s, e in intervals:
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)   # overlap → extend
        else:
            out.append([s, e])
    return out

def min_meeting_rooms(intervals):
    intervals.sort(key=lambda iv: iv[0])
    ends = []                                 # min-heap of end times in use
    for s, e in intervals:
        if ends and ends[0] <= s:
            heapq.heappop(ends)               # a room freed up
        heapq.heappush(ends, e)
    return len(ends)
`,
            },
            {
              lang: "javascript",
              code: `
function merge(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of intervals) {
    if (out.length && s <= out.at(-1)[1]) out.at(-1)[1] = Math.max(out.at(-1)[1], e);
    else out.push([s, e]);
  }
  return out;
}

function minMeetingRooms(intervals) {      // sweep line
  const events = [];
  for (const [s, e] of intervals) events.push([s, 1], [e, -1]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // ends first on ties
  let cur = 0, best = 0;
  for (const [, d] of events) best = Math.max(best, (cur += d));
  return best;
}
`,
            },
            {
              lang: "java",
              code: `
int[][] insert(int[][] ivs, int[] nw) {
    List<int[]> out = new ArrayList<>();
    int i = 0, n = ivs.length;
    while (i < n && ivs[i][1] < nw[0]) out.add(ivs[i++]);          // before
    while (i < n && ivs[i][0] <= nw[1]) {                           // overlapping
        nw[0] = Math.min(nw[0], ivs[i][0]);
        nw[1] = Math.max(nw[1], ivs[i][1]);
        i++;
    }
    out.add(nw);
    while (i < n) out.add(ivs[i++]);                                 // after
    return out.toArray(new int[0][]);
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What's the condition for two intervals to overlap?",
          a: "`[a, b]` and `[c, d]` overlap iff `a < d && c < b` (strict if touching endpoints don't count, ≤ otherwise). Equivalently, they *don't* overlap iff one ends before the other starts: `b <= c || d <= a`. Negating the non-overlap condition is the easiest way to remember it.",
          freq: "very-common",
        },
        {
          q: "Meeting Rooms II: minimum number of rooms?",
          a: "It's the maximum number of meetings in progress at any instant. Sweep line: events (+1 at start, −1 at end), sort with ends before starts on ties, track the running max. Or sort by start and keep a min-heap of end times; pop when the earliest end ≤ current start (room reused), push current end; the heap size at the end (or its max) is the answer. O(n log n).",
          freq: "very-common",
        },
        {
          q: "Employee Free Time: given each employee's sorted busy intervals, find common free time.",
          a: "Merge all intervals (k-way merge with a heap keyed by start, or flatten and sort), then the gaps between consecutive merged intervals are the common free times. O(N log k) with the heap where N is total intervals.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Merging [[1,4],[2,3],[5,7]] gives…",
          options: ["[[1,3],[5,7]]", "[[1,4],[5,7]]", "[[1,7]]", "[[2,4],[5,7]]"],
          answer: 1,
          explain: "[2,3] is inside [1,4]; the end stays 4 thanks to max().",
        },
        {
          q: "First step of merge intervals?",
          options: ["Sort by end", "Sort by start", "Build a heap", "Binary search"],
          answer: 1,
          explain: "Sorting by start makes overlapping intervals adjacent.",
        },
        {
          q: "Meetings [0,30], [5,10], [15,20] need how many rooms?",
          options: ["1", "2", "3", "0"],
          answer: 1,
          explain: "[0,30] overlaps each of the others, which don't overlap each other.",
        },
        {
          q: "Inserting into an already sorted, non-overlapping list costs…",
          options: ["O(log n)", "O(n)", "O(n log n)", "O(n²)"],
          answer: 1,
          explain: "One pass with three phases; no sort needed.",
        },
      ],
      problems: [
        { title: "Meeting Rooms", url: lc("meeting-rooms"), difficulty: "Easy" },
        { title: "Merge Intervals", url: lc("merge-intervals"), difficulty: "Medium" },
        { title: "Insert Interval", url: lc("insert-interval"), difficulty: "Medium" },
        { title: "Non-overlapping Intervals", url: lc("non-overlapping-intervals"), difficulty: "Medium" },
        { title: "Meeting Rooms II", url: lc("meeting-rooms-ii"), difficulty: "Medium" },
        { title: "Interval List Intersections", url: lc("interval-list-intersections"), difficulty: "Medium" },
        { title: "My Calendar II", url: lc("my-calendar-ii"), difficulty: "Medium" },
        { title: "Employee Free Time", url: lc("employee-free-time"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ TOP K
    {
      id: "top-k",
      title: "Top-K & K-Way Merge",
      tagline: "Heaps of size k for streaming rankings and merges.",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["heap"],
      concept: `
## Recognize it
- "Top / largest / smallest / most frequent **k**", "k closest points", "k-th largest".
- Merge **k sorted** arrays, lists or streams; smallest range covering k lists.
- Anything **streaming** where you can't hold or sort everything.

## The size-k heap
To keep the **k largest**, use a **min-heap** of size k: its root is the smallest of the current top k, i.e. the one to evict. For k smallest, use a max-heap. Each of n items costs O(log k) → **O(n log k)**, O(k) memory — far better than sorting (O(n log n)) when k ≪ n, and it works on unbounded streams.

## Alternatives the interviewer may want
| Approach | Time | When |
|---|---|---|
| Sort | O(n log n) | simplest, small n |
| Heap of size k | O(n log k) | streaming, k ≪ n |
| Quickselect | O(n) avg | one-off, in memory, k-th element |
| Bucket sort by frequency | O(n) | top-k frequent (frequencies ≤ n) |
| Count-min sketch + heap | sublinear memory | heavy hitters at internet scale |

## K-way merge
Push the head of each of k sorted sequences into a min-heap of \`(value, list_id, index)\`. Pop the smallest, output it, push the next element from the same list. O(N log k) for N total elements. This is the core of **external merge sort**, of merging SSTables in LSM-tree compaction, and of search engines merging posting lists.

## Two heaps
Running median (max-heap low half + min-heap high half), sliding window median, IPO (maximize capital: one heap of affordable projects by profit, one of locked projects by cost).
`,
      keyPoints: [
        "k largest ⇒ min-heap of size k (evict the root).",
        "O(n log k) time, O(k) space, works on streams.",
        "Top-k frequent: hash map counts + heap, or bucket sort for O(n).",
        "K-way merge: heap of list heads, O(N log k).",
        "Quickselect for one-off k-th element in O(n) average.",
      ],
      complexity: [
        { op: "Top k of n (heap)", time: "O(n log k)", space: "O(k)" },
        { op: "Top k frequent (bucket)", time: "O(n)", space: "O(n)" },
        { op: "Merge k sorted lists", time: "O(N log k)", space: "O(k)" },
        { op: "Quickselect", time: "O(n) avg" },
      ],
      code: [
        {
          title: "Top K frequent elements (heap and bucket sort)",
          variants: [
            {
              lang: "python",
              code: `
import heapq
from collections import Counter

def top_k_frequent_heap(nums, k):
    counts = Counter(nums)
    return heapq.nlargest(k, counts, key=counts.get)   # O(n log k)

def top_k_frequent_bucket(nums, k):
    counts = Counter(nums)
    buckets = [[] for _ in range(len(nums) + 1)]       # index = frequency
    for x, c in counts.items():
        buckets[c].append(x)
    out = []
    for c in range(len(buckets) - 1, 0, -1):
        for x in buckets[c]:
            out.append(x)
            if len(out) == k:
                return out
    return out

def k_closest(points, k):
    return heapq.nsmallest(k, points, key=lambda p: p[0] ** 2 + p[1] ** 2)
`,
            },
            {
              lang: "java",
              code: `
int[] topKFrequent(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    for (int x : nums) count.merge(x, 1, Integer::sum);
    PriorityQueue<Integer> heap = new PriorityQueue<>((a, b) -> count.get(a) - count.get(b));
    for (int x : count.keySet()) {
        heap.offer(x);
        if (heap.size() > k) heap.poll();          // evict least frequent
    }
    return heap.stream().mapToInt(Integer::intValue).toArray();
}
`,
            },
            {
              lang: "javascript",
              code: `
function topKFrequent(nums, k) {
  const count = new Map();
  for (const x of nums) count.set(x, (count.get(x) ?? 0) + 1);
  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [x, c] of count) buckets[c].push(x);
  const out = [];
  for (let c = buckets.length - 1; c > 0 && out.length < k; c--) out.push(...buckets[c]);
  return out.slice(0, k);
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Find the top 10 most frequent search queries from a log of billions of queries.",
          a: "Single machine, fits in memory: hash map counts + min-heap of size 10 → O(n log 10). Too big for memory: **hash-partition** queries by `hash(query) % P` into P files so each query's counts land in one file, count each file separately, take each file's top 10, then merge the candidates. Distributed: MapReduce/Spark with the same idea (map: emit (query, 1); combine; reduce: count; then a global top-k). Streaming/approximate: **Count-Min Sketch** for counts plus a heap of heavy hitters, or Space-Saving / Misra–Gries.",
          freq: "very-common",
        },
        {
          q: "Why a MIN-heap to find the k LARGEST elements?",
          a: "The heap holds the current best k candidates, and you need fast access to the *weakest* candidate to decide whether a new element beats it. In a min-heap that's the root: compare in O(1), replace in O(log k). A max-heap of all n items would need O(n) space and k pops.",
          freq: "common",
        },
        {
          q: "Smallest range covering elements from k sorted lists?",
          a: "K-way merge style: push the first element of each list into a min-heap and track the current max among them. The range [heap min, current max] covers all lists. Pop the min, push the next element from that list (updating max), and record the range if smaller. Stop when any list is exhausted. O(N log k).",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Top-k via a size-k heap over n items costs…",
          options: ["O(n)", "O(n log k)", "O(k log n)", "O(n log n)"],
          answer: 1,
          explain: "n pushes/pops on a heap of size k.",
        },
        {
          q: "Top-k frequent in O(n) uses…",
          options: ["Merge sort", "Bucket sort indexed by frequency", "Binary search", "A trie"],
          answer: 1,
          explain: "Frequencies are bounded by n, so buckets 1..n work.",
        },
        {
          q: "Merging k sorted lists with N total nodes costs…",
          options: ["O(N k)", "O(N log k)", "O(k log N)", "O(N log N)"],
          answer: 1,
          explain: "Heap of k list heads, N pops/pushes.",
        },
        {
          q: "For approximate heavy hitters on an unbounded stream, a common tool is…",
          options: ["Bloom filter", "Count-Min Sketch", "Trie", "B-tree"],
          answer: 1,
          explain: "It estimates frequencies in sublinear memory.",
        },
      ],
      problems: [
        { title: "Kth Largest Element in a Stream", url: lc("kth-largest-element-in-a-stream"), difficulty: "Easy" },
        { title: "Top K Frequent Elements", url: lc("top-k-frequent-elements"), difficulty: "Medium" },
        { title: "Top K Frequent Words", url: lc("top-k-frequent-words"), difficulty: "Medium" },
        { title: "K Closest Points to Origin", url: lc("k-closest-points-to-origin"), difficulty: "Medium" },
        { title: "Find K Pairs with Smallest Sums", url: lc("find-k-pairs-with-smallest-sums"), difficulty: "Medium" },
        { title: "Reorganize String", url: lc("reorganize-string"), difficulty: "Medium" },
        { title: "Merge k Sorted Lists", url: lc("merge-k-sorted-lists"), difficulty: "Hard" },
        { title: "Smallest Range Covering Elements from K Lists", url: lc("smallest-range-covering-elements-from-k-lists"), difficulty: "Hard" },
        { title: "IPO", url: lc("ipo"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ DP PATTERNS
    {
      id: "dp-patterns",
      title: "DP Patterns Playbook",
      tagline: "Map an unfamiliar DP problem to one of eight families.",
      difficulty: "advanced",
      minutes: 18,
      visualizers: ["dp"],
      concept: `
## Pattern → state cheat sheet
| Family | State | Transition sketch | Examples |
|---|---|---|---|
| **Linear** | dp[i] = answer for prefix i | from dp[i−1], dp[i−2] | climbing stairs, house robber, decode ways |
| **Unbounded choices** | dp[x] = best for value x | min/sum over choices | coin change I & II, perfect squares, word break |
| **0/1 knapsack** | dp[i][w] (or dp[w] backwards) | skip / take item i | subset sum, partition equal subset, target sum, ones and zeroes |
| **Two sequences** | dp[i][j] over prefixes | match → diagonal; else neighbours | LCS, edit distance, distinct subsequences, regex/wildcard |
| **Grid paths** | dp[r][c] | from top / left | unique paths, min path sum, dungeon game (backwards) |
| **LIS family** | dp[i] = best ending at i | max over j < i with a[j] < a[i] | LIS, Russian dolls, longest string chain |
| **Interval** | dp[l][r] over subarrays | split point k in (l, r) | burst balloons, palindromic substrings, matrix chain, stone game |
| **State machine** | dp[i][state] | transitions between states | stock buy/sell (cooldown, fee, k transactions), paint house |

Plus **bitmask DP** (n ≤ 20: dp[mask]), **tree DP** (return tuples from children: house robber III, binary tree cameras) and **digit DP** (count numbers ≤ N with a property).

## Counting vs optimizing
- "**How many ways**" → sum the transitions (watch for order: coin change II loops coins *outside* amounts to count combinations, inside to count permutations).
- "**Min / max**" → min/max over transitions, initialize with ±∞.
- "**Possible?**" → boolean OR.

## Reading the constraints
- n ≤ 20 → bitmask, n ≤ 100–500 → O(n³) interval DP okay, n ≤ 5,000 → O(n²) (LIS, LCS), n ≤ 10⁵ → O(n) or O(n log n) DP only.

## Space optimization
If row i depends only on row i−1, keep two rows (or one: iterate in the direction that keeps unread values intact). Two-sequence DPs drop from O(mn) to O(min(m, n)).

## Debugging DP
Print the table for a tiny input and compare with hand-computed values. Most bugs are off-by-one in the state definition (prefix of length i vs index i) or wrong base cases.
`,
      keyPoints: [
        "Match the problem to a family, then reuse its state shape.",
        "Count ways = sum; optimize = min/max; feasibility = OR.",
        "Coin change II: coins outer loop counts combinations, not permutations.",
        "Interval DP fills by increasing length.",
        "State machines model 'holding / not holding / cooldown'.",
      ],
      complexity: [
        { op: "Linear DP", time: "O(n)", space: "O(1)" },
        { op: "Two sequences", time: "O(m·n)", space: "O(min(m, n))" },
        { op: "Interval DP", time: "O(n³)", space: "O(n²)" },
        { op: "Bitmask DP", time: "O(2ⁿ · n)", space: "O(2ⁿ)" },
      ],
      code: [
        {
          title: "House robber, coin change II and stock with cooldown",
          variants: [
            {
              lang: "python",
              code: `
def rob(nums):                          # linear: take i or skip it
    take = skip = 0
    for x in nums:
        take, skip = skip + x, max(take, skip)
    return max(take, skip)

def change(amount, coins):              # number of COMBINATIONS
    dp = [1] + [0] * amount
    for c in coins:                     # coins outer → each multiset counted once
        for a in range(c, amount + 1):
            dp[a] += dp[a - c]
    return dp[amount]

def max_profit_cooldown(prices):        # state machine
    hold, sold, rest = float("-inf"), 0, 0
    for p in prices:
        hold, sold, rest = max(hold, rest - p), hold + p, max(rest, sold)
    return max(sold, rest)
`,
            },
            {
              lang: "javascript",
              code: `
function lengthOfLIS(nums) {            // O(n log n) patience sorting
  const tails = [];
  for (const x of nums) {
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1; else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}

function countSubstrings(s) {           // palindromic substrings: expand around centers
  let count = 0;
  for (let c = 0; c < 2 * s.length - 1; c++) {
    let l = c >> 1, r = l + (c & 1);
    while (l >= 0 && r < s.length && s[l] === s[r]) { count++; l--; r++; }
  }
  return count;
}
`,
            },
            {
              lang: "java",
              code: `
int uniquePaths(int m, int n) {         // grid DP, one row
    int[] dp = new int[n];
    Arrays.fill(dp, 1);
    for (int r = 1; r < m; r++)
        for (int c = 1; c < n; c++)
            dp[c] += dp[c - 1];         // from top (old dp[c]) + from left
    return dp[n - 1];
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Coin Change II counts combinations. What happens if you swap the loops?",
          a: "With **coins outer, amount inner**, each coin is considered in a fixed order, so {1,2} and {2,1} are the same combination — you count **combinations**. With **amount outer, coins inner**, every ordering is counted separately — you count **permutations** (that's Combination Sum IV). The recurrence is identical; only the loop order changes what's being counted.",
          freq: "common",
        },
        {
          q: "How do you approach 'Best Time to Buy and Sell Stock' variants systematically?",
          a: "Model it as a **state machine** over days: states like `hold` (own a share) and `free` (don't), plus `cooldown` or a transaction counter k when needed. Transitions: buy (free → hold, −price), sell (hold → free, +price − fee), rest. Each day update all states from the previous day's values. That single framework solves I (k=1), II (unlimited), III (k=2), IV (k), cooldown and fee in O(n·k).",
          freq: "common",
        },
        {
          q: "What is interval DP and how do you order the computation?",
          a: "`dp[l][r]` describes the answer for subarray l..r, computed from smaller intervals inside it, usually by trying every split point k: `dp[l][r] = best over k of combine(dp[l][k], dp[k][r], cost)`. Fill by **increasing interval length** so all shorter intervals are ready. Burst Balloons is the classic: choose k as the *last* balloon to burst in (l, r) so its neighbours are l and r. O(n³).",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "\"Partition an array into two subsets with equal sum\" belongs to which family?",
          options: ["Two sequences", "0/1 knapsack (subset sum)", "Interval DP", "LIS"],
          answer: 1,
          explain: "Can a subset reach total/2? Each item used at most once.",
        },
        {
          q: "Edit distance is a…",
          options: ["Linear DP", "Two-sequence DP", "Bitmask DP", "Tree DP"],
          answer: 1,
          explain: "dp[i][j] over prefixes of both strings.",
        },
        {
          q: "Interval DP tables are filled by…",
          options: ["Row then column", "Increasing interval length", "Random order", "Decreasing index only"],
          answer: 1,
          explain: "dp[l][r] depends on strictly shorter intervals.",
        },
        {
          q: "Constraints n ≤ 16 and 'visit all nodes' suggest…",
          options: ["Greedy", "Bitmask DP", "Union-Find", "Two pointers"],
          answer: 1,
          explain: "2¹⁶ × 16 states is small enough.",
        },
      ],
      problems: [
        { title: "House Robber II", url: lc("house-robber-ii"), difficulty: "Medium" },
        { title: "Decode Ways", url: lc("decode-ways"), difficulty: "Medium" },
        { title: "Coin Change II", url: lc("coin-change-ii"), difficulty: "Medium" },
        { title: "Target Sum", url: lc("target-sum"), difficulty: "Medium" },
        { title: "Longest Palindromic Substring", url: lc("longest-palindromic-substring"), difficulty: "Medium" },
        { title: "Best Time to Buy and Sell Stock with Cooldown", url: lc("best-time-to-buy-and-sell-stock-with-cooldown"), difficulty: "Medium" },
        { title: "Interleaving String", url: lc("interleaving-string"), difficulty: "Medium" },
        { title: "Distinct Subsequences", url: lc("distinct-subsequences"), difficulty: "Hard" },
        { title: "Burst Balloons", url: lc("burst-balloons"), difficulty: "Hard" },
        { title: "Shortest Path Visiting All Nodes", url: lc("shortest-path-visiting-all-nodes"), difficulty: "Hard", note: "bitmask BFS" },
      ],
    },

    // ------------------------------------------------------------------ GRAPH PATTERNS
    {
      id: "graph-patterns",
      title: "Graph Patterns on Grids & Words",
      tagline: "Islands, multi-source BFS, word ladders and implicit graphs.",
      difficulty: "advanced",
      minutes: 14,
      visualizers: ["grid"],
      concept: `
## Most graph problems don't say "graph"
They hide it in a **grid**, a set of **words**, a **state space** (lock combinations, puzzle boards), or **relationships** (accounts sharing emails, equations). The skill is recognizing the nodes and edges:

| Disguise | Nodes | Edges |
|---|---|---|
| Grid | cells | 4 (or 8) neighbours |
| Word ladder | words | differ by one letter |
| Open the lock | 4-digit codes | turn one wheel ±1 |
| Sliding puzzle | board states | one swap with the blank |
| Accounts merge | emails | same account |
| Evaluate division | variables | a / b = value (weighted) |

## The pattern menu
1. **Flood fill / connected components** — DFS/BFS from every unvisited cell (islands, max area, surrounded regions: flood from the *border* first).
2. **Multi-source BFS** — seed all sources at distance 0 (rotting oranges, walls and gates, 01-matrix, as-far-from-land-as-possible).
3. **Shortest path in an implicit graph** — BFS over states, generating neighbours on the fly; use a visited set of states (word ladder, open the lock, minimum knight moves).
4. **Bidirectional BFS** — search from both ends and stop when the frontiers meet: roughly √ of the work when the branching factor is large (word ladder).
5. **Reverse thinking** — Pacific Atlantic: instead of asking where each cell flows, BFS *uphill* from each ocean and intersect.
6. **Weighted / 0-1 grid** — Dijkstra on cells (path with minimum effort, swim in rising water) or 0-1 BFS with a deque.
7. **Topological sort on implicit dependencies** — alien dictionary, longest increasing path in a matrix (edges from smaller to larger cells, DAG → DP/topo).

## Word ladder trick
Generating neighbours by trying all 26 letters at each position is O(L · 26) per word. Alternatively precompute **wildcard buckets**: \`h*t\` → [hot, hit, hat]. Words in the same bucket are neighbours.

## Complexity hygiene
State the number of states × neighbours per state. Open the lock: 10⁴ states × 8 neighbours. Sliding puzzle 2×3: 6! = 720 states. That number tells you whether BFS is feasible.
`,
      keyPoints: [
        "Identify nodes and edges first — the algorithm usually follows.",
        "Multi-source BFS: all sources in the queue at distance 0.",
        "Implicit graphs: generate neighbours lazily, track visited states.",
        "Bidirectional BFS shrinks huge search spaces.",
        "Border-first / ocean-first: flip the direction of the search.",
      ],
      complexity: [
        { op: "Grid BFS/DFS", time: "O(R · C)", space: "O(R · C)" },
        { op: "Word ladder (BFS)", time: "O(N · L²)", note: "N words, length L" },
        { op: "State-space BFS", time: "O(states · branching)" },
      ],
      code: [
        {
          title: "Word ladder (BFS with wildcard buckets) & 01-matrix (multi-source)",
          variants: [
            {
              lang: "python",
              code: `
from collections import defaultdict, deque

def ladder_length(begin, end, words):
    if end not in words:
        return 0
    buckets = defaultdict(list)
    for w in words + [begin]:
        for i in range(len(w)):
            buckets[w[:i] + "*" + w[i + 1:]].append(w)
    seen, q = {begin}, deque([(begin, 1)])
    while q:
        w, d = q.popleft()
        if w == end:
            return d
        for i in range(len(w)):
            key = w[:i] + "*" + w[i + 1:]
            for nxt in buckets[key]:
                if nxt not in seen:
                    seen.add(nxt)
                    q.append((nxt, d + 1))
            buckets[key] = []          # never scan this bucket again
    return 0

def update_matrix(mat):                 # distance to nearest 0
    R, C = len(mat), len(mat[0])
    dist = [[-1] * C for _ in range(R)]
    q = deque()
    for r in range(R):
        for c in range(C):
            if mat[r][c] == 0:
                dist[r][c] = 0
                q.append((r, c))        # every 0 is a source
    while q:
        r, c = q.popleft()
        for nr, nc in ((r+1, c), (r-1, c), (r, c+1), (r, c-1)):
            if 0 <= nr < R and 0 <= nc < C and dist[nr][nc] == -1:
                dist[nr][nc] = dist[r][c] + 1
                q.append((nr, nc))
    return dist
`,
            },
            {
              lang: "java",
              code: `
int openLock(String[] deadends, String target) {
    Set<String> seen = new HashSet<>(Arrays.asList(deadends));
    if (seen.contains("0000")) return -1;
    Deque<String> q = new ArrayDeque<>(List.of("0000"));
    seen.add("0000");
    for (int steps = 0; !q.isEmpty(); steps++) {
        for (int size = q.size(); size > 0; size--) {
            String cur = q.poll();
            if (cur.equals(target)) return steps;
            char[] c = cur.toCharArray();
            for (int i = 0; i < 4; i++) {
                char orig = c[i];
                for (int d : new int[]{1, 9}) {               // +1 and -1 (mod 10)
                    c[i] = (char) ('0' + (orig - '0' + d) % 10);
                    String nxt = new String(c);
                    if (seen.add(nxt)) q.offer(nxt);
                }
                c[i] = orig;
            }
        }
    }
    return -1;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Surrounded Regions: how do you avoid checking every region for border contact?",
          a: "Flip the question. Any 'O' connected to the **border** can't be captured. DFS/BFS from every border 'O' and mark those cells safe. Then sweep the board: remaining 'O's are surrounded → flip to 'X'; safe marks go back to 'O'. O(R·C) with no per-region bookkeeping.",
          freq: "common",
        },
        {
          q: "When is bidirectional BFS worth it?",
          a: "When you know both start and target and the branching factor b is large. A one-sided BFS to depth d explores ~b^d states; two searches meeting in the middle explore ~2·b^(d/2). Expand the smaller frontier each round and stop when a newly generated state is in the other side's visited set. Word ladder with a large dictionary is the classic case.",
          freq: "occasional",
        },
        {
          q: "Longest Increasing Path in a Matrix — DFS or DP?",
          a: "Both: edges go from a cell to a strictly larger neighbour, so the graph is a **DAG** (no cycles). DFS with **memoization** of the longest path starting at each cell gives O(R·C). Equivalently, topologically sort by value (or Kahn's algorithm peeling cells with no smaller neighbours) and count layers.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "In Word Ladder, what are the graph's edges?",
          options: ["Words sharing a first letter", "Words differing by exactly one letter", "Alphabetical order", "Same length"],
          answer: 1,
          explain: "Each transformation changes one letter.",
        },
        {
          q: "Distance from every cell to its nearest 0 is best solved with…",
          options: ["DFS from each cell", "Multi-source BFS from all 0s", "Dijkstra from each 1", "Union-Find"],
          answer: 1,
          explain: "One BFS with every 0 as a source: O(R·C).",
        },
        {
          q: "Pacific Atlantic Water Flow is easiest by searching…",
          options: ["Downhill from every cell", "Uphill from each ocean's border, then intersect", "With binary search", "With a heap only"],
          answer: 1,
          explain: "Two BFS/DFS runs instead of one per cell.",
        },
        {
          q: "Open the Lock has how many possible states?",
          options: ["40", "4⁴", "10⁴", "10!"],
          answer: 2,
          explain: "Four wheels with ten digits each.",
        },
      ],
      problems: [
        { title: "Number of Islands", url: lc("number-of-islands"), difficulty: "Medium" },
        { title: "Surrounded Regions", url: lc("surrounded-regions"), difficulty: "Medium" },
        { title: "01 Matrix", url: lc("01-matrix"), difficulty: "Medium" },
        { title: "Walls and Gates", url: lc("walls-and-gates"), difficulty: "Medium" },
        { title: "Open the Lock", url: lc("open-the-lock"), difficulty: "Medium" },
        { title: "Pacific Atlantic Water Flow", url: lc("pacific-atlantic-water-flow"), difficulty: "Medium" },
        { title: "Evaluate Division", url: lc("evaluate-division"), difficulty: "Medium" },
        { title: "Word Ladder", url: lc("word-ladder"), difficulty: "Hard" },
        { title: "Sliding Puzzle", url: lc("sliding-puzzle"), difficulty: "Hard" },
        { title: "Longest Increasing Path in a Matrix", url: lc("longest-increasing-path-in-a-matrix"), difficulty: "Hard" },
      ],
    },
  ],
};
