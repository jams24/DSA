from collections import Counter, defaultdict
from decimal import Decimal
from itertools import groupby
from operator import itemgetter
from typing import TypedDict


class Order(TypedDict):
    id: str
    customer: str
    category: str
    amount: Decimal  # Decimal, not float, for money
    status: str


def top_customers(orders: list[Order], n: int) -> list[tuple[str, Decimal]]:
    revenue: defaultdict[str, Decimal] = defaultdict(Decimal)
    for o in orders:
        if o["status"] == "PAID":
            revenue[o["customer"]] += o["amount"]
    return sorted(revenue.items(), key=lambda kv: (-kv[1], kv[0]))[:n]


def count_by_status(orders: list[Order]) -> dict[str, int]:
    return dict(sorted(Counter(o["status"] for o in orders).items()))


def per_category_customer(orders: list[Order]) -> dict[str, dict[str, int]]:
    nested: defaultdict[str, Counter] = defaultdict(Counter)
    for o in orders:
        nested[o["category"]][o["customer"]] += 1
    return {cat: dict(c) for cat, c in sorted(nested.items())}


def runs_by_customer(orders: list[Order]) -> dict[str, list[str]]:
    """itertools.groupby only groups *adjacent* items, so sort by the same key first."""
    key = itemgetter("customer")
    return {cust: [o["id"] for o in group] for cust, group in groupby(sorted(orders, key=key), key=key)}
