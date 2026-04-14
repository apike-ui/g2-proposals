// G2 Product Catalog — TypeScript port of g2-proposals.html constants
// These are the authoritative SKU definitions for proposals, quotes, and rate cards.

// ─── Brand Colors ──────────────────────────────────────────────────────────────
export const G2_COLORS = {
  rorange: '#FF492C',
  navy: '#062846',
  green: '#27D3BC',
  blue: '#0073F5',
  purple: '#5746B2',
  yellow: '#FFC800',
  // Tints (light backgrounds)
  rorangeTint: '#FFEEE9',
  blueTint: '#E6F2FF',
  purpleTint: '#EEEAFB',
  greenTint: '#E6FAF8',
  yellowTint: '#FFF9E6',
  mid: '#6B7280',
} as const

// ─── TypeScript Interfaces ─────────────────────────────────────────────────────
export interface FoundationTier {
  id: string
  name: string
  listPrice: number        // annual price in USD
  color: string
  headline: string
  highlights: string[]
}

export interface AddonTier {
  label: string
  price: number
  custom?: boolean         // true = price is $0 placeholder, entered manually
}

export interface CatVolumeRule {
  minCats: number
  perCatPrice: number
}

export interface AddonSku {
  id: string
  name: string
  color: string
  tint: string
  tiers: AddonTier[]
  catPricing?: boolean     // true = supports "by category" pricing model
  allCatPrice?: number     // "all categories" flat price
  catVolume?: CatVolumeRule[]
  noDisc?: boolean         // true = non-discountable
}

export interface NonAvcItem {
  id: string
  name: string
  listPrice: number        // 0 = variable / non-discountable
  note: string
}

// Proposal product state (one G2 product/logo in a proposal)
export interface AddonState {
  on: boolean
  tierIdx: number
  qty: number
  rate: string             // custom price override (empty = use list)
  disc: string             // discount percent string (e.g. "10")
  cats: string             // comma-separated category labels (for catPricing)
  allCats: boolean
}

export interface ProposalProduct {
  id: number               // internal temp ID
  name: string             // customer-facing product name e.g. "Product 1"
  basePkg: string          // 'free' | 'professional' | 'enterprise'
  baseRate: string         // custom base price override
  baseDisc: string         // base package discount percent
  addons: Record<string, AddonState>
}

export interface AcctItems {
  [nonAvcId: string]: {
    qty: number
    rate: string
  }
}

export interface ProposalSnapshot {
  cust: string
  rep: string
  products: ProposalProduct[]
  acctItems: AcctItems
  proposalDisc: string
  contractTerm: string     // '6' | '12' | '24' | '36' | 'custom'
  startDate: string        // YYYY-MM-DD
  endDate: string          // YYYY-MM-DD
  rateCardId?: string
  rateCardName?: string
}

export interface RateCardTierOverride {
  label: string
  listPrice: number
  myPrice: number
}

export interface RateCardVolumeDisc {
  minProducts: number
  discPct: number
}

export interface RateCardData {
  basePkgs: Record<string, { price: number }>
  addons: Record<string, {
    tiers: RateCardTierOverride[]
    volumeDisc: RateCardVolumeDisc[]
  }>
  nonAcv: Record<string, { price: number }>
}

