from common import P, PATTERN

SUDOKU = r'''
rows = ["53..7....", "6..195...", ".98....6.", "8...6...3", "4..8.3..1", "7...2...6", ".6....28.", "...419..5", "....8..79"]
board = [list(r) for r in rows]
'''

GUIDES = {
    # ------------------------------------------------------------------ Matrix
    "valid-sudoku": P(
        "One pass, one set: record (row, digit), (col, digit) and (box, digit) keys. A repeated key means invalid. The box index is (r // 3, c // 3).",
        ["Skip empty cells.", "Build three tagged keys per filled cell.", "If any key already exists, return False. Otherwise add them."],
        "O(81) = O(1)", "O(1)",
        "The task is validating, not solving. An incomplete but consistent board is valid.",
        r'''
class Solution:
    def isValidSudoku(self, board: List[List[str]]) -> bool:
        seen = set()
        for r in range(9):
            for c in range(9):
                v = board[r][c]
                if v == ".":
                    continue
                keys = (("row", r, v), ("col", c, v), ("box", r // 3, c // 3, v))
                if any(k in seen for k in keys):
                    return False
                seen.update(keys)
        return True
''',
        SUDOKU + r'''
assert Solution().isValidSudoku(board) is True
board[0][0] = "8"
assert Solution().isValidSudoku(board) is False
''',
    ),
    "spiral-matrix": P(
        "Keep four boundaries and peel one layer at a time: top row → right column → bottom row → left column, shrinking a boundary after each side.",
        ["top, bottom, left, right = the outer edges.", "Walk each side, then move that boundary inward.", "Re-check top ≤ bottom and left ≤ right before the bottom and left walks."],
        "O(m·n)", "O(1) extra",
        "A single remaining row or column gets traversed twice unless you re-check the boundaries mid-loop.",
        r'''
class Solution:
    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:
        res = []
        top, bottom, left, right = 0, len(matrix) - 1, 0, len(matrix[0]) - 1
        while top <= bottom and left <= right:
            for c in range(left, right + 1):
                res.append(matrix[top][c])
            top += 1
            for r in range(top, bottom + 1):
                res.append(matrix[r][right])
            right -= 1
            if top <= bottom:
                for c in range(right, left - 1, -1):
                    res.append(matrix[bottom][c])
                bottom -= 1
            if left <= right:
                for r in range(bottom, top - 1, -1):
                    res.append(matrix[r][left])
                left += 1
        return res
''',
        r'''
assert Solution().spiralOrder([[1, 2, 3], [4, 5, 6], [7, 8, 9]]) == [1, 2, 3, 6, 9, 8, 7, 4, 5]
assert Solution().spiralOrder([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]) == [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]
assert Solution().spiralOrder([[1], [2], [3]]) == [1, 2, 3]
''',
    ),
    "rotate-image": P(
        "Clockwise rotation = transpose (swap across the main diagonal), then reverse each row.",
        ["Transpose: swap matrix[i][j] with matrix[j][i] for j > i.", "Reverse every row.", "Counter-clockwise: reverse the rows first, then transpose."],
        "O(n²)", "O(1)",
        "Transposing with j starting at 0 swaps every pair twice, which undoes itself.",
        r'''
class Solution:
    def rotate(self, matrix: List[List[int]]) -> None:
        n = len(matrix)
        for i in range(n):
            for j in range(i + 1, n):
                matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
        for row in matrix:
            row.reverse()
''',
        r'''
m = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]; Solution().rotate(m); assert m == [[7, 4, 1], [8, 5, 2], [9, 6, 3]]
m = [[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]]; Solution().rotate(m)
assert m == [[15, 13, 2, 5], [14, 3, 4, 1], [12, 6, 8, 9], [16, 7, 10, 11]]
''',
    ),
    "set-matrix-zeroes": P(
        "Use the first row and the first column as marker arrays, and remember separately whether they themselves contained a zero.",
        ["Record whether row 0 and column 0 contain zeros.", "For each zero at (r, c) with r, c ≥ 1, mark matrix[r][0] and matrix[0][c].", "Zero the inner cells whose row or column is marked.", "Finally zero row 0 and column 0 if needed."],
        "O(m·n)", "O(1)",
        "Zeroing while scanning spreads zeros you created. Zeroing the markers before you've used them loses information.",
        r'''
class Solution:
    def setZeroes(self, matrix: List[List[int]]) -> None:
        m, n = len(matrix), len(matrix[0])
        first_row = any(matrix[0][c] == 0 for c in range(n))
        first_col = any(matrix[r][0] == 0 for r in range(m))
        for r in range(1, m):
            for c in range(1, n):
                if matrix[r][c] == 0:
                    matrix[r][0] = matrix[0][c] = 0
        for r in range(1, m):
            for c in range(1, n):
                if matrix[r][0] == 0 or matrix[0][c] == 0:
                    matrix[r][c] = 0
        if first_row:
            for c in range(n):
                matrix[0][c] = 0
        if first_col:
            for r in range(m):
                matrix[r][0] = 0
''',
        r'''
m = [[1, 1, 1], [1, 0, 1], [1, 1, 1]]; Solution().setZeroes(m); assert m == [[1, 0, 1], [0, 0, 0], [1, 0, 1]]
m = [[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]]; Solution().setZeroes(m); assert m == [[0, 0, 0, 0], [0, 4, 5, 0], [0, 3, 1, 0]]
''',
    ),
    "game-of-life": P(
        "Store the next state in a spare bit: bit 0 = current, bit 1 = next. Neighbours read bit 0, so updates don't interfere. Shift right at the end.",
        ["Count live neighbours using cell & 1.", "If the cell lives in the next generation, set bit 1 (cell |= 2).", "Shift every cell right by one."],
        "O(m·n)", "O(1)",
        "Updating cells directly means later cells see next-generation neighbours.",
        r'''
class Solution:
    def gameOfLife(self, board: List[List[int]]) -> None:
        m, n = len(board), len(board[0])
        for r in range(m):
            for c in range(n):
                live = 0
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        if (dr or dc) and 0 <= r + dr < m and 0 <= c + dc < n:
                            live += board[r + dr][c + dc] & 1
                alive = board[r][c] & 1
                if (alive and live in (2, 3)) or (not alive and live == 3):
                    board[r][c] |= 2
        for r in range(m):
            for c in range(n):
                board[r][c] >>= 1
''',
        r'''
b = [[0, 1, 0], [0, 0, 1], [1, 1, 1], [0, 0, 0]]; Solution().gameOfLife(b); assert b == [[0, 0, 0], [1, 0, 1], [0, 1, 1], [0, 1, 0]]
b = [[1, 1], [1, 0]]; Solution().gameOfLife(b); assert b == [[1, 1], [1, 1]]
''',
    ),
    # ------------------------------------------------------------------ Hashmap
    "ransom-note": P(
        "Count the letters the magazine offers and spend them. Going negative means a letter is missing.",
        ["Counter(magazine).", "For each note character, decrement its count.", "A negative count means you can't build the note."],
        "O(m + n)", "O(1) (26 letters)",
        "Checking only whether each letter exists, ignoring how many times it's needed.",
        r'''
class Solution:
    def canConstruct(self, ransomNote: str, magazine: str) -> bool:
        have = Counter(magazine)
        for ch in ransomNote:
            have[ch] -= 1
            if have[ch] < 0:
                return False
        return True
''',
        r'''
assert Solution().canConstruct("a", "b") is False
assert Solution().canConstruct("aa", "ab") is False
assert Solution().canConstruct("aa", "aab") is True
''',
    ),
    "isomorphic-strings": P(
        "A valid mapping is a bijection, so check both directions (s→t and t→s). One map alone accepts 'ab' → 'aa'.",
        ["Two maps: s→t and t→s.", "For each pair (a, b), both maps must agree (setdefault makes this one line).", "Any conflict means False."],
        "O(n)", "O(alphabet)",
        "Checking only one direction.",
        r'''
class Solution:
    def isIsomorphic(self, s: str, t: str) -> bool:
        st, ts = {}, {}
        for a, b in zip(s, t):
            if st.setdefault(a, b) != b or ts.setdefault(b, a) != a:
                return False
        return True
''',
        r'''
assert Solution().isIsomorphic("egg", "add") is True
assert Solution().isIsomorphic("foo", "bar") is False
assert Solution().isIsomorphic("paper", "title") is True
assert Solution().isIsomorphic("badc", "baba") is False
''',
    ),
    "word-pattern": P(
        "It's isomorphic strings with words: a two-way map between pattern letters and words, plus a length check.",
        ["Split s into words. Different lengths → False.", "Maintain letter→word and word→letter maps.", "Any conflict → False."],
        "O(n)", "O(n)",
        "Forgetting the reverse map ('abba' vs 'dog dog dog dog').",
        r'''
class Solution:
    def wordPattern(self, pattern: str, s: str) -> bool:
        words = s.split()
        if len(words) != len(pattern):
            return False
        pw, wp = {}, {}
        for ch, w in zip(pattern, words):
            if pw.setdefault(ch, w) != w or wp.setdefault(w, ch) != ch:
                return False
        return True
''',
        r'''
assert Solution().wordPattern("abba", "dog cat cat dog") is True
assert Solution().wordPattern("abba", "dog cat cat fish") is False
assert Solution().wordPattern("aaaa", "dog cat cat dog") is False
assert Solution().wordPattern("abba", "dog dog dog dog") is False
''',
    ),
    "valid-anagram": P(
        "Anagrams have identical letter counts. Compare counters (or a 26-int array).",
        ["Different lengths → False.", "Count the characters of both strings.", "Compare the counts."],
        "O(n)", "O(1) (26 letters)",
        "Sorting also works but costs O(n log n). For the Unicode follow-up, use a hash map instead of an array.",
        r'''
class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        return len(s) == len(t) and Counter(s) == Counter(t)
''',
        r'''
assert Solution().isAnagram("anagram", "nagaram") is True
assert Solution().isAnagram("rat", "car") is False
''',
    ),
    "group-anagrams": P(
        "Give all anagrams the same canonical key (the 26 letter counts, or the sorted string) and bucket by it.",
        ["For each word, compute its key.", "Append the word to groups[key].", "Return the groups."],
        "O(n·k)", "O(n·k)",
        "Lists aren't hashable. Convert the count array to a tuple.",
        r'''
class Solution:
    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        groups = defaultdict(list)
        for s in strs:
            key = [0] * 26
            for ch in s:
                key[ord(ch) - ord("a")] += 1
            groups[tuple(key)].append(s)
        return list(groups.values())
''',
        r'''
got = sorted(sorted(g) for g in Solution().groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
assert got == [["ate", "eat", "tea"], ["bat"], ["nat", "tan"]]
assert Solution().groupAnagrams([""]) == [[""]]
''',
    ),
    "two-sum": P(
        "For each number, the partner you need is target − x. Look it up among the numbers you've already seen.",
        ["seen = {value: index}.", "For each x, if target − x is in seen, return both indices.", "Otherwise store x."],
        "O(n)", "O(n)",
        "Insert after checking, so a number can't pair with itself.",
        r'''
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
''',
        r'''
assert Solution().twoSum([2, 7, 11, 15], 9) == [0, 1]
assert Solution().twoSum([3, 2, 4], 6) == [1, 2]
assert Solution().twoSum([3, 3], 6) == [0, 1]
''',
    ),
    "happy-number": P(
        "The digit-square sequence either reaches 1 or loops forever. Detect the loop with a set, or with Floyd's fast/slow pointers in O(1) space.",
        ["next(x) = sum of the squares of x's digits.", "slow moves one step, fast moves two.", "Stop when fast hits 1 (happy) or meets slow (cycle)."],
        "O(log n) per step", "O(1)",
        "Looping until 1 without cycle detection never terminates for unhappy numbers.",
        r'''
class Solution:
    def isHappy(self, n: int) -> bool:
        def step(x):
            return sum(int(d) ** 2 for d in str(x))

        slow, fast = n, step(n)
        while fast != 1 and slow != fast:
            slow, fast = step(slow), step(step(fast))
        return fast == 1
''',
        r'''
assert Solution().isHappy(19) is True
assert Solution().isHappy(2) is False
assert Solution().isHappy(1) is True
''',
    ),
    "contains-duplicate-ii": P(
        "Only the most recent index of each value matters. Compare the distance to it.",
        ["last = {value: most recent index}.", "If x was seen within k positions, return True.", "Update last[x] = i."],
        "O(n)", "O(n)",
        "Storing the first index instead of the latest one misses closer duplicates later on.",
        r'''
class Solution:
    def containsNearbyDuplicate(self, nums: List[int], k: int) -> bool:
        last = {}
        for i, x in enumerate(nums):
            if x in last and i - last[x] <= k:
                return True
            last[x] = i
        return False
''',
        r'''
assert Solution().containsNearbyDuplicate([1, 2, 3, 1], 3) is True
assert Solution().containsNearbyDuplicate([1, 0, 1, 1], 1) is True
assert Solution().containsNearbyDuplicate([1, 2, 3, 1, 2, 3], 2) is False
''',
    ),
    "longest-consecutive-sequence": P(
        "Only start counting at numbers that begin a run (x − 1 not in the set). Each number is then visited at most twice, so it's O(n) without sorting.",
        ["Put all numbers in a set.", "For each x with x − 1 missing, count up x, x+1, x+2, … while they exist.", "Keep the longest run."],
        "O(n)", "O(n)",
        "Starting a count from every number is O(n²). Iterate over the set, not the list, so duplicates don't repeat work.",
        r'''
class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        s = set(nums)
        best = 0
        for x in s:
            if x - 1 not in s:
                y = x
                while y + 1 in s:
                    y += 1
                best = max(best, y - x + 1)
        return best
''',
        r'''
assert Solution().longestConsecutive([100, 4, 200, 1, 3, 2]) == 4
assert Solution().longestConsecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]) == 9
assert Solution().longestConsecutive([]) == 0
''',
    ),
    # ------------------------------------------------------------------ Intervals
    "summary-ranges": P(
        "Extend a run while the next number is exactly one more, then emit it as 'a->b' or 'a'.",
        ["i marks the run's start, j walks forward while nums[j+1] = nums[j] + 1.", "Emit the range.", "Continue from j + 1."],
        "O(n)", "O(1) extra",
        "Off-by-one at the end of the array. Check j + 1 < n before reading nums[j+1].",
        r'''
class Solution:
    def summaryRanges(self, nums: List[int]) -> List[str]:
        res, i = [], 0
        while i < len(nums):
            j = i
            while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1:
                j += 1
            res.append(str(nums[i]) if i == j else f"{nums[i]}->{nums[j]}")
            i = j + 1
        return res
''',
        r'''
assert Solution().summaryRanges([0, 1, 2, 4, 5, 7]) == ["0->2", "4->5", "7"]
assert Solution().summaryRanges([0, 2, 3, 4, 6, 8, 9]) == ["0", "2->4", "6", "8->9"]
assert Solution().summaryRanges([]) == []
''',
    ),
    "merge-intervals": P(
        "Sort by start, and overlapping intervals become adjacent. Either extend the last merged interval or start a new one.",
        ["Sort by start.", "If the next interval starts ≤ the last end, extend: end = max(end, its end).", "Otherwise append it as a new interval."],
        "O(n log n)", "O(n)",
        "Using the new end instead of max(last end, new end) breaks on contained intervals like [1,4] and [2,3].",
        r'''
class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        intervals.sort(key=lambda iv: iv[0])
        res = []
        for start, end in intervals:
            if res and start <= res[-1][1]:
                res[-1][1] = max(res[-1][1], end)
            else:
                res.append([start, end])
        return res
''',
        r'''
assert Solution().merge([[1, 3], [2, 6], [8, 10], [15, 18]]) == [[1, 6], [8, 10], [15, 18]]
assert Solution().merge([[1, 4], [4, 5]]) == [[1, 5]]
assert Solution().merge([[1, 4], [2, 3]]) == [[1, 4]]
''',
    ),
    "insert-interval": P(
        "The list is already sorted: copy the intervals that end before the new one, merge everything that overlaps it, then copy the rest.",
        ["Append intervals with end < new.start.", "While intervals start ≤ new.end, widen new to cover them.", "Append the merged interval, then the remainder."],
        "O(n)", "O(n)",
        "Re-sorting and merging everything works, but it wastes the sortedness (O(n log n)).",
        r'''
class Solution:
    def insert(self, intervals: List[List[int]], newInterval: List[int]) -> List[List[int]]:
        res, i, n = [], 0, len(intervals)
        start, end = newInterval
        while i < n and intervals[i][1] < start:
            res.append(intervals[i])
            i += 1
        while i < n and intervals[i][0] <= end:
            start = min(start, intervals[i][0])
            end = max(end, intervals[i][1])
            i += 1
        res.append([start, end])
        res.extend(intervals[i:])
        return res
''',
        r'''
assert Solution().insert([[1, 3], [6, 9]], [2, 5]) == [[1, 5], [6, 9]]
assert Solution().insert([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]) == [[1, 2], [3, 10], [12, 16]]
assert Solution().insert([], [5, 7]) == [[5, 7]]
''',
    ),
    "minimum-number-of-arrows-to-burst-balloons": P(
        "Sort by end and shoot each arrow at the earliest end. It bursts every balloon that has started by then (the classic interval-scheduling greedy).",
        ["Sort balloons by their end coordinate.", "Shoot at the first end, then skip every balloon whose start ≤ that point.", "The next unburst balloon needs a new arrow at its end."],
        "O(n log n)", "O(1) extra",
        "Touching balloons ([1,2] and [2,3]) share a point, so test start > arrow, not start ≥ arrow.",
        r'''
class Solution:
    def findMinArrowShots(self, points: List[List[int]]) -> int:
        points.sort(key=lambda p: p[1])
        arrows, arrow = 0, float("-inf")
        for start, end in points:
            if start > arrow:
                arrows += 1
                arrow = end
        return arrows
''',
        r'''
assert Solution().findMinArrowShots([[10, 16], [2, 8], [1, 6], [7, 12]]) == 2
assert Solution().findMinArrowShots([[1, 2], [3, 4], [5, 6], [7, 8]]) == 4
assert Solution().findMinArrowShots([[1, 2], [2, 3], [3, 4], [4, 5]]) == 2
''',
    ),
    # ------------------------------------------------------------------ Stack
    "valid-parentheses": P(
        "The most recent unmatched opener must close first. That's LIFO, so use a stack.",
        ["Push openers.", "For a closer, the stack top must be its matching opener: pop it.", "Valid iff the stack ends empty."],
        "O(n)", "O(n)",
        "Forgetting the empty-stack case (a leading closer) or leftover openers at the end.",
        r'''
class Solution:
    def isValid(self, s: str) -> bool:
        pairs = {")": "(", "]": "[", "}": "{"}
        stack = []
        for ch in s:
            if ch in pairs:
                if not stack or stack.pop() != pairs[ch]:
                    return False
            else:
                stack.append(ch)
        return not stack
''',
        r'''
for s, want in [("()", True), ("()[]{}", True), ("(]", False), ("([])", True), ("((", False), ("]", False)]:
    assert Solution().isValid(s) is want, s
''',
    ),
    "simplify-path": P(
        "Split on '/' and treat the directories as a stack: names push, '..' pops, '.' and empty parts do nothing.",
        ["Split the path by '/'.", "Skip '' and '.'. Pop on '..' (if there's anything to pop). Push anything else.", "Join with '/' and prefix the root."],
        "O(n)", "O(n)",
        "'...' is a valid directory name, not a parent reference.",
        r'''
class Solution:
    def simplifyPath(self, path: str) -> str:
        stack = []
        for part in path.split("/"):
            if part == "..":
                if stack:
                    stack.pop()
            elif part and part != ".":
                stack.append(part)
        return "/" + "/".join(stack)
''',
        r'''
assert Solution().simplifyPath("/home/") == "/home"
assert Solution().simplifyPath("/home//foo/") == "/home/foo"
assert Solution().simplifyPath("/home/user/Documents/../Pictures") == "/home/user/Pictures"
assert Solution().simplifyPath("/../") == "/"
assert Solution().simplifyPath("/.../a/../b/c/../d/./") == "/.../b/d"
''',
    ),
    "min-stack": P(
        "Store, with every element, the minimum of the stack at the moment it was pushed. Popping restores the old minimum automatically.",
        ["Push (val, min(val, current min)).", "top() reads the value and getMin() reads the stored minimum.", "Every operation is O(1)."],
        "O(1) per operation", "O(n)",
        "A single 'min' variable can't recover the previous minimum after a pop.",
        r'''
class MinStack:
    def __init__(self):
        self.stack = []

    def push(self, val: int) -> None:
        current = self.stack[-1][1] if self.stack else val
        self.stack.append((val, min(val, current)))

    def pop(self) -> None:
        self.stack.pop()

    def top(self) -> int:
        return self.stack[-1][0]

    def getMin(self) -> int:
        return self.stack[-1][1]
''',
        r'''
ms = MinStack(); ms.push(-2); ms.push(0); ms.push(-3)
assert ms.getMin() == -3
ms.pop()
assert ms.top() == 0 and ms.getMin() == -2
''',
    ),
    "evaluate-reverse-polish-notation": P(
        "Operands wait on a stack. An operator pops the two most recent (b first, then a) and pushes a op b.",
        ["Push numbers.", "On an operator, pop b, pop a, push a op b.", "The single remaining value is the answer."],
        "O(n)", "O(n)",
        "Python's // floors toward −∞, but RPN wants truncation toward zero, so use int(a / b). And mind operand order for − and /.",
        r'''
class Solution:
    def evalRPN(self, tokens: List[str]) -> int:
        ops = {
            "+": lambda a, b: a + b,
            "-": lambda a, b: a - b,
            "*": lambda a, b: a * b,
            "/": lambda a, b: int(a / b),
        }
        stack = []
        for t in tokens:
            if t in ops:
                b, a = stack.pop(), stack.pop()
                stack.append(ops[t](a, b))
            else:
                stack.append(int(t))
        return stack[0]
''',
        r'''
assert Solution().evalRPN(["2", "1", "+", "3", "*"]) == 9
assert Solution().evalRPN(["4", "13", "5", "/", "+"]) == 6
assert Solution().evalRPN(["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]) == 22
''',
    ),
    "basic-calculator": P(
        "With only + and − plus parentheses, keep a running result and the current sign. '(' saves (result, sign) on a stack, and ')' folds the inner result back in.",
        ["Build multi-digit numbers digit by digit.", "On + or −, add sign·num to the result and set the new sign.", "On '(', push (result, sign) and start fresh. On ')', finish the inner result, then result = saved + savedSign·result."],
        "O(n)", "O(depth of nesting)",
        "Unary minus ('-(2+3)', '1-(-2)') is handled naturally by this scheme. Don't special-case it into bugs.",
        r'''
class Solution:
    def calculate(self, s: str) -> int:
        result, num, sign, stack = 0, 0, 1, []
        for ch in s:
            if ch.isdigit():
                num = num * 10 + int(ch)
            elif ch in "+-":
                result += sign * num
                num, sign = 0, (1 if ch == "+" else -1)
            elif ch == "(":
                stack.append((result, sign))
                result, sign = 0, 1
            elif ch == ")":
                result += sign * num
                num = 0
                prev, prev_sign = stack.pop()
                result = prev + prev_sign * result
        return result + sign * num
''',
        r'''
for s, want in [("1 + 1", 2), (" 2-1 + 2 ", 3), ("(1+(4+5+2)-3)+(6+8)", 23), ("-(2+3)", -5), ("1-(     -2)", 3)]:
    assert Solution().calculate(s) == want, s
''',
    ),
}

