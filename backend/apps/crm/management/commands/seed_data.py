import random
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.crm.models import Channel, Customer, Order


@dataclass(frozen=True)
class CustomerCohort:
    name: str
    share: float
    min_orders: int
    max_orders: int
    min_days_ago: int
    max_days_ago: int
    spend_multiplier: float


FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna",
    "Ishaan", "Shaurya", "Ananya", "Diya", "Aadhya", "Kiara", "Meera", "Saanvi",
    "Ira", "Myra", "Avni", "Nisha", "Rohan", "Kabir", "Karan", "Rahul",
    "Vikram", "Arnav", "Dev", "Neil", "Riya", "Priya", "Neha", "Pooja",
    "Sneha", "Anika", "Tara", "Kavya", "Mira", "Siddharth", "Akash", "Varun",
]

LAST_NAMES = [
    "Sharma", "Verma", "Mehta", "Patel", "Reddy", "Nair", "Iyer", "Menon",
    "Gupta", "Agarwal", "Singh", "Kapoor", "Bose", "Chatterjee", "Banerjee",
    "Das", "Kulkarni", "Joshi", "Desai", "Rao", "Pillai", "Khan", "Malhotra",
    "Bhat", "Shetty", "Mishra", "Yadav", "Jain", "Saxena", "Ghosh",
]

CITIES = [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune",
    "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore",
    "Thane", "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Ghaziabad",
    "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Kochi",
    "Coimbatore", "Mysore", "Chandigarh",
]

EMAIL_DOMAINS = [
    "gmail.com", "outlook.com", "yahoo.com", "icloud.com", "rediffmail.com",
    "hotmail.com", "proton.me",
]

CATEGORY_PRICE_RANGES = {
    "Coffee": (Decimal("180.00"), Decimal("2800.00")),
    "Beauty": (Decimal("250.00"), Decimal("6500.00")),
    "Fashion": (Decimal("399.00"), Decimal("12000.00")),
    "Electronics": (Decimal("999.00"), Decimal("85000.00")),
}

COHORTS = [
    CustomerCohort("high_value", 0.10, 8, 20, 1, 180, 2.8),
    CustomerCohort("loyal", 0.25, 6, 14, 1, 120, 1.4),
    CustomerCohort("churned", 0.20, 1, 5, 180, 540, 0.9),
    CustomerCohort("new", 0.20, 1, 3, 1, 30, 0.8),
    CustomerCohort("regular", 0.25, 2, 8, 15, 240, 1.0),
]

CHANNEL_WEIGHTS = [
    (Channel.WHATSAPP, 0.42),
    (Channel.EMAIL, 0.30),
    (Channel.SMS, 0.18),
    (Channel.PUSH, 0.10),
]


def weighted_choice(weighted_values):
    threshold = random.random()
    cumulative = 0
    for value, weight in weighted_values:
        cumulative += weight
        if threshold <= cumulative:
            return value
    return weighted_values[-1][0]


def weighted_category(cohort: CustomerCohort) -> str:
    if cohort.name == "high_value":
        weights = [("Electronics", 0.42), ("Fashion", 0.27), ("Beauty", 0.20), ("Coffee", 0.11)]
    elif cohort.name == "loyal":
        weights = [("Coffee", 0.36), ("Beauty", 0.27), ("Fashion", 0.25), ("Electronics", 0.12)]
    elif cohort.name == "new":
        weights = [("Fashion", 0.31), ("Beauty", 0.28), ("Coffee", 0.27), ("Electronics", 0.14)]
    elif cohort.name == "churned":
        weights = [("Coffee", 0.34), ("Fashion", 0.29), ("Beauty", 0.24), ("Electronics", 0.13)]
    else:
        weights = [("Coffee", 0.30), ("Fashion", 0.28), ("Beauty", 0.25), ("Electronics", 0.17)]
    return weighted_choice(weights)


def random_amount(category: str, multiplier: float) -> Decimal:
    low, high = CATEGORY_PRICE_RANGES[category]
    base = Decimal(str(random.triangular(float(low), float(high), float(low) * 1.6)))
    amount = base * Decimal(str(multiplier))
    return amount.quantize(Decimal("0.01"))


