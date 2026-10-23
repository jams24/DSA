from common import P, PATTERN

GUIDES = {
    # ------------------------------------------------------------------ Linked List
    "linked-list-cycle": P(
        "Floyd's tortoise and hare: inside a cycle the fast pointer gains one step per move, so it must land on the slow one.",
        ["slow moves 1 step, fast moves 2.", "If fast reaches None, there's no cycle.", "If they meet, there's a cycle."],
        "O(n)", "O(1)",
        "Check fast and fast.next before moving, or you crash at the end of an acyclic list.",
        r'''
class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        slow = fast = head
        while fast and fast.next:
            slow, fast = slow.next, fast.next.next
            if slow is fast:
                return True
        return False
''',
        r'''
h = L([3, 2, 0, -4]); h.next.next.next.next = h.next
assert Solution().hasCycle(h) is True
assert Solution().hasCycle(L([1])) is False
assert Solution().hasCycle(None) is False
''',
    ),
    "add-two-numbers": P(
        "The digits are stored in reverse, so walk both lists from the head like grade-school addition, carrying into the next node.",
        ["Dummy head, carry = 0.", "Sum the digits (missing ones count as 0) + carry. Write sum % 10 and carry sum // 10.", "Continue while either list or the carry remains."],
        "O(max(m, n))", "O(max(m, n)) for the output",
        "Forgetting the final carry (999 + 1). Include carry in the loop condition.",
        r'''
class Solution:
    def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:
        dummy = cur = ListNode()
        carry = 0
        while l1 or l2 or carry:
            s = carry + (l1.val if l1 else 0) + (l2.val if l2 else 0)
            carry, digit = divmod(s, 10)
            cur.next = ListNode(digit)
            cur = cur.next
            l1 = l1.next if l1 else None
            l2 = l2.next if l2 else None
        return dummy.next
''',
        r'''
assert tolist(Solution().addTwoNumbers(L([2, 4, 3]), L([5, 6, 4]))) == [7, 0, 8]
assert tolist(Solution().addTwoNumbers(L([0]), L([0]))) == [0]
assert tolist(Solution().addTwoNumbers(L([9] * 7), L([9] * 4))) == [8, 9, 9, 9, 0, 0, 0, 1]
''',
    ),
    "merge-two-sorted-lists": P(
        "A dummy head removes the 'which node comes first' special case. Attach the smaller node each step, then splice in whatever is left.",
        ["dummy → tail.", "While both lists have nodes, attach the smaller one and advance it.", "Attach the remaining list (it's already sorted)."],
        "O(m + n)", "O(1)",
        "Creating new nodes instead of relinking the existing ones (which wastes memory but still works).",
        r'''
class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        dummy = tail = ListNode()
        while list1 and list2:
            if list1.val <= list2.val:
                tail.next, list1 = list1, list1.next
            else:
                tail.next, list2 = list2, list2.next
            tail = tail.next
        tail.next = list1 or list2
        return dummy.next
''',
        r'''
assert tolist(Solution().mergeTwoLists(L([1, 2, 4]), L([1, 3, 4]))) == [1, 1, 2, 3, 4, 4]
assert tolist(Solution().mergeTwoLists(None, None)) == []
assert tolist(Solution().mergeTwoLists(None, L([0]))) == [0]
''',
    ),
    "copy-list-with-random-pointer": P(
        "Two passes with a map old → new: first create every clone, then wire next and random through the map (None maps to None).",
        ["Pass 1: clone[node] = Node(node.val) for every node.", "Pass 2: clone[node].next = clone[node.next], and the same for random.", "O(1)-space variant: interleave the clones (A→A'→B→B'), set randoms, then split the lists."],
        "O(n)", "O(n) (O(1) extra with interleaving)",
        "Trying to set random pointers in one pass, before the target clone exists.",
        r'''
class Solution:
    def copyRandomList(self, head: "Optional[Node]") -> "Optional[Node]":
        clone = {None: None}
        cur = head
        while cur:
            clone[cur] = Node(cur.val)
            cur = cur.next
        cur = head
        while cur:
            clone[cur].next = clone[cur.next]
            clone[cur].random = clone[cur.random]
            cur = cur.next
        return clone[head]
''',
        r'''
class Node:
    def __init__(self, x, next=None, random=None):
        self.val, self.next, self.random = int(x), next, random

nodes = [Node(v) for v in [7, 13, 11, 10, 1]]
for a, b in zip(nodes, nodes[1:]):
    a.next = b
for node, r in zip(nodes, [None, 0, 4, 2, 0]):
    node.random = None if r is None else nodes[r]
copy = Solution().copyRandomList(nodes[0])
copies = []
while copy:
    assert copy not in nodes
    copies.append(copy)
    copy = copy.next
assert [c.val for c in copies] == [7, 13, 11, 10, 1]
assert [None if c.random is None else copies.index(c.random) for c in copies] == [None, 0, 4, 2, 0]
''',
    ),
    "reverse-linked-list-ii": P(
        "Stop at the node before the range, then repeatedly move the node after 'cur' to the front of the range (head insertion), right − left times.",
        ["Dummy head. Walk prev to position left − 1.", "cur = prev.next stays put and slides toward the end of the range.", "Repeat right − left times: take nxt = cur.next and splice it right after prev."],
        "O(n)", "O(1)",
        "Without a dummy head, left = 1 needs a special case.",
        r'''
class Solution:
    def reverseBetween(self, head: Optional[ListNode], left: int, right: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        prev = dummy
        for _ in range(left - 1):
            prev = prev.next
        cur = prev.next
        for _ in range(right - left):
            nxt = cur.next
            cur.next = nxt.next
            nxt.next = prev.next
            prev.next = nxt
        return dummy.next
''',
        r'''
assert tolist(Solution().reverseBetween(L([1, 2, 3, 4, 5]), 2, 4)) == [1, 4, 3, 2, 5]
assert tolist(Solution().reverseBetween(L([5]), 1, 1)) == [5]
assert tolist(Solution().reverseBetween(L([3, 5]), 1, 2)) == [5, 3]
''',
    ),
    "reverse-nodes-in-k-group": P(
        "Check that k nodes remain, reverse exactly that block in place (pointing its new tail at the next group), reconnect, and move on to the next block.",
        ["group_prev = the node before the block. Find the k-th node, and stop if there are fewer than k.", "Reverse the block with prev initialized to the node after it.", "Link group_prev to the new head, and advance group_prev to the old head (now the tail)."],
        "O(n)", "O(1)",
        "Reversing a final partial group. It must be left as is.",
        r'''
class Solution:
    def reverseKGroup(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        group_prev = dummy
        while True:
            kth = group_prev
            for _ in range(k):
                kth = kth.next
                if not kth:
                    return dummy.next
            group_next = kth.next
            prev, cur = group_next, group_prev.next
            while cur is not group_next:
                cur.next, prev, cur = prev, cur, cur.next
            first = group_prev.next
            group_prev.next = kth
            group_prev = first
''',
        r'''
assert tolist(Solution().reverseKGroup(L([1, 2, 3, 4, 5]), 2)) == [2, 1, 4, 3, 5]
assert tolist(Solution().reverseKGroup(L([1, 2, 3, 4, 5]), 3)) == [3, 2, 1, 4, 5]
assert tolist(Solution().reverseKGroup(L([1]), 1)) == [1]
''',
    ),
    "remove-nth-node-from-end-of-list": P(
        "Give the fast pointer an n+1 head start from a dummy node. When it falls off the end, slow sits just before the node to delete.",
        ["Both pointers start at a dummy before head.", "Advance fast n + 1 steps.", "Move both until fast is None, then unlink slow.next."],
        "O(n), one pass", "O(1)",
        "Removing the head itself, which the dummy node makes a non-special case.",
        r'''
class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        fast = slow = dummy
        for _ in range(n + 1):
            fast = fast.next
        while fast:
            fast, slow = fast.next, slow.next
        slow.next = slow.next.next
        return dummy.next
''',
        r'''
assert tolist(Solution().removeNthFromEnd(L([1, 2, 3, 4, 5]), 2)) == [1, 2, 3, 5]
assert tolist(Solution().removeNthFromEnd(L([1]), 1)) == []
assert tolist(Solution().removeNthFromEnd(L([1, 2]), 1)) == [1]
''',
    ),
    "remove-duplicates-from-sorted-list-ii": P(
        "Keep 'prev' at the last node known to be unique. When a run of duplicates starts, skip the whole run and link prev past it.",
        ["Dummy head, prev = dummy.", "If head starts a run of duplicates, advance to the run's end and set prev.next = node after the run.", "Otherwise advance prev normally."],
        "O(n)", "O(1)",
        "Keeping one copy of each duplicate. This version removes them all.",
        r'''
class Solution:
    def deleteDuplicates(self, head: Optional[ListNode]) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        prev = dummy
        while head:
            if head.next and head.val == head.next.val:
                while head.next and head.val == head.next.val:
                    head = head.next
                prev.next = head.next
            else:
                prev = prev.next
            head = head.next
        return dummy.next
''',
        r'''
assert tolist(Solution().deleteDuplicates(L([1, 2, 3, 3, 4, 4, 5]))) == [1, 2, 5]
assert tolist(Solution().deleteDuplicates(L([1, 1, 1, 2, 3]))) == [2, 3]
''',
    ),
    "rotate-list": P(
        "Close the list into a ring, then cut it n − k nodes from the old head. k %= n handles huge k.",
        ["Find the length n and the tail.", "k %= n. If it's 0, return head.", "Link tail → head, walk n − k − 1 steps to the new tail, and cut."],
        "O(n)", "O(1)",
        "k can be far larger than n. Without k %= n you walk around the ring for nothing.",
        r'''
class Solution:
    def rotateRight(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:
        if not head:
            return head
        n, tail = 1, head
        while tail.next:
            tail = tail.next
            n += 1
        k %= n
        if k == 0:
            return head
        tail.next = head
        new_tail = head
        for _ in range(n - k - 1):
            new_tail = new_tail.next
        new_head = new_tail.next
        new_tail.next = None
        return new_head
''',
        r'''
assert tolist(Solution().rotateRight(L([1, 2, 3, 4, 5]), 2)) == [4, 5, 1, 2, 3]
assert tolist(Solution().rotateRight(L([0, 1, 2]), 4)) == [2, 0, 1]
assert tolist(Solution().rotateRight(None, 0)) == []
''',
    ),
    "partition-list": P(
        "Build two lists (less than x, and the rest) behind dummy heads, preserving order, then join them.",
        ["Two dummy heads: before and after.", "Append each node to one of them.", "Terminate the 'after' list, then link before's tail to after's head."],
        "O(n)", "O(1)",
        "Not terminating the 'after' list leaves a stale next pointer and creates a cycle.",
        r'''
class Solution:
    def partition(self, head: Optional[ListNode], x: int) -> Optional[ListNode]:
        before = b = ListNode()
        after = a = ListNode()
        while head:
            if head.val < x:
                b.next = head
                b = b.next
            else:
                a.next = head
                a = a.next
            head = head.next
        a.next = None
        b.next = after.next
        return before.next
''',
        r'''
assert tolist(Solution().partition(L([1, 4, 3, 2, 5, 2]), 3)) == [1, 2, 2, 4, 3, 5]
assert tolist(Solution().partition(L([2, 1]), 2)) == [1, 2]
''',
    ),
    "lru-cache": P(
        "A hash map gives O(1) lookup and a doubly linked list gives O(1) reordering: most recent at the head, evict from the tail. Store the key in each node so eviction can delete it from the map.",
        ["map: key → node. The list has sentinel head and tail nodes.", "get: move the node to the front and return its value.", "put: replace or insert at the front. If over capacity, remove tail.prev and delete its key."],
        "O(1) per operation", "O(capacity)",
        "Forgetting to store the key in the node (you can't delete the evicted entry from the map). In Python, OrderedDict with move_to_end is the short answer, but interviewers usually want the real structure.",
        r'''
class LRUCache:
    class _Node:
        __slots__ = ("key", "val", "prev", "next")

        def __init__(self, key=0, val=0):
            self.key, self.val, self.prev, self.next = key, val, None, None

    def __init__(self, capacity: int):
        self.cap = capacity
        self.map = {}
        self.head, self.tail = self._Node(), self._Node()
        self.head.next, self.tail.prev = self.tail, self.head

    def _remove(self, node):
        node.prev.next, node.next.prev = node.next, node.prev

    def _add_front(self, node):
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.map:
            return -1
        node = self.map[key]
        self._remove(node)
        self._add_front(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if key in self.map:
            self._remove(self.map[key])
        node = self._Node(key, value)
        self.map[key] = node
        self._add_front(node)
        if len(self.map) > self.cap:
            lru = self.tail.prev
            self._remove(lru)
            del self.map[lru.key]
''',
        r'''
c = LRUCache(2); c.put(1, 1); c.put(2, 2)
assert c.get(1) == 1
c.put(3, 3)
assert c.get(2) == -1
c.put(4, 4)
assert c.get(1) == -1 and c.get(3) == 3 and c.get(4) == 4
''',
    ),
    # ------------------------------------------------------------------ Binary Tree General
    "maximum-depth-of-binary-tree": P(
        "The depth of a tree is 1 + the deeper of its two subtrees. An empty tree has depth 0.",
        ["Base case: None → 0.", "Return 1 + max(depth(left), depth(right)).", "BFS counting levels works too."],
        "O(n)", "O(h)",
        "Returning 1 for None makes every answer one too big.",
        r'''
class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if not root:
            return 0
        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))
''',
        r'''
assert Solution().maxDepth(T([3, 9, 20, None, None, 15, 7])) == 3
assert Solution().maxDepth(T([1, None, 2])) == 2
assert Solution().maxDepth(None) == 0
''',
    ),
    "same-tree": P(
        "Two trees are equal if the roots match and the left-left and right-right subtrees are equal. Two Nones are equal, but one None isn't.",
        ["If either is None, they're equal only if both are.", "Compare the values.", "Recurse on the left pair and the right pair."],
        "O(n)", "O(h)",
        "Comparing only the values in traversal order. Different shapes can share a traversal.",
        r'''
class Solution:
    def isSameTree(self, p: Optional[TreeNode], q: Optional[TreeNode]) -> bool:
        if not p or not q:
            return p is q
        return p.val == q.val and self.isSameTree(p.left, q.left) and self.isSameTree(p.right, q.right)
''',
        r'''
assert Solution().isSameTree(T([1, 2, 3]), T([1, 2, 3])) is True
assert Solution().isSameTree(T([1, 2]), T([1, None, 2])) is False
assert Solution().isSameTree(T([1, 2, 1]), T([1, 1, 2])) is False
''',
    ),
    "invert-binary-tree": P(
        "Swap the children at every node. Recursion (or BFS) visits each node once.",
        ["Base case: None.", "Swap left and right, inverting each one recursively.", "Return the root."],
        "O(n)", "O(h)",
        "Swapping, then recursing into the already-swapped child twice. Use the tuple swap as shown.",
        r'''
class Solution:
    def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
        if root:
            root.left, root.right = self.invertTree(root.right), self.invertTree(root.left)
        return root
''',
        r'''
assert levels(Solution().invertTree(T([4, 2, 7, 1, 3, 6, 9]))) == [4, 7, 2, 9, 6, 3, 1]
assert levels(Solution().invertTree(T([2, 1, 3]))) == [2, 3, 1]
assert Solution().invertTree(None) is None
''',
    ),
    "symmetric-tree": P(
        "A tree is symmetric if its left and right subtrees are mirror images: compare the outer pair (left.left, right.right) and the inner pair (left.right, right.left).",
        ["mirror(a, b): both None → True, and one None → False.", "Values must match.", "Recurse: mirror(a.left, b.right) and mirror(a.right, b.left)."],
        "O(n)", "O(h)",
        "Comparing left.left with right.left (same side), which checks equality instead of mirroring.",
        r'''
class Solution:
    def isSymmetric(self, root: Optional[TreeNode]) -> bool:
        def mirror(a, b):
            if not a or not b:
                return a is b
            return a.val == b.val and mirror(a.left, b.right) and mirror(a.right, b.left)

        return mirror(root.left, root.right)
''',
        r'''
assert Solution().isSymmetric(T([1, 2, 2, 3, 4, 4, 3])) is True
assert Solution().isSymmetric(T([1, 2, 2, None, 3, None, 3])) is False
''',
    ),
    "construct-binary-tree-from-preorder-and-inorder-traversal": P(
        "Preorder's next value is always the current root. Its position in inorder splits the remaining values into the left and right subtrees, and a value → index map makes each split O(1).",
        ["Map each inorder value to its index.", "build(lo, hi): take the next preorder value as the root, find its index mid.", "Build the left from (lo, mid−1), then the right from (mid+1, hi). Order matters: preorder is root, left, right."],
        "O(n)", "O(n)",
        "Slicing the arrays in every call makes it O(n²). Pass index bounds instead.",
        r'''
class Solution:
    def buildTree(self, preorder: List[int], inorder: List[int]) -> Optional[TreeNode]:
        index = {v: i for i, v in enumerate(inorder)}
        roots = iter(preorder)

        def build(lo, hi):
            if lo > hi:
                return None
            val = next(roots)
            node = TreeNode(val)
            mid = index[val]
            node.left = build(lo, mid - 1)
            node.right = build(mid + 1, hi)
            return node

        return build(0, len(inorder) - 1)
''',
        r'''
assert levels(Solution().buildTree([3, 9, 20, 15, 7], [9, 3, 15, 20, 7])) == [3, 9, 20, None, None, 15, 7]
assert levels(Solution().buildTree([-1], [-1])) == [-1]
''',
    ),
    "construct-binary-tree-from-inorder-and-postorder-traversal": P(
        "Postorder read backwards is root, right, left. So pop the roots from the end, and build the right subtree first.",
        ["Map each inorder value to its index.", "build(lo, hi): pop the last postorder value as the root.", "Build the right subtree (mid+1, hi) before the left subtree (lo, mid−1)."],
        "O(n)", "O(n)",
        "Building the left subtree first consumes the wrong values from the end of postorder.",
        r'''
class Solution:
    def buildTree(self, inorder: List[int], postorder: List[int]) -> Optional[TreeNode]:
        index = {v: i for i, v in enumerate(inorder)}

        def build(lo, hi):
            if lo > hi:
                return None
            val = postorder.pop()
            node = TreeNode(val)
            mid = index[val]
            node.right = build(mid + 1, hi)
            node.left = build(lo, mid - 1)
            return node

        return build(0, len(inorder) - 1)
''',
        r'''
assert levels(Solution().buildTree([9, 3, 15, 20, 7], [9, 15, 7, 20, 3])) == [3, 9, 20, None, None, 15, 7]
assert levels(Solution().buildTree([-1], [-1])) == [-1]
''',
    ),
    "populating-next-right-pointers-in-each-node-ii": P(
        "Use the level you've already linked as a linked list to walk across it, while building the next level's links behind a dummy head. That's O(1) extra space.",
        ["level = root.", "Walk the level via next pointers, appending each child to a tail pointer that starts at a dummy.", "Move to dummy.next (the first node of the next level) and repeat."],
        "O(n)", "O(1)",
        "A BFS queue is simpler but uses O(width) memory. The follow-up asks for constant space.",
        r'''
class Solution:
    def connect(self, root: "Node") -> "Node":
        level = root
        while level:
            dummy = tail = Node(0)
            cur = level
            while cur:
                for child in (cur.left, cur.right):
                    if child:
                        tail.next = child
                        tail = child
                cur = cur.next
            level = dummy.next
        return root
''',
        r'''
class Node:
    def __init__(self, val=0, left=None, right=None, next=None):
        self.val, self.left, self.right, self.next = val, left, right, next

n4, n5, n7 = Node(4), Node(5), Node(7)
n2, n3 = Node(2, n4, n5), Node(3, None, n7)
root = Solution().connect(Node(1, n2, n3))
assert root.next is None and n2.next is n3 and n3.next is None
assert n4.next is n5 and n5.next is n7 and n7.next is None
''',
    ),
    "flatten-binary-tree-to-linked-list": P(
        "Morris-style rewiring: for each node with a left subtree, attach its right subtree to the rightmost node of the left subtree, then move the left subtree over to the right.",
        ["cur = root.", "If cur.left exists, find its rightmost node pre, then set pre.right = cur.right, cur.right = cur.left, cur.left = None.", "Move cur = cur.right."],
        "O(n)", "O(1)",
        "Forgetting cur.left = None leaves a tree, not a list. The recursive alternative uses O(h) stack space.",
        r'''
class Solution:
    def flatten(self, root: Optional[TreeNode]) -> None:
        cur = root
        while cur:
            if cur.left:
                pre = cur.left
                while pre.right:
                    pre = pre.right
                pre.right = cur.right
                cur.right = cur.left
                cur.left = None
            cur = cur.right
''',
        r'''
r = T([1, 2, 5, 3, 4, None, 6]); Solution().flatten(r)
vals = []
while r:
    assert r.left is None
    vals.append(r.val)
    r = r.right
assert vals == [1, 2, 3, 4, 5, 6]
''',
    ),
    "path-sum": P(
        "Subtract each node's value on the way down. At a leaf, check whether what's left equals the leaf's value.",
        ["An empty tree has no path.", "At a leaf, return target == leaf.val.", "Otherwise recurse into the children with target − node.val."],
        "O(n)", "O(h)",
        "Checking at None instead of at leaves accepts paths that stop at an internal node.",
        r'''
class Solution:
    def hasPathSum(self, root: Optional[TreeNode], targetSum: int) -> bool:
        if not root:
            return False
        if not root.left and not root.right:
            return targetSum == root.val
        rest = targetSum - root.val
        return self.hasPathSum(root.left, rest) or self.hasPathSum(root.right, rest)
''',
        r'''
assert Solution().hasPathSum(T([5, 4, 8, 11, None, 13, 4, 7, 2, None, None, None, 1]), 22) is True
assert Solution().hasPathSum(T([1, 2, 3]), 5) is False
assert Solution().hasPathSum(None, 0) is False
''',
    ),
    "sum-root-to-leaf-numbers": P(
        "Carry the number formed so far down the path (num·10 + val), and add it up at the leaves.",
        ["dfs(node, num): num = num·10 + node.val.", "At a leaf, return num.", "Otherwise return dfs(left) + dfs(right)."],
        "O(n)", "O(h)",
        "Adding at internal nodes, or counting a missing child as a leaf.",
        r'''
class Solution:
    def sumNumbers(self, root: Optional[TreeNode]) -> int:
        def dfs(node, num):
            if not node:
                return 0
            num = num * 10 + node.val
            if not node.left and not node.right:
                return num
            return dfs(node.left, num) + dfs(node.right, num)

        return dfs(root, 0)
''',
        r'''
assert Solution().sumNumbers(T([1, 2, 3])) == 25
assert Solution().sumNumbers(T([4, 9, 0, 5, 1])) == 1026
''',
    ),
    "binary-tree-maximum-path-sum": P(
        "Each node returns its best single downward branch (a path can only extend one side upward). The global answer considers the path that bends through the node: left + node + right. Negative branches are dropped with max(…, 0).",
        ["gain(node) = node.val + max(left gain, right gain, 0).", "At every node, update best with node.val + max(left gain, 0) + max(right gain, 0).", "Return best (it starts at −∞, since all values can be negative)."],
        "O(n)", "O(h)",
        "Returning the bent path upward (it isn't a valid path for the parent), and initializing best to 0 when every value is negative.",
        r'''
class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        best = float("-inf")

        def gain(node):
            nonlocal best
            if not node:
                return 0
            left = max(gain(node.left), 0)
            right = max(gain(node.right), 0)
            best = max(best, node.val + left + right)
            return node.val + max(left, right)

        gain(root)
        return best
''',
        r'''
assert Solution().maxPathSum(T([1, 2, 3])) == 6
assert Solution().maxPathSum(T([-10, 9, 20, None, None, 15, 7])) == 42
assert Solution().maxPathSum(T([-3])) == -3
''',
    ),
    "binary-search-tree-iterator": P(
        "This is a paused inorder traversal. The stack holds the left spine, and next() pops the smallest node and pushes the left spine of its right child. Amortized O(1) time, O(h) memory.",
        ["Constructor: push root and all its left descendants.", "next(): pop, push the left spine of node.right, return node.val.", "hasNext(): the stack isn't empty."],
        "O(1) amortized", "O(h)",
        "Flattening the whole tree into a list up front works, but uses O(n) memory instead of O(h).",
        r'''
class BSTIterator:
    def __init__(self, root: Optional[TreeNode]):
        self.stack = []
        self._push_left(root)

    def _push_left(self, node):
        while node:
            self.stack.append(node)
            node = node.left

    def next(self) -> int:
        node = self.stack.pop()
        self._push_left(node.right)
        return node.val

    def hasNext(self) -> bool:
        return bool(self.stack)
''',
        r'''
it = BSTIterator(T([7, 3, 15, None, None, 9, 20]))
out = []
while it.hasNext():
    out.append(it.next())
assert out == [3, 7, 9, 15, 20]
''',
    ),
    "count-complete-tree-nodes": P(
        "If the leftmost and rightmost depths match, the subtree is perfect and has 2^h − 1 nodes, with no need to visit them. Otherwise recurse. One side is always perfect, which gives O(log² n).",
        ["Measure the left-spine height and the right-spine height.", "Equal → return 2^h − 1.", "Otherwise return 1 + count(left) + count(right)."],
        "O(log² n)", "O(log n)",
        "A plain traversal is O(n) and ignores the 'complete' property the problem hands you.",
        r'''
class Solution:
    def countNodes(self, root: Optional[TreeNode]) -> int:
        if not root:
            return 0
        lh, rh, l, r = 0, 0, root, root
        while l:
            lh, l = lh + 1, l.left
        while r:
            rh, r = rh + 1, r.right
        if lh == rh:
            return (1 << lh) - 1
        return 1 + self.countNodes(root.left) + self.countNodes(root.right)
''',
        r'''
assert Solution().countNodes(T([1, 2, 3, 4, 5, 6])) == 6
assert Solution().countNodes(None) == 0
assert Solution().countNodes(T(list(range(1, 16)))) == 15
assert Solution().countNodes(T(list(range(1, 11)))) == 10
''',
    ),
    "lowest-common-ancestor-of-a-binary-tree": P(
        "Return p or q when you find them. A node that gets non-null results from both subtrees is where the two paths split: the LCA.",
        ["If the node is None, p or q, return it.", "Recurse left and right.", "Both non-null → this node is the LCA. Otherwise pass up whichever side is non-null."],
        "O(n)", "O(h)",
        "This relies on p and q both existing in the tree. If either might be missing, you need an extra check.",
        r'''
class Solution:
    def lowestCommonAncestor(self, root: "TreeNode", p: "TreeNode", q: "TreeNode") -> "TreeNode":
        if not root or root is p or root is q:
            return root
        left = self.lowestCommonAncestor(root.left, p, q)
        right = self.lowestCommonAncestor(root.right, p, q)
        return root if left and right else left or right
''',
        r'''
r = T([3, 5, 1, 6, 2, 0, 8, None, None, 7, 4])
assert Solution().lowestCommonAncestor(r, find(r, 5), find(r, 1)).val == 3
assert Solution().lowestCommonAncestor(r, find(r, 5), find(r, 4)).val == 5
''',
    ),
    # ------------------------------------------------------------------ Binary Tree BFS
    "binary-tree-right-side-view": P(
        "Do a level-order traversal. The last node of each level is what you see from the right.",
        ["BFS with a queue.", "Before processing a level, record the value of q[-1].", "Process exactly len(q) nodes, enqueueing their children."],
        "O(n)", "O(width)",
        "Taking only right children misses levels where the visible node is a left child.",
        r'''
class Solution:
    def rightSideView(self, root: Optional[TreeNode]) -> List[int]:
        res, q = [], deque([root] if root else [])
        while q:
            res.append(q[-1].val)
            for _ in range(len(q)):
                node = q.popleft()
                if node.left:
                    q.append(node.left)
                if node.right:
                    q.append(node.right)
        return res
''',
        r'''
assert Solution().rightSideView(T([1, 2, 3, None, 5, None, 4])) == [1, 3, 4]
assert Solution().rightSideView(T([1, 2, 3, 4, None, None, None, 5])) == [1, 3, 4, 5]
assert Solution().rightSideView(None) == []
''',
    ),
    "average-of-levels-in-binary-tree": P(
        "BFS one level at a time (process exactly len(queue) nodes) and average each level.",
        ["Queue with the root.", "For each level, sum its len(q) nodes and enqueue their children.", "Append sum / count."],
        "O(n)", "O(width)",
        "Integer division in languages without true division. Also, sums can overflow in fixed-width integer languages.",
        r'''
class Solution:
    def averageOfLevels(self, root: Optional[TreeNode]) -> List[float]:
        res, q = [], deque([root])
        while q:
            n, total = len(q), 0
            for _ in range(n):
                node = q.popleft()
                total += node.val
                if node.left:
                    q.append(node.left)
                if node.right:
                    q.append(node.right)
            res.append(total / n)
        return res
''',
        r'''
assert Solution().averageOfLevels(T([3, 9, 20, None, None, 15, 7])) == [3.0, 14.5, 11.0]
''',
    ),
    "binary-tree-level-order-traversal": P(
        "Snapshot the queue length at the start of each level. That many pops belong to the current level.",
        ["Queue with the root.", "n = len(q). Pop n nodes into a level list, enqueueing their children.", "Append the level."],
        "O(n)", "O(width)",
        "Using list.pop(0), which is O(n) per pop. Use collections.deque.",
        r'''
class Solution:
    def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        res, q = [], deque([root] if root else [])
        while q:
            level = []
            for _ in range(len(q)):
                node = q.popleft()
                level.append(node.val)
                if node.left:
                    q.append(node.left)
                if node.right:
                    q.append(node.right)
            res.append(level)
        return res
''',
        r'''
assert Solution().levelOrder(T([3, 9, 20, None, None, 15, 7])) == [[3], [9, 20], [15, 7]]
assert Solution().levelOrder(None) == []
''',
    ),
    "binary-tree-zigzag-level-order-traversal": P(
        "Do a normal level-order traversal and reverse every other level (or appendleft into a deque).",
        ["Same as level order.", "Flip a left-to-right flag after each level.", "Reverse the level's values when the flag is false."],
        "O(n)", "O(width)",
        "Changing the order children are enqueued corrupts the next level. Only reverse the output.",
        r'''
class Solution:
    def zigzagLevelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        res, q, left_to_right = [], deque([root] if root else []), True
        while q:
            level = []
            for _ in range(len(q)):
                node = q.popleft()
                level.append(node.val)
                if node.left:
                    q.append(node.left)
                if node.right:
                    q.append(node.right)
            res.append(level if left_to_right else level[::-1])
            left_to_right = not left_to_right
        return res
''',
        r'''
assert Solution().zigzagLevelOrder(T([3, 9, 20, None, None, 15, 7])) == [[3], [20, 9], [15, 7]]
assert Solution().zigzagLevelOrder(T([1, 2, 3, 4, None, None, 5])) == [[1], [3, 2], [4, 5]]
''',
    ),
    # ------------------------------------------------------------------ Binary Search Tree
    "minimum-absolute-difference-in-bst": P(
        "An inorder traversal of a BST is sorted, so the minimum difference is between consecutive inorder values.",
        ["Iterative inorder traversal.", "Compare each value with the previous one.", "Keep the smallest gap."],
        "O(n)", "O(h)",
        "Comparing only parent and child misses neighbours that are far apart in the tree but adjacent in sorted order.",
        r'''
class Solution:
    def getMinimumDifference(self, root: Optional[TreeNode]) -> int:
        prev, best = None, float("inf")
        stack, node = [], root
        while stack or node:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            if prev is not None:
                best = min(best, node.val - prev)
            prev = node.val
            node = node.right
        return best
''',
        r'''
assert Solution().getMinimumDifference(T([4, 2, 6, 1, 3])) == 1
assert Solution().getMinimumDifference(T([1, 0, 48, None, None, 12, 49])) == 1
''',
    ),
    "kth-smallest-element-in-a-bst": P(
        "Iterative inorder visits values in sorted order. Stop at the k-th pop: O(h + k) instead of visiting everything.",
        ["Push the left spine.", "Pop, decrement k. If k is 0, return the value.", "Move to the right child and repeat."],
        "O(h + k)", "O(h)",
        "The follow-up (frequent updates) wants each node to store its subtree size, so you can descend directly.",
        r'''
class Solution:
    def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:
        stack, node = [], root
        while True:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            k -= 1
            if k == 0:
                return node.val
            node = node.right
''',
        r'''
assert Solution().kthSmallest(T([3, 1, 4, None, 2]), 1) == 1
assert Solution().kthSmallest(T([5, 3, 6, 2, 4, None, None, 1]), 3) == 3
''',
    ),
    "validate-binary-search-tree": P(
        "Every node must lie in an open range inherited from all its ancestors, not just its parent. Pass (low, high) bounds down the recursion.",
        ["ok(node, lo, hi): None is valid.", "Require lo < node.val < hi.", "Left child gets (lo, node.val), right child gets (node.val, hi)."],
        "O(n)", "O(h)",
        "Comparing only with direct children misses deeper violations ([5,4,6,null,null,3,7]). Duplicates are invalid, so the bounds are strict.",
        r'''
class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        def ok(node, lo, hi):
            if not node:
                return True
            if not lo < node.val < hi:
                return False
            return ok(node.left, lo, node.val) and ok(node.right, node.val, hi)

        return ok(root, float("-inf"), float("inf"))
''',
        r'''
assert Solution().isValidBST(T([2, 1, 3])) is True
assert Solution().isValidBST(T([5, 1, 4, None, None, 3, 6])) is False
assert Solution().isValidBST(T([5, 4, 6, None, None, 3, 7])) is False
assert Solution().isValidBST(T([2, 2, 2])) is False
''',
    ),
}

