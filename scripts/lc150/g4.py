from common import P, PATTERN

GUIDES = {
    # ------------------------------------------------------------------ Graph General
    "number-of-islands": P(
        "Each time you find unvisited land, you've found a new island: count it and flood-fill (sink) the whole island so it's never counted again.",
        ["Scan every cell.", "On a '1', increment the count and DFS/BFS through all connected '1's, marking them '0'.", "Return the count."],
        "O(m·n)", "O(m·n) worst case for the stack",
        "Recursive DFS can overflow the call stack on a large all-land grid, so use an explicit stack. Mark cells when pushing them, not when popping.",
        r'''
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        m, n = len(grid), len(grid[0])
        count = 0
        for r in range(m):
            for c in range(n):
                if grid[r][c] != "1":
                    continue
                count += 1
                grid[r][c] = "0"
                stack = [(r, c)]
                while stack:
                    i, j = stack.pop()
                    for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                        if 0 <= a < m and 0 <= b < n and grid[a][b] == "1":
                            grid[a][b] = "0"
                            stack.append((a, b))
        return count
''',
        r'''
g = [list("11110"), list("11010"), list("11000"), list("00000")]
assert Solution().numIslands(g) == 1
g = [list("11000"), list("11000"), list("00100"), list("00011")]
assert Solution().numIslands(g) == 3
''',
    ),
    "surrounded-regions": P(
        "Think in reverse: an 'O' survives only if it connects to the border. Flood-fill from the border 'O's to mark the survivors, then flip everything else.",
        ["Start a DFS from every border cell, marking connected 'O's as 'S' (safe).", "Sweep the board: 'S' → 'O', everything else → 'X'."],
        "O(m·n)", "O(m·n)",
        "Searching from each interior region and asking 'does it touch the border?' repeats work and is easy to get wrong.",
        r'''
class Solution:
    def solve(self, board: List[List[str]]) -> None:
        m, n = len(board), len(board[0])
        stack = [(r, c) for r in range(m) for c in (0, n - 1)] + [(r, c) for r in (0, m - 1) for c in range(n)]
        while stack:
            r, c = stack.pop()
            if 0 <= r < m and 0 <= c < n and board[r][c] == "O":
                board[r][c] = "S"
                stack += [(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)]
        for r in range(m):
            for c in range(n):
                board[r][c] = "O" if board[r][c] == "S" else "X"
''',
        r'''
b = [list("XXXX"), list("XOOX"), list("XXOX"), list("XOXX")]; Solution().solve(b)
assert b == [list("XXXX"), list("XXXX"), list("XXXX"), list("XOXX")]
b = [["X"]]; Solution().solve(b); assert b == [["X"]]
''',
    ),
    "clone-graph": P(
        "Graph traversal plus a map original → clone. The map doubles as the visited set and handles cycles.",
        ["clones = {start: Node(start.val)}, then BFS from start.", "For each neighbour, create its clone the first time you see it and enqueue it.", "Append the neighbour's clone to the current clone's neighbors."],
        "O(V + E)", "O(V)",
        "Without the map, cycles make the copy loop forever, and shared neighbours get duplicated.",
        r'''
class Solution:
    def cloneGraph(self, node: Optional["Node"]) -> Optional["Node"]:
        if not node:
            return None
        clones = {node: Node(node.val)}
        q = deque([node])
        while q:
            cur = q.popleft()
            for nb in cur.neighbors:
                if nb not in clones:
                    clones[nb] = Node(nb.val)
                    q.append(nb)
                clones[cur].neighbors.append(clones[nb])
        return clones[node]
''',
        r'''
class Node:
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []

nodes = {i: Node(i) for i in range(1, 5)}
for i, nbs in {1: [2, 4], 2: [1, 3], 3: [2, 4], 4: [1, 3]}.items():
    nodes[i].neighbors = [nodes[j] for j in nbs]
copy = Solution().cloneGraph(nodes[1])
seen, q, adj = {copy}, deque([copy]), {}
while q:
    cur = q.popleft()
    assert cur not in nodes.values()
    adj[cur.val] = sorted(nb.val for nb in cur.neighbors)
    for nb in cur.neighbors:
        if nb not in seen:
            seen.add(nb)
            q.append(nb)
assert adj == {1: [2, 4], 2: [1, 3], 3: [2, 4], 4: [1, 3]}
''',
    ),
    "evaluate-division": P(
        "Model a / b = k as weighted edges a→b (k) and b→a (1/k). Each query is a path search that multiplies the edge weights along the way.",
        ["Build an adjacency map with both directions.", "For each query, BFS/DFS from the numerator, carrying the product.", "Unknown variables or no path → −1.0. (Weighted union-find answers queries in near O(1).)"],
        "O(Q · (V + E))", "O(V + E)",
        "x / x for an unknown x is −1.0, not 1.0. The variable has to appear in the equations.",
        r'''
class Solution:
    def calcEquation(self, equations: List[List[str]], values: List[float], queries: List[List[str]]) -> List[float]:
        graph = defaultdict(dict)
        for (a, b), v in zip(equations, values):
            graph[a][b] = v
            graph[b][a] = 1 / v

        def solve(src, dst):
            if src not in graph or dst not in graph:
                return -1.0
            q, seen = deque([(src, 1.0)]), {src}
            while q:
                node, acc = q.popleft()
                if node == dst:
                    return acc
                for nb, w in graph[node].items():
                    if nb not in seen:
                        seen.add(nb)
                        q.append((nb, acc * w))
            return -1.0

        return [solve(a, b) for a, b in queries]
''',
        r'''
got = Solution().calcEquation([["a", "b"], ["b", "c"]], [2.0, 3.0], [["a", "c"], ["b", "a"], ["a", "e"], ["a", "a"], ["x", "x"]])
assert all(abs(g - w) < 1e-9 for g, w in zip(got, [6.0, 0.5, -1.0, 1.0, -1.0]))
''',
    ),
    "course-schedule": P(
        "Courses and prerequisites form a directed graph, and you can finish them all iff it has no cycle. Kahn's algorithm: repeatedly take the courses with no remaining prerequisites.",
        ["Build edges prerequisite → course and count in-degrees.", "Queue every course with in-degree 0.", "Pop, count it, and decrement its dependents, enqueueing any that hit 0.", "All courses processed ⇔ no cycle."],
        "O(V + E)", "O(V + E)",
        "Getting the edge direction backwards. [a, b] means b comes before a.",
        r'''
class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        graph = [[] for _ in range(numCourses)]
        indegree = [0] * numCourses
        for course, pre in prerequisites:
            graph[pre].append(course)
            indegree[course] += 1
        q = deque(i for i in range(numCourses) if indegree[i] == 0)
        done = 0
        while q:
            c = q.popleft()
            done += 1
            for nxt in graph[c]:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    q.append(nxt)
        return done == numCourses
''',
        r'''
assert Solution().canFinish(2, [[1, 0]]) is True
assert Solution().canFinish(2, [[1, 0], [0, 1]]) is False
''',
    ),
    "course-schedule-ii": P(
        "Kahn's algorithm again, but record the order in which courses are dequeued. If not every course appears, there's a cycle.",
        ["Build the graph and in-degrees.", "Process zero in-degree courses with a queue, appending each to the order.", "Return the order if its length is numCourses, else []."],
        "O(V + E)", "O(V + E)",
        "Returning a partial order when there's a cycle. It must be [].",
        r'''
class Solution:
    def findOrder(self, numCourses: int, prerequisites: List[List[int]]) -> List[int]:
        graph = [[] for _ in range(numCourses)]
        indegree = [0] * numCourses
        for course, pre in prerequisites:
            graph[pre].append(course)
            indegree[course] += 1
        q = deque(i for i in range(numCourses) if indegree[i] == 0)
        order = []
        while q:
            c = q.popleft()
            order.append(c)
            for nxt in graph[c]:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    q.append(nxt)
        return order if len(order) == numCourses else []
''',
        r'''
def valid(n, prereqs, order):
    pos = {c: i for i, c in enumerate(order)}
    return sorted(order) == list(range(n)) and all(pos[b] < pos[a] for a, b in prereqs)

assert Solution().findOrder(2, [[1, 0]]) == [0, 1]
pre = [[1, 0], [2, 0], [3, 1], [3, 2]]
assert valid(4, pre, Solution().findOrder(4, pre))
assert Solution().findOrder(1, []) == [0]
assert Solution().findOrder(2, [[0, 1], [1, 0]]) == []
''',
    ),
    # ------------------------------------------------------------------ Graph BFS
    "snakes-and-ladders": P(
        "It's a shortest path in an unweighted graph: BFS over squares, where each square has up to 6 edges (die rolls). When you land on a snake or ladder, follow it immediately.",
        ["Convert a square number to (row, col): rows count from the bottom and alternate direction.", "BFS from square 1 with distance 0.", "For each roll 1–6, jump to the destination (following any snake or ladder), and enqueue it if it's unseen."],
        "O(n²)", "O(n²)",
        "Getting the alternating (boustrophedon) coordinates wrong, or chaining two ladders in one move (you only take one).",
        r'''
class Solution:
    def snakesAndLadders(self, board: List[List[int]]) -> int:
        n = len(board)

        def cell(square):
            r, c = divmod(square - 1, n)
            row = n - 1 - r
            col = c if r % 2 == 0 else n - 1 - c
            return board[row][col]

        target = n * n
        dist = {1: 0}
        q = deque([1])
        while q:
            s = q.popleft()
            if s == target:
                return dist[s]
            for nxt in range(s + 1, min(s + 6, target) + 1):
                dest = cell(nxt)
                if dest != -1:
                    nxt = dest
                if nxt not in dist:
                    dist[nxt] = dist[s] + 1
                    q.append(nxt)
        return -1
''',
        r'''
b = [[-1] * 6, [-1] * 6, [-1] * 6, [-1, 35, -1, -1, 13, -1], [-1] * 6, [-1, 15, -1, -1, -1, -1]]
assert Solution().snakesAndLadders(b) == 4
assert Solution().snakesAndLadders([[-1, -1], [-1, 3]]) == 1
''',
    ),
    "minimum-genetic-mutation": P(
        "Each gene is a node, and edges connect bank genes that are one mutation apart. BFS finds the fewest mutations.",
        ["If the end gene isn't in the bank, return −1.", "BFS from the start gene, trying all 8 × 4 single-character changes.", "Only step to genes in the bank that haven't been seen. Return the distance on reaching the end."],
        "O(B · L · 4)", "O(B)",
        "Forgetting a visited set makes BFS bounce between two genes forever.",
        r'''
class Solution:
    def minMutation(self, startGene: str, endGene: str, bank: List[str]) -> int:
        bank = set(bank)
        if endGene not in bank:
            return -1
        q, seen = deque([(startGene, 0)]), {startGene}
        while q:
            gene, steps = q.popleft()
            if gene == endGene:
                return steps
            for i in range(len(gene)):
                for ch in "ACGT":
                    nxt = gene[:i] + ch + gene[i + 1:]
                    if nxt in bank and nxt not in seen:
                        seen.add(nxt)
                        q.append((nxt, steps + 1))
        return -1
''',
        r'''
assert Solution().minMutation("AACCGGTT", "AACCGGTA", ["AACCGGTA"]) == 1
assert Solution().minMutation("AACCGGTT", "AAACGGTA", ["AACCGGTA", "AACCGCTA", "AAACGGTA"]) == 2
assert Solution().minMutation("AAAAACCC", "AACCCCCC", ["AAAACCCC", "AAACCCCC", "AACCCCCC"]) == 3
''',
    ),
    "word-ladder": P(
        "BFS over words, where edges connect words that differ by one letter. Generate neighbours by trying all 26 letters at each position, and search from both ends at once to shrink the frontier.",
        ["If endWord isn't in the list, return 0.", "Keep two frontier sets (from begin and from end) and always expand the smaller one.", "A generated word found in the other frontier means the paths met: return steps + 1.", "Remove visited words from the dictionary as you go."],
        "O(N · L · 26)", "O(N)",
        "Comparing every pair of words to build the graph is O(N² · L). Generate neighbours instead.",
        r'''
class Solution:
    def ladderLength(self, beginWord: str, endWord: str, wordList: List[str]) -> int:
        words = set(wordList)
        if endWord not in words:
            return 0
        words.discard(beginWord)
        words.discard(endWord)
        front, back, steps = {beginWord}, {endWord}, 1
        while front and back:
            if len(front) > len(back):
                front, back = back, front
            nxt = set()
            for w in front:
                for i in range(len(w)):
                    for ch in "abcdefghijklmnopqrstuvwxyz":
                        cand = w[:i] + ch + w[i + 1:]
                        if cand in back:
                            return steps + 1
                        if cand in words:
                            words.discard(cand)
                            nxt.add(cand)
            front = nxt
            steps += 1
        return 0
''',
        r'''
assert Solution().ladderLength("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]) == 5
assert Solution().ladderLength("hit", "cog", ["hot", "dot", "dog", "lot", "log"]) == 0
assert Solution().ladderLength("a", "c", ["a", "b", "c"]) == 2
''',
    ),
    # ------------------------------------------------------------------ Trie
    "implement-trie-prefix-tree": P(
        "Each node maps a character to a child, plus an end-of-word flag. Insert and search walk one character at a time, so the cost depends on word length, not on how many words are stored.",
        ["The root is an empty dict.", "insert: walk/create child dicts, then set the end marker.", "search: walk, and require the end marker. startsWith: just walk."],
        "O(L) per operation", "O(total characters)",
        "search('app') after insert('apple') must be False. That's what the end marker is for.",
        r'''
class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word: str) -> None:
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node["$"] = True

    def _walk(self, s):
        node = self.root
        for ch in s:
            if ch not in node:
                return None
            node = node[ch]
        return node

    def search(self, word: str) -> bool:
        node = self._walk(word)
        return node is not None and "$" in node

    def startsWith(self, prefix: str) -> bool:
        return self._walk(prefix) is not None
''',
        r'''
t = Trie(); t.insert("apple")
assert t.search("apple") and not t.search("app") and t.startsWith("app")
t.insert("app")
assert t.search("app")
''',
    ),
    "design-add-and-search-words-data-structure": P(
        "It's a trie where '.' branches into every child: DFS explores all children at wildcard positions and follows one edge everywhere else.",
        ["addWord: a standard trie insert.", "search: dfs(node, i). At the end, check the end marker.", "On '.', try every child. On a letter, follow that edge if it exists."],
        "O(L) without wildcards, up to O(26^L) with many", "O(total characters)",
        "Treating the end marker as a child when expanding a '.'.",
        r'''
class WordDictionary:
    def __init__(self):
        self.root = {}

    def addWord(self, word: str) -> None:
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node["$"] = True

    def search(self, word: str) -> bool:
        def dfs(node, i):
            if i == len(word):
                return "$" in node
            ch = word[i]
            if ch == ".":
                return any(dfs(child, i + 1) for key, child in node.items() if key != "$")
            return ch in node and dfs(node[ch], i + 1)

        return dfs(self.root, 0)
''',
        r'''
d = WordDictionary()
for w in ["bad", "dad", "mad"]:
    d.addWord(w)
assert not d.search("pad") and d.search("bad") and d.search(".ad") and d.search("b..")
''',
    ),
    "word-search-ii": P(
        "Put all the words in a trie and run one DFS per cell that walks the board and the trie together, so the trie prunes any path that can't become a word. Remove found words and empty branches to speed up later searches.",
        ["Build a trie and store the full word at its end node.", "DFS from each cell whose letter starts a trie branch, marking cells visited in place.", "When a node holds a word, record it and delete it (no duplicates).", "On the way back, prune trie nodes that became empty."],
        "O(m·n·4·3^(L−1)) worst case, far less with pruning", "O(total characters in words)",
        "Running Word Search I once per word repeats the same board exploration for every word.",
        r'''
class Solution:
    def findWords(self, board: List[List[str]], words: List[str]) -> List[str]:
        root = {}
        for w in words:
            node = root
            for ch in w:
                node = node.setdefault(ch, {})
            node["$"] = w
        m, n, found = len(board), len(board[0]), []

        def dfs(r, c, parent):
            ch = board[r][c]
            node = parent[ch]
            if "$" in node:
                found.append(node.pop("$"))
            board[r][c] = "#"
            for a, b in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= a < m and 0 <= b < n and board[a][b] in node:
                    dfs(a, b, node)
            board[r][c] = ch
            if not node:
                parent.pop(ch)

        for r in range(m):
            for c in range(n):
                if board[r][c] in root:
                    dfs(r, c, root)
        return found
''',
        r'''
b = [list("oaan"), list("etae"), list("ihkr"), list("iflv")]
assert sorted(Solution().findWords(b, ["oath", "pea", "eat", "rain"])) == ["eat", "oath"]
assert Solution().findWords([list("ab"), list("cd")], ["abcb"]) == []
''',
    ),
    # ------------------------------------------------------------------ Backtracking
    "letter-combinations-of-a-phone-number": P(
        "One decision per digit: choose a letter, recurse to the next digit, undo. The recursion tree has one level per digit.",
        ["Map digits to letters.", "bt(i, path): if i == len(digits), record the path.", "Otherwise try each letter of digits[i]."],
        "O(4^n · n)", "O(n) recursion",
        "Empty input should return [], not [''].",
        r'''
class Solution:
    def letterCombinations(self, digits: str) -> List[str]:
        if not digits:
            return []
        phone = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}
        res = []

        def bt(i, path):
            if i == len(digits):
                res.append("".join(path))
                return
            for ch in phone[digits[i]]:
                path.append(ch)
                bt(i + 1, path)
                path.pop()

        bt(0, [])
        return res
''',
        r'''
assert Solution().letterCombinations("23") == ["ad", "ae", "af", "bd", "be", "bf", "cd", "ce", "cf"]
assert Solution().letterCombinations("") == []
assert Solution().letterCombinations("2") == ["a", "b", "c"]
''',
    ),
    "combinations": P(
        "Choose numbers in increasing order (start from the last pick + 1) so each set appears once. Prune when too few numbers remain to fill k slots.",
        ["bt(start): if the path has k numbers, record a copy.", "Try x from start up to n − (k − len(path)) + 1.", "Append, recurse with x + 1, pop."],
        "O(C(n, k) · k)", "O(k)",
        "Appending the path object itself instead of a copy: every result ends up as the same, emptied list.",
        r'''
class Solution:
    def combine(self, n: int, k: int) -> List[List[int]]:
        res, path = [], []

        def bt(start):
            if len(path) == k:
                res.append(path[:])
                return
            for x in range(start, n - (k - len(path)) + 2):
                path.append(x)
                bt(x + 1)
                path.pop()

        bt(1)
        return res
''',
        r'''
assert Solution().combine(4, 2) == [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]
assert Solution().combine(1, 1) == [[1]]
''',
    ),
    "permutations": P(
        "At each position, try every number not yet used. A used[] array (or swapping in place) tracks what's taken.",
        ["When the path is full, record a copy.", "For each unused number: mark it, append, recurse, then undo both.", "n! results, each of length n."],
        "O(n · n!)", "O(n)",
        "Using a start index like in combinations produces combinations, not permutations.",
        r'''
class Solution:
    def permute(self, nums: List[int]) -> List[List[int]]:
        res, path, used = [], [], [False] * len(nums)

        def bt():
            if len(path) == len(nums):
                res.append(path[:])
                return
            for i, x in enumerate(nums):
                if not used[i]:
                    used[i] = True
                    path.append(x)
                    bt()
                    path.pop()
                    used[i] = False

        bt()
        return res
''',
        r'''
assert sorted(Solution().permute([1, 2, 3])) == sorted(map(list, itertools.permutations([1, 2, 3])))
assert sorted(Solution().permute([0, 1])) == [[0, 1], [1, 0]]
assert Solution().permute([1]) == [[1]]
''',
    ),
    "combination-sum": P(
        "Recurse with the same index to allow reusing a number, but never go back to earlier indices (that would produce permutations of the same combination). Sorting lets you break as soon as a candidate exceeds the remainder.",
        ["Sort the candidates.", "bt(start, remain): remain == 0 → record.", "For i from start: if candidates[i] > remain, break. Otherwise choose it and recurse with (i, remain − c)."],
        "O(N^(T/min)) worst case", "O(T/min) depth",
        "Recursing with i + 1 forbids reuse. Recursing from 0 creates duplicates like [2,3,2] and [3,2,2].",
        r'''
class Solution:
    def combinationSum(self, candidates: List[int], target: int) -> List[List[int]]:
        candidates.sort()
        res, path = [], []

        def bt(start, remain):
            if remain == 0:
                res.append(path[:])
                return
            for i in range(start, len(candidates)):
                c = candidates[i]
                if c > remain:
                    break
                path.append(c)
                bt(i, remain - c)
                path.pop()

        bt(0, target)
        return res
''',
        r'''
assert Solution().combinationSum([2, 3, 6, 7], 7) == [[2, 2, 3], [7]]
assert Solution().combinationSum([2, 3, 5], 8) == [[2, 2, 2, 2], [2, 3, 3], [3, 5]]
assert Solution().combinationSum([2], 1) == []
''',
    ),
    "n-queens-ii": P(
        "Place one queen per row. Each column, each down-right diagonal (r − c) and each down-left diagonal (r + c) can hold only one queen, so three sets give O(1) conflict checks.",
        ["bt(row): if row == n, count one solution.", "For each column, skip it if the column or either diagonal is taken.", "Mark, recurse to row + 1, unmark."],
        "O(n!)", "O(n)",
        "Checking conflicts by scanning the board costs O(n) per check. The sets make it O(1).",
        r'''
class Solution:
    def totalNQueens(self, n: int) -> int:
        cols, diag, anti = set(), set(), set()

        def bt(r):
            if r == n:
                return 1
            count = 0
            for c in range(n):
                if c in cols or r - c in diag or r + c in anti:
                    continue
                cols.add(c); diag.add(r - c); anti.add(r + c)
                count += bt(r + 1)
                cols.remove(c); diag.remove(r - c); anti.remove(r + c)
            return count

        return bt(0)
''',
        r'''
assert Solution().totalNQueens(4) == 2
assert Solution().totalNQueens(1) == 1
assert Solution().totalNQueens(8) == 92
''',
    ),
    "generate-parentheses": P(
        "Only ever build valid prefixes: add '(' while you have some left, and ')' only when it closes an open one. No invalid string is ever generated.",
        ["bt(s, open, close).", "If open < n, add '('.", "If close < open, add ')'.", "Record when the length is 2n."],
        "O(4^n / √n) (the Catalan numbers)", "O(n)",
        "Generating all 2^(2n) strings and filtering the valid ones afterwards.",
        r'''
class Solution:
    def generateParenthesis(self, n: int) -> List[str]:
        res = []

        def bt(s, opened, closed):
            if len(s) == 2 * n:
                res.append(s)
                return
            if opened < n:
                bt(s + "(", opened + 1, closed)
            if closed < opened:
                bt(s + ")", opened, closed + 1)

        bt("", 0, 0)
        return res
''',
        r'''
assert Solution().generateParenthesis(3) == ["((()))", "(()())", "(())()", "()(())", "()()()"]
assert Solution().generateParenthesis(1) == ["()"]
''',
    ),
    "word-search": P(
        "DFS from every cell, matching one character per step. Mark a cell as visited in place while it's on the path, and restore it when backtracking.",
        ["dfs(r, c, i): out of bounds or a mismatch → False. i == len(word) → True.", "Temporarily overwrite board[r][c] with '#'.", "Try the four neighbours with i + 1, then restore the cell."],
        "O(m·n·3^L)", "O(L)",
        "Forgetting to restore the cell breaks every later search.",
        r'''
class Solution:
    def exist(self, board: List[List[str]], word: str) -> bool:
        m, n = len(board), len(board[0])

        def dfs(r, c, i):
            if i == len(word):
                return True
            if not (0 <= r < m and 0 <= c < n) or board[r][c] != word[i]:
                return False
            board[r][c] = "#"
            found = dfs(r + 1, c, i + 1) or dfs(r - 1, c, i + 1) or dfs(r, c + 1, i + 1) or dfs(r, c - 1, i + 1)
            board[r][c] = word[i]
            return found

        return any(dfs(r, c, 0) for r in range(m) for c in range(n))
''',
        r'''
b = [list("ABCE"), list("SFCS"), list("ADEE")]
assert Solution().exist(b, "ABCCED") and Solution().exist(b, "SEE") and not Solution().exist(b, "ABCB")
''',
    ),
    # ------------------------------------------------------------------ Divide & Conquer
    "convert-sorted-array-to-binary-search-tree": P(
        "Making the middle element the root splits the rest into two halves of equal size. Recursing on each half guarantees height balance.",
        ["build(lo, hi): empty range → None.", "mid = (lo + hi) // 2 becomes the root.", "Left = build(lo, mid − 1), right = build(mid + 1, hi)."],
        "O(n)", "O(log n)",
        "Slicing the array at every level costs O(n log n) in copies. Pass indices instead.",
        r'''
class Solution:
    def sortedArrayToBST(self, nums: List[int]) -> Optional[TreeNode]:
        def build(lo, hi):
            if lo > hi:
                return None
            mid = (lo + hi) // 2
            return TreeNode(nums[mid], build(lo, mid - 1), build(mid + 1, hi))

        return build(0, len(nums) - 1)
''',
        r'''
def inorder(n):
    return inorder(n.left) + [n.val] + inorder(n.right) if n else []

def height(n):
    if not n:
        return 0
    l, r = height(n.left), height(n.right)
    assert abs(l - r) <= 1
    return 1 + max(l, r)

r = Solution().sortedArrayToBST([-10, -3, 0, 5, 9])
assert inorder(r) == [-10, -3, 0, 5, 9] and height(r) == 3
''',
    ),
    "sort-list": P(
        "Merge sort fits linked lists: split at the middle with fast/slow pointers, sort each half, and merge. No random access needed.",
        ["Base case: 0 or 1 nodes.", "Find the middle (fast starts at head.next so even lists split evenly) and cut the list.", "Recursively sort both halves, then merge them like two sorted lists."],
        "O(n log n)", "O(log n) recursion",
        "Not cutting the list at the middle causes infinite recursion. Quicksort degrades badly on linked lists.",
        r'''
class Solution:
    def sortList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if not head or not head.next:
            return head
        slow, fast = head, head.next
        while fast and fast.next:
            slow, fast = slow.next, fast.next.next
        mid, slow.next = slow.next, None
        left, right = self.sortList(head), self.sortList(mid)
        dummy = tail = ListNode()
        while left and right:
            if left.val <= right.val:
                tail.next, left = left, left.next
            else:
                tail.next, right = right, right.next
            tail = tail.next
        tail.next = left or right
        return dummy.next
''',
        r'''
assert tolist(Solution().sortList(L([4, 2, 1, 3]))) == [1, 2, 3, 4]
assert tolist(Solution().sortList(L([-1, 5, 3, 4, 0]))) == [-1, 0, 3, 4, 5]
assert tolist(Solution().sortList(None)) == []
''',
    ),
    "construct-quad-tree": P(
        "Divide into four quadrants until a region is uniform, and a uniform region becomes a leaf. A 2D prefix sum makes 'is it uniform?' O(1).",
        ["build(r, c, size): if every cell matches the first one, return a leaf with that value.", "Otherwise split into four size/2 quadrants: top-left, top-right, bottom-left, bottom-right.", "Internal nodes have isLeaf = False (their val can be anything)."],
        "O(n² log n) (O(n²) with prefix sums)", "O(log n) recursion",
        "Mixing up the quadrant order or offsets. Top-right is (r, c + half), bottom-left is (r + half, c).",
        r'''
class Solution:
    def construct(self, grid: List[List[int]]) -> "Node":
        def build(r, c, size):
            first = grid[r][c]
            if all(grid[i][j] == first for i in range(r, r + size) for j in range(c, c + size)):
                return Node(first == 1, True, None, None, None, None)
            h = size // 2
            return Node(True, False, build(r, c, h), build(r, c + h, h), build(r + h, c, h), build(r + h, c + h, h))

        return build(0, 0, len(grid))
''',
        r'''
class Node:
    def __init__(self, val, isLeaf, topLeft=None, topRight=None, bottomLeft=None, bottomRight=None):
        self.val, self.isLeaf = val, isLeaf
        self.topLeft, self.topRight, self.bottomLeft, self.bottomRight = topLeft, topRight, bottomLeft, bottomRight

root = Solution().construct([[0, 1], [1, 0]])
kids = [root.topLeft, root.topRight, root.bottomLeft, root.bottomRight]
assert not root.isLeaf and all(k.isLeaf for k in kids) and [k.val for k in kids] == [False, True, True, False]
leaf = Solution().construct([[1] * 4 for _ in range(4)])
assert leaf.isLeaf and leaf.val is True
''',
    ),
    "merge-k-sorted-lists": P(
        "Keep the current head of every list in a min-heap. Repeatedly take the smallest and push its successor. The list index breaks ties so nodes are never compared directly.",
        ["Push (val, i, node) for each non-empty list.", "Pop the smallest, append it to the result, push its next node.", "Alternatively, merge lists in pairs, halving their number each round."],
        "O(N log k)", "O(k)",
        "Merging lists one by one into a growing result is O(N·k).",
        r'''
class Solution:
    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:
        heap = [(node.val, i, node) for i, node in enumerate(lists) if node]
        heapq.heapify(heap)
        dummy = tail = ListNode()
        while heap:
            _, i, node = heapq.heappop(heap)
            tail.next = tail = node
            if node.next:
                heapq.heappush(heap, (node.next.val, i, node.next))
        return dummy.next
''',
        r'''
assert tolist(Solution().mergeKLists([L([1, 4, 5]), L([1, 3, 4]), L([2, 6])])) == [1, 1, 2, 3, 4, 4, 5, 6]
assert tolist(Solution().mergeKLists([])) == []
assert tolist(Solution().mergeKLists([None])) == []
''',
    ),
    # ------------------------------------------------------------------ Kadane's Algorithm
    "maximum-subarray": P(
        "The best subarray ending at each index either extends the previous one or starts fresh: cur = max(x, cur + x). A negative running sum is never worth keeping.",
        ["cur = best = nums[0].", "For each next x: cur = max(x, cur + x), best = max(best, cur).", "Return best."],
        "O(n)", "O(1)",
        "Starting best at 0 fails when every number is negative.",
        r'''
class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        best = cur = nums[0]
        for x in nums[1:]:
            cur = max(x, cur + x)
            best = max(best, cur)
        return best
''',
        r'''
assert Solution().maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4]) == 6
assert Solution().maxSubArray([1]) == 1
assert Solution().maxSubArray([5, 4, -1, 7, 8]) == 23
assert Solution().maxSubArray([-3, -1, -2]) == -1
''',
    ),
    "maximum-sum-circular-subarray": P(
        "A wrapping subarray is the total minus a minimum subarray in the middle. Answer = max(normal Kadane, total − min subarray), unless every number is negative (then total − min would be the empty array).",
        ["Run Kadane for the max subarray and, in the same pass, for the min subarray.", "Track the total sum.", "If the max is negative, return it. Otherwise return max(max, total − min)."],
        "O(n)", "O(1)",
        "The all-negative case: total − min = 0 corresponds to an empty subarray, which isn't allowed.",
        r'''
class Solution:
    def maxSubarraySumCircular(self, nums: List[int]) -> int:
        total = cur_max = cur_min = 0
        best_max, best_min = float("-inf"), float("inf")
        for x in nums:
            cur_max = max(x, cur_max + x)
            best_max = max(best_max, cur_max)
            cur_min = min(x, cur_min + x)
            best_min = min(best_min, cur_min)
            total += x
        return best_max if best_max < 0 else max(best_max, total - best_min)
''',
        r'''
assert Solution().maxSubarraySumCircular([1, -2, 3, -2]) == 3
assert Solution().maxSubarraySumCircular([5, -3, 5]) == 10
assert Solution().maxSubarraySumCircular([-3, -2, -3]) == -2
''',
    ),
}

