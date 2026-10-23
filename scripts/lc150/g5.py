from common import P, PATTERN

GUIDES = {
    # ------------------------------------------------------------------ Binary Search
    "search-insert-position": P(
        "This is lower bound: the first index whose value is ≥ target. A half-open [lo, hi) search with hi = len(nums) handles 'insert at the end' naturally.",
        ["lo = 0, hi = n.", "If nums[mid] < target the answer is right of mid (lo = mid + 1), otherwise hi = mid.", "When lo == hi, that's the index."],
        "O(log n)", "O(1)",
        "Mixing closed and half-open bounds causes off-by-one errors and infinite loops. Pick one template and keep it.",
        r'''
class Solution:
    def searchInsert(self, nums: List[int], target: int) -> int:
        lo, hi = 0, len(nums)
        while lo < hi:
            mid = (lo + hi) // 2
            if nums[mid] < target:
                lo = mid + 1
            else:
                hi = mid
        return lo
''',
        r'''
for t, want in [(5, 2), (2, 1), (7, 4), (0, 0)]:
    assert Solution().searchInsert([1, 3, 5, 6], t) == want
''',
    ),
    "search-a-2d-matrix": P(
        "Rows are sorted and each row starts after the previous one ends, so the matrix is one sorted array of m·n elements. Index k maps to (k // n, k % n).",
        ["Binary search over 0 … m·n − 1.", "Convert mid to (row, col).", "Compare and narrow as usual."],
        "O(log(m·n))", "O(1)",
        "Using k // m instead of k // n. Divide by the number of columns.",
        r'''
class Solution:
    def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
        m, n = len(matrix), len(matrix[0])
        lo, hi = 0, m * n - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            v = matrix[mid // n][mid % n]
            if v == target:
                return True
            if v < target:
                lo = mid + 1
            else:
                hi = mid - 1
        return False
''',
        r'''
m = [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]]
assert Solution().searchMatrix(m, 3) is True and Solution().searchMatrix(m, 13) is False
''',
    ),
    "find-peak-element": P(
        "If nums[mid] < nums[mid + 1] you're on an upward slope, and a peak must exist to the right (the edges count as −∞). Otherwise there's one at mid or to its left. The array doesn't need to be sorted for this to work.",
        ["lo = 0, hi = n − 1.", "Compare mid with mid + 1 and move toward the higher side.", "When lo == hi, it's a peak."],
        "O(log n)", "O(1)",
        "Comparing with mid − 1 as well complicates the bounds. One neighbour is enough.",
        r'''
class Solution:
    def findPeakElement(self, nums: List[int]) -> int:
        lo, hi = 0, len(nums) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if nums[mid] < nums[mid + 1]:
                lo = mid + 1
            else:
                hi = mid
        return lo
''',
        r'''
def is_peak(a, i):
    return (i == 0 or a[i] > a[i - 1]) and (i == len(a) - 1 or a[i] > a[i + 1])

for a in ([1, 2, 3, 1], [1, 2, 1, 3, 5, 6, 4], [1], [3, 2, 1]):
    assert is_peak(a, Solution().findPeakElement(a)), a
''',
    ),
    "search-in-rotated-sorted-array": P(
        "Around mid, at least one half is sorted. Check whether the target lies within that sorted half's range: if it does, search there, otherwise search the other half.",
        ["If nums[mid] == target, done.", "If nums[lo] ≤ nums[mid], the left half is sorted: check nums[lo] ≤ target < nums[mid].", "Otherwise the right half is sorted: check nums[mid] < target ≤ nums[hi]."],
        "O(log n)", "O(1)",
        "Use ≤ in nums[lo] ≤ nums[mid], or two-element ranges are misclassified.",
        r'''
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] == target:
                return mid
            if nums[lo] <= nums[mid]:
                if nums[lo] <= target < nums[mid]:
                    hi = mid - 1
                else:
                    lo = mid + 1
            else:
                if nums[mid] < target <= nums[hi]:
                    lo = mid + 1
                else:
                    hi = mid - 1
        return -1
''',
        r'''
assert Solution().search([4, 5, 6, 7, 0, 1, 2], 0) == 4
assert Solution().search([4, 5, 6, 7, 0, 1, 2], 3) == -1
assert Solution().search([1], 0) == -1
assert Solution().search([3, 1], 1) == 1
''',
    ),
    "find-first-and-last-position-of-element-in-sorted-array": P(
        "Two lower-bound searches: the first index ≥ target, and the first index ≥ target + 1, minus one. One correct lower-bound function solves both ends.",
        ["first = lower_bound(target). If it's out of range or not equal to target, return [−1, −1].", "last = lower_bound(target + 1) − 1.", "Return [first, last]."],
        "O(log n)", "O(1)",
        "Finding one occurrence and then scanning outward is O(n) when the value repeats many times.",
        r'''
class Solution:
    def searchRange(self, nums: List[int], target: int) -> List[int]:
        def lower(x):
            lo, hi = 0, len(nums)
            while lo < hi:
                mid = (lo + hi) // 2
                if nums[mid] < x:
                    lo = mid + 1
                else:
                    hi = mid
            return lo

        first = lower(target)
        if first == len(nums) or nums[first] != target:
            return [-1, -1]
        return [first, lower(target + 1) - 1]
''',
        r'''
assert Solution().searchRange([5, 7, 7, 8, 8, 10], 8) == [3, 4]
assert Solution().searchRange([5, 7, 7, 8, 8, 10], 6) == [-1, -1]
assert Solution().searchRange([], 0) == [-1, -1]
''',
    ),
    "find-minimum-in-rotated-sorted-array": P(
        "Compare mid with the right end. If nums[mid] > nums[hi], the drop (where the minimum is) lies to the right. Otherwise mid could be the minimum, so keep it with hi = mid.",
        ["lo = 0, hi = n − 1.", "nums[mid] > nums[hi] → lo = mid + 1, else hi = mid.", "Return nums[lo]."],
        "O(log n)", "O(1)",
        "Comparing with nums[lo] is ambiguous when the array isn't rotated. Compare with nums[hi].",
        r'''
class Solution:
    def findMin(self, nums: List[int]) -> int:
        lo, hi = 0, len(nums) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if nums[mid] > nums[hi]:
                lo = mid + 1
            else:
                hi = mid
        return nums[lo]
''',
        r'''
assert Solution().findMin([3, 4, 5, 1, 2]) == 1
assert Solution().findMin([4, 5, 6, 7, 0, 1, 2]) == 0
assert Solution().findMin([11, 13, 15, 17]) == 11
''',
    ),
    "median-of-two-sorted-arrays": P(
        "Binary search how many elements the smaller array contributes to the left half (i), so the larger array contributes half − i. The partition is right when both left sides ≤ both right sides, and the median comes from the four values at the border.",
        ["Make A the shorter array. half = (m + n + 1) // 2.", "Binary search i in [0, m], with j = half − i. Missing borders count as ±∞.", "If A[i−1] > B[j], move left. If B[j−1] > A[i], move right.", "Odd total → max of the left borders. Even → average of max(left borders) and min(right borders)."],
        "O(log min(m, n))", "O(1)",
        "Searching over the longer array, or forgetting the ±∞ sentinels at the edges.",
        r'''
class Solution:
    def findMedianSortedArrays(self, nums1: List[int], nums2: List[int]) -> float:
        A, B = (nums1, nums2) if len(nums1) <= len(nums2) else (nums2, nums1)
        m, n = len(A), len(B)
        half = (m + n + 1) // 2
        lo, hi = 0, m
        while lo <= hi:
            i = (lo + hi) // 2
            j = half - i
            a_left = A[i - 1] if i > 0 else float("-inf")
            a_right = A[i] if i < m else float("inf")
            b_left = B[j - 1] if j > 0 else float("-inf")
            b_right = B[j] if j < n else float("inf")
            if a_left <= b_right and b_left <= a_right:
                if (m + n) % 2:
                    return float(max(a_left, b_left))
                return (max(a_left, b_left) + min(a_right, b_right)) / 2
            if a_left > b_right:
                hi = i - 1
            else:
                lo = i + 1
''',
        r'''
assert Solution().findMedianSortedArrays([1, 3], [2]) == 2.0
assert Solution().findMedianSortedArrays([1, 2], [3, 4]) == 2.5
assert Solution().findMedianSortedArrays([], [1]) == 1.0
assert Solution().findMedianSortedArrays([2], []) == 2.0
assert Solution().findMedianSortedArrays([1, 2, 3, 4, 5], [6, 7]) == 4.0
''',
    ),
    # ------------------------------------------------------------------ Heap
    "kth-largest-element-in-an-array": P(
        "Keep a min-heap of the k largest values seen so far. Its top is the k-th largest. Quickselect averages O(n) but has an O(n²) worst case.",
        ["Push each number.", "If the heap grows past k, pop the smallest.", "Return heap[0]."],
        "O(n log k)", "O(k)",
        "Sorting is O(n log n), which is fine, but interviewers want the heap or quickselect discussion.",
        r'''
class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        heap = []
        for x in nums:
            heapq.heappush(heap, x)
            if len(heap) > k:
                heapq.heappop(heap)
        return heap[0]
''',
        r'''
assert Solution().findKthLargest([3, 2, 1, 5, 6, 4], 2) == 5
assert Solution().findKthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4) == 4
''',
    ),
    "ipo": P(
        "Greedy: among the projects you can currently afford, always do the most profitable one. Sort by capital to unlock projects as your capital grows, and keep the affordable ones in a max-heap by profit.",
        ["Sort the projects by required capital.", "Before each pick, push every newly affordable project's profit into a max-heap.", "Take the top profit (if any) and add it to w. Repeat k times."],
        "O(n log n)", "O(n)",
        "Re-scanning all projects for each pick is O(k·n).",
        r'''
class Solution:
    def findMaximizedCapital(self, k: int, w: int, profits: List[int], capital: List[int]) -> int:
        projects = sorted(zip(capital, profits))
        heap, i = [], 0
        for _ in range(k):
            while i < len(projects) and projects[i][0] <= w:
                heapq.heappush(heap, -projects[i][1])
                i += 1
            if not heap:
                break
            w -= heapq.heappop(heap)
        return w
''',
        r'''
assert Solution().findMaximizedCapital(2, 0, [1, 2, 3], [0, 1, 1]) == 4
assert Solution().findMaximizedCapital(3, 0, [1, 2, 3], [0, 1, 2]) == 6
''',
    ),
    "find-k-pairs-with-smallest-sums": P(
        "Think of a sorted matrix where row i pairs nums1[i] with every nums2[j]. Seed the heap with each row's first pair, and after popping (i, j), push (i, j + 1). It's 'merge k sorted lists' in disguise.",
        ["Push (nums1[i] + nums2[0], i, 0) for the first min(k, len(nums1)) rows.", "Pop the smallest pair and record it.", "Push its right neighbour (i, j + 1). Stop after k pairs."],
        "O(k log k)", "O(k)",
        "Generating all m·n pairs. And pushing both (i+1, j) and (i, j+1) without a visited set creates duplicates.",
        r'''
class Solution:
    def kSmallestPairs(self, nums1: List[int], nums2: List[int], k: int) -> List[List[int]]:
        heap = [(nums1[i] + nums2[0], i, 0) for i in range(min(k, len(nums1)))]
        heapq.heapify(heap)
        res = []
        while heap and len(res) < k:
            _, i, j = heapq.heappop(heap)
            res.append([nums1[i], nums2[j]])
            if j + 1 < len(nums2):
                heapq.heappush(heap, (nums1[i] + nums2[j + 1], i, j + 1))
        return res
''',
        r'''
assert Solution().kSmallestPairs([1, 7, 11], [2, 4, 6], 3) == [[1, 2], [1, 4], [1, 6]]
assert Solution().kSmallestPairs([1, 1, 2], [1, 2, 3], 2) == [[1, 1], [1, 1]]
''',
    ),
    "find-median-from-data-stream": P(
        "Split the numbers into a lower half (max-heap) and an upper half (min-heap), keeping the sizes equal or the lower half one bigger. The median sits at the heap tops.",
        ["Push into the lower heap, then move the lower heap's max into the upper heap (this keeps the order).", "If the upper heap is bigger, move its min back down.", "Median = the lower top (odd count), or the average of both tops."],
        "O(log n) add, O(1) median", "O(n)",
        "Python only has min-heaps, so store negated values for the max-heap.",
        r'''
class MedianFinder:
    def __init__(self):
        self.low = []    # max-heap of the smaller half (negated values)
        self.high = []   # min-heap of the larger half

    def addNum(self, num: int) -> None:
        heapq.heappush(self.low, -num)
        heapq.heappush(self.high, -heapq.heappop(self.low))
        if len(self.high) > len(self.low):
            heapq.heappush(self.low, -heapq.heappop(self.high))

    def findMedian(self) -> float:
        if len(self.low) > len(self.high):
            return float(-self.low[0])
        return (-self.low[0] + self.high[0]) / 2
''',
        r'''
mf = MedianFinder(); mf.addNum(1); mf.addNum(2)
assert mf.findMedian() == 1.5
mf.addNum(3)
assert mf.findMedian() == 2.0
''',
    ),
    # ------------------------------------------------------------------ Bit Manipulation
    "add-binary": P(
        "Grade-school addition in base 2: walk both strings from the right with a carry.",
        ["i, j at the last characters, carry = 0.", "Sum the bits + carry. Append sum % 2, carry = sum // 2.", "Continue while either string or the carry remains, then reverse."],
        "O(max(m, n))", "O(max(m, n))",
        "int(a, 2) + int(b, 2) works in Python but misses the point (and overflows in fixed-width languages).",
        r'''
class Solution:
    def addBinary(self, a: str, b: str) -> str:
        i, j, carry, out = len(a) - 1, len(b) - 1, 0, []
        while i >= 0 or j >= 0 or carry:
            s = carry
            if i >= 0:
                s += int(a[i])
                i -= 1
            if j >= 0:
                s += int(b[j])
                j -= 1
            out.append(str(s % 2))
            carry = s // 2
        return "".join(reversed(out))
''',
        r'''
assert Solution().addBinary("11", "1") == "100"
assert Solution().addBinary("1010", "1011") == "10101"
assert Solution().addBinary("0", "0") == "0"
''',
    ),
    "reverse-bits": P(
        "32 times: shift the result left and append n's lowest bit, then shift n right. The bits come out in reverse order.",
        ["res = 0.", "Repeat 32 times: res = (res << 1) | (n & 1), then n >>= 1.", "Return res."],
        "O(32)", "O(1)",
        "Stopping when n becomes 0 drops the trailing zeros, which should become leading zeros. Always do all 32 iterations.",
        r'''
class Solution:
    def reverseBits(self, n: int) -> int:
        res = 0
        for _ in range(32):
            res = (res << 1) | (n & 1)
            n >>= 1
        return res
''',
        r'''
assert Solution().reverseBits(43261596) == 964176192
assert Solution().reverseBits(4294967293) == 3221225471
''',
    ),
    "number-of-1-bits": P(
        "n & (n − 1) clears the lowest set bit, so the loop runs once per 1-bit.",
        ["count = 0.", "While n: n &= n − 1, count += 1.", "Return count."],
        "O(number of set bits)", "O(1)",
        "Shifting 32 times is fine too, but the n & (n − 1) trick is what interviewers look for.",
        r'''
class Solution:
    def hammingWeight(self, n: int) -> int:
        count = 0
        while n:
            n &= n - 1
            count += 1
        return count
''',
        r'''
assert Solution().hammingWeight(11) == 3
assert Solution().hammingWeight(128) == 1
assert Solution().hammingWeight(2147483645) == 30
''',
    ),
    "single-number": P(
        "XOR is its own inverse (x ^ x = 0) and is commutative, so every pair cancels out and only the single number remains.",
        ["res = 0.", "XOR in every number.", "Return res."],
        "O(n)", "O(1)",
        "A hash set works but uses O(n) space, and the problem asks for O(1).",
        r'''
class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        res = 0
        for x in nums:
            res ^= x
        return res
''',
        r'''
assert Solution().singleNumber([2, 2, 1]) == 1
assert Solution().singleNumber([4, 1, 2, 1, 2]) == 4
assert Solution().singleNumber([1]) == 1
''',
    ),
    "single-number-ii": P(
        "Count each bit position modulo 3: the bits of numbers that appear three times sum to a multiple of 3. The ones/twos state machine does this for every bit at once.",
        ["ones holds the bits seen 1 time (mod 3), twos the bits seen 2 times.", "ones = (ones ^ x) & ~twos, then twos = (twos ^ x) & ~ones.", "Bits seen 3 times are cleared from both, so ones ends up as the answer."],
        "O(n)", "O(1)",
        "A simpler alternative: sum bit i across all numbers, take it mod 3, and rebuild the answer (handle the sign bit in fixed-width languages).",
        r'''
class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        ones = twos = 0
        for x in nums:
            ones = (ones ^ x) & ~twos
            twos = (twos ^ x) & ~ones
        return ones
''',
        r'''
assert Solution().singleNumber([2, 2, 3, 2]) == 3
assert Solution().singleNumber([0, 1, 0, 1, 0, 1, 99]) == 99
assert Solution().singleNumber([-2, -2, 1, 1, 4, 1, 4, 4, -4, -2]) == -4
''',
    ),
    "bitwise-and-of-numbers-range": P(
        "Any bit that flips somewhere in the range becomes 0. Only the common binary prefix of left and right survives, so shift both right until they're equal, then shift back.",
        ["shift = 0.", "While left ≠ right, shift both right and count.", "Return left << shift."],
        "O(log n)", "O(1)",
        "ANDing every number in the range is O(right − left), which is far too slow for ranges near 2³¹.",
        r'''
class Solution:
    def rangeBitwiseAnd(self, left: int, right: int) -> int:
        shift = 0
        while left != right:
            left >>= 1
            right >>= 1
            shift += 1
        return left << shift
''',
        r'''
assert Solution().rangeBitwiseAnd(5, 7) == 4
assert Solution().rangeBitwiseAnd(0, 0) == 0
assert Solution().rangeBitwiseAnd(1, 2147483647) == 0
''',
    ),
    # ------------------------------------------------------------------ Math
    "palindrome-number": P(
        "Reverse only the second half of the number and compare it with the first half. No string conversion, and no overflow risk.",
        ["Negatives, and numbers ending in 0 (except 0 itself), are not palindromes.", "Pop digits from x onto rev until rev ≥ x.", "Palindrome iff x == rev (even length) or x == rev // 10 (odd length)."],
        "O(log n)", "O(1)",
        "Reversing the whole number can overflow in fixed-width languages. Halfway is enough.",
        r'''
class Solution:
    def isPalindrome(self, x: int) -> bool:
        if x < 0 or (x % 10 == 0 and x != 0):
            return False
        rev = 0
        while x > rev:
            rev = rev * 10 + x % 10
            x //= 10
        return x == rev or x == rev // 10
''',
        r'''
for x, want in [(121, True), (-121, False), (10, False), (0, True), (1221, True), (12321, True), (123, False)]:
    assert Solution().isPalindrome(x) is want, x
''',
    ),
    "plus-one": P(
        "Walk from the end. A digit below 9 just increments and you're done. A 9 becomes 0 and the carry moves left. If every digit was 9, prepend a 1.",
        ["For i from the last digit down: if digits[i] < 9, increment it and return.", "Otherwise set it to 0 and continue.", "Fell through → return [1] + digits."],
        "O(n)", "O(1) (O(n) only for all-9s)",
        "Converting to an integer and back can overflow in other languages and dodges the point.",
        r'''
class Solution:
    def plusOne(self, digits: List[int]) -> List[int]:
        for i in range(len(digits) - 1, -1, -1):
            if digits[i] < 9:
                digits[i] += 1
                return digits
            digits[i] = 0
        return [1] + digits
''',
        r'''
assert Solution().plusOne([1, 2, 3]) == [1, 2, 4]
assert Solution().plusOne([4, 3, 2, 1]) == [4, 3, 2, 2]
assert Solution().plusOne([9]) == [1, 0]
assert Solution().plusOne([9, 9]) == [1, 0, 0]
''',
    ),
    "factorial-trailing-zeroes": P(
        "Each trailing zero needs a factor of 10 = 2 × 5, and 2s are plentiful, so count the 5s: n/5 + n/25 + n/125 + …",
        ["count = 0.", "While n > 0: n //= 5, count += n.", "Return count."],
        "O(log n)", "O(1)",
        "Computing n! directly overflows (or is just slow), and counting only n/5 misses the extra 5s in 25, 125, …",
        r'''
class Solution:
    def trailingZeroes(self, n: int) -> int:
        count = 0
        while n:
            n //= 5
            count += n
        return count
''',
        r'''
for n, want in [(3, 0), (5, 1), (0, 0), (25, 6), (100, 24)]:
    assert Solution().trailingZeroes(n) == want
''',
    ),
    "sqrtx": P(
        "Binary search for the largest m with m·m ≤ x. When you keep lo = mid, round mid up ((lo + hi + 1) // 2), or the loop never ends.",
        ["lo = 0, hi = x.", "mid = (lo + hi + 1) // 2. If mid² ≤ x, lo = mid, else hi = mid − 1.", "Return lo."],
        "O(log x)", "O(1)",
        "The infinite loop from rounding mid down while assigning lo = mid. Newton's method also works.",
        r'''
class Solution:
    def mySqrt(self, x: int) -> int:
        lo, hi = 0, x
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if mid * mid <= x:
                lo = mid
            else:
                hi = mid - 1
        return lo
''',
        r'''
for x, want in [(4, 2), (8, 2), (0, 0), (1, 1), (2147395599, 46339)]:
    assert Solution().mySqrt(x) == want
''',
    ),
    "powx-n": P(
        "Exponentiation by squaring: x^n = (x²)^(n/2), with an extra x when n is odd. Process n's bits from the lowest, squaring x each time: O(log n) multiplications.",
        ["If n < 0, use 1/x and −n.", "While n: if the lowest bit is set, multiply the result by x. Square x, shift n right.", "Return the result."],
        "O(log n)", "O(1)",
        "Multiplying n times is O(n). In fixed-width languages, −(−2³¹) overflows, so use a 64-bit type.",
        r'''
class Solution:
    def myPow(self, x: float, n: int) -> float:
        if n < 0:
            x, n = 1 / x, -n
        result = 1.0
        while n:
            if n & 1:
                result *= x
            x *= x
            n >>= 1
        return result
''',
        r'''
for x, n, want in [(2.0, 10, 1024.0), (2.1, 3, 9.261), (2.0, -2, 0.25), (1.0, -2147483648, 1.0)]:
    assert abs(Solution().myPow(x, n) - want) < 1e-9
''',
    ),
    "max-points-on-a-line": P(
        "Fix each point as an anchor and group the other points by slope. Represent slopes as reduced (dx, dy) fractions with a normalized sign, which avoids floating-point error and handles vertical lines.",
        ["For each anchor i, count the slopes to every later point j.", "Reduce (dx, dy) by their gcd and normalize the sign.", "The best line through the anchor = the max slope count + 1."],
        "O(n²)", "O(n)",
        "Float slopes (dy / dx) suffer precision errors and crash on vertical lines.",
        r'''
class Solution:
    def maxPoints(self, points: List[List[int]]) -> int:
        if len(points) <= 2:
            return len(points)
        best = 0
        for i, (x1, y1) in enumerate(points):
            slopes = Counter()
            for x2, y2 in points[i + 1:]:
                dx, dy = x2 - x1, y2 - y1
                g = math.gcd(dx, dy)
                dx, dy = dx // g, dy // g
                if dx < 0 or (dx == 0 and dy < 0):
                    dx, dy = -dx, -dy
                slopes[(dx, dy)] += 1
            if slopes:
                best = max(best, max(slopes.values()) + 1)
        return best
''',
        r'''
assert Solution().maxPoints([[1, 1], [2, 2], [3, 3]]) == 3
assert Solution().maxPoints([[1, 1], [3, 2], [5, 3], [4, 1], [2, 3], [1, 4]]) == 4
assert Solution().maxPoints([[0, 0]]) == 1
''',
    ),
    # ------------------------------------------------------------------ 1D DP
    "climbing-stairs": P(
        "To reach step i, your last move was 1 or 2 steps: ways(i) = ways(i−1) + ways(i−2). It's Fibonacci, so two variables suffice.",
        ["ways(0) = ways(1) = 1.", "Roll two variables forward n times.", "Return the first one."],
        "O(n)", "O(1)",
        "Plain recursion without memoization is exponential.",
        r'''
class Solution:
    def climbStairs(self, n: int) -> int:
        a, b = 1, 1
        for _ in range(n):
            a, b = b, a + b
        return a
''',
        r'''
for n, want in [(1, 1), (2, 2), (3, 3), (5, 8)]:
    assert Solution().climbStairs(n) == want
''',
    ),
    "house-robber": P(
        "At each house, either skip it (keep the best so far) or rob it (the best up to two houses back + this house): dp[i] = max(dp[i−1], dp[i−2] + nums[i]).",
        ["prev = best up to i−2, cur = best up to i−1.", "For each x: prev, cur = cur, max(cur, prev + x).", "Return cur."],
        "O(n)", "O(1)",
        "Greedily taking every other house fails on inputs like [2, 1, 1, 2].",
        r'''
class Solution:
    def rob(self, nums: List[int]) -> int:
        prev = cur = 0
        for x in nums:
            prev, cur = cur, max(cur, prev + x)
        return cur
''',
        r'''
assert Solution().rob([1, 2, 3, 1]) == 4
assert Solution().rob([2, 7, 9, 3, 1]) == 12
assert Solution().rob([2, 1, 1, 2]) == 4
''',
    ),
    "word-break": P(
        "dp[i] = 'the first i characters can be segmented'. It's true if some earlier split point j is segmentable and s[j:i] is a dictionary word. Only look back as far as the longest word.",
        ["dp[0] = True (the empty prefix).", "For each i, check the split points j within maxLen of i.", "dp[i] = any(dp[j] and s[j:i] in words). Return dp[n]."],
        "O(n · maxLen)", "O(n)",
        "Plain recursion re-solves the same suffixes exponentially often. Memoize or go bottom-up.",
        r'''
class Solution:
    def wordBreak(self, s: str, wordDict: List[str]) -> bool:
        words = set(wordDict)
        max_len = max(map(len, words))
        dp = [True] + [False] * len(s)
        for i in range(1, len(s) + 1):
            for j in range(max(0, i - max_len), i):
                if dp[j] and s[j:i] in words:
                    dp[i] = True
                    break
        return dp[-1]
''',
        r'''
assert Solution().wordBreak("leetcode", ["leet", "code"]) is True
assert Solution().wordBreak("applepenapple", ["apple", "pen"]) is True
assert Solution().wordBreak("catsandog", ["cats", "dog", "sand", "and", "cat"]) is False
''',
    ),
    "coin-change": P(
        "dp[a] = the fewest coins that make amount a = 1 + min(dp[a − c]) over the coins. Greedy (largest coin first) fails for coin sets like [1, 3, 4] with amount 6.",
        ["dp[0] = 0, everything else = ∞.", "For each amount a, try every coin c ≤ a.", "dp[amount], or −1 if it's still ∞."],
        "O(amount · coins)", "O(amount)",
        "Assuming greedy works (it only does for 'canonical' coin systems).",
        r'''
class Solution:
    def coinChange(self, coins: List[int], amount: int) -> int:
        INF = amount + 1
        dp = [0] + [INF] * amount
        for a in range(1, amount + 1):
            for c in coins:
                if c <= a:
                    dp[a] = min(dp[a], dp[a - c] + 1)
        return dp[amount] if dp[amount] != INF else -1
''',
        r'''
assert Solution().coinChange([1, 2, 5], 11) == 3
assert Solution().coinChange([2], 3) == -1
assert Solution().coinChange([1], 0) == 0
assert Solution().coinChange([1, 3, 4], 6) == 2
''',
    ),
    "longest-increasing-subsequence": P(
        "Patience sorting: tails[k] is the smallest possible tail of an increasing subsequence of length k+1. For each x, binary-search the first tail ≥ x and replace it (or append). The length of tails is the answer.",
        ["tails = [].", "i = bisect_left(tails, x). Append if i == len(tails), else tails[i] = x.", "Return len(tails). (The O(n²) DP is dp[i] = 1 + max dp[j] for j < i with nums[j] < nums[i].)"],
        "O(n log n)", "O(n)",
        "tails isn't itself a valid LIS, just one of the right length. Use bisect_left for strictly increasing.",
        r'''
class Solution:
    def lengthOfLIS(self, nums: List[int]) -> int:
        tails = []
        for x in nums:
            i = bisect.bisect_left(tails, x)
            if i == len(tails):
                tails.append(x)
            else:
                tails[i] = x
        return len(tails)
''',
        r'''
assert Solution().lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18]) == 4
assert Solution().lengthOfLIS([0, 1, 0, 3, 2, 3]) == 4
assert Solution().lengthOfLIS([7, 7, 7, 7]) == 1
''',
    ),
    # ------------------------------------------------------------------ Multidimensional DP
    "triangle": P(
        "Go bottom-up: each cell's best path = its value + the smaller of the two cells below it. The answer ends up at the top, using one row of memory.",
        ["dp = a copy of the last row.", "For each row going up: dp[i] = row[i] + min(dp[i], dp[i+1]).", "Return dp[0]."],
        "O(n²)", "O(n)",
        "Going top-down forces you to handle the edges of each row and take a min at the end. Bottom-up avoids both.",
        r'''
class Solution:
    def minimumTotal(self, triangle: List[List[int]]) -> int:
        dp = triangle[-1][:]
        for row in reversed(triangle[:-1]):
            for i, v in enumerate(row):
                dp[i] = v + min(dp[i], dp[i + 1])
        return dp[0]
''',
        r'''
assert Solution().minimumTotal([[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]]) == 11
assert Solution().minimumTotal([[-10]]) == -10
''',
    ),
    "minimum-path-sum": P(
        "You can only arrive from the top or from the left: dp[r][c] = grid[r][c] + min(top, left). One rolling row is enough.",
        ["dp = [∞] × n with dp[0] = 0 before the first row.", "For each cell: dp[c] = grid[r][c] + min(dp[c] (top), dp[c−1] (left)).", "Return dp[-1]."],
        "O(m·n)", "O(n)",
        "Forgetting that the first row and first column have only one way in.",
        r'''
class Solution:
    def minPathSum(self, grid: List[List[int]]) -> int:
        n = len(grid[0])
        dp = [float("inf")] * n
        dp[0] = 0
        for row in grid:
            for c in range(n):
                dp[c] = row[c] + (min(dp[c], dp[c - 1]) if c else dp[c])
        return dp[-1]
''',
        r'''
assert Solution().minPathSum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]) == 7
assert Solution().minPathSum([[1, 2, 3], [4, 5, 6]]) == 12
''',
    ),
    "unique-paths-ii": P(
        "Paths into a cell = paths from above + paths from the left, and an obstacle cell has 0 paths. A rolling row does it in O(n) space.",
        ["dp = [0] × n, dp[0] = 1.", "For each cell: an obstacle → 0, otherwise dp[c] += dp[c−1].", "Return dp[-1]."],
        "O(m·n)", "O(n)",
        "An obstacle at the start (or end) makes the answer 0, and the rolling update handles that automatically.",
        r'''
class Solution:
    def uniquePathsWithObstacles(self, obstacleGrid: List[List[int]]) -> int:
        n = len(obstacleGrid[0])
        dp = [0] * n
        dp[0] = 1
        for row in obstacleGrid:
            for c in range(n):
                if row[c] == 1:
                    dp[c] = 0
                elif c:
                    dp[c] += dp[c - 1]
        return dp[-1]
''',
        r'''
assert Solution().uniquePathsWithObstacles([[0, 0, 0], [0, 1, 0], [0, 0, 0]]) == 2
assert Solution().uniquePathsWithObstacles([[0, 1], [0, 0]]) == 1
assert Solution().uniquePathsWithObstacles([[1]]) == 0
''',
    ),
    "longest-palindromic-substring": P(
        "Every palindrome has a center: a character (odd length) or the gap between two characters (even length). Expand outward from all 2n − 1 centers while the ends match.",
        ["For each i, expand around (i, i) and (i, i + 1).", "Keep the longest span found.", "Manacher's algorithm makes it O(n), but expand-around-center is the expected answer."],
        "O(n²)", "O(1)",
        "Forgetting even-length centers ('cbbd' → 'bb').",
        r'''
class Solution:
    def longestPalindrome(self, s: str) -> str:
        best = (0, 1)

        def expand(l, r):
            while l >= 0 and r < len(s) and s[l] == s[r]:
                l, r = l - 1, r + 1
            return l + 1, r

        for i in range(len(s)):
            for l, r in (expand(i, i), expand(i, i + 1)):
                if r - l > best[1] - best[0]:
                    best = (l, r)
        return s[best[0]:best[1]]
''',
        r'''
assert Solution().longestPalindrome("babad") in ("bab", "aba")
assert Solution().longestPalindrome("cbbd") == "bb"
assert Solution().longestPalindrome("a") == "a"
''',
    ),
    "interleaving-string": P(
        "dp[i][j] = can s1[:i] and s2[:j] form s3[:i+j]? The last character of s3 came either from s1 (dp[i−1][j]) or from s2 (dp[i][j−1]). Greedy matching fails when both strings could supply the next character.",
        ["If the lengths don't add up, return False.", "dp[i][j] = (dp[i−1][j] and s1[i−1] == s3[i+j−1]) or (dp[i][j−1] and s2[j−1] == s3[i+j−1]).", "One rolling row of size len(s2) + 1."],
        "O(m·n)", "O(n)",
        "Two-pointer greedy: when s1 and s2 offer the same next character, you can't know which to take without exploring both.",
        r'''
class Solution:
    def isInterleave(self, s1: str, s2: str, s3: str) -> bool:
        m, n = len(s1), len(s2)
        if m + n != len(s3):
            return False
        dp = [False] * (n + 1)
        for i in range(m + 1):
            for j in range(n + 1):
                if i == 0 and j == 0:
                    dp[j] = True
                else:
                    from_s1 = i > 0 and dp[j] and s1[i - 1] == s3[i + j - 1]
                    from_s2 = j > 0 and dp[j - 1] and s2[j - 1] == s3[i + j - 1]
                    dp[j] = from_s1 or from_s2
        return dp[n]
''',
        r'''
assert Solution().isInterleave("aabcc", "dbbca", "aadbbcbcac") is True
assert Solution().isInterleave("aabcc", "dbbca", "aadbbbaccc") is False
assert Solution().isInterleave("", "", "") is True
''',
    ),
    "edit-distance": P(
        "dp[i][j] = the number of edits to turn word1[:i] into word2[:j]. If the last characters match, they're free (diagonal). Otherwise it's 1 + min(delete = up, insert = left, replace = diagonal).",
        ["Base cases: dp[i][0] = i deletes, dp[0][j] = j inserts.", "Fill row by row with the recurrence.", "Keep only the previous row for O(n) space."],
        "O(m·n)", "O(n)",
        "Mixing up which neighbour means insert vs delete is harmless here (all cost 1), but explaining it clearly is what's graded.",
        r'''
class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        m, n = len(word1), len(word2)
        prev = list(range(n + 1))
        for i in range(1, m + 1):
            cur = [i] + [0] * n
            for j in range(1, n + 1):
                if word1[i - 1] == word2[j - 1]:
                    cur[j] = prev[j - 1]
                else:
                    cur[j] = 1 + min(prev[j], cur[j - 1], prev[j - 1])
            prev = cur
        return prev[n]
''',
        r'''
assert Solution().minDistance("horse", "ros") == 3
assert Solution().minDistance("intention", "execution") == 5
assert Solution().minDistance("", "a") == 1
''',
    ),
    "best-time-to-buy-and-sell-stock-iii": P(
        "Track four running states: the best balance after the first buy, the first sell, the second buy and the second sell. Each state builds on the previous one, so updating them in order within the same day is safe.",
        ["buy1 = max(buy1, −p), sell1 = max(sell1, buy1 + p).", "buy2 = max(buy2, sell1 − p), sell2 = max(sell2, buy2 + p).", "Return sell2 (doing fewer transactions is allowed)."],
        "O(n)", "O(1)",
        "Splitting the array at every point and solving each half separately is O(n²) (or needs prefix/suffix arrays).",
        r'''
class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        buy1 = buy2 = float("-inf")
        sell1 = sell2 = 0
        for p in prices:
            buy1 = max(buy1, -p)
            sell1 = max(sell1, buy1 + p)
            buy2 = max(buy2, sell1 - p)
            sell2 = max(sell2, buy2 + p)
        return sell2
''',
        r'''
assert Solution().maxProfit([3, 3, 5, 0, 0, 3, 1, 4]) == 6
assert Solution().maxProfit([1, 2, 3, 4, 5]) == 4
assert Solution().maxProfit([7, 6, 4, 3, 1]) == 0
''',
    ),
    "best-time-to-buy-and-sell-stock-iv": P(
        "Generalize Stock III to k transactions: keep buy[j] and sell[j] for j = 1…k, where buy[j] builds on sell[j−1]. If k ≥ n/2, it's effectively unlimited, so just sum all the rises.",
        ["buy = [−∞] × (k+1), sell = [0] × (k+1).", "For each price, for j = 1…k: buy[j] = max(buy[j], sell[j−1] − p), sell[j] = max(sell[j], buy[j] + p).", "Return sell[k]."],
        "O(n·k)", "O(k)",
        "A large k with a long price list: shortcut to the unlimited-transactions greedy.",
        r'''
class Solution:
    def maxProfit(self, k: int, prices: List[int]) -> int:
        if 2 * k >= len(prices):
            return sum(max(0, b - a) for a, b in zip(prices, prices[1:]))
        buy = [float("-inf")] * (k + 1)
        sell = [0] * (k + 1)
        for p in prices:
            for j in range(1, k + 1):
                buy[j] = max(buy[j], sell[j - 1] - p)
                sell[j] = max(sell[j], buy[j] + p)
        return sell[k]
''',
        r'''
assert Solution().maxProfit(2, [2, 4, 1]) == 2
assert Solution().maxProfit(2, [3, 2, 6, 5, 0, 3]) == 7
assert Solution().maxProfit(1, [3, 3, 5, 0, 0, 3, 1, 4]) == 4
''',
    ),
    "maximal-square": P(
        "dp[r][c] = the side of the largest all-'1' square whose bottom-right corner is (r, c) = 1 + min(top, left, top-left). The smallest neighbour limits how far the square can grow.",
        ["One rolling row of size n + 1, plus a variable for the top-left value.", "For '1' cells: dp[c] = 1 + min(dp[c], dp[c−1], top-left). For '0' cells: 0.", "Track the max side and return side²."],
        "O(m·n)", "O(n)",
        "Returning the side instead of the area, and the cells are characters ('1'), not integers.",
        r'''
class Solution:
    def maximalSquare(self, matrix: List[List[str]]) -> int:
        n = len(matrix[0])
        dp = [0] * (n + 1)
        best = 0
        for row in matrix:
            top_left = 0
            for c in range(1, n + 1):
                above = dp[c]
                if row[c - 1] == "1":
                    dp[c] = 1 + min(dp[c], dp[c - 1], top_left)
                    best = max(best, dp[c])
                else:
                    dp[c] = 0
                top_left = above
        return best * best
''',
        r'''
assert Solution().maximalSquare([list("10100"), list("10111"), list("11111"), list("10010")]) == 4
assert Solution().maximalSquare([list("01"), list("10")]) == 1
assert Solution().maximalSquare([["0"]]) == 0
''',
    ),
}