// ─── Foundation Tiers ─────────────────────────────────────────────────────────
export const FOUNDATION_TIERS: FoundationTier[] = [
  {
    id: 'free',
    name: 'Free',
    listPrice: 0,
    color: G2_COLORS.mid,
    headline: 'Get listed on G2',
    highlights: [
      'Logo on G2 Profile & Reports',
      'Seller Pages (basic)',
      'Review Collection Page (unincentivized)',
      'Users Love Us badge',
      'Review Syndication',
      'AI Sales Agent (G2.com only)',
      '3 user seats',
      'Chat support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    listPrice: 18000,
    color: G2_COLORS.purple,
    headline: 'Capture demand & prove ROI',
    highlights: [
      'Everything in Free, plus:',
      'Seller Pages (custom branding)',
      'Review Collection (incentivized + custom campaigns)',
      'Competitive Intelligence (1 category)',
      'Buyer Intent (basic, 1 category)',
      'AI Sales Agent (full platform)',
      '10 user seats',
      'Dedicated CSM',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    listPrice: 34000,
    color: G2_COLORS.rorange,
    headline: 'Full platform + intelligence',
    highlights: [
      'Everything in Professional, plus:',
      'Solutions Pages (custom product groupings)',
      'Multi-Product Review Collection & Leads',
      'Market Intelligence Dashboard (included)',
      'Video Reviews (5 included)',
      'Written Review Campaigns ($1,000 credit)',
      'AI Sales Agent ($1,000 chat credit)',
      'Unlimited user seats',
      'Buyer Intent available as add-on',
      'G2 Content available as add-on',
    ],
  },
]

// ─── Add-On Catalog ───────────────────────────────────────────────────────────
export const ADDON_CATALOG: AddonSku[] = [
  {
    id: 'intent',
    name: 'Buyer Intent',
    color: G2_COLORS.blue,
    tint: G2_COLORS.blueTint,
    catPricing: true,
    allCatPrice: 75000,
    catVolume: [
      { minCats: 1, perCatPrice: 12500 },
      { minCats: 3, perCatPrice: 11000 },
      { minCats: 5, perCatPrice: 9500 },
      { minCats: 10, perCatPrice: 8000 },
    ],
    tiers: [
      { label: 'Tier 1', price: 12500 },
      { label: 'Tier 2', price: 17000 },
      { label: 'Tier 3', price: 25000 },
      { label: 'Tier 4', price: 32500 },
      { label: 'Tier 5', price: 40000 },
      { label: 'Tier 6', price: 47500 },
      { label: 'Tier 7', price: 57000 },
      { label: 'Tier 8', price: 65000 },
      { label: 'Tier 9', price: 70500 },
      { label: 'Tier 10', price: 75000 },
    ],
  },
  {
    id: 'content',
    name: 'G2 Content',
    color: G2_COLORS.purple,
    tint: G2_COLORS.purpleTint,
    catPricing: true,
    allCatPrice: 80000,
    catVolume: [
      { minCats: 1, perCatPrice: 25000 },
      { minCats: 3, perCatPrice: 22000 },
      { minCats: 5, perCatPrice: 18000 },
    ],
    tiers: [
      { label: 'Cat & Comparison', price: 45000 },
      { label: 'Momentum & Index', price: 13000 },
      { label: 'Regional Grid', price: 20000 },
      { label: 'Grid Report', price: 25000 },
      { label: 'Comparison Report', price: 18000 },
      { label: 'Segmented Grid', price: 25000 },
      { label: 'Index Report', price: 7000 },
    ],
  },
  {
    id: 'aicr',
    name: 'AI-Led Custom Research (AICR)',
    color: G2_COLORS.green,
    tint: G2_COLORS.greenTint,
    tiers: [
      { label: 'SMART Report (reviews-based)', price: 5000 },
      { label: 'AI Research (~100 interviews)', price: 10000 },
      { label: 'AI Research (200-300 interviews)', price: 85000 },
      { label: 'Post-Pilot (100 interviews)', price: 25000 },
    ],
  },
  {
    id: 'clicks',
    name: 'G2 Clicks (PPC)',
    color: G2_COLORS.blue,
    tint: G2_COLORS.blueTint,
    tiers: [
      { label: 'Monthly PPC Budget', price: 5000 },
    ],
  },
  {
    id: 'paidpromo',
    name: 'Paid Promotions',
    color: G2_COLORS.rorange,
    tint: G2_COLORS.rorangeTint,
    tiers: [
      { label: 'Quarterly slot (per category)', price: 5000 },
      { label: 'Annual slot (per category)', price: 17000 },
    ],
  },
  {
    id: 'rms',
    name: 'Review Managed Services',
    color: G2_COLORS.green,
    tint: G2_COLORS.greenTint,
    noDisc: true,
    tiers: [
      { label: 'Accelerator (1 product, 50 reviews)', price: 10000 },
      { label: 'Growth (1 product, 100 reviews)', price: 18000 },
      { label: 'Custom', price: 0, custom: true },
    ],
  },
  {
    id: 'events',
    name: 'Custom Event Activation',
    color: G2_COLORS.yellow,
    tint: G2_COLORS.yellowTint,
    tiers: [
      { label: 'Core Package', price: 15000 },
      { label: 'Enhanced Package', price: 25000 },
      { label: 'Review Booth (US)', price: 5500 },
      { label: 'Review Booth (International)', price: 6500 },
      { label: 'Onsite G2 Rep', price: 7000 },
    ],
  },
  {
    id: 'mi',
    name: 'Market Intelligence',
    color: G2_COLORS.navy,
    tint: '#D9DEE6',
    tiers: [
      { label: 'Data Licensing (custom scope)', price: 0, custom: true },
    ],
  },
  {
    id: 'techconsulting',
    name: 'Technical Consulting',
    color: G2_COLORS.purple,
    tint: G2_COLORS.purpleTint,
    tiers: [
      { label: 'Data Consumption Advisory (fixed)', price: 0, custom: true },
      { label: 'Custom BI Integration (hourly)', price: 0, custom: true },
      { label: 'Custom Data Pipeline (hourly)', price: 0, custom: true },
      { label: 'Custom App Development (hourly)', price: 0, custom: true },
    ],
  },
  {
    id: 'review_campaigns',
    name: 'Written Review Campaigns',
    color: G2_COLORS.rorange,
    tint: G2_COLORS.rorangeTint,
    tiers: [
      { label: '$1,000 credit', price: 1000 },
      { label: '$2,500 credit', price: 2500 },
      { label: '$5,000 credit', price: 5000 },
      { label: '$10,000 credit', price: 10000 },
    ],
  },
]

// ─── Non-ACV Catalog ──────────────────────────────────────────────────────────
export const NONAVC_CATALOG: NonAvcItem[] = [
  { id: 'giftcards', name: 'Gift Card Add-Ons', listPrice: 0, note: 'Variable, non-discountable' },
  { id: 'videoreview', name: 'Video Review Add-On', listPrice: 500, note: 'Per additional video' },
  { id: 'adcut', name: 'Ad Cut (Video Reviews)', listPrice: 500, note: '15-30s excerpt' },
  { id: 'social', name: 'Social Asset Creation', listPrice: 2500, note: '3 ad units' },
  { id: 'infographic', name: 'Infographics', listPrice: 2500, note: 'Visual data from G2 reports' },
  { id: 'animatedgif', name: 'Animated GIFs', listPrice: 2500, note: 'Animated assets' },
  { id: 'reportpdf', name: 'Report PDF', listPrice: 2000, note: 'Formatted downloadable PDF' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getFoundationTier(id: string): FoundationTier | undefined {
  return FOUNDATION_TIERS.find(t => t.id === id)
}

export function getAddonSku(id: string): AddonSku | undefined {
  return ADDON_CATALOG.find(a => a.id === id)
}

export function getNonAvcItem(id: string): NonAvcItem | undefined {
  return NONAVC_CATALOG.find(n => n.id === id)
}
