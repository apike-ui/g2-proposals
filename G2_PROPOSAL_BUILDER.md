# G2 Proposal Builder

## Overview

A full-stack web application for G2 Enterprise sales reps to build, manage, and export multi-product customer proposals with custom rate cards, volume-based pricing, and professional branded exports.

**Live URL:** https://g2-proposals.onrender.com/proposals
**GitHub:** https://github.com/apike-ui/g2-proposals
**Login:** Username: `G2products` / Password: `Enterprise1`

---

## Architecture

| Component | Technology | Location |
|-----------|-----------|----------|
| Frontend | React 18 + Babel (CDN, no build) | `g2-proposals.html` |
| Backend | Flask (Python) | `proposals_server.py` |
| Database | Supabase (Postgres) / SQLite fallback | Cloud / `./data/proposals.db` |
| PPTX Export | python-pptx | `pptx_gen.py` |
| Hosting | Render (free tier) | Auto-deploys from GitHub |
| WSGI | Gunicorn | `wsgi.py` |

### Key Files

```
g2-proposals.html      — Single-file React frontend (all UI)
proposals_server.py    — Flask API server (proposals, rate cards, PPTX export)
pptx_gen.py            — PowerPoint generator (7-slide G2-branded deck)
wsgi.py                — Gunicorn entry point for Render
requirements.txt       — Flask, python-pptx, gunicorn, requests
render.yaml            — Render deployment config
supabase-schema.sql    — Database schema (proposals, versions, rate_cards)
assets/                — G2 logo files (Red, Inverse, SVG)
```

---

## Features

### Proposals + Rate Cards Library
- Unified searchable grid of all proposals and rate cards
- Filter by: All / Proposals / Rate Cards
- Search by name, customer, rep, or owner
- Version history per proposal (click version count to browse)
- Export to PPTX or Google Slides from library cards

### Proposal Builder
- **Multi-product profiles** — add a product for each G2 profile the customer owns
- **Base packages** — Free / Professional ($18K) / Enterprise ($34K)
- **10 add-on SKUs** with tiered pricing:
  - Buyer Intent (Tiers 1-10 + All Categories @ $75K)
  - G2 Content (7 report types + All Categories @ $80K)
  - AI-Led Custom Research (AICR)
  - G2 Clicks (PPC)
  - Paid Promotions
  - Review Managed Services (Accelerator / Growth / Custom)
  - Custom Event Activation
  - Market Intelligence
  - Technical Consulting
- **Category volume pricing** — Buyer Intent and G2 Content price by # of categories with volume breaks
- **Contract terms** — 6/12/24/36 months with linked start/end dates
- **Proposal-level discount** — percentage off total ACV
- **Rate card selector** — apply a saved rate card to override all pricing
- **Non-ACV items** — gift cards, video reviews, social assets, etc.
- **Auto-save** — versions created on save and rate card application
- **Running total** — live ACV calculation in the header

### Rate Card Builder
- **Named, per-customer rate cards** with owner field
- **Custom tier pricing** — set "My Rate" per tier for every SKU
- **Category volume pricing** — categories column for Buyer Intent / G2 Content
- **All Categories flat rate** — customizable per rate card
- **Volume discounts** — "when on 3+ products, discount 10%"
- **Discount rules** — named rules with:
  - Discount percentage
  - Term condition (any / 12+ / 24+ / 36+ months)
  - SKU selector (checkboxes for every base pkg + add-on)
- **Tier exclusions** — uncheck tiers to remove them from the rate card
- When applied to a proposal: overrides all pricing, excluded tiers bump to highest available, auto-saves new version

### Proposal Preview
- **Investment summary at top** — Total Investment/yr, ACV, Non-ACV, Profiles, SKUs
- **SKU summary table** — Profile | Package | Add-Ons (colored pills) | ACV
- **Non-ACV items** — below SKU summary
- **Cost by Year** — annual breakdown for multi-year terms (Year 1, Year 2, etc. with cumulative)
- **Per-product detail** — base package + each add-on with tier, qty, rate, discount %
- **Discount display** — proposal discounts (green) + rate card discounts (blue)
- **G2 branded** — logo in header and footer, rorange accents

### Export
- **PPTX (PowerPoint)** — 7-slide professional G2-branded deck:
  1. Cover — customer name, rep, dates, proof points
  2. Executive Summary — stat cards + SKU table + TCV
  3. Per-Product Detail — add-on table + ACV card + breakdown
  4. Pricing Details — full line-item table with every SKU
  5. Cost by Year — annual + cumulative (multi-year only)
  6. Next Steps — 4-step process + rep contact card
- **Google Slides** — downloads PPTX + opens Google Drive for drag-and-drop upload
- **PDF** — browser print (Cmd+P) with print-optimized CSS

