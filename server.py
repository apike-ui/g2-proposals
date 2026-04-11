"""
G2 Vendor Intelligence Dashboard — Flask Backend
Calls the G2 data API (data.g2.com/api/v2) and serves the dashboard UI.

Required env var:  G2_API_KEY=<your_g2_api_token>
"""

import os
import time
import json
import sqlite3
import uuid
from flask import Flask, jsonify, send_from_directory, request
import requests

_HERE = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    static_folder=os.path.join(_HERE, "public"),
    root_path=_HERE,
    instance_path=os.path.join(_HERE, "instance"),
)

G2_BASE   = "https://data.g2.com/api/v2"
DEFAULT_PRODUCT_ID = "a7d324a4-06eb-4be2-ad8e-65938bce5fd5"   # G2 Buyer Intent

# ------------------------------------------------------------------
# Simple in-process cache  {key: (timestamp, data)}
# ------------------------------------------------------------------
_cache: dict = {}
CACHE_TTL = 300   # 5 minutes


def _get_api_key() -> str:
    key = os.environ.get("G2_API_KEY", "")
    if not key:
        raise EnvironmentError("G2_API_KEY environment variable is not set")
    return key


def _headers() -> dict:
    return {
        "Authorization": f"Token token={_get_api_key()}",
        "Content-Type":  "application/json",
    }


def _cached(cache_key: str, fetcher, ttl: int = CACHE_TTL):
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < ttl:
            return data
    data = fetcher()
    _cache[cache_key] = (now, data)
    return data


# ------------------------------------------------------------------
# G2 API helpers
# ------------------------------------------------------------------

def _g2_get(path: str, params: dict = None):
    r = requests.get(f"{G2_BASE}{path}", headers=_headers(), params=params or {}, timeout=15)
    r.raise_for_status()
    return r.json()


# ------------------------------------------------------------------
# Vendor cache (populated via G2 MCP tools)
# ------------------------------------------------------------------
_VENDOR_DIR = os.path.join(_HERE, "data", "vendors")


def _search_vendor_cache(query: str):
    """Search for vendor data in local cache. Case-insensitive fuzzy match."""
    if not os.path.isdir(_VENDOR_DIR):
        return None
    q_lower = query.lower().strip()
    # Try exact filename match first
    exact_path = os.path.join(_VENDOR_DIR, f"{q_lower}.json")
    if os.path.exists(exact_path):
        with open(exact_path) as f:
            return json.load(f)
    # Fuzzy: check all cached vendors
    best_match = None
    for fname in os.listdir(_VENDOR_DIR):
        if not fname.endswith(".json"):
            continue
        vendor_key = fname[:-5]  # strip .json
        if q_lower in vendor_key or vendor_key in q_lower:
            fpath = os.path.join(_VENDOR_DIR, fname)
            with open(fpath) as f:
                data = json.load(f)
            # Check if vendor name matches
            vname = data.get("vendor", {}).get("name", "").lower()
            if q_lower == vname or q_lower in vname or vname in q_lower:
                return data
            if not best_match:
                best_match = data
    return best_match


def _list_cached_vendors():
    """List all vendors available in the cache."""
    if not os.path.isdir(_VENDOR_DIR):
        return []
    vendors = []
    for fname in sorted(os.listdir(_VENDOR_DIR)):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(_VENDOR_DIR, fname)
        try:
            with open(fpath) as f:
                data = json.load(f)
            v = data.get("vendor", {})
            vendors.append({
                "name": v.get("name", fname[:-5]),
                "slug": v.get("slug", fname[:-5]),
                "total_products": v.get("total_products", len(data.get("products", []))),
            })
        except (json.JSONDecodeError, IOError):
            pass
    return vendors


# ------------------------------------------------------------------
# Vendor & product search (API fallback)
# ------------------------------------------------------------------