PATTERNS = {
    "Binary Search": PATTERN(
        [
            "Sorted (or rotated sorted) data and a target.",
            "'Minimum x such that…' or 'maximum x such that…' with a monotonic condition (binary search on the answer).",
            "An O(log n) requirement.",
        ],
        [
            "Learn one template (lower bound, half-open [lo, hi)) and reuse it everywhere.",
            "Ask what the monotonic predicate is, and find the first index where it becomes true.",
            "When you keep lo = mid, round mid up to avoid an infinite loop.",
            "Search the answer space (capacity, speed, square root) when the input itself isn't sorted.",
        ],
        r'''
def lower_bound(nums, target):
    """First index i with nums[i] >= target (len(nums) if none)."""
    lo, hi = 0, len(nums)            # half-open [lo, hi)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo

def first_true(lo, hi, predicate):
    """Smallest x in [lo, hi] with predicate(x) True. predicate must be monotonic: False…False True…True."""
    while lo < hi:
        mid = (lo + hi) // 2
        if predicate(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
''',
    ),
    "Heap": PATTERN(
        [
            "Top-k, k-th largest, k smallest pairs.",
            "Repeatedly take the best available option (greedy scheduling, IPO).",
            "Merging k sorted streams.",
            "A running median.",
        ],
        [
            "k largest → a min-heap of size k (pop when it grows past k).",
            "Python's heapq is a min-heap, so negate values for a max-heap.",
            "Push tuples (priority, tie_breaker, item) so the items themselves are never compared.",
            "Two heaps (a max-heap for the low half, a min-heap for the high half) give a running median.",
        ],
        r'''
import heapq

def k_largest(nums, k):
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)       # drop the smallest of the k + 1
    return sorted(heap, reverse=True)

def merge_sorted_streams(streams):
    heap = [(s[0], i, 0) for i, s in enumerate(streams) if s]
    heapq.heapify(heap)
    out = []
    while heap:
        val, i, j = heapq.heappop(heap)
        out.append(val)
        if j + 1 < len(streams[i]):
            heapq.heappush(heap, (streams[i][j + 1], i, j + 1))
    return out
''',
    ),
    "Bit Manipulation": PATTERN(
        [
            "'Every element appears twice (or three times) except one.'",
            "Binary representations, counting bits, powers of two.",
            "Constant-space tricks on integers.",
        ],
        [
            "x ^ x = 0 and x ^ 0 = x, so XOR cancels pairs.",
            "n & (n − 1) clears the lowest set bit, and n & −n isolates it.",
            "Check bit i with (n >> i) & 1. Set it with n | (1 << i).",
            "Python ints are unbounded: mask with 0xFFFFFFFF when you need 32-bit behaviour.",
        ],
        r'''
def count_bits(n):
    count = 0
    while n:
        n &= n - 1          # clear the lowest set bit
        count += 1
    return count

def bit(n, i):
    return (n >> i) & 1

def is_power_of_two(n):
    return n > 0 and n & (n - 1) == 0
''',
    ),
    "Math": PATTERN(
        [
            "Digit manipulation, number properties, overflow concerns.",
            "Geometry on integer points (slopes, collinearity).",
            "Exponentiation, roots, factorials.",
        ],
        [
            "Use integer arithmetic (gcd-reduced fractions) instead of floats for slopes.",
            "Exponentiation by squaring is O(log n).",
            "Binary search works for integer roots.",
            "Look for a counting argument (factors of 5 for trailing zeros) before simulating.",
        ],
        r'''
import math

def fast_pow(x, n):
    if n < 0:
        x, n = 1 / x, -n
    result = 1
    while n:
        if n & 1:
            result *= x
        x *= x
        n >>= 1
    return result

def reduced_slope(dx, dy):
    g = math.gcd(dx, dy) or 1
    dx, dy = dx // g, dy // g
    if dx < 0 or (dx == 0 and dy < 0):   # normalize the sign
        dx, dy = -dx, -dy
    return dx, dy
''',
    ),
    "1D DP": PATTERN(
        [
            "'How many ways', 'minimum cost', 'maximum value' or 'is it possible' over a sequence.",
            "Choices at each step that depend on earlier results (take/skip, step sizes).",
            "A brute-force recursion with overlapping subproblems.",
        ],
        [
            "Define dp[i] in words first ('the best answer for the first i items').",
            "Write the recurrence from the last decision, then the base cases.",
            "Top-down memoization (@cache) is a fine start. Convert to bottom-up and roll variables for O(1) space.",
            "Check the iteration order: dp[i] must only use states you've already computed.",
        ],
        r'''
from functools import cache

def min_cost_climb(costs):
    @cache
    def best(i):                       # 1. state in words: cheapest way to reach step i
        if i <= 1:
            return 0                   # 2. base cases
        return min(best(i - 1) + costs[i - 1], best(i - 2) + costs[i - 2])   # 3. recurrence
    return best(len(costs))

def min_cost_climb_bottom_up(costs):   # the same recurrence, O(1) space
    a = b = 0                          # best(i - 2), best(i - 1)
    for i in range(2, len(costs) + 1):
        a, b = b, min(b + costs[i - 1], a + costs[i - 2])
    return b
''',
    ),
    "Multidimensional DP": PATTERN(
        [
            "Two sequences (edit distance, interleaving, LCS).",
            "Grids (paths, squares).",
            "States with an extra dimension (transactions left, holding stock or not).",
        ],
        [
            "Name the state: dp[i][j] = the answer for the prefixes s[:i] and t[:j].",
            "Draw the table, with arrows showing which cells each cell depends on.",
            "Roll the table into one row (or a few variables) when a row depends only on the previous one.",
            "State machines (buy/sell) are DP with a small, fixed set of states per step.",
        ],
        r'''
def lcs(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]   # dp[i][j]: the answer for a[:i], b[:j]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1   # take the match (diagonal)
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])   # skip one character
    return dp[m][n]
''',
    ),
}