def build_cohort_plan(total_customers: int) -> list[CustomerCohort]:
    plan: list[CustomerCohort] = []
    for cohort in COHORTS:
        plan.extend([cohort] * int(total_customers * cohort.share))
    while len(plan) < total_customers:
        plan.append(COHORTS[-1])
    random.shuffle(plan)
    return plan[:total_customers]


def allocate_order_counts(cohorts: list[CustomerCohort], total_orders: int) -> list[int]:
    counts = [random.randint(cohort.min_orders, cohort.max_orders) for cohort in cohorts]

    while sum(counts) > total_orders:
        candidates = [i for i, count in enumerate(counts) if count > cohorts[i].min_orders]
        index = random.choice(candidates)
        counts[index] -= 1

    while sum(counts) < total_orders:
        candidates = [i for i, count in enumerate(counts) if count < cohorts[i].max_orders]
        index = random.choice(candidates)
        counts[index] += 1

    return counts


def unique_email(first_name: str, last_name: str, index: int) -> str:
    domain = random.choice(EMAIL_DOMAINS)
    token = random.choice(["", ".", "_"])
    suffix = random.randint(10, 9999)
    return f"{first_name.lower()}{token}{last_name.lower()}{index}{suffix}@{domain}"


def random_phone() -> str:
    first_digit = random.choice(["6", "7", "8", "9"])
    rest = "".join(str(random.randint(0, 9)) for _ in range(9))
    return f"+91{first_digit}{rest}"


class Command(BaseCommand):
    help = "Seed the CRM database with 1000 realistic Indian customers and 5000 orders."

    def add_arguments(self, parser):
        parser.add_argument(
            "--customers",
            type=int,
            default=1000,
            help="Number of customers to create.",
        )
        parser.add_argument(
            "--orders",
            type=int,
            default=5000,
            help="Number of orders to create.",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Random seed for repeatable data.",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing customers and orders before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        total_customers = options["customers"]
        total_orders = options["orders"]
        random.seed(options["seed"])

        if options["clear"]:
            Order.objects.all().delete()
            Customer.objects.all().delete()

        cohorts = build_cohort_plan(total_customers)
        min_possible_orders = sum(cohort.min_orders for cohort in cohorts)
        max_possible_orders = sum(cohort.max_orders for cohort in cohorts)
        if not min_possible_orders <= total_orders <= max_possible_orders:
            raise CommandError(
                "Order count must be between "
                f"{min_possible_orders} and {max_possible_orders} for {total_customers} customers."
            )

        order_counts = allocate_order_counts(cohorts, total_orders)

        customers = []
        for index, cohort in enumerate(cohorts, start=1):
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            customers.append(
                Customer(
                    name=f"{first_name} {last_name}",
                    email=unique_email(first_name, last_name, index),
                    phone=random_phone(),
                    city=random.choice(CITIES),
                    preferred_channel=weighted_choice(CHANNEL_WEIGHTS),
                )
            )

        created_customers = Customer.objects.bulk_create(customers, batch_size=500)
        now = timezone.now()
        orders = []

        for customer, cohort, order_count in zip(created_customers, cohorts, order_counts):
            last_purchase_days_ago = random.randint(cohort.min_days_ago, cohort.max_days_ago)
            last_order_date = now - timedelta(days=last_purchase_days_ago)

            for order_index in range(order_count):
                category = weighted_category(cohort)
                if order_index == 0:
                    order_date = last_order_date
                else:
                    spread_days = random.randint(last_purchase_days_ago, max(last_purchase_days_ago + 365, 366))
                    order_date = now - timedelta(days=spread_days)

                orders.append(
                    Order(
                        customer=customer,
                        amount=random_amount(category, cohort.spend_multiplier),
                        category=category,
                        order_date=order_date,
                    )
                )

        random.shuffle(orders)
        Order.objects.bulk_create(orders[:total_orders], batch_size=1000)

        cohort_counts = {cohort.name: 0 for cohort in COHORTS}
        for cohort in cohorts:
            cohort_counts[cohort.name] += 1

        self.stdout.write(self.style.SUCCESS("Seed data created successfully."))
        self.stdout.write(f"Customers created: {total_customers}")
        self.stdout.write(f"Orders created: {total_orders}")
        self.stdout.write(
            "Cohorts: "
            + ", ".join(f"{name}={count}" for name, count in sorted(cohort_counts.items()))
        )