def search_vendor_products(vendor_name: str):
    """Search G2 products by exact vendor name, return vendor info + product list."""
    data = _g2_get("/products", params={
        "filter[vendor_name]": vendor_name,
        "fields[products]": "name,slug,domain,star_rating,review_count",
        "include": "vendor",
        "page[size]": 100,
    })
    products = []
    vendor_info = None
    # Extract vendor from included
    included = {(r["type"], r["id"]): r for r in data.get("included", [])}
    for row in data.get("data", []):
        attr = row["attributes"]
        products.append({
            "id": row["id"],
            "name": attr.get("name"),
            "slug": attr.get("slug"),
            "domain": attr.get("domain"),
            "star_rating": attr.get("star_rating"),
            "review_count": attr.get("review_count"),
        })
        # Get vendor info from relationship
        if not vendor_info:
            vid = row.get("relationships", {}).get("vendor", {}).get("data", {}).get("id")
            if vid:
                v = included.get(("vendors", vid))
                if v:
                    va = v.get("attributes", {})
                    vendor_info = {
                        "id": vid,
                        "name": va.get("name", vendor_name),
                        "slug": va.get("slug"),
                        "website": va.get("company_website"),
                        "total_products": va.get("public_products_count"),
                    }
    if not vendor_info:
        vendor_info = {"name": vendor_name, "total_products": len(products)}
    return {"vendor": vendor_info, "products": products}


# ------------------------------------------------------------------
# Intent data fetchers (dynamic product_id)
# ------------------------------------------------------------------

NA_COUNTRIES  = {"United States", "Canada", "Mexico"}
EMEA_COUNTRIES = {
    "United Kingdom", "Germany", "France", "Netherlands", "Sweden",
    "Denmark", "Switzerland", "Ireland", "Spain", "Italy", "Norway",
    "Finland", "Belgium", "Austria", "Poland", "Nigeria", "South Africa",
    "Ukraine", "Israel", "Türkiye", "Turkey", "United Arab Emirates",
    "Saudi Arabia",
}
APAC_COUNTRIES = {
    "India", "Australia", "Singapore", "China", "Japan", "South Korea",
    "Philippines", "Indonesia", "Vietnam", "Malaysia", "Thailand",
    "New Zealand", "Pakistan", "Bangladesh",
}
LATAM_COUNTRIES = {
    "Brazil", "Chile", "Argentina", "Colombia", "Peru", "Mexico",
    "Venezuela",
}


def _date_params(date_from: str) -> dict:
    """Return dimension_filters params for date filtering if date_from is set."""
    if not date_from:
        return {}
    return {"dimension_filters[week_gteq]": date_from[:10]}


def fetch_intent_funnel(product_id: str, date_from: str = None):
    params = {
        "dimensions": "signal_type",
        "measures":   "company_count,total_activity",
        "sort":       "-total_activity",
    }
    params.update(_date_params(date_from))
    data = _g2_get(f"/products/{product_id}/buyer_intent", params=params)
    rows = {r["attributes"]["signal_type"]: r["attributes"] for r in data["data"]}
    return {
        "awareness":     rows.get("profile", {}).get("company_count", 0),
        "consideration": (
            rows.get("compare", {}).get("company_count", 0) +
            rows.get("category", {}).get("company_count", 0) +
            rows.get("competitors", {}).get("company_count", 0)
        ),
        "decision": rows.get("pricing", {}).get("company_count", 0),
        "raw": rows,
    }


def fetch_regional(product_id: str, date_from: str = None):
    params = {
        "dimensions": "company_country",
        "measures":   "company_count,total_activity",
        "sort":       "-company_count",
        "page[size]": 100,
    }
    params.update(_date_params(date_from))
    data = _g2_get(f"/products/{product_id}/buyer_intent", params=params)
    totals = {"North America": 0, "EMEA": 0, "APAC": 0, "LATAM": 0, "Other": 0}
    for row in data["data"]:
        country = row["attributes"].get("company_country") or ""
        count   = row["attributes"].get("company_count", 0)
        if country in NA_COUNTRIES:
            totals["North America"] += count
        elif country in EMEA_COUNTRIES:
            totals["EMEA"] += count
        elif country in APAC_COUNTRIES:
            totals["APAC"] += count
        elif country in LATAM_COUNTRIES:
            totals["LATAM"] += count
        else:
            totals["Other"] += count
    total = sum(totals.values()) or 1
    return {
        region: {"count": count, "pct": round(count / total * 100, 1)}
        for region, count in totals.items()
    }