PATTERNS = {
    "Matrix": PATTERN(
        [
            "Traversing a grid in a specific order (spiral, layers, diagonals).",
            "In-place transformations (rotate, mark rows and columns).",
            "Updates that must happen 'simultaneously' (Game of Life).",
        ],
        [
            "Boundary variables (top, bottom, left, right) beat visited arrays for layer walks.",
            "Rotate clockwise = transpose + reverse rows. Counter-clockwise = reverse rows + transpose.",
            "Reuse existing storage as markers (first row/column, spare bits) for O(1) extra space.",
            "Write the directions list and a bounds check once, and reuse them everywhere.",
        ],
        r'''
DIRS = [(0, 1), (1, 0), (0, -1), (-1, 0)]      # right, down, left, up

def neighbors(grid, r, c):
    m, n = len(grid), len(grid[0])
    for dr, dc in DIRS:
        nr, nc = r + dr, c + dc
        if 0 <= nr < m and 0 <= nc < n:
            yield nr, nc

def rotate_clockwise(matrix):
    n = len(matrix)
    for i in range(n):
        for j in range(i + 1, n):              # transpose
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    for row in matrix:                         # reverse each row
        row.reverse()
''',
    ),
    "Hashmap": PATTERN(
        [
            "'Have I seen this before?', or pairs that hit a target.",
            "Counting frequencies (anagrams, ransom notes).",
            "Grouping items by a canonical key.",
            "You need O(1) lookups inside a loop to avoid O(n²).",
        ],
        [
            "Complement lookup: store what you've seen, look up what you need (target − x).",
            "Canonical keys: a sorted string or a count tuple for anagrams.",
            "Bijection problems need two maps, one per direction.",
            "Sets make 'is x present' O(1). Start sequences only where they begin.",
        ],
        r'''
from collections import defaultdict

def two_sum(nums, target):
    seen = {}                       # value -> index
    for i, x in enumerate(nums):
        if target - x in seen:      # look up the complement first
            return seen[target - x], i
        seen[x] = i

def group_by_key(items, key):
    groups = defaultdict(list)
    for item in items:
        groups[key(item)].append(item)
    return list(groups.values())
''',
    ),
    "Intervals": PATTERN(
        [
            "Ranges with a start and end: merging, inserting, overlapping, scheduling.",
            "The minimum number of points, rooms or arrows to cover or separate intervals.",
        ],
        [
            "Sort by start to merge. Sort by end for greedy selection (max non-overlapping, min arrows).",
            "Two intervals overlap iff a.start ≤ b.end and b.start ≤ a.end.",
            "Meeting rooms: sort starts and ends separately, or keep a min-heap of end times.",
            "Clarify whether touching endpoints count as overlapping.",
        ],
        r'''
def merge(intervals):
    intervals.sort(key=lambda iv: iv[0])
    out = []
    for start, end in intervals:
        if out and start <= out[-1][1]:          # overlaps the last one
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out

def max_non_overlapping(intervals):              # greedy by end time
    count, last_end = 0, float("-inf")
    for start, end in sorted(intervals, key=lambda iv: iv[1]):
        if start >= last_end:
            count, last_end = count + 1, end
    return count
''',
    ),
    "Stack": PATTERN(
        [
            "Matching pairs and nesting (brackets, tags, directories).",
            "Expression evaluation and parsing.",
            "The most recent unresolved item matters (undo, current path).",
            "'Next greater / smaller element' → monotonic stack.",
        ],
        [
            "Push the opener and pop on the closer: the stack holds whatever is still open.",
            "Save context on '(' and restore it on ')' for nested expressions.",
            "Store extra info with each element (such as the current min) for O(1) queries.",
            "Monotonic stack: pop while the new element breaks the order. Each element is pushed and popped once, so it's O(n).",
        ],
        r'''
def next_greater(nums):
    res = [-1] * len(nums)
    stack = []                          # indices whose values are decreasing
    for i, x in enumerate(nums):
        while stack and nums[stack[-1]] < x:
            res[stack.pop()] = x        # x is the next greater element for that index
        stack.append(i)
    return res

def is_balanced(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack
''',
    ),
}
