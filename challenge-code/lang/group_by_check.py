from decimal import Decimal

from solution import count_by_status, per_category_customer, runs_by_customer, top_customers

orders = [
    {"id": "o1", "customer": "ada", "category": "books", "amount": Decimal("30.00"), "status": "PAID"},
    {"id": "o2", "customer": "bob", "category": "games", "amount": Decimal("60.00"), "status": "PAID"},
    {"id": "o3", "customer": "ada", "category": "games", "amount": Decimal("45.50"), "status": "PAID"},
    {"id": "o4", "customer": "cy", "category": "books", "amount": Decimal("500.00"), "status": "REFUNDED"},
    {"id": "o5", "customer": "bob", "category": "books", "amount": Decimal("10.00"), "status": "PENDING"},
]
assert top_customers(orders, 2) == [("ada", Decimal("75.50")), ("bob", Decimal("60.00"))]
assert count_by_status(orders) == {"PAID": 3, "PENDING": 1, "REFUNDED": 1}
assert per_category_customer(orders)["books"] == {"ada": 1, "cy": 1, "bob": 1}
assert runs_by_customer(orders) == {"ada": ["o1", "o3"], "bob": ["o2", "o5"], "cy": ["o4"]}
print("ok")