def fetch_top_companies(product_id: str, limit: int = 25, date_from: str = None,
                        industry: str = None, country: str = None, employees: str = None):
    params = {
        "dimensions":  "company_name,company_domain,company_intent_score,company_country,company_industry,company_employees",
        "measures":    "total_activity",
        "sort":        "-company_intent_score",
        "page[size]":  limit,
    }
    params.update(_date_params(date_from))
    if industry:
        params["dimension_filters[company_industry_cont]"] = industry
    if country:
        params["dimension_filters[company_country_eq]"] = country
    if employees:
        params["dimension_filters[company_employees_eq]"] = employees
    data = _g2_get(f"/products/{product_id}/buyer_intent", params=params)
    return [
        {
            "name":      r["attributes"]["company_name"],
            "domain":    r["attributes"]["company_domain"],
            "score":     r["attributes"]["company_intent_score"],
            "country":   r["attributes"].get("company_country"),
            "industry":  r["attributes"].get("company_industry"),
            "employees": r["attributes"].get("company_employees"),
            "activity":  r["attributes"]["total_activity"],
        }
        for r in data["data"]
    ]


def fetch_competitors(product_id: str, limit: int = 8, date_from: str = None):
    params = {
        "dimensions":  "product_name",
        "measures":    "company_count,total_activity",
        "sort":        "-company_count",
        "page[size]":  limit + 2,
        "dimension_filters[product_id_not_eq]": product_id,
    }
    params.update(_date_params(date_from))
    data = _g2_get(f"/products/{product_id}/buyer_intent", params=params)
    results = []
    for row in data["data"]:
        name = row["attributes"].get("product_name")
        if not name:
            continue
        results.append({
            "name":     name,
            "companies": row["attributes"]["company_count"],
            "activity": row["attributes"]["total_activity"],
        })
        if len(results) >= limit:
            break
    return results


def fetch_weekly_trend(product_id: str, date_from: str = None):
    # Fetch up to 52 weeks when date filtering so long ranges have full data
    page_size = 52 if date_from else 8
    params = {
        "dimensions": "week",
        "measures":   "company_count,total_activity",
        "sort":       "-week",
        "page[size]": page_size,
    }
    params.update(_date_params(date_from))
    data = _g2_get(f"/products/{product_id}/buyer_intent", params=params)
    return [
        {
            "week":      r["attributes"]["week"],
            "companies": r["attributes"]["company_count"],
            "activity":  r["attributes"]["total_activity"],
        }
        for r in data["data"]
    ]


