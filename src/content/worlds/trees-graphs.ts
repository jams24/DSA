import type { World } from "../types";

const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export const treesGraphs: World = {
  id: "trees-graphs",
  order: 2,
  title: "Graph Grove",
  subtitle: "Trees, heaps, tries, BFS/DFS, shortest paths & union-find",
  description:
    "Hierarchies and networks are everywhere: file systems, org charts, maps, social graphs, build systems. Learn to walk them, search them and connect them efficiently.",
  emoji: "🌳",
  color: "#059669",
  boss: {
    name: "The Hydra of Edges",
    title: "Guardian of the Cyclic Graph",
    emoji: "🐉",
    taunt: "Cut one edge and two more grow back. You'll never find the shortest path out of my lair!",
    defeat: "My heads... topologically sorted... defeated!",
  },
  lessons: [
    // ------------------------------------------------------------------ BINARY TREES
    {
      id: "binary-trees",
      title: "Binary Trees & Traversals",
      tagline: "Recursion's natural habitat: pre, in, post and level order.",
      difficulty: "beginner",
      minutes: 15,
      visualizers: ["traversal"],
      concept: `
## Vocabulary
A **binary tree** is a set of nodes where each node has at most two children, \`left\` and \`right\`. The top node is the **root**; nodes without children are **leaves**.

- **Depth** of a node = edges from the root. **Height** of a tree = longest root-to-leaf path.
- **Full**: every node has 0 or 2 children. **Complete**: every level full except possibly the last, filled left to right (heaps!). **Perfect**: all leaves on the same level — 2ʰ⁺¹ − 1 nodes. **Balanced**: subtree heights differ by at most 1 everywhere → height O(log n).

## Four traversals you must know cold
| Order | Visit sequence | Typical use |
|---|---|---|
| Preorder | node → left → right | copy / serialize a tree |
| Inorder | left → node → right | **sorted order of a BST** |
| Postorder | left → right → node | delete a tree, compute sizes/heights bottom-up |
| Level order (BFS) | level by level with a queue | shortest depth, right-side view, zigzag |

All are **O(n) time**. DFS traversals use **O(h)** space for the recursion stack (O(log n) balanced, O(n) skewed); BFS uses **O(w)** for the queue, where w is the maximum width (up to n/2).

## The recursive template
Almost every tree problem is: *"what do I need from my left and right subtrees, and how do I combine it?"*

\`\`\`
def solve(node):
    if node is None:
        return BASE            # e.g. 0, True, None
    left = solve(node.left)
    right = solve(node.right)
    return COMBINE(node, left, right)
\`\`\`

- Max depth: \`1 + max(left, right)\`
- Is balanced: return height, or −1 to signal "unbalanced"
- Diameter: at each node, \`left + right\` is a candidate; return \`1 + max(left, right)\` upward
- Lowest common ancestor: if both sides return non-null, this node is the LCA

> **Global answer vs return value.** Problems like diameter or max path sum track a *global* best while returning a different value (the best single downward path) to the parent. Spotting this split is the key insight.

## Level-order template
\`\`\`
queue = [root]
while queue:
    for _ in range(len(queue)):     # exactly one level
        node = queue.popleft()
        ...                          # process
        enqueue node.left / node.right if present
\`\`\`
Snapshotting \`len(queue)\` at the start of each iteration is how you know where a level ends.

## Iterative DFS
Interviewers sometimes ask for traversal without recursion. Preorder: push root; pop, visit, push right then left. Inorder: walk left pushing nodes; pop, visit, then go right. Knowing this also avoids stack overflow on deep trees.
`,
      keyPoints: [
        "Pre/in/post = where the node is visited relative to its children.",
        "Inorder of a BST is sorted.",
        "DFS space O(h); BFS space O(width).",
        "Template: get answers from children, combine, return.",
        "Some problems track a global best separate from the return value (diameter, max path sum).",
      ],
      complexity: [
        { op: "Any traversal", time: "O(n)", space: "O(h) DFS / O(w) BFS" },
        { op: "Height / size", time: "O(n)", space: "O(h)" },
        { op: "Search (unordered tree)", time: "O(n)" },
      ],
      code: [
        {
          title: "All four traversals",
          variants: [
            {
              lang: "python",
              code: `
from collections import deque

def preorder(node, out):
    if node:
        out.append(node.val)
        preorder(node.left, out)
        preorder(node.right, out)

def inorder(node, out):
    if node:
        inorder(node.left, out)
        out.append(node.val)
        inorder(node.right, out)

def inorder_iterative(root):
    out, stack, cur = [], [], root
    while cur or stack:
        while cur:                 # go as far left as possible
            stack.append(cur)
            cur = cur.left
        cur = stack.pop()
        out.append(cur.val)
        cur = cur.right
    return out

def level_order(root):
    if not root:
        return []
    levels, q = [], deque([root])
    while q:
        level = []
        for _ in range(len(q)):
            node = q.popleft()
            level.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        levels.append(level)
    return levels
`,
            },
            {
              lang: "javascript",
              code: `
function inorder(node, out = []) {
  if (!node) return out;
  inorder(node.left, out);
  out.push(node.val);
  inorder(node.right, out);
  return out;
}

function levelOrder(root) {
  const levels = [];
  let q = root ? [root] : [];
  while (q.length) {
    levels.push(q.map((n) => n.val));
    q = q.flatMap((n) => [n.left, n.right].filter(Boolean));
  }
  return levels;
}
`,
            },
            {
              lang: "java",
              code: `
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> levels = new ArrayList<>();
    if (root == null) return levels;
    Deque<TreeNode> q = new ArrayDeque<>();
    q.offer(root);
    while (!q.isEmpty()) {
        List<Integer> level = new ArrayList<>();
        for (int i = q.size(); i > 0; i--) {
            TreeNode n = q.poll();
            level.add(n.val);
            if (n.left != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
        levels.add(level);
    }
    return levels;
}
`,
            },
          ],
        },
        {
          title: "Diameter — global best vs return value",
          variants: [
            {
              lang: "python",
              code: `
def diameter(root):
    best = 0
    def height(node):
        nonlocal best
        if not node:
            return 0
        l, r = height(node.left), height(node.right)
        best = max(best, l + r)        # path through this node
        return 1 + max(l, r)           # best single branch for the parent
    height(root)
    return best
`,
            },
            {
              lang: "javascript",
              code: `
function diameter(root) {
  let best = 0;
  const height = (node) => {
    if (!node) return 0;
    const l = height(node.left), r = height(node.right);
    best = Math.max(best, l + r);
    return 1 + Math.max(l, r);
  };
  height(root);
  return best;
}
`,
            },
            {
              lang: "java",
              code: `
int best = 0;
int diameterOfBinaryTree(TreeNode root) { height(root); return best; }
int height(TreeNode n) {
    if (n == null) return 0;
    int l = height(n.left), r = height(n.right);
    best = Math.max(best, l + r);
    return 1 + Math.max(l, r);
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Find the lowest common ancestor of two nodes in a binary tree.",
          a: "Recurse: if the node is null or equals p or q, return it. Recurse left and right. If **both** sides return non-null, p and q are in different subtrees, so the current node is the LCA. Otherwise return whichever side is non-null. O(n) time, O(h) space. (For a **BST**, use ordering instead: walk down from the root; if both values are smaller go left, both larger go right, else you're at the LCA — O(h).)",
          freq: "very-common",
        },
        {
          q: "How do you serialize and deserialize a binary tree?",
          a: "Preorder with null markers: `1,2,#,#,3,4,#,#,5,#,#`. Deserialize by reading tokens with a pointer: a `#` returns null, otherwise create the node and recursively build left then right. Level-order with nulls (LeetCode's format) also works. Both are O(n). Inorder alone is ambiguous — you'd need two traversals (e.g. preorder + inorder with unique values).",
          freq: "very-common",
        },
        {
          q: "BFS or DFS: which would you use to find the minimum depth of a tree?",
          a: "**BFS** — it explores level by level and can stop at the first leaf it meets, which may be far earlier than visiting the whole tree. DFS must explore everything (or carefully prune). The same reasoning applies to shortest paths in unweighted graphs.",
          freq: "common",
        },
        {
          q: "Check whether a binary tree is height-balanced in O(n).",
          a: "A naive solution calls `height()` at every node → O(n²) on skewed trees. Instead compute height bottom-up and return a sentinel (−1) as soon as any subtree is unbalanced: `l = h(left); r = h(right); if l < 0 or r < 0 or abs(l - r) > 1: return -1; return 1 + max(l, r)`. Each node is visited once: O(n).",
          freq: "common",
        },
        {
          q: "What is the maximum path sum in a binary tree?",
          a: "At each node compute `gain(node) = node.val + max(0, gain(left), gain(right))` — the best downward path (negative branches are dropped). Update a global answer with `node.val + max(0, gain(left)) + max(0, gain(right))`, which is the best path *bending* through the node. Return `gain` to the parent. O(n).",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which traversal of a BST produces values in sorted order?",
          options: ["Preorder", "Inorder", "Postorder", "Level order"],
          answer: 1,
          explain: "Left subtree (smaller) → node → right subtree (larger).",
        },
        {
          q: "Space complexity of recursive DFS on a balanced binary tree of n nodes?",
          options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
          answer: 1,
          explain: "The stack holds one root-to-leaf path: height = O(log n) when balanced.",
        },
        {
          q: "To delete all nodes of a tree safely (children before parent), use…",
          options: ["Preorder", "Inorder", "Postorder", "Level order"],
          answer: 2,
          explain: "Postorder finishes both children before visiting (freeing) the parent.",
        },
        {
          q: "In level-order traversal, how do you know where one level ends?",
          options: [
            "Track depth in a hash map",
            "Record the queue's length at the start of each level and process exactly that many",
            "Use a stack instead",
            "You can't",
          ],
          answer: 1,
          explain: "The queue holds exactly one full level at the start of each iteration.",
        },
        {
          q: "A perfect binary tree of height 3 (root at height 0) has how many nodes?",
          options: ["7", "8", "15", "16"],
          answer: 2,
          explain: "2^(h+1) − 1 = 2⁴ − 1 = 15.",
        },
      ],
      problems: [
        { title: "Maximum Depth of Binary Tree", url: lc("maximum-depth-of-binary-tree"), difficulty: "Easy" },
        { title: "Invert Binary Tree", url: lc("invert-binary-tree"), difficulty: "Easy" },
        { title: "Same Tree", url: lc("same-tree"), difficulty: "Easy" },
        { title: "Diameter of Binary Tree", url: lc("diameter-of-binary-tree"), difficulty: "Easy" },
        { title: "Binary Tree Level Order Traversal", url: lc("binary-tree-level-order-traversal"), difficulty: "Medium" },
        { title: "Binary Tree Right Side View", url: lc("binary-tree-right-side-view"), difficulty: "Medium" },
        { title: "Lowest Common Ancestor of a Binary Tree", url: lc("lowest-common-ancestor-of-a-binary-tree"), difficulty: "Medium" },
        { title: "Construct Binary Tree from Preorder and Inorder Traversal", url: lc("construct-binary-tree-from-preorder-and-inorder-traversal"), difficulty: "Medium" },
        { title: "Binary Tree Maximum Path Sum", url: lc("binary-tree-maximum-path-sum"), difficulty: "Hard" },
        { title: "Serialize and Deserialize Binary Tree", url: lc("serialize-and-deserialize-binary-tree"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ BST
    {
      id: "bst",
      title: "Binary Search Trees",
      tagline: "Ordered data with O(log n) operations — if you keep it balanced.",
      difficulty: "intermediate",
      minutes: 14,
      visualizers: ["bst"],
      concept: `
## The invariant
For **every** node: all values in the left subtree are smaller, all values in the right subtree are larger. (Not just the immediate children — a common bug when validating.)

That ordering lets each comparison discard a whole subtree, exactly like binary search: **search, insert and delete are O(h)**.

## Height is everything
- Balanced: h ≈ log₂ n → **O(log n)**. A million keys need ~20 comparisons.
- Inserting sorted data into a plain BST builds a **linked list**: h = n → **O(n)**. Try "sorted inserts" in the visualizer.

**Self-balancing trees** fix this with rotations after inserts/deletes:
- **AVL trees** — strict balance (heights differ ≤ 1), faster lookups.
- **Red-black trees** — looser balance, fewer rotations on writes; used by Java's \`TreeMap\`, C++'s \`std::map\`, the Linux scheduler.
- **B-trees / B+ trees** — many keys per node to minimize disk reads; used by virtually every database index (see the Distributed world's storage lesson).

You won't be asked to code a red-black tree, but you should know *why* they exist and what they guarantee.

## Delete: the three cases
1. **Leaf** — remove it.
2. **One child** — splice the child into the node's place.
3. **Two children** — replace the value with its **inorder successor** (leftmost node of the right subtree) or predecessor, then delete that node (which has at most one child).

## BST superpowers
Because it's ordered, a BST answers questions a hash map can't:
- **floor / ceiling** — largest key ≤ x, smallest key ≥ x
- **range queries** — all keys in [lo, hi] in O(log n + k)
- **k-th smallest** — inorder traversal, or augment nodes with subtree sizes for O(log n)
- **predecessor / successor**

Python has no built-in balanced BST; use \`sortedcontainers.SortedList\` or \`bisect\` on a list. Java has \`TreeMap\`/\`TreeSet\`; C++ has \`std::map\`/\`std::set\`.

## Validating a BST
Pass down an allowed **range** \`(lo, hi)\`: the root may be anything; a left child must be in \`(lo, node.val)\`, a right child in \`(node.val, hi)\`. Or check that the inorder traversal is strictly increasing.
`,
      keyPoints: [
        "Left subtree < node < right subtree — for the whole subtree, not just children.",
        "Operations cost O(height): log n balanced, n degenerate.",
        "Self-balancing trees (AVL, red-black) guarantee O(log n).",
        "Delete with two children → swap with inorder successor.",
        "Ordered queries (floor, ceiling, range, k-th) are why you pick a BST over a hash map.",
      ],
      complexity: [
        { op: "Search / insert / delete (balanced)", time: "O(log n)" },
        { op: "Search / insert / delete (degenerate)", time: "O(n)" },
        { op: "Inorder traversal", time: "O(n)" },
        { op: "Range query [lo, hi]", time: "O(log n + k)" },
      ],
      code: [
        {
          title: "Search, insert and validate",
          variants: [
            {
              lang: "python",
              code: `
def search(node, target):
    while node and node.val != target:
        node = node.left if target < node.val else node.right
    return node

def insert(node, val):
    if not node:
        return TreeNode(val)
    if val < node.val:
        node.left = insert(node.left, val)
    elif val > node.val:
        node.right = insert(node.right, val)
    return node

def is_valid_bst(node, lo=float("-inf"), hi=float("inf")):
    if not node:
        return True
    if not lo < node.val < hi:
        return False
    return is_valid_bst(node.left, lo, node.val) and is_valid_bst(node.right, node.val, hi)
`,
            },
            {
              lang: "javascript",
              code: `
function search(node, target) {
  while (node && node.val !== target) node = target < node.val ? node.left : node.right;
  return node;
}

function isValidBST(node, lo = -Infinity, hi = Infinity) {
  if (!node) return true;
  if (node.val <= lo || node.val >= hi) return false;
  return isValidBST(node.left, lo, node.val) && isValidBST(node.right, node.val, hi);
}
`,
            },
            {
              lang: "java",
              code: `
boolean isValidBST(TreeNode n, long lo, long hi) {
    if (n == null) return true;
    if (n.val <= lo || n.val >= hi) return false;
    return isValidBST(n.left, lo, n.val) && isValidBST(n.right, n.val, hi);
}
// call with isValidBST(root, Long.MIN_VALUE, Long.MAX_VALUE)
`,
            },
          ],
        },
        {
          title: "Delete a node",
          variants: [
            {
              lang: "python",
              code: `
def delete(node, key):
    if not node:
        return None
    if key < node.val:
        node.left = delete(node.left, key)
    elif key > node.val:
        node.right = delete(node.right, key)
    else:
        if not node.left:
            return node.right            # 0 or 1 child
        if not node.right:
            return node.left
        succ = node.right                # 2 children: inorder successor
        while succ.left:
            succ = succ.left
        node.val = succ.val
        node.right = delete(node.right, succ.val)
    return node
`,
            },
            {
              lang: "java",
              code: `
TreeNode delete(TreeNode node, int key) {
    if (node == null) return null;
    if (key < node.val) node.left = delete(node.left, key);
    else if (key > node.val) node.right = delete(node.right, key);
    else {
        if (node.left == null) return node.right;
        if (node.right == null) return node.left;
        TreeNode s = node.right;
        while (s.left != null) s = s.left;
        node.val = s.val;
        node.right = delete(node.right, s.val);
    }
    return node;
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why is checking `node.left.val < node.val < node.right.val` at every node not enough to validate a BST?",
          a: "It only checks parent–child pairs. In `5 → left 3 → right 7`, every pair looks fine but 7 sits in 5's **left** subtree, violating the invariant. You must propagate bounds: everything under 5's left must be < 5. Pass `(lo, hi)` down the recursion, or verify the inorder sequence is strictly increasing.",
          freq: "very-common",
        },
        {
          q: "Find the k-th smallest element in a BST. What if the tree is modified often?",
          a: "Inorder traversal stops at the k-th visited node: O(h + k) with an iterative stack. If inserts/deletes are frequent and k-th queries are repeated, **augment** each node with the size of its subtree; then at each node compare k with `size(left) + 1` and descend left or right — O(h) per query, with sizes maintained during updates.",
          freq: "common",
        },
        {
          q: "Hash map or balanced BST for a leaderboard?",
          a: "If you need ranking / top-k / \"players between scores X and Y\", use an **ordered** structure (balanced BST, skip list — Redis sorted sets use skip lists). A hash map gives O(1) lookup by player but no order; you'd have to sort on each query. Common design: hash map for player → score plus an ordered set of (score, player).",
          freq: "common",
        },
        {
          q: "What's the difference between AVL and red-black trees?",
          a: "Both guarantee O(log n). **AVL** keeps heights within 1, so it's more strictly balanced → slightly faster lookups but more rotations on insert/delete. **Red-black** trees allow up to 2× height difference via coloring rules → fewer rotations, faster writes; that's why most standard libraries (Java `TreeMap`, C++ `std::map`) use red-black trees.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Inserting 1, 2, 3, 4, 5 in that order into an empty plain BST produces a tree of height…",
          options: ["2", "3", "5", "log₂ 5"],
          answer: 2,
          explain: "Each value becomes the right child of the previous one — a linked list.",
        },
        {
          q: "Deleting a node with two children replaces it with…",
          options: ["Its left child", "Its parent", "Its inorder successor (or predecessor)", "The root"],
          answer: 2,
          explain: "The successor keeps the ordering valid and has at most one child.",
        },
        {
          q: "Where is the inorder successor of a node with a right child?",
          options: ["Its parent", "Leftmost node in its right subtree", "Rightmost node in its left subtree", "The root"],
          answer: 1,
          explain: "The smallest value larger than the node lives at the far left of its right subtree.",
        },
        {
          q: "Which query does a balanced BST support efficiently but a hash map doesn't?",
          options: ["Insert", "Exact lookup", "Smallest key ≥ x (ceiling)", "Delete"],
          answer: 2,
          explain: "Ordered queries need ordering; hashing destroys it.",
        },
        {
          q: "Which structure does Java's TreeMap use?",
          options: ["AVL tree", "Red-black tree", "B-tree", "Skip list"],
          answer: 1,
          explain: "TreeMap is a red-black tree with O(log n) guarantees.",
        },
      ],
      problems: [
        { title: "Search in a Binary Search Tree", url: lc("search-in-a-binary-search-tree"), difficulty: "Easy" },
        { title: "Lowest Common Ancestor of a BST", url: lc("lowest-common-ancestor-of-a-binary-search-tree"), difficulty: "Medium" },
        { title: "Validate Binary Search Tree", url: lc("validate-binary-search-tree"), difficulty: "Medium" },
        { title: "Kth Smallest Element in a BST", url: lc("kth-smallest-element-in-a-bst"), difficulty: "Medium" },
        { title: "Delete Node in a BST", url: lc("delete-node-in-a-bst"), difficulty: "Medium" },
        { title: "Convert Sorted Array to Binary Search Tree", url: lc("convert-sorted-array-to-binary-search-tree"), difficulty: "Easy" },
        { title: "Binary Search Tree Iterator", url: lc("binary-search-tree-iterator"), difficulty: "Medium" },
        { title: "My Calendar I", url: lc("my-calendar-i"), difficulty: "Medium", note: "TreeMap floor/ceiling" },
      ],
    },

    // ------------------------------------------------------------------ HEAPS
    {
      id: "heaps",
      title: "Heaps & Priority Queues",
      tagline: "Always know the smallest (or largest) item in O(1).",
      difficulty: "intermediate",
      minutes: 14,
      visualizers: ["heap"],
      concept: `
## What a heap guarantees
A **binary heap** is a *complete* binary tree with the **heap property**: in a min-heap every parent ≤ its children (max-heap: ≥). That's weaker than a BST — siblings are unordered — but it's exactly enough to give:

- **peek** min/max: O(1) (it's the root)
- **push**: O(log n) — append at the end, **sift up**
- **pop**: O(log n) — move the last element to the root, **sift down**
- **heapify** an array: **O(n)** (not n log n!)

## Stored in a plain array
Completeness means no gaps, so no pointers are needed. For index i:
- parent = ⌊(i − 1) / 2⌋
- left child = 2i + 1, right child = 2i + 2

## Why heapify is O(n)
Floyd's algorithm sifts down every non-leaf from the bottom up. Half the nodes are leaves (no work), a quarter move at most 1 level, an eighth at most 2… The sum n/4·1 + n/8·2 + n/16·3 + … converges to **O(n)**.

## Language notes
- **Python** \`heapq\` is a **min-heap** on a list: \`heappush\`, \`heappop\`, \`heapify\`, \`nlargest\`. For a max-heap push negated values (\`-x\`), or push tuples \`(priority, tiebreak, item)\`.
- **Java** \`PriorityQueue\` is a min-heap; pass \`Comparator.reverseOrder()\` for max.
- **C++** \`priority_queue\` is a **max-heap** by default.
- **JavaScript** has none built in — interviewers usually let you assume one or write a small class.

## Where heaps show up
- **Top-K**: keep a min-heap of size k while scanning n items → O(n log k). The root is the k-th largest.
- **Merge k sorted lists/streams**: heap of the current head of each list → O(n log k).
- **Running median**: a max-heap for the lower half and a min-heap for the upper half.
- **Scheduling**: CPU schedulers, task queues, meeting rooms (heap of end times).
- **Graph algorithms**: Dijkstra and Prim pop the next-closest vertex.
- **Systems**: timer wheels, rate limiter refills, event simulation, Kafka's delayed operations.
`,
      keyPoints: [
        "Heap property: parent ≤ children (min-heap). Siblings are unordered.",
        "Array layout: children at 2i+1, 2i+2; parent at (i−1)//2.",
        "push/pop O(log n), peek O(1), heapify O(n).",
        "Top-k largest → min-heap of size k (O(n log k)).",
        "Python heapq is a min-heap — negate for max.",
      ],
      complexity: [
        { op: "peek", time: "O(1)" },
        { op: "push (sift up)", time: "O(log n)" },
        { op: "pop (sift down)", time: "O(log n)" },
        { op: "heapify n items", time: "O(n)" },
        { op: "search arbitrary item", time: "O(n)" },
        { op: "heap sort", time: "O(n log n)", space: "O(1)" },
      ],
      code: [
        {
          title: "Kth largest element & merge k sorted lists",
          variants: [
            {
              lang: "python",
              code: `
import heapq

def kth_largest(nums, k):
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)       # drop the smallest
    return heap[0]                    # O(n log k)

def merge_k_lists(lists):
    heap = [(node.val, i, node) for i, node in enumerate(lists) if node]
    heapq.heapify(heap)
    dummy = tail = ListNode()
    while heap:
        _, i, node = heapq.heappop(heap)   # i breaks ties between equal vals
        tail.next = tail = node
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    return dummy.next
`,
            },
            {
              lang: "java",
              code: `
int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>(); // min-heap
    for (int x : nums) {
        heap.offer(x);
        if (heap.size() > k) heap.poll();
    }
    return heap.peek();
}

ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> pq = new PriorityQueue<>((a, b) -> a.val - b.val);
    for (ListNode l : lists) if (l != null) pq.offer(l);
    ListNode dummy = new ListNode(0), tail = dummy;
    while (!pq.isEmpty()) {
        ListNode n = pq.poll();
        tail.next = n; tail = n;
        if (n.next != null) pq.offer(n.next);
    }
    return dummy.next;
}
`,
            },
            {
              lang: "javascript",
              code: `
class MinHeap {
  a = [];
  get size() { return this.a.length; }
  peek() { return this.a[0]; }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p] <= a[i]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l] < a[m]) m = l;
        if (r < a.length && a[r] < a[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
`,
            },
          ],
        },
        {
          title: "Running median with two heaps",
          variants: [
            {
              lang: "python",
              code: `
import heapq

class MedianFinder:
    def __init__(self):
        self.lo = []   # max-heap (negated) — lower half
        self.hi = []   # min-heap — upper half

    def add(self, x):
        heapq.heappush(self.lo, -x)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))   # move max of lo to hi
        if len(self.hi) > len(self.lo):                     # rebalance: lo may hold one extra
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self):
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Find the k largest elements in an array of n numbers. Compare approaches.",
          a: "1) **Sort**: O(n log n). 2) **Min-heap of size k**: scan once, push each item and pop when size > k → O(n log k) time, O(k) space; great for streams. 3) **Quickselect**: partition like quicksort around a pivot and recurse into one side → O(n) average, O(n²) worst (randomize the pivot). 4) For a fixed small value range, **counting / bucket sort** → O(n). Mention the streaming case: the heap is the only one that works when data doesn't fit in memory.",
          freq: "very-common",
        },
        {
          q: "Why is building a heap O(n) and not O(n log n)?",
          a: "Bottom-up heapify sifts each node down at most its *height*. Most nodes are near the bottom: n/2 leaves do no work, n/4 nodes move ≤ 1 level, n/8 ≤ 2, … The total Σ (n / 2^(h+1)) · h is bounded by 2n, i.e. O(n). Pushing items one by one is O(n log n) because each push may bubble up the full height.",
          freq: "common",
        },
        {
          q: "How would you find the median of a data stream?",
          a: "Two heaps: a **max-heap** for the smaller half and a **min-heap** for the larger half, kept balanced so their sizes differ by at most one. Insert is O(log n), median is O(1) — the top of the bigger heap or the average of both tops. Follow-up: if values are bounded (0–100), use counting buckets for O(1) updates.",
          freq: "very-common",
        },
        {
          q: "Design a task scheduler that runs jobs at given timestamps.",
          a: "Min-heap keyed by run time. A worker thread peeks the earliest job; if it's due, pop and run it, otherwise sleep until its time (or until a new earlier job is pushed — signal with a condition variable). Push and pop are O(log n). At scale, shard by job id, persist jobs in a DB with an index on run_at, and use timing wheels for huge numbers of timers.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "In an array-backed heap, the children of index 3 are at…",
          options: ["4 and 5", "6 and 7", "7 and 8", "3 and 4"],
          answer: 2,
          explain: "2i + 1 = 7 and 2i + 2 = 8.",
        },
        {
          q: "Building a heap from n unsorted items with bottom-up heapify costs…",
          options: ["O(log n)", "O(n)", "O(n log n)", "O(n²)"],
          answer: 1,
          explain: "Most nodes are near the leaves and sift down very little.",
        },
        {
          q: "To keep the k LARGEST elements while streaming, you maintain a…",
          options: ["Max-heap of size k", "Min-heap of size k", "Sorted array", "Hash set"],
          answer: 1,
          explain: "The min-heap's root is the smallest of the top k, so it's the one to evict.",
        },
        {
          q: "Python's heapq module provides a…",
          options: ["Max-heap", "Min-heap", "Balanced BST", "Fibonacci heap"],
          answer: 1,
          explain: "Use negated keys for max-heap behaviour.",
        },
        {
          q: "Merging k sorted lists with n total elements using a heap costs…",
          options: ["O(n k)", "O(n log k)", "O(n log n)", "O(k log n)"],
          answer: 1,
          explain: "Each of n pops/pushes is on a heap of size k.",
        },
      ],
      problems: [
        { title: "Kth Largest Element in a Stream", url: lc("kth-largest-element-in-a-stream"), difficulty: "Easy" },
        { title: "Last Stone Weight", url: lc("last-stone-weight"), difficulty: "Easy" },
        { title: "Kth Largest Element in an Array", url: lc("kth-largest-element-in-an-array"), difficulty: "Medium" },
        { title: "K Closest Points to Origin", url: lc("k-closest-points-to-origin"), difficulty: "Medium" },
        { title: "Task Scheduler", url: lc("task-scheduler"), difficulty: "Medium" },
        { title: "Meeting Rooms II", url: lc("meeting-rooms-ii"), difficulty: "Medium" },
        { title: "Find Median from Data Stream", url: lc("find-median-from-data-stream"), difficulty: "Hard" },
        { title: "Merge k Sorted Lists", url: lc("merge-k-sorted-lists"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ TRIES
    {
      id: "tries",
      title: "Tries",
      tagline: "Prefix trees for autocomplete, spell check and word games.",
      difficulty: "intermediate",
      minutes: 11,
      visualizers: ["trie"],
      concept: `
## Structure
A **trie** stores strings character by character. Each node has up to Σ children (Σ = alphabet size) and a flag marking whether a word **ends** there. All words sharing a prefix share the same path from the root.

\`\`\`
       (root)
       /    \\
      c      d
      |      |
      a      o*        * = end of word
     / \\     |
    r*  t*   g*
   / \\
  d*  e*
\`\`\`
Words: car, card, care, cat, do, dog.

## Costs depend on word length, not word count
For a word of length L:
- **insert**, **search**, **startsWith(prefix)**: **O(L)** — no matter if the trie holds 10 or 10 million words.
- Hash sets can check whole words in O(L) too, but they can't answer **prefix** questions without scanning everything.

## Implementation choices
- **Array of 26 children** — fastest, wasteful for sparse alphabets.
- **Hash map of children** — flexible (Unicode, arbitrary tokens), a bit slower.
- **Compressed trie / radix tree** — merge single-child chains into one edge labelled with a substring; saves memory (used in routers' IP lookup and in many key-value stores).

## Where tries shine
- **Autocomplete / typeahead**: walk to the prefix node, DFS to collect words; store top-k suggestions *at each node* to answer in O(L) (see the System Design autocomplete case study).
- **Word Search II**: put all target words in a trie and DFS the board once, pruning as soon as the path leaves the trie.
- **Longest common prefix**, **replace words**, **spell checkers**.
- **IP routing**: longest-prefix match on binary tries.
- **XOR maximization**: a binary trie of numbers' bits finds the max XOR pair in O(n · 32).
`,
      keyPoints: [
        "Each edge is a character; an end flag marks complete words.",
        "insert / search / startsWith are O(L), independent of word count.",
        "Prefix queries are the reason to choose a trie over a hash set.",
        "Children as array[26] (fast) or hash map (flexible).",
        "Autocomplete = walk to prefix + DFS (or cache top-k per node).",
      ],
      complexity: [
        { op: "insert word of length L", time: "O(L)", space: "O(L) new nodes worst case" },
        { op: "search / startsWith", time: "O(L)" },
        { op: "autocomplete k results", time: "O(L + size of subtree)" },
        { op: "total space", time: "—", space: "O(total characters · Σ) array impl." },
      ],
      code: [
        {
          title: "Trie with insert, search, startsWith",
          variants: [
            {
              lang: "python",
              code: `
class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node["$"] = True                  # end-of-word marker

    def _walk(self, s):
        node = self.root
        for ch in s:
            if ch not in node:
                return None
            node = node[ch]
        return node

    def search(self, word):
        node = self._walk(word)
        return node is not None and "$" in node

    def starts_with(self, prefix):
        return self._walk(prefix) is not None
`,
            },
            {
              lang: "javascript",
              code: `
class TrieNode {
  children = new Map();
  end = false;
}

class Trie {
  root = new TrieNode();
  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch);
    }
    node.end = true;
  }
  #walk(s) {
    let node = this.root;
    for (const ch of s) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }
  search(word) { return this.#walk(word)?.end === true; }
  startsWith(prefix) { return this.#walk(prefix) !== null; }
}
`,
            },
            {
              lang: "java",
              code: `
class Trie {
    private final Trie[] next = new Trie[26];
    private boolean end;

    public void insert(String word) {
        Trie node = this;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (node.next[i] == null) node.next[i] = new Trie();
            node = node.next[i];
        }
        node.end = true;
    }
    private Trie walk(String s) {
        Trie node = this;
        for (char c : s.toCharArray()) {
            node = node.next[c - 'a'];
            if (node == null) return null;
        }
        return node;
    }
    public boolean search(String w) { Trie n = walk(w); return n != null && n.end; }
    public boolean startsWith(String p) { return walk(p) != null; }
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "When would you use a trie instead of a hash set of words?",
          a: "When you need **prefix** operations: autocomplete, \"does any word start with…\", longest common prefix, or pruning a search (Word Search II, Boggle). A hash set answers only exact-match membership; for prefixes it must scan every word. Tries can also save memory when many words share prefixes, although naive array-of-26 tries can use *more* memory than a hash set.",
          freq: "very-common",
        },
        {
          q: "How does Word Search II use a trie to avoid TLE?",
          a: "Searching each word separately costs O(words × cells × 4^L). Instead insert all words into a trie, then DFS from every cell **once**, following trie edges: as soon as the current path isn't a prefix of any word, stop. When you reach a node marked end-of-word, record it (and clear the mark to avoid duplicates). Pruning leaf nodes after matching speeds it up further.",
          freq: "common",
        },
        {
          q: "How would you make autocomplete return the top 5 suggestions fast?",
          a: "Store at each trie node a small list of the top-k completions by popularity (precomputed offline). A query walks L characters and returns the cached list: O(L). Updates are batched (rebuild periodically from logs) because maintaining top-k on every keystroke from every user is expensive. At scale, shard the trie by prefix and cache hot prefixes in a CDN or Redis.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Search for a word of length L in a trie holding N words costs…",
          options: ["O(N)", "O(L)", "O(N · L)", "O(log N)"],
          answer: 1,
          explain: "You follow at most L edges; N doesn't matter.",
        },
        {
          q: "Why does a trie need an end-of-word flag?",
          options: ["To save memory", "Because a word can be a prefix of another (\"car\" in \"card\")", "For sorting", "To support deletion only"],
          answer: 1,
          explain: "Without it you can't tell \"car\" was inserted when only \"card\" passes through it.",
        },
        {
          q: "Which problem is the classic trie use case?",
          options: ["Shortest path", "Autocomplete", "Median of a stream", "Range sum"],
          answer: 1,
          explain: "Prefix lookups are what tries are built for.",
        },
        {
          q: "A radix (compressed) trie improves on a plain trie by…",
          options: ["Sorting children", "Merging single-child chains into one edge", "Using hashing", "Storing words in leaves only"],
          answer: 1,
          explain: "Fewer nodes, less memory, shorter walks.",
        },
      ],
      problems: [
        { title: "Implement Trie (Prefix Tree)", url: lc("implement-trie-prefix-tree"), difficulty: "Medium" },
        { title: "Design Add and Search Words Data Structure", url: lc("design-add-and-search-words-data-structure"), difficulty: "Medium" },
        { title: "Replace Words", url: lc("replace-words"), difficulty: "Medium" },
        { title: "Search Suggestions System", url: lc("search-suggestions-system"), difficulty: "Medium" },
        { title: "Maximum XOR of Two Numbers in an Array", url: lc("maximum-xor-of-two-numbers-in-an-array"), difficulty: "Medium" },
        { title: "Word Search II", url: lc("word-search-ii"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ GRAPHS
    {
      id: "graphs-bfs-dfs",
      title: "Graphs: BFS & DFS",
      tagline: "Represent any network, then explore it two fundamental ways.",
      difficulty: "intermediate",
      minutes: 18,
      visualizers: ["grid"],
      concept: `
## Graph vocabulary
A graph G = (V, E) is a set of **vertices** connected by **edges**. Edges can be **directed** (follows on Twitter) or **undirected** (Facebook friends), **weighted** (road distances) or unweighted. A **DAG** is a directed graph without cycles.

Trees are graphs (connected, no cycles, n − 1 edges). Grids are graphs (each cell connects to its 4 neighbours). Many interview problems are graph problems in disguise: word ladders, course schedules, flight routes, social networks, state machines.

## Representations
| | Adjacency list | Adjacency matrix |
|---|---|---|
| Space | O(V + E) | O(V²) |
| Check edge (u, v) | O(deg u) | O(1) |
| Iterate neighbours | O(deg u) | O(V) |
| Best for | sparse graphs (almost always) | dense graphs, Floyd-Warshall |

In interviews you usually build \`adj = defaultdict(list)\` from an edge list.

## BFS — breadth-first search
Explore in **rings** of increasing distance using a **queue**. Mark nodes visited **when you enqueue them** (not when you dequeue) or you'll enqueue duplicates.
- Finds the **shortest path in an unweighted graph** (fewest edges).
- Level-by-level processing (word ladder, rotting oranges, minimum moves).
- **Multi-source BFS**: start with *all* sources in the queue (rotting oranges, walls and gates, distance to nearest 0).

## DFS — depth-first search
Go as deep as possible, then backtrack — recursion or an explicit **stack**.
- Connected components, flood fill (**number of islands**).
- Cycle detection (directed graphs: track nodes on the current recursion path — white/gray/black colouring).
- Topological sort (reverse postorder), path existence, backtracking.

Both run in **O(V + E)**. On a grid that's O(rows × cols).

## Grid-as-graph checklist
\`\`\`
for dr, dc in ((1,0), (-1,0), (0,1), (0,-1)):
    nr, nc = r + dr, c + dc
    if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == target and (nr, nc) not in seen:
        ...
\`\`\`
You can often mark visited in-place (e.g. set land to '0') to save the seen-set — mention that it mutates the input.

## BFS vs DFS vs A*
Play with the visualizer: BFS explores evenly and guarantees the shortest path; DFS may wander and find a long path; **A\\*** adds a heuristic (Manhattan distance) to steer toward the goal while still finding the shortest path if the heuristic never overestimates.
`,
      keyPoints: [
        "Adjacency list: O(V + E) space — the default choice.",
        "BFS + queue = shortest path by edge count; mark visited on enqueue.",
        "DFS + stack/recursion = components, cycles, topological order.",
        "Both are O(V + E); grids are O(R × C).",
        "Multi-source BFS: seed the queue with every source at distance 0.",
      ],
      complexity: [
        { op: "BFS / DFS", time: "O(V + E)", space: "O(V)" },
        { op: "Grid BFS / DFS", time: "O(R · C)", space: "O(R · C)" },
        { op: "Build adjacency list", time: "O(V + E)", space: "O(V + E)" },
      ],
      code: [
        {
          title: "Number of islands (DFS flood fill)",
          variants: [
            {
              lang: "python",
              code: `
def num_islands(grid):
    R, C = len(grid), len(grid[0])

    def sink(r, c):
        if r < 0 or c < 0 or r >= R or c >= C or grid[r][c] != "1":
            return
        grid[r][c] = "0"                     # mark visited in place
        sink(r + 1, c); sink(r - 1, c)
        sink(r, c + 1); sink(r, c - 1)

    count = 0
    for r in range(R):
        for c in range(C):
            if grid[r][c] == "1":
                count += 1
                sink(r, c)
    return count
`,
            },
            {
              lang: "javascript",
              code: `
function numIslands(grid) {
  const R = grid.length, C = grid[0].length;
  const sink = (r, c) => {
    if (r < 0 || c < 0 || r >= R || c >= C || grid[r][c] !== "1") return;
    grid[r][c] = "0";
    sink(r + 1, c); sink(r - 1, c); sink(r, c + 1); sink(r, c - 1);
  };
  let count = 0;
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      if (grid[r][c] === "1") { count++; sink(r, c); }
  return count;
}
`,
            },
            {
              lang: "java",
              code: `
int numIslands(char[][] g) {
    int count = 0;
    for (int r = 0; r < g.length; r++)
        for (int c = 0; c < g[0].length; c++)
            if (g[r][c] == '1') { count++; sink(g, r, c); }
    return count;
}
void sink(char[][] g, int r, int c) {
    if (r < 0 || c < 0 || r >= g.length || c >= g[0].length || g[r][c] != '1') return;
    g[r][c] = '0';
    sink(g, r + 1, c); sink(g, r - 1, c); sink(g, r, c + 1); sink(g, r, c - 1);
}
`,
            },
          ],
        },
        {
          title: "Shortest path in an unweighted graph (BFS)",
          variants: [
            {
              lang: "python",
              code: `
from collections import deque, defaultdict

def shortest_path(edges, src, dst):
    adj = defaultdict(list)
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
    dist = {src: 0}
    q = deque([src])
    while q:
        u = q.popleft()
        if u == dst:
            return dist[u]
        for v in adj[u]:
            if v not in dist:          # mark when enqueuing
                dist[v] = dist[u] + 1
                q.append(v)
    return -1
`,
            },
            {
              lang: "javascript",
              code: `
function shortestPath(edges, src, dst) {
  const adj = new Map();
  for (const [u, v] of edges) {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push(v);
    adj.get(v).push(u);
  }
  const dist = new Map([[src, 0]]);
  const q = [src];
  for (let head = 0; head < q.length; head++) {   // index pointer = O(1) dequeue
    const u = q[head];
    if (u === dst) return dist.get(u);
    for (const v of adj.get(u) ?? [])
      if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); q.push(v); }
  }
  return -1;
}
`,
            },
          ],
        },
        {
          title: "Cycle detection in a directed graph (3-colour DFS)",
          variants: [
            {
              lang: "python",
              code: `
def has_cycle(n, adj):
    WHITE, GRAY, BLACK = 0, 1, 2
    color = [WHITE] * n

    def dfs(u):
        color[u] = GRAY                  # on the current path
        for v in adj[u]:
            if color[v] == GRAY:         # back edge → cycle
                return True
            if color[v] == WHITE and dfs(v):
                return True
        color[u] = BLACK                 # fully explored
        return False

    return any(color[u] == WHITE and dfs(u) for u in range(n))
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "BFS vs DFS — when do you choose each?",
          a: "**BFS** when you need the *shortest* path in an unweighted graph, minimum number of steps/moves, or level-by-level processing; it uses O(width) memory. **DFS** for exhaustive exploration: connected components, cycle detection, topological sort, path existence, backtracking; it uses O(depth) memory and is easy to write recursively (watch out for recursion limits on huge graphs). If both work (e.g. counting islands), either is fine — pick the one you write most reliably.",
          freq: "very-common",
        },
        {
          q: "How do you clone a graph?",
          a: "DFS or BFS with a hash map `original → copy`. When you visit a node, create its copy if it isn't in the map, then for each neighbour, recursively clone it (or fetch it from the map) and append to the copy's neighbour list. The map doubles as the visited set and handles cycles. O(V + E).",
          freq: "common",
        },
        {
          q: "Rotting oranges: how many minutes until all oranges rot?",
          a: "Multi-source BFS. Enqueue every rotten orange at minute 0 and count fresh ones. Process the queue level by level (each level = one minute), rotting fresh neighbours and decrementing the fresh count. Answer = number of levels processed, or −1 if fresh oranges remain. O(R·C).",
          freq: "common",
        },
        {
          q: "Why mark nodes visited when enqueuing rather than when dequeuing in BFS?",
          a: "If you mark on dequeue, a node can be enqueued multiple times by different neighbours before it's processed — wasting time and memory (worst case O(E) queue entries instead of O(V)) and, for path counting, producing wrong answers. Marking on enqueue guarantees each node enters the queue once.",
          freq: "common",
        },
        {
          q: "How do you detect a cycle in an undirected vs a directed graph?",
          a: "**Undirected**: DFS and ignore the edge back to the parent; any other visited neighbour means a cycle — or use Union-Find (an edge joining two nodes already in the same set closes a cycle). **Directed**: DFS with three colours (unvisited / on current path / done); reaching a node that's *on the current path* is a back edge → cycle. Kahn's topological sort also detects it: if not all nodes get processed, there's a cycle.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which algorithm finds the shortest path (fewest edges) in an unweighted graph?",
          options: ["DFS", "BFS", "Dijkstra only", "Topological sort"],
          answer: 1,
          explain: "BFS visits nodes in order of distance from the source.",
        },
        {
          q: "Space for an adjacency list with V vertices and E edges?",
          options: ["O(V)", "O(E)", "O(V + E)", "O(V²)"],
          answer: 2,
          explain: "One list per vertex plus one entry per edge (two for undirected).",
        },
        {
          q: "Rotting oranges spreading from several rotten oranges at once is solved with…",
          options: ["DFS from each orange", "Multi-source BFS", "Dijkstra", "Union-Find"],
          answer: 1,
          explain: "Seed the queue with all sources so distances grow in sync.",
        },
        {
          q: "In a directed graph, DFS reaching a node that is currently on the recursion stack means…",
          options: ["The graph is disconnected", "There is a cycle", "The node is a leaf", "Nothing special"],
          answer: 1,
          explain: "That's a back edge — a directed cycle.",
        },
        {
          q: "Time complexity of BFS on an R × C grid?",
          options: ["O(R + C)", "O(R · C)", "O((R · C)²)", "O(R · C · log(R · C))"],
          answer: 1,
          explain: "Each cell is visited once and has at most 4 neighbours.",
        },
      ],
      problems: [
        { title: "Flood Fill", url: lc("flood-fill"), difficulty: "Easy" },
        { title: "Number of Islands", url: lc("number-of-islands"), difficulty: "Medium" },
        { title: "Max Area of Island", url: lc("max-area-of-island"), difficulty: "Medium" },
        { title: "Clone Graph", url: lc("clone-graph"), difficulty: "Medium" },
        { title: "Rotting Oranges", url: lc("rotting-oranges"), difficulty: "Medium" },
        { title: "Pacific Atlantic Water Flow", url: lc("pacific-atlantic-water-flow"), difficulty: "Medium" },
        { title: "Surrounded Regions", url: lc("surrounded-regions"), difficulty: "Medium" },
        { title: "Shortest Path in Binary Matrix", url: lc("shortest-path-in-binary-matrix"), difficulty: "Medium" },
        { title: "Word Ladder", url: lc("word-ladder"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ SHORTEST PATHS
    {
      id: "shortest-paths",
      title: "Shortest Paths: Dijkstra & Friends",
      tagline: "Weighted graphs, greedy relaxation and when greed fails.",
      difficulty: "advanced",
      minutes: 16,
      visualizers: ["dijkstra"],
      concept: `
## The problem
Given a weighted graph and a source, find the minimum total weight path to every other node. BFS no longer works — a path with more edges can be cheaper.

## Relaxation
Every shortest-path algorithm is built on one move:
\`\`\`
if dist[u] + w(u, v) < dist[v]:
    dist[v] = dist[u] + w(u, v)
    parent[v] = u
\`\`\`
They differ in the **order** they relax edges.

## Dijkstra's algorithm (non-negative weights)
Greedy: always expand the unvisited node with the **smallest tentative distance**, using a min-heap.
1. dist[src] = 0, others ∞; push (0, src).
2. Pop (d, u). If u was already finalized, skip (lazy deletion). Otherwise u is **final** — with non-negative weights nothing later can make it cheaper.
3. Relax all of u's edges; push improved (dist, v) pairs.

**O((V + E) log V)** with a binary heap. Negative edges break the greedy argument: a finalized node could later be reached more cheaply.

## The toolbox
| Algorithm | Weights | Complexity | Notes |
|---|---|---|---|
| BFS | all equal | O(V + E) | fewest edges |
| 0-1 BFS | 0 or 1 | O(V + E) | deque: push 0-edges front, 1-edges back |
| Dijkstra | ≥ 0 | O((V + E) log V) | the default |
| Bellman-Ford | any | O(V · E) | relax all edges V−1 times; a V-th improvement ⇒ negative cycle |
| SPFA | any | avg fast, worst O(VE) | queue-based Bellman-Ford |
| Floyd-Warshall | any | O(V³) | all pairs; DP over intermediate nodes |
| A* | ≥ 0 | depends on heuristic | Dijkstra + admissible heuristic; maps & games |

## Variations interviewers love
- **"Cheapest flights within K stops"** — Bellman-Ford limited to K+1 rounds, or BFS/Dijkstra on (node, stops) state.
- **"Path with minimum effort / maximum probability"** — Dijkstra with a different combine function (max instead of sum, product of probabilities).
- **"Network delay time"** — plain Dijkstra; answer is the max over all distances.
- **State-space Dijkstra** — nodes become (position, keys collected, fuel…) tuples.

## Minimum spanning trees (bonus)
Connect all vertices with minimum total edge weight: **Kruskal** (sort edges, add if Union-Find says no cycle) or **Prim** (Dijkstra-like heap growth from one vertex). Both O(E log V).
`,
      keyPoints: [
        "Relaxation: dist[v] = min(dist[v], dist[u] + w).",
        "Dijkstra = greedy + min-heap; requires non-negative weights.",
        "O((V + E) log V); skip stale heap entries.",
        "Negative weights → Bellman-Ford (detects negative cycles).",
        "All pairs, small V → Floyd-Warshall O(V³).",
      ],
      complexity: [
        { op: "Dijkstra (binary heap)", time: "O((V + E) log V)", space: "O(V + E)" },
        { op: "Bellman-Ford", time: "O(V · E)", space: "O(V)" },
        { op: "Floyd-Warshall", time: "O(V³)", space: "O(V²)" },
        { op: "0-1 BFS", time: "O(V + E)" },
      ],
      code: [
        {
          title: "Dijkstra with a min-heap",
          variants: [
            {
              lang: "python",
              code: `
import heapq
from collections import defaultdict

def dijkstra(n, edges, src):
    adj = defaultdict(list)
    for u, v, w in edges:
        adj[u].append((v, w))
    dist = [float("inf")] * n
    dist[src] = 0
    heap = [(0, src)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:               # stale entry
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist
`,
            },
            {
              lang: "java",
              code: `
int[] dijkstra(int n, int[][] edges, int src) {
    List<List<int[]>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    for (int[] e : edges) adj.get(e[0]).add(new int[]{e[1], e[2]});
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]);
    pq.offer(new int[]{0, src});
    while (!pq.isEmpty()) {
        int[] top = pq.poll();
        int d = top[0], u = top[1];
        if (d > dist[u]) continue;
        for (int[] e : adj.get(u)) {
            int v = e[0], nd = d + e[1];
            if (nd < dist[v]) { dist[v] = nd; pq.offer(new int[]{nd, v}); }
        }
    }
    return dist;
}
`,
            },
          ],
        },
        {
          title: "Bellman-Ford with negative-cycle detection",
          variants: [
            {
              lang: "python",
              code: `
def bellman_ford(n, edges, src):
    dist = [float("inf")] * n
    dist[src] = 0
    for _ in range(n - 1):                 # a shortest path has ≤ n-1 edges
        changed = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                changed = True
        if not changed:
            break
    for u, v, w in edges:                  # still improving ⇒ negative cycle
        if dist[u] + w < dist[v]:
            raise ValueError("negative cycle")
    return dist
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why doesn't Dijkstra work with negative edge weights?",
          a: "Dijkstra finalizes a node the moment it's popped, assuming no future path can be cheaper because every remaining path only adds non-negative weight. A negative edge discovered later can produce a cheaper path to an already-finalized node, so the answer is wrong. Use Bellman-Ford (O(VE)), which keeps relaxing all edges and also detects negative cycles.",
          freq: "very-common",
        },
        {
          q: "Cheapest flights within K stops — why isn't plain Dijkstra enough?",
          a: "Dijkstra keeps only the best cost per node, but a costlier path with fewer stops might be the only one that satisfies the K-stop limit. Options: (1) **Bellman-Ford for K+1 rounds**, copying the dist array each round so a round extends paths by exactly one edge — O(K·E); (2) Dijkstra/BFS over states **(city, stops used)**, pruning states with more stops than K.",
          freq: "common",
        },
        {
          q: "How does Google Maps compute routes so fast on a graph with billions of edges?",
          a: "Not plain Dijkstra. Real systems precompute: **contraction hierarchies** (shortcut edges that skip unimportant nodes), **A\\*** with landmark-based heuristics (ALT), bidirectional search, and partitioning the road network into regions with precomputed boundary distances. Live traffic updates edge weights; customizable route planning (CRP) lets weights change without full recomputation.",
          freq: "occasional",
        },
        {
          q: "Kruskal vs Prim for minimum spanning trees?",
          a: "**Kruskal** sorts all edges and adds each one that connects two different components (Union-Find) — O(E log E), great for sparse graphs or when edges come as a list. **Prim** grows one tree from a start vertex, always adding the cheapest edge leaving the tree (min-heap) — O(E log V), natural for dense graphs / adjacency lists. Both are greedy and correct by the cut property.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Dijkstra's algorithm requires edge weights that are…",
          options: ["Integers", "Non-negative", "Distinct", "Less than V"],
          answer: 1,
          explain: "Negative weights invalidate the greedy finalization step.",
        },
        {
          q: "Complexity of Dijkstra with a binary heap?",
          options: ["O(V + E)", "O((V + E) log V)", "O(V · E)", "O(V³)"],
          answer: 1,
          explain: "Each edge may push to the heap; each heap operation is O(log V).",
        },
        {
          q: "How does Bellman-Ford detect a negative cycle?",
          options: [
            "A node's distance becomes negative",
            "Some edge can still be relaxed after V − 1 rounds",
            "The heap becomes empty",
            "DFS finds a back edge",
          ],
          answer: 1,
          explain: "Shortest simple paths need ≤ V − 1 edges, so further improvement implies a negative cycle.",
        },
        {
          q: "Which algorithm computes shortest paths between ALL pairs on a small dense graph?",
          options: ["BFS", "Prim", "Floyd-Warshall", "Kahn"],
          answer: 2,
          explain: "Floyd-Warshall's triple loop is O(V³).",
        },
        {
          q: "With edge weights only 0 or 1, the fastest approach is…",
          options: ["Dijkstra", "0-1 BFS with a deque", "Bellman-Ford", "Floyd-Warshall"],
          answer: 1,
          explain: "Push 0-weight neighbours to the front, 1-weight to the back: O(V + E).",
        },
      ],
      problems: [
        { title: "Network Delay Time", url: lc("network-delay-time"), difficulty: "Medium" },
        { title: "Path With Minimum Effort", url: lc("path-with-minimum-effort"), difficulty: "Medium" },
        { title: "Cheapest Flights Within K Stops", url: lc("cheapest-flights-within-k-stops"), difficulty: "Medium" },
        { title: "Path with Maximum Probability", url: lc("path-with-maximum-probability"), difficulty: "Medium" },
        { title: "Min Cost to Connect All Points", url: lc("min-cost-to-connect-all-points"), difficulty: "Medium", note: "MST" },
        { title: "Swim in Rising Water", url: lc("swim-in-rising-water"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ TOPOLOGICAL SORT
    {
      id: "topological-sort",
      title: "Topological Sort",
      tagline: "Order tasks so every dependency comes first.",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["topo"],
      concept: `
## The idea
Given a **directed acyclic graph** (DAG) where an edge u → v means "u must happen before v", a **topological order** lists every vertex so all edges point forward. Build systems (make, Bazel), package managers, spreadsheet recalculation, course prerequisites, task schedulers and database migration runners all do this.

A topological order exists **if and only if the graph has no directed cycle**. Detecting that cycle is often the real question ("Can you finish all courses?").

## Kahn's algorithm (BFS)
1. Compute every node's **in-degree** (number of incoming edges).
2. Queue all nodes with in-degree 0 — nothing blocks them.
3. Pop a node, append it to the order, and "delete" its outgoing edges by decrementing each neighbour's in-degree; enqueue neighbours that hit 0.
4. If the order contains fewer than V nodes, the remaining ones sit on a **cycle**.

O(V + E). Using a min-heap instead of a queue gives the lexicographically smallest order.

## DFS-based alternative
Run DFS; when a node **finishes** (all descendants explored), push it onto a list. Reverse that list → topological order. Detect cycles with the three-colour trick (gray node reached again = back edge).

## Patterns
- **Course Schedule I/II** — cycle detection / produce the order.
- **Alien Dictionary** — compare adjacent words to derive letter-ordering edges, then topo sort.
- **Parallel courses / minimum semesters** — Kahn's algorithm level by level; the number of levels is the minimum time with unlimited parallelism (critical path).
- **Sequence reconstruction** — the order is unique iff the queue never holds more than one node.
`,
      keyPoints: [
        "Only DAGs have a topological order.",
        "Kahn: queue in-degree-0 nodes, peel them off, decrement neighbours.",
        "Processed fewer than V nodes ⇒ cycle.",
        "DFS alternative: reverse postorder.",
        "Processing Kahn level by level = minimum number of parallel rounds.",
      ],
      complexity: [
        { op: "Kahn's algorithm", time: "O(V + E)", space: "O(V + E)" },
        { op: "DFS topo sort", time: "O(V + E)", space: "O(V + E)" },
      ],
      code: [
        {
          title: "Course Schedule II with Kahn's algorithm",
          variants: [
            {
              lang: "python",
              code: `
from collections import deque

def find_order(n, prerequisites):
    adj = [[] for _ in range(n)]
    indeg = [0] * n
    for course, pre in prerequisites:     # pre -> course
        adj[pre].append(course)
        indeg[course] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == n else []   # [] ⇒ cycle
`,
            },
            {
              lang: "javascript",
              code: `
function findOrder(n, prerequisites) {
  const adj = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (const [course, pre] of prerequisites) {
    adj[pre].push(course);
    indeg[course]++;
  }
  const q = [];
  indeg.forEach((d, i) => d === 0 && q.push(i));
  const order = [];
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    order.push(u);
    for (const v of adj[u]) if (--indeg[v] === 0) q.push(v);
  }
  return order.length === n ? order : [];
}
`,
            },
            {
              lang: "java",
              code: `
int[] findOrder(int n, int[][] prereq) {
    List<List<Integer>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    int[] indeg = new int[n];
    for (int[] p : prereq) { adj.get(p[1]).add(p[0]); indeg[p[0]]++; }
    Deque<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < n; i++) if (indeg[i] == 0) q.offer(i);
    int[] order = new int[n];
    int k = 0;
    while (!q.isEmpty()) {
        int u = q.poll();
        order[k++] = u;
        for (int v : adj.get(u)) if (--indeg[v] == 0) q.offer(v);
    }
    return k == n ? order : new int[0];
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How do you determine if all courses can be finished given prerequisites?",
          a: "Model courses as nodes and `prereq → course` as directed edges. All courses can be finished iff the graph has **no cycle**. Run Kahn's algorithm and check that every node was processed, or run DFS with three colours and look for a back edge. O(V + E).",
          freq: "very-common",
        },
        {
          q: "Explain the Alien Dictionary problem approach.",
          a: "Compare each pair of adjacent words; the first differing character gives an edge `a → b` (a comes before b). Edge case: if a word is a longer version of the next word with the same prefix (`\"abc\"` before `\"ab\"`), the input is invalid. Then topologically sort the letters (Kahn's). If not all letters are output, there's a cycle → invalid ordering. O(total characters).",
          freq: "common",
        },
        {
          q: "How would a build system decide what to rebuild and in what order?",
          a: "Represent targets and dependencies as a DAG. When files change, mark affected nodes dirty and propagate to dependents (reverse edges). Topologically sort the dirty subgraph and build in that order; nodes in the same Kahn \"level\" have no dependencies between them and can build **in parallel**. Detect cycles and report them as configuration errors. Content hashing avoids rebuilding unchanged outputs.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "A topological order exists only for…",
          options: ["Undirected graphs", "Directed acyclic graphs", "Complete graphs", "Weighted graphs"],
          answer: 1,
          explain: "Any directed cycle makes it impossible to put every edge forward.",
        },
        {
          q: "Kahn's algorithm starts by queueing nodes with…",
          options: ["Highest out-degree", "In-degree 0", "Out-degree 0", "The smallest label"],
          answer: 1,
          explain: "They have no unmet dependencies.",
        },
        {
          q: "After Kahn's algorithm, 2 of 8 nodes were never output. This means…",
          options: ["The graph is disconnected", "There is a cycle", "Those nodes are leaves", "The algorithm is wrong"],
          answer: 1,
          explain: "Nodes on a cycle never reach in-degree 0.",
        },
        {
          q: "The DFS-based topological sort uses…",
          options: ["Preorder", "Reverse postorder", "Inorder", "Level order"],
          answer: 1,
          explain: "A node finishes after all its descendants; reversing puts it before them.",
        },
      ],
      problems: [
        { title: "Course Schedule", url: lc("course-schedule"), difficulty: "Medium" },
        { title: "Course Schedule II", url: lc("course-schedule-ii"), difficulty: "Medium" },
        { title: "Minimum Height Trees", url: lc("minimum-height-trees"), difficulty: "Medium" },
        { title: "Parallel Courses", url: lc("parallel-courses"), difficulty: "Medium" },
        { title: "Alien Dictionary", url: lc("alien-dictionary"), difficulty: "Hard" },
        { title: "Longest Increasing Path in a Matrix", url: lc("longest-increasing-path-in-a-matrix"), difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ UNION FIND
    {
      id: "union-find",
      title: "Union-Find (Disjoint Sets)",
      tagline: "Merge groups and ask 'connected?' in near-constant time.",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["unionfind"],
      concept: `
## The data structure
Union-Find (a.k.a. Disjoint Set Union, DSU) maintains a partition of elements into groups, supporting:
- **find(x)** — which group (representative/root) is x in?
- **union(a, b)** — merge a's and b's groups.

Each group is a tree stored in a \`parent\` array; the root represents the group. \`find\` walks up to the root.

## Two optimizations make it fly
1. **Union by rank / size** — attach the smaller (shorter) tree under the larger root. Trees stay O(log n) tall.
2. **Path compression** — during \`find\`, point every visited node directly at the root. Future finds become almost instant.

With both, operations cost **O(α(n))** amortized, where α is the inverse Ackermann function — ≤ 4 for any n you'll ever meet. Effectively O(1).

## When to reach for it
- **Dynamic connectivity**: edges arrive over time; "are u and v connected now?" (BFS per query would be O(V + E) each).
- **Counting components**: start with n components, decrement on every successful union.
- **Cycle detection in undirected graphs**: an edge whose endpoints already share a root closes a cycle (Redundant Connection, Graph Valid Tree).
- **Kruskal's MST**: sort edges, keep each edge that joins two components.
- **Grouping by equivalence**: accounts merge (emails), similar strings, equations (\`a == b\`, \`b != c\`).
- **Grid percolation / islands II**: add land cells online and union with neighbours.

Union-Find can't easily *split* groups or list a group's members — use graph search for that.
`,
      keyPoints: [
        "parent[] forest; the root identifies the set.",
        "Union by rank/size keeps trees shallow.",
        "Path compression flattens trees during find.",
        "Both together ⇒ O(α(n)) ≈ O(1) amortized.",
        "Union returning false (same root) ⇒ cycle in an undirected graph.",
      ],
      complexity: [
        { op: "find / union (both optimizations)", time: "O(α(n)) amortized" },
        { op: "find (no optimizations)", time: "O(n) worst" },
        { op: "space", time: "—", space: "O(n)" },
      ],
      code: [
        {
          title: "DSU with path compression and union by size",
          variants: [
            {
              lang: "python",
              code: `
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.size = [1] * n
        self.components = n

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]   # path halving
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False                                   # already connected
        if self.size[ra] < self.size[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        self.components -= 1
        return True
`,
            },
            {
              lang: "javascript",
              code: `
class DSU {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = new Array(n).fill(1);
    this.components = n;
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a, b) {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra] += this.size[rb];
    this.components--;
    return true;
  }
}
`,
            },
            {
              lang: "java",
              code: `
class DSU {
    int[] parent, size;
    int components;
    DSU(int n) {
        parent = new int[n]; size = new int[n]; components = n;
        for (int i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
    }
    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);   // full path compression
        return parent[x];
    }
    boolean union(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (size[ra] < size[rb]) { int t = ra; ra = rb; rb = t; }
        parent[rb] = ra; size[ra] += size[rb]; components--;
        return true;
    }
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Union-Find vs BFS/DFS for counting connected components?",
          a: "For a **static** graph both are O(V + E) and DFS is simpler. Union-Find wins when edges arrive **online** and you must answer connectivity after each addition (number of islands II, accounts merge streaming in), or when you only have an edge list and want to avoid building adjacency lists. DFS wins when you need the actual members or paths of a component.",
          freq: "common",
        },
        {
          q: "What is the inverse Ackermann function and why does it matter here?",
          a: "It's the inverse of an absurdly fast-growing function; α(n) ≤ 4 for any n smaller than the number of atoms in the universe. Tarjan proved that union by rank + path compression gives O(α(n)) amortized per operation, so in practice Union-Find operations are constant time.",
          freq: "occasional",
        },
        {
          q: "Given a graph that started as a tree with one extra edge, find the redundant edge.",
          a: "Process edges in order with Union-Find. The first edge whose endpoints already have the same root would close a cycle — that's the redundant edge (Redundant Connection). O(E α(V)). The directed version (Redundant Connection II) also has to handle a node with two parents.",
          freq: "common",
        },
        {
          q: "How does Kruskal's algorithm use Union-Find?",
          a: "Sort edges by weight. For each edge (u, v), if `find(u) != find(v)`, add it to the MST and `union(u, v)`; otherwise skip it because it would create a cycle. Stop after V − 1 edges. Sorting dominates: O(E log E).",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "With union by rank and path compression, find/union cost…",
          options: ["O(log n)", "O(n)", "O(α(n)) amortized — effectively constant", "O(1) worst case"],
          answer: 2,
          explain: "Tarjan's inverse-Ackermann bound.",
        },
        {
          q: "union(a, b) returns false because a and b already share a root. In an undirected graph this edge…",
          options: ["Is a bridge", "Would create a cycle", "Is the heaviest edge", "Disconnects the graph"],
          answer: 1,
          explain: "There's already a path between a and b.",
        },
        {
          q: "Path compression does what?",
          options: [
            "Merges two trees",
            "Points nodes on the find path directly to the root",
            "Sorts the parent array",
            "Deletes empty sets",
          ],
          answer: 1,
          explain: "Flattening makes later finds almost immediate.",
        },
        {
          q: "Which problem is NOT a natural fit for Union-Find?",
          options: ["Number of provinces", "Accounts merge", "Shortest path between two nodes", "Redundant connection"],
          answer: 2,
          explain: "Union-Find knows *whether* nodes are connected, not the path or its length.",
        },
      ],
      problems: [
        { title: "Number of Provinces", url: lc("number-of-provinces"), difficulty: "Medium" },
        { title: "Redundant Connection", url: lc("redundant-connection"), difficulty: "Medium" },
        { title: "Graph Valid Tree", url: lc("graph-valid-tree"), difficulty: "Medium" },
        { title: "Number of Connected Components in an Undirected Graph", url: lc("number-of-connected-components-in-an-undirected-graph"), difficulty: "Medium" },
        { title: "Accounts Merge", url: lc("accounts-merge"), difficulty: "Medium" },
        { title: "Satisfiability of Equality Equations", url: lc("satisfiability-of-equality-equations"), difficulty: "Medium" },
        { title: "Number of Islands II", url: lc("number-of-islands-ii"), difficulty: "Hard" },
      ],
    },
  ],
};