### Product Reference
- Internal-only reference of all G2 products with full pricing details
- Base packages, add-on products with tier tables, non-ACV items
- Signal volume details visible here (hidden from customer-facing views)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/proposals` | Serve the UI |
| GET | `/assets/<file>` | Serve logo files |
| GET | `/api/storage-mode` | Returns `sqlite` or `supabase` |
| GET | `/api/proposals` | List all proposals with version counts |
| POST | `/api/proposals` | Create a new proposal |
| PUT | `/api/proposals/:id` | Update proposal metadata |
| GET | `/api/proposals/:id/versions` | List versions for a proposal |
| POST | `/api/proposals/:id/versions` | Create a new version (snapshot) |
| GET | `/api/versions/:id` | Get a specific version with snapshot |
| GET | `/api/ratecards` | List all rate cards |
| POST | `/api/ratecards` | Create a new rate card |
| GET | `/api/ratecards/:id` | Get a rate card with full card_data |
| PUT | `/api/ratecards/:id` | Update a rate card |
| POST | `/api/proposals/export-pptx` | Generate PPTX from proposal data |

---

## Database Schema (Supabase)

```sql
-- Proposals
proposals (id uuid PK, name text, customer text, rep text, grand_total numeric, created_at, updated_at)

-- Version snapshots (full JSON state per save)
proposal_versions (id uuid PK, proposal_id uuid FK, version_num int, snapshot jsonb, notes text, created_at)

-- Rate cards (named, per-customer)
rate_cards (id uuid PK, name text, customer text, owner text, card_data jsonb, updated_at)
```

### Snapshot Shape (stored in `proposal_versions.snapshot`)
```json
{
  "cust": "Salesforce",
  "rep": "Alex Pike",
  "contractTerm": "24",
  "startDate": "2026-02-01",
  "endDate": "2028-01-31",
  "proposalDisc": "10",
  "rateCardId": "uuid-here",
  "rateCardName": "Salesforce FY27",
  "products": [
    {
      "name": "Sales Cloud",
      "basePkg": "enterprise",
      "baseRate": "30000",
      "addons": {
        "intent": { "on": true, "tierIdx": 3, "qty": 1, "rate": "25000", "cats": "5", "allCats": false },
        "content": { "on": true, "tierIdx": 0, "qty": 1, "rate": "40000" }
      }
    }
  ],
  "acctItems": {
    "giftcards": { "on": true, "qty": 1, "rate": "500" }
  }
}
```

### Rate Card Shape (stored in `rate_cards.card_data`)
```json
{
  "basePkgs": { "professional": { "price": 15000 }, "enterprise": { "price": 30000 } },
  "addons": {
    "intent": {
      "tiers": [{ "label": "Tier 1", "listPrice": 12500, "myPrice": 10000, "excluded": false }],
      "volumeDisc": [{ "minProducts": 3, "discPct": 10 }],
      "allCatMyPrice": 65000
    }
  },
  "nonAcv": { "giftcards": { "price": 500 } },
  "discountRules": [
    { "id": 1, "name": "Multi-year", "discPct": 15, "termMonths": "24", "skus": ["addon_intent", "base_enterprise"] }
  ]
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | For cloud storage | `https://aolscfxqpgrjugbynfzn.supabase.co` |
| `SUPABASE_KEY` | For cloud storage | Supabase anon public key |
| `PORT` | On Render | Set automatically by Render |

---

## Brand Guidelines

- **Colors:** Rorange `#FF492C`, Navy `#062846`, Green `#27D3BC`, Blue `#0073F5`, Purple `#5746B2`, Yellow `#FFC800`
- **Dollar amounts:** Always G2 Blue (`#0073F5`), never red/orange
- **Discounts/savings:** Green (`#27D3BC`)
- **Font:** Figtree (Google Fonts)
- **Logo:** G2Logo-Red.png on light backgrounds, G2Logo-Inverse.png on dark
- **Design:** Flat, no gradients, no shadows per G2 Brand Book

---

## Development

```bash
# Run locally
cd "/Users/apike/Documents/Claude Code BI Dashboard"
python3 proposals_server.py
# → http://localhost:5001/proposals

# With Supabase (persistent storage)
SUPABASE_URL="https://..." SUPABASE_KEY="eyJ..." python3 proposals_server.py

# Deploy to Render
git add -A && git commit -m "update" && git push
# Render auto-deploys from GitHub

# Test PPTX generation
python3 pptx_gen.py
# → writes test_proposal.pptx
```

---

## Update Workflow

1. Edit files locally
2. `git add -A && git commit -m "description" && git push`
3. Render auto-redeploys (same URL, no credential changes)
4. Takes ~2 minutes for free tier