def build_dashboard(product_id: str, date_from: str = None,
                    industry: str = None, country: str = None, employees: str = None):
    funnel      = fetch_intent_funnel(product_id, date_from)
    regional    = fetch_regional(product_id, date_from)
    companies   = fetch_top_companies(product_id, date_from=date_from,
                                      industry=industry, country=country, employees=employees)
    competitors = fetch_competitors(product_id, date_from=date_from)
    trends      = fetch_weekly_trend(product_id, date_from)

    raw = funnel.get("raw", {})
    high_intent = (
        raw.get("profile",  {}).get("total_activity", 0) +
        raw.get("compare",  {}).get("total_activity", 0) +
        raw.get("pricing",  {}).get("total_activity", 0)
    )
    all_activity = sum(v.get("total_activity", 0) for v in raw.values()) or 1
    active_score = round(high_intent / all_activity * 100, 1)

    wow = 0
    if len(trends) >= 2:
        curr, prev = trends[0]["companies"], trends[1]["companies"]
        wow = round((curr - prev) / (prev or 1) * 100, 1)

    return {
        "product": {"id": product_id, "name": ""},
        "active_intent_score": active_score,
        "wow_pct": wow,
        "funnel": funnel,
        "regional": regional,
        "top_companies": companies,
        "competitors": competitors,
        "weekly_trend": trends,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


_DATA_FILE  = os.path.join(_HERE, "data", "dashboard.json")
_INTENT_DIR = os.path.join(_HERE, "data", "intent")


def load_static_data():
    with open(_DATA_FILE) as f:
        return json.load(f)


def load_intent_cache(product_id: str):
    """Load cached intent data for a product. Returns None if not cached."""
    path = os.path.join(_INTENT_DIR, f"{product_id}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None


def aggregate_intent(datasets: list) -> dict:
    """Merge intent data from multiple products into one combined dashboard view."""
    if not datasets:
        return {}
    if len(datasets) == 1:
        return datasets[0]

    # Aggregate funnel counts
    funnel_keys = ["awareness", "consideration", "decision"]
    funnel = {k: sum(d.get("funnel", {}).get(k, 0) for d in datasets) for k in funnel_keys}

    # Merge raw signal breakdown
    all_signal_keys = set()
    for d in datasets:
        all_signal_keys.update(d.get("funnel", {}).get("raw", {}).keys())
    raw = {}
    for k in all_signal_keys:
        raw[k] = {
            "total_activity": sum(d.get("funnel", {}).get("raw", {}).get(k, {}).get("total_activity", 0) for d in datasets),
            "company_count":  sum(d.get("funnel", {}).get("raw", {}).get(k, {}).get("company_count", 0) for d in datasets),
        }
    funnel["raw"] = raw

    # Recalculate active intent score
    hi = sum(raw.get(k, {}).get("total_activity", 0) for k in ["profile", "compare", "pricing"])
    all_act = sum(v.get("total_activity", 0) for v in raw.values()) or 1
    active_score = round(hi / all_act * 100, 1)

    # Average wow_pct
    wows = [d.get("wow_pct", 0) for d in datasets]
    wow = round(sum(wows) / len(wows), 1)

    # Aggregate regional
    region_keys = ["North America", "EMEA", "APAC", "LATAM", "Other"]
    reg_counts = {k: sum(d.get("regional", {}).get(k, {}).get("count", 0) for d in datasets) for k in region_keys}
    total_reg = sum(reg_counts.values()) or 1
    regional = {k: {"count": v, "pct": round(v / total_reg * 100, 1)} for k, v in reg_counts.items()}

    # Merge top companies (dedupe by domain, keep highest score)
    companies_by_domain = {}
    for d in datasets:
        for c in d.get("top_companies", []):
            dom = c.get("domain") or c.get("name")
            if dom not in companies_by_domain or c.get("score", 0) > companies_by_domain[dom].get("score", 0):
                companies_by_domain[dom] = c
    top_companies = sorted(companies_by_domain.values(), key=lambda c: -c.get("score", 0))[:25]

    # Merge competitors (sum company counts across products)
    comp_by_name = {}
    for d in datasets:
        for c in d.get("competitors", []):
            name = c.get("name")
            if not name:
                continue
            if name not in comp_by_name:
                comp_by_name[name] = {"name": name, "companies": 0, "activity": 0}
            comp_by_name[name]["companies"] += c.get("companies", 0)
            comp_by_name[name]["activity"]  += c.get("activity", 0)
    competitors = sorted(comp_by_name.values(), key=lambda c: -c["companies"])[:8]

    # Merge weekly trend (sum by week)
    trend_by_week = {}
    for d in datasets:
        for w in d.get("weekly_trend", []):
            wk = w.get("week")
            if wk not in trend_by_week:
                trend_by_week[wk] = {"week": wk, "companies": 0, "activity": 0}
            trend_by_week[wk]["companies"] += w.get("companies", 0)
            trend_by_week[wk]["activity"]  += w.get("activity", 0)
    weekly_trend = sorted(trend_by_week.values(), key=lambda w: w["week"], reverse=True)[:8]

    # Product / vendor context
    if len(datasets) == 1:
        product = datasets[0].get("product", {})
        vendor  = datasets[0].get("vendor", {})
    else:
        product = {"id": "multi", "name": f"{len(datasets)} products selected"}
        vendor  = datasets[0].get("vendor", {})

    return {
        "product":            product,
        "vendor":             vendor,
        "active_intent_score": active_score,
        "wow_pct":            wow,
        "funnel":             funnel,
        "regional":           regional,
        "top_companies":      top_companies,
        "competitors":        competitors,
        "weekly_trend":       weekly_trend,
        "fetched_at":         time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory("public", "index.html")


@app.route("/api/dashboard")
def api_dashboard():
    product_id = request.args.get("product_id", "") or DEFAULT_PRODUCT_ID
    date_from  = request.args.get("date_from")
    industry   = request.args.get("industry") or None
    country    = request.args.get("country") or None
    employees  = request.args.get("employees") or None

    def _filter_trend(data):
        """Filter weekly_trend client-side for cache/static fallback (no live API)."""
        if date_from and data.get("weekly_trend"):
            data = dict(data)
            data["weekly_trend"] = [w for w in data["weekly_trend"] if w.get("week", "") >= date_from]
            data["_snapshot_mode"] = True  # tells frontend other metrics are not period-filtered
        return data

    # 1) If G2_API_KEY available → live date-filtered query with company filters
    if os.environ.get("G2_API_KEY") and (date_from or industry or country or employees):
        try:
            filter_key = f"{date_from or ''}_{industry or ''}_{country or ''}_{employees or ''}"
            cache_key = f"dashboard_{product_id}_{filter_key}"
            data = _cached(cache_key, lambda: build_dashboard(
                product_id, date_from, industry=industry, country=country, employees=employees
            ))
            return jsonify({"ok": True, "data": data, "source": "api"})
        except EnvironmentError as e:
            return jsonify({"ok": False, "error": str(e)}), 503
        except requests.HTTPError as e:
            return jsonify({"ok": False, "error": f"G2 API error: {e.response.status_code}"}), 502
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    # 2) Check intent cache (snapshot — only weekly_trend gets date-filtered)
    cached = load_intent_cache(product_id)
    if cached:
        return jsonify({"ok": True, "data": _filter_trend(cached), "source": "cache"})

    # 3) Fall back to static dashboard.json for default product
    if product_id == DEFAULT_PRODUCT_ID and os.path.exists(_DATA_FILE):
        try:
            data = _cached("dashboard_static", load_static_data)
            return jsonify({"ok": True, "data": _filter_trend(data), "source": "static"})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    # 4) Live API without date_from (cache result for 5 min)
    if os.environ.get("G2_API_KEY"):
        try:
            data = _cached(f"dashboard_{product_id}", lambda: build_dashboard(product_id))
            return jsonify({"ok": True, "data": data, "source": "api"})
        except EnvironmentError as e:
            return jsonify({"ok": False, "error": str(e)}), 503
        except requests.HTTPError as e:
            return jsonify({"ok": False, "error": f"G2 API error: {e.response.status_code}"}), 502
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    return jsonify({"ok": False, "error": "not_cached", "product_id": product_id}), 404


@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    _cache.clear()
    return api_dashboard()


@app.route("/api/search/vendor")
def api_search_vendor():
    """Search products by vendor name. ?q=IBM
    Checks local cache first (populated via G2 MCP), falls back to REST API.
    """
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"ok": False, "error": "Missing ?q= parameter"}), 400

    # 1) Check local vendor cache first
    cached = _search_vendor_cache(q)
    if cached:
        return jsonify({"ok": True, "data": cached, "source": "cache"})

    # 2) Fall back to G2 REST API if key is set
    if os.environ.get("G2_API_KEY"):
        try:
            result = _cached(f"vendor_search_{q}", lambda: search_vendor_products(q))
            return jsonify({"ok": True, "data": result, "source": "api"})
        except requests.HTTPError as e:
            status = e.response.status_code if e.response else 502
            return jsonify({"ok": False, "error": f"G2 API error: {status}"}), 502
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    # 3) No cache hit and no API key — return available vendors
    available = _list_cached_vendors()
    return jsonify({
        "ok": False,
        "error": "not_cached",
        "message": f"Vendor \"{q}\" not found in cache. Use the analyze bar to ask Claude to fetch it.",
        "available_vendors": available,
    }), 404


@app.route("/api/vendors")
def api_list_vendors():
    """List all cached vendors available for search."""
    return jsonify({"ok": True, "data": _list_cached_vendors()})


@app.route("/api/product/<product_id>/intent")
def api_product_intent(product_id):
    """Full dashboard data for any product by ID. Checks intent cache first."""
    # Check intent cache first (populated via MCP)
    cached = load_intent_cache(product_id)
    if cached:
        return jsonify({"ok": True, "data": cached, "source": "cache"})

    # Fall back to live API if key is available
    if os.environ.get("G2_API_KEY"):
        try:
            data = _cached(f"dashboard_{product_id}", lambda: build_dashboard(product_id))
            return jsonify({"ok": True, "data": data, "source": "api"})
        except requests.HTTPError as e:
            status = e.response.status_code if e.response else 502
            return jsonify({"ok": False, "error": f"G2 API error: {status}"}), 502
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    return jsonify({
        "ok": False,
        "error": "not_cached",
        "message": "Intent data not yet cached for this product. Ask Claude in the analyze bar to fetch it.",
        "product_id": product_id,
    }), 404


@app.route("/api/products/intent", methods=["POST"])
def api_products_intent():
    """Aggregate intent data for one or more product IDs.
    Body: {product_ids: [...], date_from: "2025-09-01T00:00:00Z"}
    When G2_API_KEY is set and date_from is provided, queries live API with date filter.
    Otherwise serves from cache (weekly_trend filtered only).
    """
    body = request.get_json(silent=True) or {}
    product_ids = body.get("product_ids", [])
    date_from   = body.get("date_from")
    industry    = body.get("industry") or None
    country     = body.get("country") or None
    employees   = body.get("employees") or None
    if not product_ids:
        return jsonify({"ok": False, "error": "No product_ids provided"}), 400

    # Live API path when G2_API_KEY is available (with or without date_from)
    if os.environ.get("G2_API_KEY") and (date_from or industry or country or employees):
        datasets    = []
        per_product = []
        missing     = []
        for pid in product_ids:
            try:
                filter_key = f"{date_from or ''}_{industry or ''}_{country or ''}_{employees or ''}"
                cache_key = f"intent_{pid}_{filter_key}"
                d = _cached(cache_key, lambda p=pid: build_dashboard(
                    p, date_from, industry=industry, country=country, employees=employees
                ))
                datasets.append(d)
                per_product.append({"product_id": pid, "data": d})
            except Exception:
                missing.append(pid)
        if not datasets:
            return jsonify({"ok": False, "error": "not_cached", "missing": missing}), 404
        data = aggregate_intent(datasets)
        return jsonify({"ok": True, "data": data, "per_product": per_product, "missing": missing})

    # Cache-only path — snapshot data, weekly_trend filtered by date
    datasets    = []
    per_product = []
    missing     = []
    for pid in product_ids:
        d = load_intent_cache(pid)
        if d:
            datasets.append(d)
            per_product.append({"product_id": pid, "data": d})
        else:
            missing.append(pid)

    if not datasets:
        return jsonify({
            "ok": False,
            "error": "not_cached",
            "message": "No intent data cached for selected products. Ask Claude to fetch them.",
            "missing": missing,
        }), 404

    data = aggregate_intent(datasets)

    # Filter weekly_trend by date_from; mark as snapshot so frontend can show notice
    if date_from and data.get("weekly_trend"):
        data["weekly_trend"] = [
            w for w in data["weekly_trend"]
            if w.get("week", "") >= date_from
        ]
        data["_snapshot_mode"] = True

    return jsonify({"ok": True, "data": data, "per_product": per_product, "missing": missing})


@app.route("/api/companies")
def api_companies():
    min_score = int(request.args.get("min_score", 50))
    limit     = min(int(request.args.get("limit", 25)), 100)
    product_id = request.args.get("product_id", DEFAULT_PRODUCT_ID)
    try:
        companies = _cached(
            f"companies_{product_id}_{min_score}_{limit}",
            lambda: fetch_top_companies(product_id, limit),
        )
        filtered = [c for c in companies if c["score"] >= min_score]
        return jsonify({"ok": True, "data": filtered})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/query", methods=["POST"])
def api_query():
    """Claude-powered natural language query against dashboard data."""
    body = request.get_json(silent=True) or {}
    question = body.get("question", "").strip()
    context  = body.get("context", {})
    filters  = body.get("filters", {})
    if not question:
        return jsonify({"ok": False, "error": "No question provided"}), 400

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return jsonify({"ok": False, "error": "ANTHROPIC_API_KEY not set"}), 503

    sub        = context.get("subscription", {})
    funnel_ctx = context.get("funnel", {})
    regional   = context.get("regional", {})
    companies  = context.get("top_companies", [])[:20]
    competitors= context.get("competitors", [])[:8]
    weekly     = context.get("weekly_trend", [])[:12]

    data_summary = json.dumps({
        "vendor": context.get("vendor", {}),
        "product": context.get("product", {}),
        "active_intent_score": context.get("active_intent_score"),
        "wow_pct": context.get("wow_pct"),
        "funnel": {
            "awareness": funnel_ctx.get("awareness"),
            "consideration": funnel_ctx.get("consideration"),
            "decision": funnel_ctx.get("decision"),
        },
        "regional": regional,
        "top_companies": [
            {"name": c["name"], "score": c.get("score"), "country": c.get("country"),
             "industry": c.get("industry"), "employees": c.get("employees"), "activity": c.get("activity")}
            for c in companies
        ],
        "competitors": competitors,
        "weekly_trend": weekly,
        "subscription": sub.get("summary", {}),
        "products": [
            {"name": p["name"], "has_intent": p.get("has_intent"),
             "subscribed_categories": [c["name"] for c in p.get("subscribed_categories", []) if c.get("subscribed")]}
            for p in sub.get("products", [])
        ],
        "active_filters": filters,
    }, indent=None)

    system_prompt = """You are the analytics assistant for a G2 Vendor Intelligence Dashboard.

When the user asks for a chart, graph, visualization, or to "show" data visually, return a chart spec.
When the user asks a factual question, return a concise text answer (2-3 sentences).
You can also navigate the dashboard with an action.

Return your response as JSON with this structure:
{
  "answer": "Brief text answer (always include this)",
  "action": null OR {"tab": "funnel"|"companies"|"regions"|"subscriptions"|"categories"} OR {"filter": {"subscription": "all"|"subscribed"|"unsubscribed"}},
  "chart": null OR {
    "type": "bar"|"pie"|"line"|"doughnut",
    "title": "Chart title",
    "labels": ["label1", "label2", ...],
    "datasets": [{"label": "Series name", "data": [n1, n2, ...], "backgroundColor": ["#FF492C",...]}]
  }
}

Use G2 brand colors: primary red #FF492C, teal #0B9D83, purple #5B47E0, blue #2563EB, orange #F97316.
For bar/line charts use ["#FF492C","#0B9D83","#5B47E0","#2563EB","#F97316","#8B5CF6","#EC4899","#10B981"].
For pie/doughnut always include a backgroundColor array matching the number of labels.
Only include "chart" when the user explicitly wants a visual or chart.

Dashboard data:
""" + data_summary

    try:
        r = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 1200,
                "system": system_prompt,
                "messages": [{"role": "user", "content": question}],
            },
            timeout=20,
        )
        r.raise_for_status()
        reply = r.json()
        text = reply["content"][0]["text"].strip()
        try:
            parsed = json.loads(text)
            return jsonify({
                "ok": True,
                "answer": parsed.get("answer", text),
                "action": parsed.get("action"),
                "chart": parsed.get("chart"),
            })
        except json.JSONDecodeError:
            return jsonify({"ok": True, "answer": text, "action": None, "chart": None})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/products/categories", methods=["POST"])
