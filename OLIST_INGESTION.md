# Olist Dataset Ingestion — Documentation

## Overview

Campaign Copilot AI uses the **Brazilian E-Commerce Public Dataset by Olist** (available on
[Kaggle](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)) as its source dataset.

The ingestion pipeline transforms five Olist CSVs into the CRM data model, computes behavioural
intelligence (CLV, RFM, Churn Risk), and creates five prebuilt segments for one-click campaign
launches.

---

## Currency Conversion

> **Fixed rate: 1 BRL = 15 INR**

All monetary amounts from the Olist dataset are denominated in **BRL (Brazilian Real)**.
They are converted to **INR (Indian Rupee, ₹)** at ingestion time using the fixed rate above.

| Field | Type | Description |
|---|---|---|
| `Order.amount` | Decimal (INR) | **Primary application field.** Always in INR. Used for all analytics, segmentation, CLV, dashboards, and AI. |
| `Order.source_amount_brl` | Decimal / NULL | Original BRL value from the Olist CSV. Preserved for full traceability. NULL for synthetic (non-Olist) orders. |

The conversion constant is documented in code:
```python
# backend/apps/crm/models.py
BRL_TO_INR_RATE = 15
```

---

## Required CSV Files

Download the dataset from Kaggle and place these files in a single directory:

| File | Contents |
|---|---|
| `olist_customers_dataset.csv` | Customer identity and location |
| `olist_orders_dataset.csv` | Order lifecycle and timestamps |
| `olist_order_items_dataset.csv` | Line items (links orders → products) |
| `olist_order_payments_dataset.csv` | Payment values per order |
| `olist_order_reviews_dataset.csv` | Customer review scores (1–5) |
| `olist_products_dataset.csv` | Product categories |

---

## Ingestion Commands

Run these three commands in order:

```bash
# Step 1 — Ingest Olist CSVs into CRM models (BRL → INR conversion happens here)
py manage.py ingest_olist --data-dir /path/to/olist/csvs/

# Optional: preview without writing (validates all CSVs)
py manage.py ingest_olist --data-dir /path/to/olist/csvs/ --dry-run

# Optional: clear previous Olist data and reimport fresh
py manage.py ingest_olist --data-dir /path/to/olist/csvs/ --clear

# Step 2 — Compute RFM scores, CLV, and Churn Risk (all values in INR)
py manage.py rfm_compute

# Step 3 — Build the 5 prebuilt segments
py manage.py build_segments

# Optional: refresh segment membership after reingestion
py manage.py build_segments --refresh
```

---

## Category Mapping

Olist's Portuguese product categories are mapped to CRM buckets:

| CRM Category | Olist Categories |
|---|---|
| **Electronics** | electronics, computers, computers_accessories, telephony, audio, consoles_games, small_appliances, tablets_printing_image, watches_gifts, … |
| **Beauty** | health_beauty, perfumery, fashion_bags_accessories, fashion_womens_clothing, fashion_underwear_beach, fashion_sport, fashion_childrens_clothes |
| **Fashion** | fashion_mens_clothing, fashion_shoes, luggage_accessories, costumes_accessories |
| **Coffee** | food, food_drink, drinks, la_cuisine |
| **General** | all other categories |

---

## RFM Scoring

The `rfm_compute` command populates the following fields on every `Customer`:

| Field | Description |
|---|---|
| `rfm_recency` | Days since last order (lower = more recent) |
| `rfm_frequency` | Total order count |
| `rfm_monetary` | Average order value **in INR** |
| `rfm_score` | Composite quintile score 1–5 (5 = best customers) |
| `clv` | Customer Lifetime Value = total spend **in INR** |
| `churn_risk` | `low` (< 90d) · `medium` (90–180d) · `high` (> 180d) |

---

## Prebuilt Segments

The `build_segments` command creates five canonical segments:

| Segment | Criteria | Use Case |
|---|---|---|
| **High Value** | rfm_score ≥ 4 OR CLV ≥ 75th percentile | VIP exclusives, premium launches |
| **Churn Risk** | churn_risk = "high" (inactive > 180d) | Win-back campaigns |
| **Electronics Buyers** | ≥ 1 Electronics order | Tech product launches |
| **Beauty Buyers** | ≥ 1 Beauty order | Skincare, cosmetics campaigns |
| **Frequent Shoppers** | rfm_frequency ≥ 5 | Loyalty, rewards programs |

Segments are accessible at:
- `GET /api/segments/prebuilt/`
- `GET /api/segments/?is_prebuilt=true`
- Campaign Copilot → **Prebuilt Segments** panel

---

## Data Flow

```
Olist CSVs (BRL)
    │
    ▼ ingest_olist (BRL × 15 → INR)
CRM Models
 ├── Customer (with state, olist_customer_id)
 └── Order (amount=INR, source_amount_brl=BRL)
    │
    ▼ rfm_compute
Customer.clv / rfm_score / rfm_recency / rfm_frequency / rfm_monetary / churn_risk
    │
    ▼ build_segments
Segment (is_prebuilt=True) × 5
    │
    ▼ Campaign Copilot AI
Segment-aware audience → CLV/RFM context → OpenAI → Campaign Draft (INR expected_revenue)
```

---

## Notes

- Emails are synthesised from `customer_unique_id` (format: `<uuid>@olist.example`) because the Olist dataset contains no real email addresses.
- Only orders with status `delivered`, `invoiced`, `shipped`, `processing`, or `approved` are imported.
- Run `rfm_compute` after each new ingestion to refresh scores.
