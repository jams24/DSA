from common import P, PATTERN

GUIDES = {
    # ------------------------------------------------------------------ Array / String
    "merge-sorted-array": P(
        "Fill nums1 from the back. The largest remaining element goes into the last free slot, so you never overwrite a value you still need.",
        ["Pointers i = m−1 (nums1), j = n−1 (nums2) and write index k = m+n−1.", "Write the larger of nums1[i] and nums2[j] at k and move that pointer.", "Loop while j ≥ 0. Anything left in nums1 is already in place."],
        "O(m + n)", "O(1)",
        "Looping while i ≥ 0 instead of j ≥ 0 leaves nums2 elements uncopied when nums1 runs out first.",
        r'''
class Solution:
    def merge(self, nums1: List[int], m: int, nums2: List[int], n: int) -> None:
        i, j, k = m - 1, n - 1, m + n - 1
        while j >= 0:
            if i >= 0 and nums1[i] > nums2[j]:
                nums1[k] = nums1[i]
                i -= 1
            else:
                nums1[k] = nums2[j]
                j -= 1
            k -= 1
''',
        r'''
a = [1, 2, 3, 0, 0, 0]; Solution().merge(a, 3, [2, 5, 6], 3); assert a == [1, 2, 2, 3, 5, 6]
b = [0]; Solution().merge(b, 0, [1], 1); assert b == [1]
''',
    ),
    "remove-element": P(
        "Read/write pointers: the write index only advances for elements you keep.",
        ["k = 0 is the next write slot.", "For each x ≠ val, write nums[k] = x and increment k.", "Return k. The first k slots hold the kept values."],
        "O(n)", "O(1)",
        "Deleting from the list while iterating (nums.remove) is O(n²) and skips elements.",
        r'''
class Solution:
    def removeElement(self, nums: List[int], val: int) -> int:
        k = 0
        for x in nums:
            if x != val:
                nums[k] = x
                k += 1
        return k
''',
        r'''
a = [3, 2, 2, 3]; k = Solution().removeElement(a, 3); assert k == 2 and sorted(a[:k]) == [2, 2]
a = [0, 1, 2, 2, 3, 0, 4, 2]; k = Solution().removeElement(a, 2); assert k == 5 and sorted(a[:k]) == [0, 0, 1, 3, 4]
''',
    ),
    "remove-duplicates-from-sorted-array": P(
        "Sorted means duplicates are adjacent: keep a value only if it differs from the last value you kept.",
        ["The first element is always kept: k = 1.", "Compare each next element with nums[k−1], the last kept value.", "If it's different, write it at k and advance."],
        "O(n)", "O(1)",
        "Returning the list instead of k, or comparing with the wrong neighbour after overwriting.",
        r'''
class Solution:
    def removeDuplicates(self, nums: List[int]) -> int:
        k = 1
        for i in range(1, len(nums)):
            if nums[i] != nums[k - 1]:
                nums[k] = nums[i]
                k += 1
        return k
''',
        r'''
a = [1, 1, 2]; k = Solution().removeDuplicates(a); assert (k, a[:k]) == (2, [1, 2])
a = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]; k = Solution().removeDuplicates(a); assert (k, a[:k]) == (5, [0, 1, 2, 3, 4])
''',
    ),
    "remove-duplicates-from-sorted-array-ii": P(
        "To allow each value at most twice, compare with the element two positions behind the write index.",
        ["Always keep the first two elements.", "Keep x if it differs from nums[k−2]. If it's equal, it would be a third copy.", "Generalizes to 'at most t copies': compare with nums[k−t]."],
        "O(n)", "O(1)",
        "Comparing with nums[i−2] on the read side fails because that slot may already be overwritten.",
        r'''
class Solution:
    def removeDuplicates(self, nums: List[int]) -> int:
        k = 0
        for x in nums:
            if k < 2 or x != nums[k - 2]:
                nums[k] = x
                k += 1
        return k
''',
        r'''
a = [1, 1, 1, 2, 2, 3]; k = Solution().removeDuplicates(a); assert (k, a[:k]) == (5, [1, 1, 2, 2, 3])
a = [0, 0, 1, 1, 1, 1, 2, 3, 3]; k = Solution().removeDuplicates(a); assert (k, a[:k]) == (7, [0, 0, 1, 1, 2, 3, 3])
''',
    ),
    "majority-element": P(
        "Boyer–Moore voting: pair each majority element with a different element to cancel it. The majority survives because it has more than n/2 copies.",
        ["Keep a candidate and a counter.", "When the counter is 0, adopt the current element as the candidate.", "+1 for a match, −1 otherwise. The final candidate is the answer."],
        "O(n)", "O(1)",
        "This only works because a majority is guaranteed. Without that, verify the candidate with a second pass.",
        r'''
class Solution:
    def majorityElement(self, nums: List[int]) -> int:
        candidate, count = None, 0
        for x in nums:
            if count == 0:
                candidate = x
            count += 1 if x == candidate else -1
        return candidate
''',
        r'''
assert Solution().majorityElement([3, 2, 3]) == 3
assert Solution().majorityElement([2, 2, 1, 1, 1, 2, 2]) == 2
''',
    ),
    "rotate-array": P(
        "Rotating right by k = reverse everything, then reverse the first k and the last n−k separately.",
        ["k %= n, since k can exceed the length.", "Reverse the whole array: the last k elements move to the front, backwards.", "Reverse the first k and the remaining n−k to fix their order."],
        "O(n)", "O(1)",
        "Forgetting k %= n. Also, nums = nums[-k:] + nums[:-k] rebinds the name instead of modifying in place (use nums[:] = …).",
        r'''
class Solution:
    def rotate(self, nums: List[int], k: int) -> None:
        n = len(nums)
        k %= n

        def reverse(lo, hi):
            while lo < hi:
                nums[lo], nums[hi] = nums[hi], nums[lo]
                lo, hi = lo + 1, hi - 1

        reverse(0, n - 1)
        reverse(0, k - 1)
        reverse(k, n - 1)
''',
        r'''
a = [1, 2, 3, 4, 5, 6, 7]; Solution().rotate(a, 3); assert a == [5, 6, 7, 1, 2, 3, 4]
a = [-1, -100, 3, 99]; Solution().rotate(a, 2); assert a == [3, 99, -1, -100]
a = [1, 2]; Solution().rotate(a, 3); assert a == [2, 1]
''',
    ),
    "best-time-to-buy-and-sell-stock": P(
        "Treat each day as the selling day. The best buy is the minimum price seen before it.",
        ["Track the lowest price so far.", "The profit from selling today = price − lowest.", "Keep the maximum profit."],
        "O(n)", "O(1)",
        "Using a future price as the buy. Update the minimum and the profit in an order that respects time.",
        r'''
class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        lowest, best = float("inf"), 0
        for p in prices:
            lowest = min(lowest, p)
            best = max(best, p - lowest)
        return best
''',
        r'''
assert Solution().maxProfit([7, 1, 5, 3, 6, 4]) == 5
assert Solution().maxProfit([7, 6, 4, 3, 1]) == 0
''',
    ),
    "best-time-to-buy-and-sell-stock-ii": P(
        "With unlimited transactions, any rising stretch splits into daily gains, so take every positive day-to-day difference.",
        ["Compare each day with the next.", "Add the difference when it's positive.", "That equals buying at every valley and selling at every peak."],
        "O(n)", "O(1)",
        "Overthinking it with DP. The greedy is provably optimal here.",
        r'''
class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        return sum(max(0, b - a) for a, b in zip(prices, prices[1:]))
''',
        r'''
assert Solution().maxProfit([7, 1, 5, 3, 6, 4]) == 7
assert Solution().maxProfit([1, 2, 3, 4, 5]) == 4
assert Solution().maxProfit([7, 6, 4, 3, 1]) == 0
''',
    ),
    "jump-game": P(
        "Track the farthest index you can reach so far. If you ever stand beyond it, you're stuck.",
        ["reach = 0.", "For each i: if i > reach, return False. Otherwise reach = max(reach, i + nums[i]).", "Finishing the loop means the end is reachable."],
        "O(n)", "O(1)",
        "Trying every jump length recursively is exponential. Greedy reach is O(n).",
        r'''
class Solution:
    def canJump(self, nums: List[int]) -> bool:
        reach = 0
        for i, x in enumerate(nums):
            if i > reach:
                return False
            reach = max(reach, i + x)
        return True
''',
        r'''
assert Solution().canJump([2, 3, 1, 1, 4]) is True
assert Solution().canJump([3, 2, 1, 0, 4]) is False
''',
    ),
    "jump-game-ii": P(
        "Think in BFS levels: the indices reachable with j jumps form a range, and the next range ends at the farthest jump from inside it.",
        ["end = the boundary of the current level, far = the farthest reach seen.", "Scan i up to n−2, updating far.", "When i reaches end, take a jump: jumps += 1, end = far."],
        "O(n)", "O(1)",
        "Looping all the way to the last index counts one jump too many. Stop at n−2.",
        r'''
class Solution:
    def jump(self, nums: List[int]) -> int:
        jumps = end = far = 0
        for i in range(len(nums) - 1):
            far = max(far, i + nums[i])
            if i == end:
                jumps += 1
                end = far
        return jumps
''',
        r'''
assert Solution().jump([2, 3, 1, 1, 4]) == 2
assert Solution().jump([2, 3, 0, 1, 4]) == 2
assert Solution().jump([0]) == 0
''',
    ),
    "h-index": P(
        "Sorted descending, the h-index is the largest h where the h-th paper still has at least h citations.",
        ["Sort citations in descending order.", "Advance h while citations[h] ≥ h + 1.", "Counting sort with n+1 buckets gives O(n)."],
        "O(n log n)", "O(1)",
        "Off-by-one errors between the 0-based index and the paper count.",
        r'''
class Solution:
    def hIndex(self, citations: List[int]) -> int:
        citations.sort(reverse=True)
        h = 0
        while h < len(citations) and citations[h] >= h + 1:
            h += 1
        return h
''',
        r'''
assert Solution().hIndex([3, 0, 6, 1, 5]) == 3
assert Solution().hIndex([1, 3, 1]) == 1
assert Solution().hIndex([0]) == 0
''',
    ),
    "insert-delete-getrandom-o1": P(
        "Arrays give O(1) random access but slow deletes. Fix deletes by swapping the target with the last element and popping.",
        ["Keep a list of values plus a map from value → index.", "Insert: append and record the index.", "Remove: move the last value into the removed slot, update its index, then pop.", "getRandom: a random index into the list."],
        "O(1) average per operation", "O(n)",
        "Deleting the map entry before updating the moved element's index breaks removing the last element itself.",
        r'''
class RandomizedSet:
    def __init__(self):
        self.pos = {}
        self.vals = []

    def insert(self, val: int) -> bool:
        if val in self.pos:
            return False
        self.pos[val] = len(self.vals)
        self.vals.append(val)
        return True

    def remove(self, val: int) -> bool:
        if val not in self.pos:
            return False
        i, last = self.pos[val], self.vals[-1]
        self.vals[i] = last
        self.pos[last] = i
        self.vals.pop()
        del self.pos[val]
        return True

    def getRandom(self) -> int:
        return random.choice(self.vals)
''',
        r'''
rs = RandomizedSet()
assert rs.insert(1) and not rs.remove(2) and rs.insert(2)
assert rs.getRandom() in (1, 2)
assert rs.remove(1) and not rs.insert(2) and rs.getRandom() == 2
assert rs.remove(2) and rs.vals == [] and rs.pos == {}
''',
    ),
    "product-of-array-except-self": P(
        "answer[i] = (product of everything left of i) × (product of everything right of i). No division needed.",
        ["The first pass writes prefix products into the output.", "The second pass multiplies in a running suffix product from the right.", "The output array doesn't count as extra space."],
        "O(n)", "O(1) extra",
        "Using total product ÷ nums[i] breaks on zeros (and the problem forbids division).",
        r'''
class Solution:
    def productExceptSelf(self, nums: List[int]) -> List[int]:
        n = len(nums)
        out = [1] * n
        left = 1
        for i in range(n):
            out[i] = left
            left *= nums[i]
        right = 1
        for i in range(n - 1, -1, -1):
            out[i] *= right
            right *= nums[i]
        return out
''',
        r'''
assert Solution().productExceptSelf([1, 2, 3, 4]) == [24, 12, 8, 6]
assert Solution().productExceptSelf([-1, 1, 0, -3, 3]) == [0, 0, 9, 0, 0]
''',
    ),
    "gas-station": P(
        "If you run dry going from A to B, no station between A and B can be the start either, so jump the start past B.",
        ["If total gas < total cost, return −1.", "Drive once, accumulating gas − cost.", "When the tank goes negative at i, set start = i + 1 and reset the tank.", "The final start is the answer (it's guaranteed unique)."],
        "O(n)", "O(1)",
        "Simulating from every start is O(n²).",
        r'''
class Solution:
    def canCompleteCircuit(self, gas: List[int], cost: List[int]) -> int:
        if sum(gas) < sum(cost):
            return -1
        tank = start = 0
        for i in range(len(gas)):
            tank += gas[i] - cost[i]
            if tank < 0:
                start, tank = i + 1, 0
        return start
''',
        r'''
assert Solution().canCompleteCircuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]) == 3
assert Solution().canCompleteCircuit([2, 3, 4], [3, 4, 3]) == -1
''',
    ),
    "candy": P(
        "Satisfy each neighbour constraint separately: a forward pass handles left neighbours, a backward pass handles right neighbours, and max() satisfies both.",
        ["Everyone starts with 1.", "Left → right: if rated higher than the left neighbour, give left + 1.", "Right → left: if rated higher than the right neighbour, take max(current, right + 1).", "Sum."],
        "O(n)", "O(n)",
        "Equal ratings impose no constraint, so don't give extra candy for ties.",
        r'''
class Solution:
    def candy(self, ratings: List[int]) -> int:
        n = len(ratings)
        c = [1] * n
        for i in range(1, n):
            if ratings[i] > ratings[i - 1]:
                c[i] = c[i - 1] + 1
        for i in range(n - 2, -1, -1):
            if ratings[i] > ratings[i + 1]:
                c[i] = max(c[i], c[i + 1] + 1)
        return sum(c)
''',
        r'''
assert Solution().candy([1, 0, 2]) == 5
assert Solution().candy([1, 2, 2]) == 4
''',
    ),
    "trapping-rain-water": P(
        "Water above i = min(max to the left, max to the right) − height[i]. With two pointers, the side with the lower wall is already bounded by its own max.",
        ["Start pointers at both ends, with leftMax and rightMax.", "Move the pointer on the lower side, since the other side guarantees a taller wall exists.", "Add (that side's max so far − height) for the cell."],
        "O(n)", "O(1)",
        "Moving the wrong pointer. Prefix/suffix max arrays also work, at O(n) space.",
        r'''
class Solution:
    def trap(self, height: List[int]) -> int:
        l, r = 0, len(height) - 1
        lmax = rmax = water = 0
        while l < r:
            if height[l] < height[r]:
                lmax = max(lmax, height[l])
                water += lmax - height[l]
                l += 1
            else:
                rmax = max(rmax, height[r])
                water += rmax - height[r]
                r -= 1
        return water
''',
        r'''
assert Solution().trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]) == 6
assert Solution().trap([4, 2, 0, 3, 2, 5]) == 9
''',
    ),
    "roman-to-integer": P(
        "A symbol smaller than the one after it is subtracted (IV, IX, XL…). Otherwise it's added.",
        ["Map each symbol to its value.", "For each symbol, look at the next one.", "Subtract if the next is larger, otherwise add."],
        "O(n)", "O(1)",
        "Special-casing all six subtractive pairs instead of applying the one comparison rule.",
        r'''
class Solution:
    def romanToInt(self, s: str) -> int:
        v = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
        total = 0
        for i, ch in enumerate(s):
            if i + 1 < len(s) and v[ch] < v[s[i + 1]]:
                total -= v[ch]
            else:
                total += v[ch]
        return total
''',
        r'''
assert Solution().romanToInt("III") == 3
assert Solution().romanToInt("LVIII") == 58
assert Solution().romanToInt("MCMXCIV") == 1994
''',
    ),
    "integer-to-roman": P(
        "Include the subtractive forms (900, 400, 90, 40, 9, 4) as symbols of their own. Then it's plain greedy change-making.",
        ["List the 13 value/symbol pairs from largest to smallest.", "For each, emit the symbol as many times as it fits.", "Subtract and continue."],
        "O(1) (bounded by 3999)", "O(1)",
        "Forgetting the subtractive pairs produces IIII instead of IV.",
        r'''
class Solution:
    def intToRoman(self, num: int) -> str:
        pairs = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
                 (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
        out = []
        for value, symbol in pairs:
            count, num = divmod(num, value)
            out.append(symbol * count)
        return "".join(out)
''',
        r'''
assert Solution().intToRoman(3749) == "MMMDCCXLIX"
assert Solution().intToRoman(58) == "LVIII"
assert Solution().intToRoman(1994) == "MCMXCIV"
''',
    ),
    "length-of-last-word": P(
        "Scan from the end: skip trailing spaces, then count until the next space.",
        ["Move i left past trailing spaces.", "Count characters until a space or the start.", "Return the count."],
        "O(n)", "O(1)",
        "Trailing spaces. s.split()[-1] works, but it builds every word.",
        r'''
class Solution:
    def lengthOfLastWord(self, s: str) -> int:
        i = len(s) - 1
        while s[i] == " ":
            i -= 1
        n = 0
        while i >= 0 and s[i] != " ":
            n += 1
            i -= 1
        return n
''',
        r'''
assert Solution().lengthOfLastWord("Hello World") == 5
assert Solution().lengthOfLastWord("   fly me   to   the moon  ") == 4
assert Solution().lengthOfLastWord("luffy is still joyboy") == 6
''',
    ),
    "longest-common-prefix": P(
        "The answer can only shrink: start with the first word and trim it until every other word starts with it.",
        ["prefix = the first string.", "For each other string, chop characters off prefix until it matches its start.", "An empty prefix means no common prefix."],
        "O(S) over all characters", "O(1)",
        "Indexing past the end of the shortest word when comparing column by column.",
        r'''
class Solution:
    def longestCommonPrefix(self, strs: List[str]) -> str:
        prefix = strs[0]
        for s in strs[1:]:
            while not s.startswith(prefix):
                prefix = prefix[:-1]
        return prefix
''',
        r'''
assert Solution().longestCommonPrefix(["flower", "flow", "flight"]) == "fl"
assert Solution().longestCommonPrefix(["dog", "racecar", "car"]) == ""
''',
    ),
    "reverse-words-in-a-string": P(
        "split() with no argument drops all extra whitespace, so reverse and join with single spaces. In place: reverse the whole string, then reverse each word.",
        ["Split on runs of whitespace.", "Reverse the list of words.", "Join with a single space."],
        "O(n)", "O(n)",
        "split(' ') keeps empty strings for repeated spaces.",
        r'''
class Solution:
    def reverseWords(self, s: str) -> str:
        return " ".join(reversed(s.split()))
''',
        r'''
assert Solution().reverseWords("the sky is blue") == "blue is sky the"
assert Solution().reverseWords("  hello world  ") == "world hello"
assert Solution().reverseWords("a good   example") == "example good a"
''',
    ),
    "zigzag-conversion": P(
        "Don't compute positions, simulate: append each character to the current row while the row index bounces between the top and bottom.",
        ["Make numRows string buffers.", "Walk the characters, appending to rows[r].", "Flip direction at row 0 and row numRows−1.", "Concatenate the rows."],
        "O(n)", "O(n)",
        "numRows = 1 never bounces. Return s directly.",
        r'''
class Solution:
    def convert(self, s: str, numRows: int) -> str:
        if numRows == 1 or numRows >= len(s):
            return s
        rows = [""] * numRows
        r, step = 0, 1
        for ch in s:
            rows[r] += ch
            if r == 0:
                step = 1
            elif r == numRows - 1:
                step = -1
            r += step
        return "".join(rows)
''',
        r'''
assert Solution().convert("PAYPALISHIRING", 3) == "PAHNAPLSIIGYIR"
assert Solution().convert("PAYPALISHIRING", 4) == "PINALSIGYAHRPI"
assert Solution().convert("A", 1) == "A"
''',
    ),
    "find-the-index-of-the-first-occurrence-in-a-string": P(
        "Compare the needle at every start position. For guaranteed O(n + m), KMP precomputes how far to fall back on a mismatch.",
        ["For each start i from 0 to n − m, compare haystack[i:i+m] with the needle.", "Return the first match, or −1.", "Mention KMP or Rabin–Karp as the follow-up."],
        "O(n·m) worst case (O(n + m) with KMP)", "O(1)",
        "The loop bound must be n − m + 1, or you read past the end.",
        r'''
class Solution:
    def strStr(self, haystack: str, needle: str) -> int:
        n, m = len(haystack), len(needle)
        for i in range(n - m + 1):
            if haystack[i:i + m] == needle:
                return i
        return -1
''',
        r'''
assert Solution().strStr("sadbutsad", "sad") == 0
assert Solution().strStr("leetcode", "leeto") == -1
''',
    ),
    "text-justification": P(
        "Greedy line packing plus round-robin spaces: add one space at a time to the gaps from the left, which naturally puts the extra spaces on the left.",
        ["Add words to the line while letters + one space per gap still fit.", "Distribute maxWidth − letters spaces across the gaps round-robin, from the left.", "Single-word lines and the last line are left-justified and padded on the right."],
        "O(total characters)", "O(maxWidth)",
        "The last line and single-word lines are special cases, and that's where most bugs live.",
        r'''
class Solution:
    def fullJustify(self, words: List[str], maxWidth: int) -> List[str]:
        res, line, letters = [], [], 0
        for w in words:
            if letters + len(w) + len(line) > maxWidth:
                gaps = len(line) - 1 or 1
                for i in range(maxWidth - letters):
                    line[i % gaps] += " "
                res.append("".join(line))
                line, letters = [], 0
            line.append(w)
            letters += len(w)
        res.append(" ".join(line).ljust(maxWidth))
        return res
''',
        r'''
assert Solution().fullJustify(["This", "is", "an", "example", "of", "text", "justification."], 16) == ["This    is    an", "example  of text", "justification.  "]
assert Solution().fullJustify(["What", "must", "be", "acknowledgment", "shall", "be"], 16) == ["What   must   be", "acknowledgment  ", "shall be        "]
''',
    ),
    # ------------------------------------------------------------------ Two Pointers
    "valid-palindrome": P(
        "Compare from both ends inward, skipping anything that isn't a letter or digit. No cleaned copy needed.",
        ["l = 0, r = n−1.", "Skip non-alphanumeric characters on either side.", "Compare lowercase characters, then move both pointers inward."],
        "O(n)", "O(1)",
        "Digits count as alphanumeric ('0P' is not a palindrome). Compare in lowercase.",
        r'''
class Solution:
    def isPalindrome(self, s: str) -> bool:
        l, r = 0, len(s) - 1
        while l < r:
            if not s[l].isalnum():
                l += 1
            elif not s[r].isalnum():
                r -= 1
            elif s[l].lower() != s[r].lower():
                return False
            else:
                l, r = l + 1, r - 1
        return True
''',
        r'''
assert Solution().isPalindrome("A man, a plan, a canal: Panama") is True
assert Solution().isPalindrome("race a car") is False
assert Solution().isPalindrome(" ") is True
''',
    ),
    "is-subsequence": P(
        "Greedy matching: take the first occurrence in t of each character of s. Matching early never hurts.",
        ["Pointer i into s.", "Scan t, advancing i whenever t's character equals s[i].", "s is a subsequence iff i reaches len(s)."],
        "O(|t|)", "O(1)",
        "The follow-up: for many queries, pre-index t (positions of each character) and binary-search the next position.",
        r'''
class Solution:
    def isSubsequence(self, s: str, t: str) -> bool:
        i = 0
        for ch in t:
            if i < len(s) and s[i] == ch:
                i += 1
        return i == len(s)
''',
        r'''
assert Solution().isSubsequence("abc", "ahbgdc") is True
assert Solution().isSubsequence("axc", "ahbgdc") is False
assert Solution().isSubsequence("", "abc") is True
''',
    ),
    "two-sum-ii-input-array-is-sorted": P(
        "Sorted input: if the sum is too small, only moving the left pointer can increase it. If it's too big, only moving the right pointer can decrease it.",
        ["l at the start, r at the end.", "Compute the sum: equal → done, smaller → l++, larger → r−−.", "Each move rules out a whole row of pairs."],
        "O(n)", "O(1)",
        "The answer is 1-indexed.",
        r'''
class Solution:
    def twoSum(self, numbers: List[int], target: int) -> List[int]:
        l, r = 0, len(numbers) - 1
        while l < r:
            s = numbers[l] + numbers[r]
            if s == target:
                return [l + 1, r + 1]
            if s < target:
                l += 1
            else:
                r -= 1
''',
        r'''
assert Solution().twoSum([2, 7, 11, 15], 9) == [1, 2]
assert Solution().twoSum([2, 3, 4], 6) == [1, 3]
assert Solution().twoSum([-1, 0], -1) == [1, 2]
''',
    ),
    "container-with-most-water": P(
        "Start with the widest container. Moving the taller wall can never help (the width shrinks and the height is capped by the shorter wall), so always move the shorter one.",
        ["l = 0, r = n−1.", "Area = (r − l) × min(height[l], height[r]). Keep the best.", "Move the pointer at the shorter wall inward."],
        "O(n)", "O(1)",
        "Coding the greedy without being able to explain why it's safe. That proof is what interviewers want.",
        r'''
class Solution:
    def maxArea(self, height: List[int]) -> int:
        l, r, best = 0, len(height) - 1, 0
        while l < r:
            best = max(best, (r - l) * min(height[l], height[r]))
            if height[l] < height[r]:
                l += 1
            else:
                r -= 1
        return best
''',
        r'''
assert Solution().maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]) == 49
assert Solution().maxArea([1, 1]) == 1
''',
    ),
    "3sum": P(
        "Sort, fix the smallest number, and it's Two Sum II on the rest. Sorting also puts duplicates next to each other, so they're easy to skip.",
        ["Sort the array.", "For each i (skipping repeated values), two-pointer the range i+1 … n−1 for −nums[i].", "After a match, move both pointers and skip duplicates of nums[l].", "Stop early once nums[i] > 0."],
        "O(n²)", "O(1) extra (ignoring the sort)",
        "Duplicate triplets: skip equal values for i, and for l after each match.",
        r'''
class Solution:
    def threeSum(self, nums: List[int]) -> List[List[int]]:
        nums.sort()
        res = []
        for i in range(len(nums) - 2):
            if nums[i] > 0:
                break
            if i and nums[i] == nums[i - 1]:
                continue
            l, r = i + 1, len(nums) - 1
            while l < r:
                s = nums[i] + nums[l] + nums[r]
                if s < 0:
                    l += 1
                elif s > 0:
                    r -= 1
                else:
                    res.append([nums[i], nums[l], nums[r]])
                    l, r = l + 1, r - 1
                    while l < r and nums[l] == nums[l - 1]:
                        l += 1
        return res
''',
        r'''
assert sorted(Solution().threeSum([-1, 0, 1, 2, -1, -4])) == [[-1, -1, 2], [-1, 0, 1]]
assert Solution().threeSum([0, 1, 1]) == []
assert Solution().threeSum([0, 0, 0, 0]) == [[0, 0, 0]]
''',
    ),
    # ------------------------------------------------------------------ Sliding Window
    "minimum-size-subarray-sum": P(
        "Every number is positive, so growing the window only increases the sum and shrinking only decreases it. That monotonicity is what makes a sliding window valid.",
        ["Expand right, adding nums[r] to the sum.", "While sum ≥ target: record the length, subtract nums[l], l++.", "Return the best length, or 0."],
        "O(n)", "O(1)",
        "With negative numbers the window trick breaks. You'd need prefix sums with a monotonic deque.",
        r'''
class Solution:
    def minSubArrayLen(self, target: int, nums: List[int]) -> int:
        best, s, l = float("inf"), 0, 0
        for r, x in enumerate(nums):
            s += x
            while s >= target:
                best = min(best, r - l + 1)
                s -= nums[l]
                l += 1
        return 0 if best == float("inf") else best
''',
        r'''
assert Solution().minSubArrayLen(7, [2, 3, 1, 2, 4, 3]) == 2
assert Solution().minSubArrayLen(4, [1, 4, 4]) == 1
assert Solution().minSubArrayLen(11, [1] * 8) == 0
''',
    ),
    "longest-substring-without-repeating-characters": P(
        "Remember each character's last index. When it repeats inside the window, jump the left edge just past the previous occurrence.",
        ["last = {char: last index}, l = 0.", "For each r: if s[r] was seen at index ≥ l, set l = last[s[r]] + 1.", "Update last[s[r]] = r and the best length r − l + 1."],
        "O(n)", "O(min(n, alphabet))",
        "Not checking last[ch] ≥ l lets the left edge move backwards (try 'abba').",
        r'''
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        last, l, best = {}, 0, 0
        for r, ch in enumerate(s):
            if last.get(ch, -1) >= l:
                l = last[ch] + 1
            last[ch] = r
            best = max(best, r - l + 1)
        return best
''',
        r'''
for s, want in [("abcabcbb", 3), ("bbbbb", 1), ("pwwkew", 3), ("", 0), ("abba", 2)]:
    assert Solution().lengthOfLongestSubstring(s) == want, s
''',
    ),
    "substring-with-concatenation-of-all-words": P(
        "All words have the same length, so slide in word-sized steps. Run one window per starting offset (0 … wordLen−1), keeping word counts as you would character counts.",
        ["need = Counter(words).", "For each offset, move r in steps of wordLen and add the word to the window counts.", "A word not in need resets the window. Too many copies → shrink from the left.", "When the window holds exactly k words, record l and slide forward one word."],
        "O(n · wordLen)", "O(k)",
        "Restarting the scan at every index (O(n·k·wordLen)), and forgetting that the word list can contain duplicates.",
        r'''
class Solution:
    def findSubstring(self, s: str, words: List[str]) -> List[int]:
        wl, k = len(words[0]), len(words)
        need = Counter(words)
        res = []
        for off in range(wl):
            l, seen, count = off, Counter(), 0
            for r in range(off, len(s) - wl + 1, wl):
                w = s[r:r + wl]
                if w not in need:
                    seen.clear()
                    count, l = 0, r + wl
                    continue
                seen[w] += 1
                count += 1
                while seen[w] > need[w]:
                    seen[s[l:l + wl]] -= 1
                    count -= 1
                    l += wl
                if count == k:
                    res.append(l)
                    seen[s[l:l + wl]] -= 1
                    count -= 1
                    l += wl
        return res
''',
        r'''
assert sorted(Solution().findSubstring("barfoothefoobarman", ["foo", "bar"])) == [0, 9]
assert Solution().findSubstring("wordgoodgoodgoodbestword", ["word", "good", "best", "word"]) == []
assert sorted(Solution().findSubstring("barfoofoobarthefoobarman", ["bar", "foo", "the"])) == [6, 9, 12]
''',
    ),
    "minimum-window-substring": P(
        "Expand right until the window contains everything (missing == 0), then shrink from the left while it still does. Record the window, break validity, and keep expanding.",
        ["need = Counter(t), missing = len(t).", "Expand: if need[ch] > 0, decrement missing. Always decrement need[ch].", "When missing == 0, drop surplus characters from the left (need < 0), record the window, then release s[l] to look for a smaller one."],
        "O(|s| + |t|)", "O(alphabet)",
        "Comparing whole count maps at every step is O(52·n). A single 'missing' counter keeps it O(n).",
        r'''
class Solution:
    def minWindow(self, s: str, t: str) -> str:
        need = Counter(t)
        missing = len(t)
        l = start = 0
        end = float("inf")
        for r, ch in enumerate(s):
            if need[ch] > 0:
                missing -= 1
            need[ch] -= 1
            if missing == 0:
                while need[s[l]] < 0:
                    need[s[l]] += 1
                    l += 1
                if r - l < end - start:
                    start, end = l, r
                need[s[l]] += 1
                missing += 1
                l += 1
        return "" if end == float("inf") else s[start:end + 1]
''',
        r'''
assert Solution().minWindow("ADOBECODEBANC", "ABC") == "BANC"
assert Solution().minWindow("a", "a") == "a"
assert Solution().minWindow("a", "aa") == ""
''',
    ),
}