def api_products_categories():
    """Return categories being researched by buyer intent companies.
    Requires G2_API_KEY for live data; otherwise falls back to subscription categories.
    Body: {product_ids: [...], date_from: "..."}
    """
    body = request.get_json(silent=True) or {}
    product_ids = body.get("product_ids", [])
    date_from   = body.get("date_from")
    if not product_ids:
        return jsonify({"ok": False, "error": "No product_ids provided"}), 400

    if not os.environ.get("G2_API_KEY"):
        return jsonify({"ok": False, "error": "G2_API_KEY required for live category data", "source": "none"}), 503

    # Query G2 API: companies browsing category pages, grouped by category
    all_categories = {}
    for pid in product_ids:
        try:
            params = {
                "dimensions":  "signal_type",
                "measures":    "company_count,total_activity",
                "sort":        "-company_count",
                "page[size]":  100,
                "dimension_filters[signal_type_eq]": "category",
            }
            params.update(_date_params(date_from))
            # Try with category_name dimension
            cat_params = dict(params)
            cat_params["dimensions"] = "category_name"
            del cat_params["dimension_filters[signal_type_eq]"]
            try:
                data = _g2_get(f"/products/{pid}/buyer_intent", params=cat_params)
                for row in data.get("data", []):
                    name = row["attributes"].get("category_name") or row["attributes"].get("name")
                    if not name:
                        continue
                    if name not in all_categories:
                        all_categories[name] = {"name": name, "companies": 0, "activity": 0, "products": []}
                    all_categories[name]["companies"] += row["attributes"].get("company_count", 0)
                    all_categories[name]["activity"]  += row["attributes"].get("total_activity", 0)
            except Exception:
                pass
        except Exception:
            pass

    categories = sorted(all_categories.values(), key=lambda c: -c["companies"])
    return jsonify({"ok": True, "data": categories, "source": "api"})


