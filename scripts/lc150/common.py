"""Shared helpers for the LeetCode 150 study guide sources (see build.py)."""


def P(trick, steps, time, space, pitfall, code, test=None):
    """One problem's guide: the key insight, approach, complexity, classic mistake and a reference solution.
    `test` is Python source with asserts that build.py runs against `code`."""
    return {
        "trick": trick,
        "steps": steps,
        "time": time,
        "space": space,
        "pitfall": pitfall,
        "code": code.strip("\n"),
        "test": test,
    }


def PATTERN(recognize, tips, template):
    """One category's pattern guide: signals that point to it, tricks, and a reusable template."""
    return {"recognize": recognize, "tips": tips, "template": template.strip("\n")}
