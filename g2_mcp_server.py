#!/usr/bin/env python3
"""
G2 Vendor Intelligence — MCP Server (stdio / JSON-RPC 2.0)

Connects Claude Code to the G2 data API so AI tools in this project
can query live buyer-intent, competitive intelligence, and product data.

Configured via .mcp.json — Claude Code launches this automatically.
Required env:  G2_API_KEY=<your_g2_api_token>
"""

import sys
import json
import os
import urllib.request
import urllib.parse
import urllib.error

PRODUCT_ID = "a7d324a4-06eb-4be2-ad8e-65938bce5fd5"
G2_BASE    = "https://data.g2.com/api/v2"


# ------------------------------------------------------------------
# G2 REST helpers
# ------------------------------------------------------------------

def _api_key():
    k = os.environ.get("G2_API_KEY", "")
    if not k:
        raise ValueError("G2_API_KEY is not set")
    return k


def _g2_get(path: str, params: dict = None) -> dict:
    qs = urllib.parse.urlencode(params or {})
    url = f"{G2_BASE}{path}{'?' + qs if qs else ''}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Token token={_api_key()}",
            "Content-Type":  "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


# ------------------------------------------------------------------
# Tool implementations
# ------------------------------------------------------------------

def tool_browse_buyer_intent(args: dict) -> str:
    product_id = args.get("product_id", PRODUCT_ID)
    params = {
        "dimensions":  args.get("dimensions", "company_name,company_domain,company_intent_score"),
        "measures":    args.get("measures",   "total_activity"),
        "sort":        args.get("sort",       "-company_intent_score"),
        "page[size]":  args.get("page_size",  25),
    }
    if "min_intent_score" in args:
        params["dimension_filters[company_intent_score_gteq]"] = args["min_intent_score"]
    data = _g2_get(f"/products/{product_id}/buyer_intent", params)
    rows = [r["attributes"] for r in data.get("data", [])]
    return json.dumps(rows, indent=2)


def tool_browse_competitive_intel(args: dict) -> str:
    product_id = args.get("product_id", PRODUCT_ID)
    params = {
        "dimensions":  args.get("dimensions", "product_name"),
        "measures":    args.get("measures",   "company_count,total_activity"),
        "sort":        args.get("sort",       "-company_count"),
        "page[size]":  args.get("page_size",  20),
        "dimension_filters[product_id_not_eq]": product_id,
    }
    data = _g2_get(f"/products/{product_id}/buyer_intent", params)
    rows = [r["attributes"] for r in data.get("data", [])]
    return json.dumps(rows, indent=2)


def tool_list_products(args: dict) -> str:
    params: dict = {
        "fields[products]": args.get("fields", "name,slug,star_rating,review_count,g2_url"),
        "page[size]":       args.get("page_size", 25),
    }
    if "vendor_name" in args:
        params["filter[vendor_name]"] = args["vendor_name"]
    data = _g2_get("/products", params)
    rows = [{"id": r["id"], **r["attributes"]} for r in data.get("data", [])]
    return json.dumps(rows, indent=2)


def tool_list_vendors(args: dict) -> str:
    params: dict = {
        "fields[vendors]": args.get("fields", "name,slug,company_website,public_products_count"),
        "page[size]":      args.get("page_size", 25),
    }
    data = _g2_get("/vendors", params)
    rows = [{"id": r["id"], **r["attributes"]} for r in data.get("data", [])]
    return json.dumps(rows, indent=2)


def tool_regional_breakdown(args: dict) -> str:
    product_id = args.get("product_id", PRODUCT_ID)
    params = {
        "dimensions": "company_country",
        "measures":   "company_count,total_activity",
        "sort":       "-company_count",
        "page[size]": 100,
    }
    data = _g2_get(f"/products/{product_id}/buyer_intent", params)
    rows = [r["attributes"] for r in data.get("data", [])]
    return json.dumps(rows, indent=2)


# ------------------------------------------------------------------
# Tool registry
# ------------------------------------------------------------------

TOOLS = [
    {
        "name": "g2_browse_buyer_intent",
        "description": (
            "Browse buyer-intent signals for a G2 product. Returns companies "
            "actively researching the product, their intent scores, and activity."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "product_id":       {"type": "string", "description": "G2 product UUID (defaults to G2 Buyer Intent)"},
                "dimensions":       {"type": "string", "description": "Comma-separated dimensions"},
                "measures":         {"type": "string", "description": "Comma-separated measures"},
                "min_intent_score": {"type": "number", "description": "Minimum intent score (0-100)"},
                "sort":             {"type": "string", "description": "Sort field, prefix - for desc"},
                "page_size":        {"type": "integer", "description": "Results per page (max 100)"},
            },
        },
    },
    {
        "name": "g2_competitive_intelligence",
        "description": (
            "Show which competitor products your intent companies are also evaluating."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "product_id":  {"type": "string"},
                "dimensions":  {"type": "string"},
                "measures":    {"type": "string"},
                "sort":        {"type": "string"},
                "page_size":   {"type": "integer"},
            },
        },
    },
    {
        "name": "g2_list_products",
        "description": "Browse the G2 product catalog with optional vendor filter.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vendor_name": {"type": "string", "description": "Exact vendor name match"},
                "fields":      {"type": "string"},
                "page_size":   {"type": "integer"},
            },
        },
    },
    {
        "name": "g2_list_vendors",
        "description": "Browse the G2 vendor directory.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fields":    {"type": "string"},
                "page_size": {"type": "integer"},
            },
        },
    },
    {
        "name": "g2_regional_breakdown",
        "description": "Get buyer-intent company counts broken down by country.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string"},
            },
        },
    },
]

TOOL_FNS = {
    "g2_browse_buyer_intent":      tool_browse_buyer_intent,
    "g2_competitive_intelligence": tool_browse_competitive_intel,
    "g2_list_products":            tool_list_products,
    "g2_list_vendors":             tool_list_vendors,
    "g2_regional_breakdown":       tool_regional_breakdown,
}


# ------------------------------------------------------------------
# MCP JSON-RPC 2.0 over stdio
# ------------------------------------------------------------------

def _send(obj: dict):
    line = json.dumps(obj)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def _error(id_, code: int, message: str):
    _send({"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}})


def handle(msg: dict):
    method = msg.get("method", "")
    id_    = msg.get("id")
    params = msg.get("params", {})

    if method == "initialize":
        _send({
            "jsonrpc": "2.0", "id": id_,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "g2-vendor-intelligence", "version": "1.0.0"},
            },
        })

    elif method == "tools/list":
        _send({"jsonrpc": "2.0", "id": id_, "result": {"tools": TOOLS}})

    elif method == "tools/call":
        name = params.get("name", "")
        args = params.get("arguments", {})
        fn   = TOOL_FNS.get(name)
        if not fn:
            _error(id_, -32601, f"Unknown tool: {name}")
            return
        try:
            result = fn(args)
            _send({
                "jsonrpc": "2.0", "id": id_,
                "result": {"content": [{"type": "text", "text": result}]},
            })
        except Exception as exc:
            _error(id_, -32000, str(exc))

    elif method == "notifications/initialized":
        pass   # no response needed

    else:
        if id_ is not None:
            _error(id_, -32601, f"Method not found: {method}")


def main():
    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            msg = json.loads(raw_line)
        except json.JSONDecodeError:
            _send({"jsonrpc": "2.0", "id": None,
                   "error": {"code": -32700, "message": "Parse error"}})
            continue
        handle(msg)


if __name__ == "__main__":
    main()