PATTERNS = {
    "Graph General": PATTERN(
        [
            "Grids of cells or explicit edges: connected components, reachability.",
            "Dependencies or prerequisites → a directed graph and topological sort.",
            "Ratios or relations between pairs → a weighted graph or union-find.",
        ],
        [
            "Mark nodes visited when you push or enqueue them, not when you pop them, to avoid duplicates.",
            "A grid is an implicit graph: generate neighbours with a directions array.",
            "Topological sort with Kahn's algorithm (in-degrees) detects cycles for free.",
            "Use union-find for dynamic connectivity and 'are these connected?' queries.",
        ],
        r'''
from collections import deque

def count_components(n, edges):
    graph = [[] for _ in range(n)]
    for a, b in edges:
        graph[a].append(b)
        graph[b].append(a)
    seen, components = set(), 0
    for start in range(n):
        if start in seen:
            continue
        components += 1
        seen.add(start)
        stack = [start]
        while stack:
            node = stack.pop()
            for nb in graph[node]:
                if nb not in seen:
                    seen.add(nb)              # mark when pushing
                    stack.append(nb)
    return components

def topo_order(n, edges):                     # edges: (before, after)
    graph, indegree = [[] for _ in range(n)], [0] * n
    for a, b in edges:
        graph[a].append(b)
        indegree[b] += 1
    q = deque(i for i in range(n) if indegree[i] == 0)
    order = []
    while q:
        node = q.popleft()
        order.append(node)
        for nb in graph[node]:
            indegree[nb] -= 1
            if indegree[nb] == 0:
                q.append(nb)
    return order if len(order) == n else []  # [] means there's a cycle
''',
    ),
    "Graph BFS": PATTERN(
        [
            "The minimum number of steps, moves or mutations in an unweighted state space.",
            "States you can generate on the fly (words, board positions, lock combinations).",
        ],
        [
            "When every edge costs 1, BFS finds shortest paths: the first time you reach a node is optimal.",
            "Store (state, distance), or process the queue level by level.",
            "Generate neighbours lazily (change one character, roll a die) instead of building the graph up front.",
            "Bidirectional BFS: expand the smaller frontier from both ends to shrink the search drastically.",
        ],
        r'''
from collections import deque

def shortest_steps(start, goal, neighbors):
    q = deque([(start, 0)])
    seen = {start}
    while q:
        state, dist = q.popleft()
        if state == goal:
            return dist
        for nxt in neighbors(state):
            if nxt not in seen:
                seen.add(nxt)
                q.append((nxt, dist + 1))
    return -1
''',
    ),
    "Trie": PATTERN(
        [
            "Prefix queries: startsWith, autocomplete, longest common prefix.",
            "Many words searched at once (Word Search II).",
            "Wildcard matching against a dictionary.",
        ],
        [
            "Nested dicts are the fastest trie to write in an interview. Mark word ends with a sentinel key.",
            "Store the whole word at its end node to avoid rebuilding strings during a DFS.",
            "Prune by deleting found words and empty branches.",
            "The cost depends on word length, not on the number of words stored.",
        ],
        r'''
class Trie:
    END = "$"

    def __init__(self):
        self.root = {}

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node[self.END] = True

    def find(self, prefix):
        node = self.root
        for ch in prefix:
            if ch not in node:
                return None
            node = node[ch]
        return node

    def search(self, word):
        node = self.find(word)
        return node is not None and self.END in node
''',
    ),
    "Backtracking": PATTERN(
        [
            "Generate all combinations, permutations, subsets or partitions.",
            "Constraint satisfaction (N-Queens, Sudoku, word search).",
            "'Return all possible…' with a small n.",
        ],
        [
            "The template: choose → recurse → un-choose.",
            "Combinations pass a start index so order doesn't matter. Permutations track which elements are used.",
            "Prune early (sorted input + break, constraint sets).",
            "Copy the path when recording an answer (path[:]).",
        ],
        r'''
def backtrack_all(choices, is_complete, is_valid):
    results, path = [], []

    def bt(start):
        if is_complete(path):
            results.append(path[:])          # copy!
            return
        for i in range(start, len(choices)):
            if not is_valid(path, choices[i]):
                continue                     # prune
            path.append(choices[i])          # choose
            bt(i + 1)                        # explore (i allows reuse; permutations use a used[] array instead)
            path.pop()                       # un-choose

    bt(0)
    return results
''',
    ),
    "Divide & Conquer": PATTERN(
        [
            "The problem splits into independent halves or quadrants whose answers combine (merge sort, balanced trees, quad trees).",
            "Merging many sorted sources.",
        ],
        [
            "Define the split, the base case and the combine step explicitly before coding.",
            "T(n) = 2T(n/2) + O(n) gives O(n log n).",
            "Merging k sorted lists: a heap (O(N log k)) or pairwise merging in rounds.",
            "Pass index bounds instead of slicing to avoid copies.",
        ],
        r'''
def merge_sort(a):
    if len(a) <= 1:
        return a                                  # base case
    mid = len(a) // 2
    left, right = merge_sort(a[:mid]), merge_sort(a[mid:])   # divide and conquer
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):      # combine
        if left[i] <= right[j]:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1
    return out + left[i:] + right[j:]
''',
    ),
    "Kadane's Algorithm": PATTERN(
        [
            "The maximum (or minimum) sum of a contiguous subarray.",
            "Circular arrays: think total − the opposite subarray.",
        ],
        [
            "cur = max(x, cur + x): extend the previous subarray or restart.",
            "For products, track both the max and the min, since a negative number swaps them.",
            "Circular: max(Kadane, total − min subarray), unless every number is negative.",
            "Kadane is a 1D DP where dp[i] depends only on dp[i−1], so it needs O(1) space.",
        ],
        r'''
def max_subarray(nums):
    best = cur = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)      # extend the previous subarray or start fresh at x
        best = max(best, cur)
    return best
''',
    ),
}
