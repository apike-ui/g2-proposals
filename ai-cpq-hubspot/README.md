# AI CPQ + HubSpot

An AI-powered Configure Price Quote (CPQ) system with HubSpot CRM integration. Built with Next.js 14, Supabase, and Claude AI.

## Features

- **AI-Powered Quoting** — Describe customer requirements and Claude AI suggests the right products automatically
- **Excel/CSV Import** — Upload bulk SKU lists with drag-and-drop; auto-detects column headers
- **HubSpot Integration** — Sync products to HubSpot catalog, pull CRM contacts, create deals
- **Quote Builder** — Build professional quotes with line items, discounts, and AI-generated summaries
- **Order Management** — Convert quotes to orders with PDF generation
- **PDF Export** — Generate professional quote and order PDFs client-side (no server cost)
- **Free to Run** — Vercel free tier + Supabase free tier = $0/month

## Default Login

| Username | Password |
|----------|----------|
| JamesPike | Soccer123 |

## Quick Start

### 1. Install dependencies

```bash
cd ai-cpq-hubspot
npm install
```

### 2. Set up Supabase (Free)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor** and run the contents of `scripts/setup.sql`
4. Copy your Project URL and API keys from **Settings → API**

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
SESSION_SECRET=any-random-string-at-least-32-characters

# Admin credentials
ADMIN_USERNAME=JamesPike
# Leave ADMIN_PASSWORD_HASH empty to use plain text fallback (Soccer123)
# For production, generate a hash:
# node scripts/hash-password.js Soccer123
ADMIN_PASSWORD_HASH=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# HubSpot (optional - get from HubSpot Settings → Private Apps)
HUBSPOT_ACCESS_TOKEN=your-hubspot-token

# Anthropic Claude API (optional - for AI features)
ANTHROPIC_API_KEY=your-anthropic-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — login with `JamesPike` / `Soccer123`

---

## Deploy to Vercel (Free)

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Set all environment variables from `.env.local` in Vercel's Environment Variables settings
4. Deploy — Vercel gives you a free `.vercel.app` URL

**Your app will be accessible from any machine via the Vercel URL.**

---

## HubSpot Setup

1. Log into HubSpot → **Settings → Integrations → Private Apps**
2. Create a new Private App
3. Under **Scopes**, enable:
   - `crm.objects.contacts.read`
   - `crm.objects.deals.write`
   - `crm.objects.products.write`
   - `crm.objects.products.read`
4. Generate the token and add it as `HUBSPOT_ACCESS_TOKEN` in your env

---

## Excel Import Format

Your Excel/CSV file needs these columns (header names are flexible):

| Column | Required | Accepted Headers |
|--------|----------|-----------------|
| SKU | Yes | SKU, Code, ProductCode, Part Number |
| Name | Yes | Name, Title, Product Name |
| Description | No | Description, Desc, Long Description |
| Price | No | Price, Unit Price, Cost, MSRP |
| Category | No | Category, Type, Product Type |
| Unit | No | Unit, UOM, Unit of Measure |

Download a template from the **Import SKUs** page.

---

## AI Features

When `ANTHROPIC_API_KEY` is configured:
- **AI Product Suggestions** — Describe customer needs → Claude recommends products
- **AI Quote Summaries** — Generate professional proposal text for your quotes

AI features are **optional** — the CPQ works fully without them. Anthropic API costs are minimal (fractions of a cent per query).

---

## Cost Breakdown

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Hobby (free) | $0 |
| Supabase | Free tier (500MB DB) | $0 |
| HubSpot | Free CRM | $0 |
| Anthropic API | Pay-per-use (optional) | ~$0.01/month typical |

**Total: ~$0/month**

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: iron-session (cookie-based)
- **HubSpot**: @hubspot/api-client
- **AI**: @anthropic-ai/sdk (Claude)
- **Excel**: xlsx
- **PDF**: jspdf + jspdf-autotable