# ------------------------------------------------------------------
# Proposals DB (SQLite)
# ------------------------------------------------------------------
_DB_PATH = os.path.join(_HERE, "data", "proposals.db")


def _db():
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    with _db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS proposals (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                customer    TEXT,
                rep         TEXT,
                grand_total REAL DEFAULT 0,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS proposal_versions (
                id          TEXT PRIMARY KEY,
                proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
                version_num INTEGER NOT NULL,
                snapshot    TEXT NOT NULL,
                notes       TEXT,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_versions_proposal
                ON proposal_versions (proposal_id, version_num DESC);
        """)

_init_db()


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# Serve the proposal builder UI
@app.route("/proposals")
def proposals_ui():
    return send_from_directory(_HERE, "g2-proposals.html")


# List all proposals
@app.route("/api/proposals", methods=["GET"])
def api_proposals_list():
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM proposals ORDER BY updated_at DESC"
        ).fetchall()
    return jsonify({"ok": True, "data": [dict(r) for r in rows]})


# Create a new proposal
@app.route("/api/proposals", methods=["POST"])
def api_proposals_create():
    body = request.get_json(force=True)
    now = _now()
    row = {
        "id":          str(uuid.uuid4()),
        "name":        body.get("name", "Untitled"),
        "customer":    body.get("customer"),
        "rep":         body.get("rep"),
        "grand_total": body.get("grand_total", 0),
        "created_at":  now,
        "updated_at":  now,
    }
    with _db() as conn:
        conn.execute(
            "INSERT INTO proposals VALUES (:id,:name,:customer,:rep,:grand_total,:created_at,:updated_at)",
            row
        )
    return jsonify({"ok": True, "data": row}), 201


# Update an existing proposal
@app.route("/api/proposals/<pid>", methods=["PUT"])
def api_proposals_update(pid):
    body = request.get_json(force=True)
    now = _now()
    with _db() as conn:
        conn.execute(
            """UPDATE proposals SET name=:name, customer=:customer, rep=:rep,
               grand_total=:grand_total, updated_at=:updated_at WHERE id=:id""",
            {"name": body.get("name"), "customer": body.get("customer"),
             "rep": body.get("rep"), "grand_total": body.get("grand_total", 0),
             "updated_at": now, "id": pid}
        )
        row = conn.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
    if not row:
        return jsonify({"ok": False, "error": "Not found"}), 404
    return jsonify({"ok": True, "data": dict(row)})


# List versions for a proposal
@app.route("/api/proposals/<pid>/versions", methods=["GET"])
def api_versions_list(pid):
    with _db() as conn:
        rows = conn.execute(
            "SELECT id,version_num,notes,created_at FROM proposal_versions WHERE proposal_id=? ORDER BY version_num DESC",
            (pid,)
        ).fetchall()
    return jsonify({"ok": True, "data": [dict(r) for r in rows]})


# Save a new version snapshot
@app.route("/api/proposals/<pid>/versions", methods=["POST"])
def api_versions_create(pid):
    body = request.get_json(force=True)
    now = _now()
    with _db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM proposal_versions WHERE proposal_id=?", (pid,)
        ).fetchone()[0]
        row = {
            "id":          str(uuid.uuid4()),
            "proposal_id": pid,
            "version_num": count + 1,
            "snapshot":    json.dumps(body.get("snapshot", {})),
            "notes":       body.get("notes"),
            "created_at":  now,
        }
        conn.execute(
            "INSERT INTO proposal_versions VALUES (:id,:proposal_id,:version_num,:snapshot,:notes,:created_at)",
            row
        )
        # bump proposal updated_at
        conn.execute("UPDATE proposals SET updated_at=? WHERE id=?", (now, pid))
    row["snapshot"] = json.loads(row["snapshot"])
    return jsonify({"ok": True, "data": row}), 201


# Fetch a specific version's snapshot
@app.route("/api/versions/<vid>", methods=["GET"])
def api_version_get(vid):
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM proposal_versions WHERE id=?", (vid,)
        ).fetchone()
    if not row:
        return jsonify({"ok": False, "error": "Not found"}), 404
    data = dict(row)
    data["snapshot"] = json.loads(data["snapshot"])
    return jsonify({"ok": True, "data": data})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"G2 Vendor Intelligence Dashboard running on http://localhost:{port}")
    print(f"Proposal Builder running on http://localhost:{port}/proposals")
    app.run(host="0.0.0.0", port=port, debug=True)