PATTERNS = {
    "Linked List": PATTERN(
        [
            "Pointer surgery: reverse, reorder, merge, split.",
            "Cycle detection, or finding the middle.",
            "The k-th node from the end.",
            "O(1) insert/delete given a node (LRU cache).",
        ],
        [
            "A dummy head removes the special case for the first node.",
            "Fast/slow pointers: middle, cycle detection, k-th from the end.",
            "Reverse with three variables (prev, cur, next), and draw it on paper.",
            "Save next before rewiring, and terminate any list you split to avoid cycles.",
        ],
        r'''
def reverse(head):
    prev, cur = None, head
    while cur:
        nxt = cur.next      # 1. save
        cur.next = prev     # 2. rewire
        prev, cur = cur, nxt
    return prev

def middle(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
    return slow

def build(values):
    dummy = tail = ListNode()
    for v in values:
        tail.next = ListNode(v)
        tail = tail.next
    return dummy.next
''',
    ),
    "Binary Tree General": PATTERN(
        [
            "Anything about a tree's structure, its paths or its subtrees.",
            "Building or serializing a tree from traversals.",
            "Ancestors, and root-to-leaf paths.",
        ],
        [
            "Ask what each node needs from its children (post-order return values) and what it needs from its parent (pre-order parameters).",
            "Return one thing upward and track the global answer separately (max path sum, diameter).",
            "The base case (None) returns a neutral value.",
            "Recursion depth = tree height, so mention iterative versions for very skewed trees.",
        ],
        r'''
def solve(root):
    best = 0

    def dfs(node, depth):              # pre-order info flows down as parameters
        nonlocal best
        if not node:
            return 0                   # neutral value for an empty subtree
        left = dfs(node.left, depth + 1)
        right = dfs(node.right, depth + 1)
        best = max(best, left + right) # an answer that "bends" through this node
        return 1 + max(left, right)    # post-order info flows up as the return value

    dfs(root, 0)
    return best
''',
    ),
    "Binary Tree BFS": PATTERN(
        [
            "Level by level: per-level aggregates, side views, zigzag order.",
            "The shortest distance in an unweighted tree or graph.",
            "Minimum depth (BFS stops at the first leaf).",
        ],
        [
            "Snapshot len(queue) to process exactly one level per outer loop.",
            "deque.popleft() is O(1), while list.pop(0) is O(n).",
            "Right view = last node per level. Left view = first.",
            "BFS uses O(width) memory, DFS uses O(height).",
        ],
        r'''
from collections import deque

def level_order(root):
    if not root:
        return []
    res, q = [], deque([root])
    while q:
        level = []
        for _ in range(len(q)):          # exactly the nodes of this level
            node = q.popleft()
            level.append(node.val)
            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)
        res.append(level)
    return res
''',
    ),
    "Binary Search Tree": PATTERN(
        [
            "A binary search tree plus sorted order, the k-th element or a range.",
            "Validation, or search in O(h).",
        ],
        [
            "Inorder traversal of a BST yields sorted values, and most BST problems reduce to that.",
            "Validate with (low, high) bounds, not parent comparisons.",
            "Search and insert walk one path: O(h), which is O(log n) only when the tree is balanced.",
            "An iterative inorder with a stack lets you stop early (k-th smallest, iterators).",
        ],
        r'''
def inorder(root):
    stack, node = [], root
    while stack or node:
        while node:                      # go as far left as possible
            stack.append(node)
            node = node.left
        node = stack.pop()
        yield node.val                   # values come out sorted
        node = node.right

def is_bst(node, lo=float("-inf"), hi=float("inf")):
    if not node:
        return True
    return lo < node.val < hi and is_bst(node.left, lo, node.val) and is_bst(node.right, node.val, hi)
''',
    ),
}
