#!/usr/bin/env python3
"""Quick API integration smoke test against a running backend."""
import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
API = BASE.rstrip("/") + "/api"

checks = []


def get(path):
    url = API + path
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode())


def check(name, fn):
    try:
        fn()
        checks.append((name, True, ""))
        print(f"  OK  {name}")
    except Exception as exc:
        checks.append((name, False, str(exc)))
        print(f"  FAIL {name}: {exc}")


def main():
    print(f"Testing {API}\n")

    stats = get("/stats/")
    check("stats.total_customers > 0", lambda: (_ for _ in ()).throw(AssertionError("empty")) if stats.get("total_customers", 0) <= 0 else None)
    check("stats.active_campaigns is int", lambda: int(stats["active_campaigns"]))
    check("stats.recent_campaigns is list", lambda: isinstance(stats["recent_campaigns"], list))

    campaigns = get("/campaigns/")
    check("campaigns is list", lambda: (_ for _ in ()).throw(TypeError("not list")) if not isinstance(campaigns, list) else None)
    check("campaigns non-empty", lambda: (_ for _ in ()).throw(AssertionError("empty")) if len(campaigns) == 0 else None)

    customers = get("/customers/")
    check("customers is list", lambda: (_ for _ in ()).throw(TypeError("not list")) if not isinstance(customers, list) else None)
    check("customers count >= 100", lambda: (_ for _ in ()).throw(AssertionError(len(customers))) if len(customers) < 100 else None)

    charts = get("/analytics/charts/")
    for key in ("funnel", "channel_performance", "campaign_trend", "engagement_trend"):
        check(f"analytics.{key} present", lambda k=key: charts[k])

    failed = [c for c in checks if not c[1]]
    print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
