"""
RFM Engine — Recency / Frequency / Monetary scoring + CLV + Churn Risk
=======================================================================

Usage (via management command):
    py manage.py rfm_compute

Or call programmatically:
    from apps.crm.services.rfm_engine import RFMEngine
    updated = RFMEngine().compute_all()

All monetary values used and stored are in INR.
"""

from decimal import Decimal

from django.db.models import Count, DecimalField, Max, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.crm.models import ChurnRisk, Customer


class RFMEngine:
    """Computes and persists RFM scores, CLV, and churn risk for all customers."""

    # Churn risk thresholds (days since last order)
    CHURN_HIGH_DAYS = 180
    CHURN_MEDIUM_DAYS = 90

    def compute_all(self) -> int:
        """
        Annotate every customer with recency, frequency, monetary metrics,
        compute quintile-based RFM scores (1–5), CLV, and churn risk,
        then bulk-update the database.

        Returns the number of customers updated.
        """
        customers = self._annotate_customers()
        if not customers:
            return 0

        # Extract raw values for quintile computation
        recency_values = [c["rfm_recency"] for c in customers]
        frequency_values = [c["rfm_frequency"] for c in customers]
        monetary_values = [float(c["rfm_monetary"]) for c in customers]

        r_quintiles = self._quintile_thresholds(recency_values)
        f_quintiles = self._quintile_thresholds(frequency_values)
        m_quintiles = self._quintile_thresholds(monetary_values)

        update_list: list[Customer] = []

        for row in customers:
            recency_days = row["rfm_recency"]
            frequency = row["rfm_frequency"]
            monetary = float(row["rfm_monetary"])
            clv = float(row["clv"])

            # Recency: lower days = better score (inverted quintile)
            r_score = self._assign_quintile(recency_days, r_quintiles, invert=True)
            f_score = self._assign_quintile(frequency, f_quintiles, invert=False)
            m_score = self._assign_quintile(monetary, m_quintiles, invert=False)

            # Composite RFM score = rounded mean
            composite = round((r_score + f_score + m_score) / 3)

            # Churn risk from raw recency
            if recency_days > self.CHURN_HIGH_DAYS:
                churn = ChurnRisk.HIGH
            elif recency_days > self.CHURN_MEDIUM_DAYS:
                churn = ChurnRisk.MEDIUM
            else:
                churn = ChurnRisk.LOW

            update_list.append(
                Customer(
                    id=row["id"],
                    rfm_recency=recency_days,
                    rfm_frequency=frequency,
                    rfm_monetary=Decimal(str(round(monetary, 2))),
                    rfm_score=composite,
                    clv=Decimal(str(round(clv, 2))),
                    churn_risk=churn,
                )
            )

        Customer.objects.bulk_update(
            update_list,
            fields=["rfm_recency", "rfm_frequency", "rfm_monetary", "rfm_score", "clv", "churn_risk"],
            batch_size=500,
        )
        return len(update_list)

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _annotate_customers(self) -> list[dict]:
        """
        Return annotated customer rows with recency, frequency, monetary, and CLV.
        All monetary values are in INR (stored in Order.amount).
        """
        now = timezone.now()

        qs = Customer.objects.annotate(
            order_count=Count("orders"),
            total_spend=Coalesce(
                Sum("orders__amount"),
                Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            ),
            last_order_at=Max("orders__order_date"),
        ).values("id", "order_count", "total_spend", "last_order_at")

        result = []
        for row in qs:
            if row["last_order_at"] is None:
                recency_days = 9999  # never ordered
            else:
                delta = now - row["last_order_at"]
                recency_days = max(0, delta.days)

            freq = row["order_count"] or 0
            total = row["total_spend"] or Decimal("0")
            avg_order = float(total) / freq if freq > 0 else 0.0

            result.append(
                {
                    "id": row["id"],
                    "rfm_recency": recency_days,
                    "rfm_frequency": freq,
                    "rfm_monetary": avg_order,  # average order value in INR
                    "clv": float(total),         # lifetime total spend in INR
                }
            )
        return result

    def _quintile_thresholds(self, values: list[float | int]) -> list[float]:
        """
        Compute 4 quintile thresholds from a sorted list of values.
        Returns [Q20, Q40, Q60, Q80].
        """
        if not values:
            return [0.0, 0.0, 0.0, 0.0]
        sorted_vals = sorted(values)
        n = len(sorted_vals)

        def percentile(p: float) -> float:
            idx = (p / 100) * (n - 1)
            lo = int(idx)
            hi = min(lo + 1, n - 1)
            frac = idx - lo
            return sorted_vals[lo] + frac * (sorted_vals[hi] - sorted_vals[lo])

        return [percentile(20), percentile(40), percentile(60), percentile(80)]

    def _assign_quintile(
        self,
        value: float | int,
        thresholds: list[float],
        invert: bool = False,
    ) -> int:
        """
        Assign a quintile score 1–5 given sorted thresholds [Q20, Q40, Q60, Q80].
        If invert=True, lower values receive higher scores (used for recency).
        """
        q20, q40, q60, q80 = thresholds
        if value <= q20:
            score = 1
        elif value <= q40:
            score = 2
        elif value <= q60:
            score = 3
        elif value <= q80:
            score = 4
        else:
            score = 5

        return (6 - score) if invert else score