PATTERNS = {
    "Array / String": PATTERN(
        [
            "Modify in place with O(1) extra space → read/write pointers.",
            "'Best so far' questions (min price, farthest reach) → one pass with a running variable.",
            "'Everything except i' → prefix and suffix passes.",
            "Rotations and reordering → reversal tricks.",
        ],
        [
            "A write index that only advances for kept elements removes items without shifting.",
            "Prefix/suffix arrays (or two passes) turn 'all except i' into O(n).",
            "Greedy works when a local choice can never hurt later: prove it out loud.",
            "In Python, slicing and join are fine in interviews, but know the in-place versions too.",
        ],
        r'''
# Read/write pointers: compact an array in place
def compact(nums, keep):
    w = 0
    for x in nums:
        if keep(x):
            nums[w] = x
            w += 1
    return w            # nums[:w] is the result

# Prefix / suffix pass: "product of everything except i"
def except_self(nums):
    n = len(nums)
    out = [1] * n
    acc = 1
    for i in range(n):              # products to the left
        out[i] = acc
        acc *= nums[i]
    acc = 1
    for i in reversed(range(n)):    # times products to the right
        out[i] *= acc
        acc *= nums[i]
    return out
''',
    ),
    "Two Pointers": PATTERN(
        [
            "Sorted array + a pair or triplet with a target sum.",
            "Palindromes, or comparing from both ends.",
            "Merging two sorted sequences.",
            "Partitioning or removing elements in place.",
        ],
        [
            "Opposite ends: each move discards a whole row of candidate pairs, so O(n) instead of O(n²).",
            "Sort first when order doesn't matter (k-sum), and skip duplicates after sorting.",
            "Same-direction pointers (read/write, fast/slow) handle in-place compaction.",
            "Always be able to say why moving this pointer can't skip the answer.",
        ],
        r'''
def pair_with_sum(nums, target):        # nums is sorted
    l, r = 0, len(nums) - 1
    while l < r:
        s = nums[l] + nums[r]
        if s == target:
            return l, r
        if s < target:
            l += 1                       # need a bigger sum
        else:
            r -= 1                       # need a smaller sum
    return None
''',
    ),
    "Sliding Window": PATTERN(
        [
            "Contiguous subarray or substring + longest / shortest / count.",
            "A constraint that changes monotonically as the window grows (sum of positives, distinct count, character counts).",
        ],
        [
            "Variable window: expand right every step. Shrink left while the window is invalid (longest) or while it's valid (shortest).",
            "Fixed window of size k: add the entering element, remove the leaving one.",
            "Track counts in a hash map plus one integer for 'how many are still missing'.",
            "Negative numbers break sum windows. Use prefix sums + a hash map instead.",
        ],
        r'''
from collections import Counter

def longest_valid(s, valid):
    count = Counter()
    left = best = 0
    for right, ch in enumerate(s):
        count[ch] += 1                      # 1. expand
        while not valid(count):             # 2. shrink until valid again
            count[s[left]] -= 1
            left += 1
        best = max(best, right - left + 1)  # 3. record
    return best
''',
    ),
}
