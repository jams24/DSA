// LeetCode "Top Interview 150" study plan — generated from LeetCode's API (ids, titles and
// difficulties verified), with a hint per problem and a link to the lesson that teaches the pattern.

export type LcDifficulty = "Easy" | "Medium" | "Hard";

export interface LcProblem {
  id: number;
  slug: string;
  title: string;
  difficulty: LcDifficulty;
  hint: string;
}

export interface LcCategory {
  category: string;
  /** `${worldId}/${lessonId}` of the lesson that teaches this pattern */
  lesson: string;
  problems: LcProblem[];
}

export const LC150: LcCategory[] = [
  {
    "category": "Array / String",
    "lesson": "foundations/arrays",
    "problems": [
      {
        "id": 88,
        "slug": "merge-sorted-array",
        "title": "Merge Sorted Array",
        "difficulty": "Easy",
        "hint": "Fill from the back with three pointers so you never overwrite unread values."
      },
      {
        "id": 27,
        "slug": "remove-element",
        "title": "Remove Element",
        "difficulty": "Easy",
        "hint": "Read/write pointers: copy every value that isn't val to the write index."
      },
      {
        "id": 26,
        "slug": "remove-duplicates-from-sorted-array",
        "title": "Remove Duplicates from Sorted Array",
        "difficulty": "Easy",
        "hint": "Write pointer; keep a value only if it differs from the last kept one."
      },
      {
        "id": 80,
        "slug": "remove-duplicates-from-sorted-array-ii",
        "title": "Remove Duplicates from Sorted Array II",
        "difficulty": "Medium",
        "hint": "Keep nums[i] if it differs from the element two positions behind the write index."
      },
      {
        "id": 169,
        "slug": "majority-element",
        "title": "Majority Element",
        "difficulty": "Easy",
        "hint": "Boyer–Moore voting: a counter that increments for the candidate and decrements otherwise."
      },
      {
        "id": 189,
        "slug": "rotate-array",
        "title": "Rotate Array",
        "difficulty": "Medium",
        "hint": "Reverse the whole array, then reverse the first k and the rest (k %= n)."
      },
      {
        "id": 121,
        "slug": "best-time-to-buy-and-sell-stock",
        "title": "Best Time to Buy and Sell Stock",
        "difficulty": "Easy",
        "hint": "Track the minimum price so far and the best price − min."
      },
      {
        "id": 122,
        "slug": "best-time-to-buy-and-sell-stock-ii",
        "title": "Best Time to Buy and Sell Stock II",
        "difficulty": "Medium",
        "hint": "Sum every positive day-to-day difference."
      },
      {
        "id": 55,
        "slug": "jump-game",
        "title": "Jump Game",
        "difficulty": "Medium",
        "hint": "Greedy: keep the farthest reachable index; fail if i ever exceeds it."
      },
      {
        "id": 45,
        "slug": "jump-game-ii",
        "title": "Jump Game II",
        "difficulty": "Medium",
        "hint": "BFS by ranges: count how many times you must extend the current reach."
      },
      {
        "id": 274,
        "slug": "h-index",
        "title": "H-Index",
        "difficulty": "Medium",
        "hint": "Sort descending (or bucket counts); h = max i with citations[i] ≥ i + 1."
      },
      {
        "id": 380,
        "slug": "insert-delete-getrandom-o1",
        "title": "Insert Delete GetRandom O(1)",
        "difficulty": "Medium",
        "hint": "Array + hash map of value→index; delete by swapping with the last element."
      },
      {
        "id": 238,
        "slug": "product-of-array-except-self",
        "title": "Product of Array Except Self",
        "difficulty": "Medium",
        "hint": "Prefix products left-to-right, then multiply by suffix products right-to-left."
      },
      {
        "id": 134,
        "slug": "gas-station",
        "title": "Gas Station",
        "difficulty": "Medium",
        "hint": "If total gas ≥ total cost a start exists; reset the start whenever the tank goes negative."
      },
      {
        "id": 135,
        "slug": "candy",
        "title": "Candy",
        "difficulty": "Hard",
        "hint": "Two passes: left-to-right for rising slopes, right-to-left taking the max."
      },
      {
        "id": 42,
        "slug": "trapping-rain-water",
        "title": "Trapping Rain Water",
        "difficulty": "Hard",
        "hint": "Two pointers with leftMax/rightMax; move the side with the smaller max."
      },
      {
        "id": 13,
        "slug": "roman-to-integer",
        "title": "Roman to Integer",
        "difficulty": "Easy",
        "hint": "Add each value, but subtract when a smaller value precedes a larger one."
      },
      {
        "id": 12,
        "slug": "integer-to-roman",
        "title": "Integer to Roman",
        "difficulty": "Medium",
        "hint": "Greedy over the 13 value/symbol pairs from largest to smallest."
      },
      {
        "id": 58,
        "slug": "length-of-last-word",
        "title": "Length of Last Word",
        "difficulty": "Easy",
        "hint": "Scan from the end: skip trailing spaces, then count letters."
      },
      {
        "id": 14,
        "slug": "longest-common-prefix",
        "title": "Longest Common Prefix",
        "difficulty": "Easy",
        "hint": "Shrink the first string until every other string starts with it (or compare column by column)."
      },
      {
        "id": 151,
        "slug": "reverse-words-in-a-string",
        "title": "Reverse Words in a String",
        "difficulty": "Medium",
        "hint": "Split on whitespace, drop empties, reverse, join with single spaces."
      },
      {
        "id": 6,
        "slug": "zigzag-conversion",
        "title": "Zigzag Conversion",
        "difficulty": "Medium",
        "hint": "Append characters to rows while bouncing the row index between 0 and numRows−1."
      },
      {
        "id": 28,
        "slug": "find-the-index-of-the-first-occurrence-in-a-string",
        "title": "Find the Index of the First Occurrence in a String",
        "difficulty": "Easy",
        "hint": "Sliding comparison (or KMP for O(n + m))."
      },
      {
        "id": 68,
        "slug": "text-justification",
        "title": "Text Justification",
        "difficulty": "Hard",
        "hint": "Greedily pack words per line, then distribute spaces left-heavy; last line left-justified."
      }
    ]
  },
  {
    "category": "Two Pointers",
    "lesson": "patterns/two-pointers",
    "problems": [
      {
        "id": 125,
        "slug": "valid-palindrome",
        "title": "Valid Palindrome",
        "difficulty": "Easy",
        "hint": "Two pointers from both ends, skipping non-alphanumerics, comparing lowercase."
      },
      {
        "id": 392,
        "slug": "is-subsequence",
        "title": "Is Subsequence",
        "difficulty": "Easy",
        "hint": "One pointer per string; advance in s only on a match."
      },
      {
        "id": 167,
        "slug": "two-sum-ii-input-array-is-sorted",
        "title": "Two Sum II - Input Array Is Sorted",
        "difficulty": "Medium",
        "hint": "Opposite ends: move left if the sum is small, right if large."
      },
      {
        "id": 11,
        "slug": "container-with-most-water",
        "title": "Container With Most Water",
        "difficulty": "Medium",
        "hint": "Opposite ends; always move the shorter wall inward."
      },
      {
        "id": 15,
        "slug": "3sum",
        "title": "3Sum",
        "difficulty": "Medium",
        "hint": "Sort, fix one number, two-pointer the rest; skip duplicates."
      }
    ]
  },
  {
    "category": "Sliding Window",
    "lesson": "patterns/sliding-window",
    "problems": [
      {
        "id": 209,
        "slug": "minimum-size-subarray-sum",
        "title": "Minimum Size Subarray Sum",
        "difficulty": "Medium",
        "hint": "Expand right; while sum ≥ target, record length and shrink left."
      },
      {
        "id": 3,
        "slug": "longest-substring-without-repeating-characters",
        "title": "Longest Substring Without Repeating Characters",
        "difficulty": "Medium",
        "hint": "Map char→last index; jump left past the previous occurrence."
      },
      {
        "id": 30,
        "slug": "substring-with-concatenation-of-all-words",
        "title": "Substring with Concatenation of All Words",
        "difficulty": "Hard",
        "hint": "For each offset < wordLen, slide a window of words with a count map."
      },
      {
        "id": 76,
        "slug": "minimum-window-substring",
        "title": "Minimum Window Substring",
        "difficulty": "Hard",
        "hint": "Count needs; expand until satisfied, then shrink while still valid."
      }
    ]
  },
  {
    "category": "Matrix",
    "lesson": "foundations/arrays",
    "problems": [
      {
        "id": 36,
        "slug": "valid-sudoku",
        "title": "Valid Sudoku",
        "difficulty": "Medium",
        "hint": "Hash sets for each row, column and 3×3 box (box = r//3*3 + c//3)."
      },
      {
        "id": 54,
        "slug": "spiral-matrix",
        "title": "Spiral Matrix",
        "difficulty": "Medium",
        "hint": "Shrink top/bottom/left/right boundaries after each side."
      },
      {
        "id": 48,
        "slug": "rotate-image",
        "title": "Rotate Image",
        "difficulty": "Medium",
        "hint": "Transpose, then reverse each row."
      },
      {
        "id": 73,
        "slug": "set-matrix-zeroes",
        "title": "Set Matrix Zeroes",
        "difficulty": "Medium",
        "hint": "Use the first row/column as marker flags for O(1) extra space."
      },
      {
        "id": 289,
        "slug": "game-of-life",
        "title": "Game of Life",
        "difficulty": "Medium",
        "hint": "Encode old and new state in the same cell (e.g. 2 = was alive, now dead)."
      }
    ]
  },
  {
    "category": "Hashmap",
    "lesson": "foundations/hash-tables",
    "problems": [
      {
        "id": 383,
        "slug": "ransom-note",
        "title": "Ransom Note",
        "difficulty": "Easy",
        "hint": "Count letters of the magazine, decrement for the note; fail on negative."
      },
      {
        "id": 205,
        "slug": "isomorphic-strings",
        "title": "Isomorphic Strings",
        "difficulty": "Easy",
        "hint": "Two maps (s→t and t→s) must stay consistent."
      },
      {
        "id": 290,
        "slug": "word-pattern",
        "title": "Word Pattern",
        "difficulty": "Easy",
        "hint": "Bijection between pattern chars and words with two maps."
      },
      {
        "id": 242,
        "slug": "valid-anagram",
        "title": "Valid Anagram",
        "difficulty": "Easy",
        "hint": "Equal 26-letter count arrays (or sorted strings)."
      },
      {
        "id": 49,
        "slug": "group-anagrams",
        "title": "Group Anagrams",
        "difficulty": "Medium",
        "hint": "Group by a canonical key: sorted letters or a count tuple."
      },
      {
        "id": 1,
        "slug": "two-sum",
        "title": "Two Sum",
        "difficulty": "Easy",
        "hint": "Map value→index; look up target − x before inserting x."
      },
      {
        "id": 202,
        "slug": "happy-number",
        "title": "Happy Number",
        "difficulty": "Easy",
        "hint": "Detect the cycle of digit-square sums with a set or fast/slow pointers."
      },
      {
        "id": 219,
        "slug": "contains-duplicate-ii",
        "title": "Contains Duplicate II",
        "difficulty": "Easy",
        "hint": "Map value→last index (or a size-k sliding set)."
      },
      {
        "id": 128,
        "slug": "longest-consecutive-sequence",
        "title": "Longest Consecutive Sequence",
        "difficulty": "Medium",
        "hint": "Set of numbers; only start counting at x when x − 1 is absent."
      }
    ]
  },
  {
    "category": "Intervals",
    "lesson": "patterns/intervals",
    "problems": [
      {
        "id": 228,
        "slug": "summary-ranges",
        "title": "Summary Ranges",
        "difficulty": "Easy",
        "hint": "Extend a run while the next number is current + 1, then emit 'a->b' or 'a'."
      },
      {
        "id": 56,
        "slug": "merge-intervals",
        "title": "Merge Intervals",
        "difficulty": "Medium",
        "hint": "Sort by start; extend the last merged end with max()."
      },
      {
        "id": 57,
        "slug": "insert-interval",
        "title": "Insert Interval",
        "difficulty": "Medium",
        "hint": "Copy intervals before, merge the overlapping ones, copy the rest."
      },
      {
        "id": 452,
        "slug": "minimum-number-of-arrows-to-burst-balloons",
        "title": "Minimum Number of Arrows to Burst Balloons",
        "difficulty": "Medium",
        "hint": "Sort by end; shoot at the end, skip balloons that start before it."
      }
    ]
  },
  {
    "category": "Stack",
    "lesson": "foundations/stacks-queues",
    "problems": [
      {
        "id": 20,
        "slug": "valid-parentheses",
        "title": "Valid Parentheses",
        "difficulty": "Easy",
        "hint": "Push openers; each closer must match the stack top."
      },
      {
        "id": 71,
        "slug": "simplify-path",
        "title": "Simplify Path",
        "difficulty": "Medium",
        "hint": "Split on '/', push names, pop on '..', ignore '.' and empty parts."
      },
      {
        "id": 155,
        "slug": "min-stack",
        "title": "Min Stack",
        "difficulty": "Medium",
        "hint": "Store (value, current minimum) pairs."
      },
      {
        "id": 150,
        "slug": "evaluate-reverse-polish-notation",
        "title": "Evaluate Reverse Polish Notation",
        "difficulty": "Medium",
        "hint": "Push numbers; on an operator pop b then a, push a op b (truncate division)."
      },
      {
        "id": 224,
        "slug": "basic-calculator",
        "title": "Basic Calculator",
        "difficulty": "Hard",
        "hint": "Running result + sign; push (result, sign) on '(' and combine on ')'."
      }
    ]
  },
  {
    "category": "Linked List",
    "lesson": "foundations/linked-lists",
    "problems": [
      {
        "id": 141,
        "slug": "linked-list-cycle",
        "title": "Linked List Cycle",
        "difficulty": "Easy",
        "hint": "Floyd's fast/slow pointers."
      },
      {
        "id": 2,
        "slug": "add-two-numbers",
        "title": "Add Two Numbers",
        "difficulty": "Medium",
        "hint": "Add digit by digit with a carry, building a new list behind a dummy head."
      },
      {
        "id": 21,
        "slug": "merge-two-sorted-lists",
        "title": "Merge Two Sorted Lists",
        "difficulty": "Easy",
        "hint": "Dummy head; attach the smaller node each step."
      },
      {
        "id": 138,
        "slug": "copy-list-with-random-pointer",
        "title": "Copy List with Random Pointer",
        "difficulty": "Medium",
        "hint": "Map old→new nodes (or interleave copies, then split)."
      },
      {
        "id": 92,
        "slug": "reverse-linked-list-ii",
        "title": "Reverse Linked List II",
        "difficulty": "Medium",
        "hint": "Walk to the node before left, then head-insert the next right−left nodes."
      },
      {
        "id": 25,
        "slug": "reverse-nodes-in-k-group",
        "title": "Reverse Nodes in k-Group",
        "difficulty": "Hard",
        "hint": "Check k nodes exist, reverse them, reconnect, repeat."
      },
      {
        "id": 19,
        "slug": "remove-nth-node-from-end-of-list",
        "title": "Remove Nth Node From End of List",
        "difficulty": "Medium",
        "hint": "Dummy head; advance fast n+1 steps, then move both."
      },
      {
        "id": 82,
        "slug": "remove-duplicates-from-sorted-list-ii",
        "title": "Remove Duplicates from Sorted List II",
        "difficulty": "Medium",
        "hint": "Dummy head; skip whole runs of equal values."
      },
      {
        "id": 61,
        "slug": "rotate-list",
        "title": "Rotate List",
        "difficulty": "Medium",
        "hint": "Find length, close into a ring, break at length − k % length."
      },
      {
        "id": 86,
        "slug": "partition-list",
        "title": "Partition List",
        "difficulty": "Medium",
        "hint": "Build 'less' and 'greater-or-equal' lists, then join them."
      },
      {
        "id": 146,
        "slug": "lru-cache",
        "title": "LRU Cache",
        "difficulty": "Medium",
        "hint": "Hash map + doubly linked list ordered by recency."
      }
    ]
  },
  {
    "category": "Binary Tree General",
    "lesson": "trees-graphs/binary-trees",
    "problems": [
      {
        "id": 104,
        "slug": "maximum-depth-of-binary-tree",
        "title": "Maximum Depth of Binary Tree",
        "difficulty": "Easy",
        "hint": "1 + max(depth(left), depth(right))."
      },
      {
        "id": 100,
        "slug": "same-tree",
        "title": "Same Tree",
        "difficulty": "Easy",
        "hint": "Recursively compare values and both subtrees."
      },
      {
        "id": 226,
        "slug": "invert-binary-tree",
        "title": "Invert Binary Tree",
        "difficulty": "Easy",
        "hint": "Swap children at every node, recursively."
      },
      {
        "id": 101,
        "slug": "symmetric-tree",
        "title": "Symmetric Tree",
        "difficulty": "Easy",
        "hint": "Mirror check: left.left vs right.right and left.right vs right.left."
      },
      {
        "id": 105,
        "slug": "construct-binary-tree-from-preorder-and-inorder-traversal",
        "title": "Construct Binary Tree from Preorder and Inorder Traversal",
        "difficulty": "Medium",
        "hint": "Preorder gives the root; its inorder index splits left/right (hash map for O(1))."
      },
      {
        "id": 106,
        "slug": "construct-binary-tree-from-inorder-and-postorder-traversal",
        "title": "Construct Binary Tree from Inorder and Postorder Traversal",
        "difficulty": "Medium",
        "hint": "Postorder's last element is the root; build right subtree first."
      },
      {
        "id": 117,
        "slug": "populating-next-right-pointers-in-each-node-ii",
        "title": "Populating Next Right Pointers in Each Node II",
        "difficulty": "Medium",
        "hint": "Walk each level via next pointers while linking the level below with a dummy head."
      },
      {
        "id": 114,
        "slug": "flatten-binary-tree-to-linked-list",
        "title": "Flatten Binary Tree to Linked List",
        "difficulty": "Medium",
        "hint": "Reverse preorder (right, left, node) with a 'prev' pointer, or Morris-style rewiring."
      },
      {
        "id": 112,
        "slug": "path-sum",
        "title": "Path Sum",
        "difficulty": "Easy",
        "hint": "Subtract node values on the way down; check at leaves."
      },
      {
        "id": 129,
        "slug": "sum-root-to-leaf-numbers",
        "title": "Sum Root to Leaf Numbers",
        "difficulty": "Medium",
        "hint": "Pass num * 10 + val down; sum at leaves."
      },
      {
        "id": 124,
        "slug": "binary-tree-maximum-path-sum",
        "title": "Binary Tree Maximum Path Sum",
        "difficulty": "Hard",
        "hint": "Return best downward gain; update a global with left + node + right."
      },
      {
        "id": 173,
        "slug": "binary-search-tree-iterator",
        "title": "Binary Search Tree Iterator",
        "difficulty": "Medium",
        "hint": "Controlled inorder with a stack of left spines."
      },
      {
        "id": 222,
        "slug": "count-complete-tree-nodes",
        "title": "Count Complete Tree Nodes",
        "difficulty": "Medium",
        "hint": "Compare leftmost and rightmost heights; perfect subtree ⇒ 2^h − 1, else recurse."
      },
      {
        "id": 236,
        "slug": "lowest-common-ancestor-of-a-binary-tree",
        "title": "Lowest Common Ancestor of a Binary Tree",
        "difficulty": "Medium",
        "hint": "If both sides return non-null, the current node is the LCA."
      }
    ]
  },
  {
    "category": "Binary Tree BFS",
    "lesson": "trees-graphs/binary-trees",
    "problems": [
      {
        "id": 199,
        "slug": "binary-tree-right-side-view",
        "title": "Binary Tree Right Side View",
        "difficulty": "Medium",
        "hint": "Level order; take the last node of each level."
      },
      {
        "id": 637,
        "slug": "average-of-levels-in-binary-tree",
        "title": "Average of Levels in Binary Tree",
        "difficulty": "Easy",
        "hint": "Level order; average each level's values."
      },
      {
        "id": 102,
        "slug": "binary-tree-level-order-traversal",
        "title": "Binary Tree Level Order Traversal",
        "difficulty": "Medium",
        "hint": "Queue; process exactly len(queue) nodes per level."
      },
      {
        "id": 103,
        "slug": "binary-tree-zigzag-level-order-traversal",
        "title": "Binary Tree Zigzag Level Order Traversal",
        "difficulty": "Medium",
        "hint": "Level order; reverse every other level."
      }
    ]
  },
  {
    "category": "Binary Search Tree",
    "lesson": "trees-graphs/bst",
    "problems": [
      {
        "id": 530,
        "slug": "minimum-absolute-difference-in-bst",
        "title": "Minimum Absolute Difference in BST",
        "difficulty": "Easy",
        "hint": "Inorder traversal is sorted; compare neighbours."
      },
      {
        "id": 230,
        "slug": "kth-smallest-element-in-a-bst",
        "title": "Kth Smallest Element in a BST",
        "difficulty": "Medium",
        "hint": "Iterative inorder; stop at the k-th node."
      },
      {
        "id": 98,
        "slug": "validate-binary-search-tree",
        "title": "Validate Binary Search Tree",
        "difficulty": "Medium",
        "hint": "Pass (low, high) bounds down the recursion."
      }
    ]
  },
  {
    "category": "Graph General",
    "lesson": "trees-graphs/graphs-bfs-dfs",
    "problems": [
      {
        "id": 200,
        "slug": "number-of-islands",
        "title": "Number of Islands",
        "difficulty": "Medium",
        "hint": "DFS/BFS flood fill from every unvisited land cell."
      },
      {
        "id": 130,
        "slug": "surrounded-regions",
        "title": "Surrounded Regions",
        "difficulty": "Medium",
        "hint": "Mark 'O's connected to the border first; flip the rest."
      },
      {
        "id": 133,
        "slug": "clone-graph",
        "title": "Clone Graph",
        "difficulty": "Medium",
        "hint": "DFS/BFS with a map original→clone."
      },
      {
        "id": 399,
        "slug": "evaluate-division",
        "title": "Evaluate Division",
        "difficulty": "Medium",
        "hint": "Weighted graph a→b = value, b→a = 1/value; DFS/BFS multiplying weights (or weighted union-find)."
      },
      {
        "id": 207,
        "slug": "course-schedule",
        "title": "Course Schedule",
        "difficulty": "Medium",
        "hint": "Detect a cycle: Kahn's algorithm or 3-colour DFS."
      },
      {
        "id": 210,
        "slug": "course-schedule-ii",
        "title": "Course Schedule II",
        "difficulty": "Medium",
        "hint": "Kahn's algorithm; return the order if all nodes are processed."
      }
    ]
  },
  {
    "category": "Graph BFS",
    "lesson": "patterns/graph-patterns",
    "problems": [
      {
        "id": 909,
        "slug": "snakes-and-ladders",
        "title": "Snakes and Ladders",
        "difficulty": "Medium",
        "hint": "BFS over squares 1..n², mapping square numbers to boustrophedon coordinates."
      },
      {
        "id": 433,
        "slug": "minimum-genetic-mutation",
        "title": "Minimum Genetic Mutation",
        "difficulty": "Medium",
        "hint": "BFS over gene strings, changing one character at a time within the bank."
      },
      {
        "id": 127,
        "slug": "word-ladder",
        "title": "Word Ladder",
        "difficulty": "Hard",
        "hint": "BFS over words with wildcard buckets (h*t); bidirectional BFS for speed."
      }
    ]
  },
  {
    "category": "Trie",
    "lesson": "trees-graphs/tries",
    "problems": [
      {
        "id": 208,
        "slug": "implement-trie-prefix-tree",
        "title": "Implement Trie (Prefix Tree)",
        "difficulty": "Medium",
        "hint": "Children map/array per node plus an end-of-word flag."
      },
      {
        "id": 211,
        "slug": "design-add-and-search-words-data-structure",
        "title": "Design Add and Search Words Data Structure",
        "difficulty": "Medium",
        "hint": "Trie; on '.', DFS into every child."
      },
      {
        "id": 212,
        "slug": "word-search-ii",
        "title": "Word Search II",
        "difficulty": "Hard",
        "hint": "Trie of words + one DFS over the board, pruning when the path leaves the trie."
      }
    ]
  },
  {
    "category": "Backtracking",
    "lesson": "algorithms/backtracking",
    "problems": [
      {
        "id": 17,
        "slug": "letter-combinations-of-a-phone-number",
        "title": "Letter Combinations of a Phone Number",
        "difficulty": "Medium",
        "hint": "Backtrack over digits, choosing one letter per digit."
      },
      {
        "id": 77,
        "slug": "combinations",
        "title": "Combinations",
        "difficulty": "Medium",
        "hint": "Choose from start..n, recurse with i + 1; prune when not enough numbers remain."
      },
      {
        "id": 46,
        "slug": "permutations",
        "title": "Permutations",
        "difficulty": "Medium",
        "hint": "used[] array; choose any unused number at each depth."
      },
      {
        "id": 39,
        "slug": "combination-sum",
        "title": "Combination Sum",
        "difficulty": "Medium",
        "hint": "Sorted candidates; recurse with the same index to allow reuse; break when too big."
      },
      {
        "id": 52,
        "slug": "n-queens-ii",
        "title": "N-Queens II",
        "difficulty": "Hard",
        "hint": "Row by row with sets for columns and both diagonals; count completions."
      },
      {
        "id": 22,
        "slug": "generate-parentheses",
        "title": "Generate Parentheses",
        "difficulty": "Medium",
        "hint": "Add '(' while open < n, ')' while close < open."
      },
      {
        "id": 79,
        "slug": "word-search",
        "title": "Word Search",
        "difficulty": "Medium",
        "hint": "DFS from each cell, marking visited in place and restoring on backtrack."
      }
    ]
  },
  {
    "category": "Divide & Conquer",
    "lesson": "algorithms/sorting",
    "problems": [
      {
        "id": 108,
        "slug": "convert-sorted-array-to-binary-search-tree",
        "title": "Convert Sorted Array to Binary Search Tree",
        "difficulty": "Easy",
        "hint": "Middle element as root; recurse on halves."
      },
      {
        "id": 148,
        "slug": "sort-list",
        "title": "Sort List",
        "difficulty": "Medium",
        "hint": "Merge sort: split with fast/slow pointers, merge sorted halves."
      },
      {
        "id": 427,
        "slug": "construct-quad-tree",
        "title": "Construct Quad Tree",
        "difficulty": "Medium",
        "hint": "If a region is uniform make a leaf, else split into four quadrants."
      },
      {
        "id": 23,
        "slug": "merge-k-sorted-lists",
        "title": "Merge k Sorted Lists",
        "difficulty": "Hard",
        "hint": "Min-heap of list heads (or pairwise merging): O(N log k)."
      }
    ]
  },
  {
    "category": "Kadane's Algorithm",
    "lesson": "algorithms/dynamic-programming",
    "problems": [
      {
        "id": 53,
        "slug": "maximum-subarray",
        "title": "Maximum Subarray",
        "difficulty": "Medium",
        "hint": "Kadane: cur = max(x, cur + x); best = max(best, cur)."
      },
      {
        "id": 918,
        "slug": "maximum-sum-circular-subarray",
        "title": "Maximum Sum Circular Subarray",
        "difficulty": "Medium",
        "hint": "max(normal Kadane, total − minimum subarray), unless all numbers are negative."
      }
    ]
  },
  {
    "category": "Binary Search",
    "lesson": "algorithms/binary-search",
    "problems": [
      {
        "id": 35,
        "slug": "search-insert-position",
        "title": "Search Insert Position",
        "difficulty": "Easy",
        "hint": "Lower bound: first index with nums[i] ≥ target."
      },
      {
        "id": 74,
        "slug": "search-a-2d-matrix",
        "title": "Search a 2D Matrix",
        "difficulty": "Medium",
        "hint": "Treat the matrix as one sorted array of m·n elements."
      },
      {
        "id": 162,
        "slug": "find-peak-element",
        "title": "Find Peak Element",
        "difficulty": "Medium",
        "hint": "Move toward the larger neighbour: if nums[mid] < nums[mid+1] go right."
      },
      {
        "id": 33,
        "slug": "search-in-rotated-sorted-array",
        "title": "Search in Rotated Sorted Array",
        "difficulty": "Medium",
        "hint": "One half around mid is sorted; check whether target lies in it."
      },
      {
        "id": 34,
        "slug": "find-first-and-last-position-of-element-in-sorted-array",
        "title": "Find First and Last Position of Element in Sorted Array",
        "difficulty": "Medium",
        "hint": "lower_bound(target) and lower_bound(target + 1) − 1."
      },
      {
        "id": 153,
        "slug": "find-minimum-in-rotated-sorted-array",
        "title": "Find Minimum in Rotated Sorted Array",
        "difficulty": "Medium",
        "hint": "Compare nums[mid] with nums[hi]: go right if larger, else hi = mid."
      },
      {
        "id": 4,
        "slug": "median-of-two-sorted-arrays",
        "title": "Median of Two Sorted Arrays",
        "difficulty": "Hard",
        "hint": "Binary search the partition of the smaller array so both left halves hold half the elements."
      }
    ]
  },
  {
    "category": "Heap",
    "lesson": "trees-graphs/heaps",
    "problems": [
      {
        "id": 215,
        "slug": "kth-largest-element-in-an-array",
        "title": "Kth Largest Element in an Array",
        "difficulty": "Medium",
        "hint": "Min-heap of size k (or quickselect, O(n) average)."
      },
      {
        "id": 502,
        "slug": "ipo",
        "title": "IPO",
        "difficulty": "Hard",
        "hint": "Sort projects by capital; push affordable ones into a max-heap of profit; take the best k times."
      },
      {
        "id": 373,
        "slug": "find-k-pairs-with-smallest-sums",
        "title": "Find K Pairs with Smallest Sums",
        "difficulty": "Medium",
        "hint": "Min-heap seeded with (nums1[i], nums2[0]); push the next j after each pop."
      },
      {
        "id": 295,
        "slug": "find-median-from-data-stream",
        "title": "Find Median from Data Stream",
        "difficulty": "Hard",
        "hint": "Max-heap for the lower half, min-heap for the upper half, kept balanced."
      }
    ]
  },
  {
    "category": "Bit Manipulation",
    "lesson": "algorithms/bit-manipulation",
    "problems": [
      {
        "id": 67,
        "slug": "add-binary",
        "title": "Add Binary",
        "difficulty": "Easy",
        "hint": "Add from the right with a carry."
      },
      {
        "id": 190,
        "slug": "reverse-bits",
        "title": "Reverse Bits",
        "difficulty": "Easy",
        "hint": "Shift result left, OR in the lowest bit of n, shift n right — 32 times."
      },
      {
        "id": 191,
        "slug": "number-of-1-bits",
        "title": "Number of 1 Bits",
        "difficulty": "Easy",
        "hint": "n &= n − 1 removes the lowest set bit; count iterations."
      },
      {
        "id": 136,
        "slug": "single-number",
        "title": "Single Number",
        "difficulty": "Easy",
        "hint": "XOR all numbers; pairs cancel."
      },
      {
        "id": 137,
        "slug": "single-number-ii",
        "title": "Single Number II",
        "difficulty": "Medium",
        "hint": "Count each bit position mod 3 (or the ones/twos state machine)."
      },
      {
        "id": 201,
        "slug": "bitwise-and-of-numbers-range",
        "title": "Bitwise AND of Numbers Range",
        "difficulty": "Medium",
        "hint": "Shift both ends right until equal; the common prefix is the answer."
      }
    ]
  },
  {
    "category": "Math",
    "lesson": "foundations/big-o",
    "problems": [
      {
        "id": 9,
        "slug": "palindrome-number",
        "title": "Palindrome Number",
        "difficulty": "Easy",
        "hint": "Reverse half of the number and compare (negatives are never palindromes)."
      },
      {
        "id": 66,
        "slug": "plus-one",
        "title": "Plus One",
        "difficulty": "Easy",
        "hint": "Add from the end; carry through 9s; prepend 1 if needed."
      },
      {
        "id": 172,
        "slug": "factorial-trailing-zeroes",
        "title": "Factorial Trailing Zeroes",
        "difficulty": "Medium",
        "hint": "Count factors of 5: n/5 + n/25 + n/125 + …"
      },
      {
        "id": 69,
        "slug": "sqrtx",
        "title": "Sqrt(x)",
        "difficulty": "Easy",
        "hint": "Binary search the largest m with m·m ≤ x."
      },
      {
        "id": 50,
        "slug": "powx-n",
        "title": "Pow(x, n)",
        "difficulty": "Medium",
        "hint": "Fast exponentiation by squaring; handle negative n."
      },
      {
        "id": 149,
        "slug": "max-points-on-a-line",
        "title": "Max Points on a Line",
        "difficulty": "Hard",
        "hint": "For each point, count slopes to others as reduced (dy, dx) fractions in a map."
      }
    ]
  },
  {
    "category": "1D DP",
    "lesson": "algorithms/dynamic-programming",
    "problems": [
      {
        "id": 70,
        "slug": "climbing-stairs",
        "title": "Climbing Stairs",
        "difficulty": "Easy",
        "hint": "dp[i] = dp[i−1] + dp[i−2] (Fibonacci)."
      },
      {
        "id": 198,
        "slug": "house-robber",
        "title": "House Robber",
        "difficulty": "Medium",
        "hint": "dp[i] = max(dp[i−1], dp[i−2] + nums[i])."
      },
      {
        "id": 139,
        "slug": "word-break",
        "title": "Word Break",
        "difficulty": "Medium",
        "hint": "dp[i] true if some dp[j] is true and s[j:i] is a word."
      },
      {
        "id": 322,
        "slug": "coin-change",
        "title": "Coin Change",
        "difficulty": "Medium",
        "hint": "dp[a] = 1 + min(dp[a − c]) over coins."
      },
      {
        "id": 300,
        "slug": "longest-increasing-subsequence",
        "title": "Longest Increasing Subsequence",
        "difficulty": "Medium",
        "hint": "Patience sorting: tails array + binary search, O(n log n)."
      }
    ]
  },
  {
    "category": "Multidimensional DP",
    "lesson": "patterns/dp-patterns",
    "problems": [
      {
        "id": 120,
        "slug": "triangle",
        "title": "Triangle",
        "difficulty": "Medium",
        "hint": "Bottom-up: each cell += min of the two cells below."
      },
      {
        "id": 64,
        "slug": "minimum-path-sum",
        "title": "Minimum Path Sum",
        "difficulty": "Medium",
        "hint": "dp[r][c] = grid[r][c] + min(top, left)."
      },
      {
        "id": 63,
        "slug": "unique-paths-ii",
        "title": "Unique Paths II",
        "difficulty": "Medium",
        "hint": "Grid DP from top and left; obstacles are 0."
      },
      {
        "id": 5,
        "slug": "longest-palindromic-substring",
        "title": "Longest Palindromic Substring",
        "difficulty": "Medium",
        "hint": "Expand around each of the 2n−1 centers."
      },
      {
        "id": 97,
        "slug": "interleaving-string",
        "title": "Interleaving String",
        "difficulty": "Medium",
        "hint": "dp[i][j]: can s1[:i] and s2[:j] form s3[:i+j]?"
      },
      {
        "id": 72,
        "slug": "edit-distance",
        "title": "Edit Distance",
        "difficulty": "Medium",
        "hint": "dp[i][j] = diagonal if chars match, else 1 + min(insert, delete, replace)."
      },
      {
        "id": 123,
        "slug": "best-time-to-buy-and-sell-stock-iii",
        "title": "Best Time to Buy and Sell Stock III",
        "difficulty": "Hard",
        "hint": "Four running states: buy1, sell1, buy2, sell2."
      },
      {
        "id": 188,
        "slug": "best-time-to-buy-and-sell-stock-iv",
        "title": "Best Time to Buy and Sell Stock IV",
        "difficulty": "Hard",
        "hint": "Generalize to k transactions: buy[j], sell[j] arrays."
      },
      {
        "id": 221,
        "slug": "maximal-square",
        "title": "Maximal Square",
        "difficulty": "Medium",
        "hint": "dp[r][c] = 1 + min(top, left, top-left) for '1' cells."
      }
    ]
  }
];

export const LC150_SLUGS = new Set(LC150.flatMap((c) => c.problems.map((p) => p.slug)));

export const lcUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;
