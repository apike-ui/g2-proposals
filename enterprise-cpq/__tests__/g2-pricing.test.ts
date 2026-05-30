import {
  getBasePrice,
  getAddonTierPrice,
  applyDiscount,
  fmtUSD,
  calcProductLineItems,
  calcProductTotal,
  calcGrandTotal,
  buildMultiYearTable,
  calcAllLineItems,
  buildAddonProductCounts,
} from '../lib/g2-pricing'
import {
  FOUNDATION_TIERS,
  ADDON_CATALOG,
  NONAVC_CATALOG,
  ProposalProduct,
  ProposalSnapshot,
  RateCardData,
  AddonState,
} from '../lib/g2-catalog'

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<ProposalProduct> = {}): ProposalProduct {
  const addons: Record<string, AddonState> = {}
  for (const a of ADDON_CATALOG) {
    addons[a.id] = { on: false, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
  }
  return {
    id: 1,
    name: 'Test Product',
    basePkg: 'professional',
    baseRate: '',
    baseDisc: '',
    addons,
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<ProposalSnapshot> = {}): ProposalSnapshot {
  return {
    cust: 'Acme Corp',
    rep: 'Jane Doe',
    products: [makeProduct()],
    acctItems: {},
    proposalDisc: '',
    contractTerm: '12',
    startDate: '',
    endDate: '',
    ...overrides,
  }
}

const mockRateCard: RateCardData = {
  basePkgs: {
    professional: { price: 15000 },
    enterprise: { price: 30000 },
  },
  addons: {
    intent: {
      tiers: [
        { label: 'Tier 1', listPrice: 12500, myPrice: 10000 },
        { label: 'Tier 2', listPrice: 17000, myPrice: 14000 },
      ],
      volumeDisc: [],
    },
  },
  nonAcv: {
    videoreview: { price: 400 },
  },
}

// ─── getBasePrice ──────────────────────────────────────────────────────────────────────────────

describe('getBasePrice', () => {
  test('returns list price when no rate card', () => {
    expect(getBasePrice('professional')).toBe(18000)
    expect(getBasePrice('enterprise')).toBe(34000)
    expect(getBasePrice('free')).toBe(0)
  })

  test('returns rate card override when present', () => {
    expect(getBasePrice('professional', mockRateCard)).toBe(15000)
    expect(getBasePrice('enterprise', mockRateCard)).toBe(30000)
  })

  test('falls back to list price if tier not in rate card', () => {
    expect(getBasePrice('free', mockRateCard)).toBe(0)
  })

  test('returns 0 for unknown tier', () => {
    expect(getBasePrice('unknown')).toBe(0)
  })
})

// ─── getAddonTierPrice ─────────────────────────────────────────────────────────────────────────────

describe('getAddonTierPrice', () => {
  test('returns catalog price when no rate card', () => {
    expect(getAddonTierPrice('intent', 0)).toBe(12500)
    expect(getAddonTierPrice('intent', 2)).toBe(25000)
  })

  test('returns rate card myPrice when present', () => {
    expect(getAddonTierPrice('intent', 0, mockRateCard)).toBe(10000)
    expect(getAddonTierPrice('intent', 1, mockRateCard)).toBe(14000)
  })

  test('returns 0 for out-of-range tierIdx', () => {
    expect(getAddonTierPrice('intent', 999)).toBe(0)
  })

  test('returns 0 for unknown addon', () => {
    expect(getAddonTierPrice('nonexistent', 0)).toBe(0)
  })
})

// ─── applyDiscount ───────────────────────────────────────────────────────────────────────────────

describe('applyDiscount', () => {
  test('no discount returns original price', () => {
    expect(applyDiscount(10000, 0)).toBe(10000)
  })

  test('10% discount', () => {
    expect(applyDiscount(10000, 10)).toBe(9000)
  })

  test('100% discount', () => {
    expect(applyDiscount(10000, 100)).toBe(0)
  })

  test('negative discount is ignored (treated as no discount)', () => {
    expect(applyDiscount(10000, -5)).toBe(10000)
  })

  test('fractional discount', () => {
    expect(applyDiscount(20000, 15)).toBe(17000)
  })
})

// ─── fmtUSD ───────────────────────────────────────────────────────────────────────────────────

describe('fmtUSD', () => {
  test('formats integer as currency', () => {
    expect(fmtUSD(18000)).toBe('$18,000')
  })

  test('formats zero', () => {
    expect(fmtUSD(0)).toBe('$0')
  })

  test('formats large number', () => {
    expect(fmtUSD(1000000)).toBe('$1,000,000')
  })
})

// ─── calcProductLineItems ────────────────────────────────────────────────────────────────────────────

describe('calcProductLineItems', () => {
  test('base professional package list price', () => {
    const product = makeProduct({ basePkg: 'professional' })
    const items = calcProductLineItems(product)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('Professional Package')
    expect(items[0].listPrice).toBe(18000)
    expect(items[0].netPrice).toBe(18000)
    expect(items[0].totalNet).toBe(18000)
    expect(items[0].discPct).toBe(0)
    expect(items[0].qty).toBe(1)
  })

  test('base enterprise package list price', () => {
    const product = makeProduct({ basePkg: 'enterprise' })
    const items = calcProductLineItems(product)
    expect(items[0].listPrice).toBe(34000)
    expect(items[0].netPrice).toBe(34000)
  })

  test('base discount applied', () => {
    const product = makeProduct({ basePkg: 'professional', baseDisc: '10' })
    const items = calcProductLineItems(product)
    expect(items[0].netPrice).toBe(16200)
    expect(items[0].discPct).toBe(10)
  })

  test('base custom rate override', () => {
    const product = makeProduct({ basePkg: 'professional', baseRate: '12000' })
    const items = calcProductLineItems(product)
    expect(items[0].listPrice).toBe(12000)
    expect(items[0].netPrice).toBe(12000)
  })

  test('rate card override for base package', () => {
    const product = makeProduct({ basePkg: 'professional' })
    const items = calcProductLineItems(product, mockRateCard)
    expect(items[0].listPrice).toBe(15000)
    expect(items[0].netPrice).toBe(15000)
  })

  test('proposal discount stacks on top of base disc', () => {
    const product = makeProduct({ basePkg: 'professional', baseDisc: '10' })
    const items = calcProductLineItems(product, null, 5)
    // 10 + 5 = 15% total discount
    expect(items[0].discPct).toBe(15)
    expect(items[0].netPrice).toBeCloseTo(18000 * 0.85, 1)
  })

  test('enabled addon adds line item', () => {
    const product = makeProduct()
    product.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const items = calcProductLineItems(product)
    expect(items).toHaveLength(2)
    const addonItem = items[1]
    expect(addonItem.label).toContain('Buyer Intent')
    expect(addonItem.listPrice).toBe(12500)
    expect(addonItem.totalNet).toBe(12500)
  })

  test('disabled addon is excluded', () => {
    const product = makeProduct()
    const items = calcProductLineItems(product)
    expect(items).toHaveLength(1) // only base
  })

  test('addon quantity multiplied into totalNet', () => {
    const product = makeProduct()
    product.addons['content'] = { on: true, tierIdx: 0, qty: 3, rate: '', disc: '', cats: '', allCats: false }
    const items = calcProductLineItems(product)
    const addonItem = items.find(i => i.label.startsWith('G2 Content'))!
    expect(addonItem.qty).toBe(3)
    expect(addonItem.totalNet).toBe(addonItem.netPrice * 3)
  })

  test('addon with custom rate override', () => {
    const product = makeProduct()
    product.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '9000', disc: '', cats: '', allCats: false }
    const items = calcProductLineItems(product)
    const addonItem = items.find(i => i.label.startsWith('Buyer Intent'))!
    expect(addonItem.listPrice).toBe(9000)
    expect(addonItem.netPrice).toBe(9000)
  })

  test('noDisc addon ignores discount', () => {
    const noDiscAddon = ADDON_CATALOG.find(a => a.noDisc)
    if (!noDiscAddon) return // skip if none defined
    const product = makeProduct()
    product.addons[noDiscAddon.id] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '20', cats: '', allCats: false }
    const items = calcProductLineItems(product, null, 10)
    const addonItem = items.find(i => i.label.startsWith(noDiscAddon.name))!
    expect(addonItem.discPct).toBe(0)
  })

  test('rate card overrides addon tier price', () => {
    const product = makeProduct()
    product.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const items = calcProductLineItems(product, mockRateCard)
    const addonItem = items.find(i => i.label.startsWith('Buyer Intent'))!
    expect(addonItem.listPrice).toBe(10000)
  })

  test('free package produces $0 base', () => {
    const product = makeProduct({ basePkg: 'free' })
    const items = calcProductLineItems(product)
    expect(items[0].listPrice).toBe(0)
    expect(items[0].netPrice).toBe(0)
  })
})

// ─── calcProductTotal ──────────────────────────────────────────────────────────────────────────────

describe('calcProductTotal', () => {
  test('professional package only', () => {
    expect(calcProductTotal(makeProduct())).toBe(18000)
  })

  test('enterprise with 10% discount', () => {
    const p = makeProduct({ basePkg: 'enterprise', baseDisc: '10' })
    expect(calcProductTotal(p)).toBe(30600)
  })

  test('professional + intent addon', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    expect(calcProductTotal(p)).toBe(18000 + 12500)
  })

  test('proposal discount applies to both base and addon', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const total = calcProductTotal(p, null, 10)
    expect(total).toBeCloseTo((18000 + 12500) * 0.9, 0)
  })
})

// ─── calcGrandTotal ───────────────────────────────────────────────────────────────────────────────

describe('calcGrandTotal', () => {
  test('single product, no acct items', () => {
    const snap = makeSnapshot()
    expect(calcGrandTotal(snap)).toBe(18000)
  })

  test('proposal discount applied', () => {
    const snap = makeSnapshot({ proposalDisc: '10' })
    expect(calcGrandTotal(snap)).toBe(16200)
  })

  test('non-ACV items included', () => {
    const snap = makeSnapshot({
      acctItems: { videoreview: { qty: 2, rate: '' } },
    })
    // videoreview list price is $500; 2 × $500 = $1,000
    expect(calcGrandTotal(snap)).toBe(18000 + 500 * 2)
  })

  test('non-ACV with custom rate', () => {
    const snap = makeSnapshot({
      acctItems: { videoreview: { qty: 3, rate: '300' } },
    })
    expect(calcGrandTotal(snap)).toBe(18000 + 300 * 3)
  })

  test('non-ACV with rate card override', () => {
    const snap = makeSnapshot({
      acctItems: { videoreview: { qty: 1, rate: '' } },
    })
    // mockRateCard has videoreview at $400; base professional at $15,000
    expect(calcGrandTotal(snap, mockRateCard)).toBe(15000 + 400)
  })

  test('multiple products summed', () => {
    const snap = makeSnapshot({
      products: [makeProduct(), makeProduct({ basePkg: 'enterprise' })],
    })
    expect(calcGrandTotal(snap)).toBe(18000 + 34000)
  })

  test('zero qty non-ACV excluded', () => {
    const snap = makeSnapshot({
      acctItems: { revcredit: { qty: 0, rate: '' } },
    })
    expect(calcGrandTotal(snap)).toBe(18000)
  })
})

// ─── buildMultiYearTable ─────────────────────────────────────────────────────────────────────────────

describe('buildMultiYearTable', () => {
  test('12 month term shows at least 3 rows', () => {
    const rows = buildMultiYearTable(18000, '12')
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })

  test('annual ACV is passed through unchanged', () => {
    const rows = buildMultiYearTable(25000, '24')
    expect(rows[0].annualAcv).toBe(25000)
    expect(rows[1].annualAcv).toBe(25000)
  })

  test('totalValue accumulates by year', () => {
    const rows = buildMultiYearTable(10000, '12')
    expect(rows[0].totalValue).toBe(10000)
    expect(rows[1].totalValue).toBe(20000)
    expect(rows[2].totalValue).toBe(30000)
  })

  test('year labels start at Year 1', () => {
    const rows = buildMultiYearTable(10000, '12')
    expect(rows[0].label).toBe('Year 1')
    expect(rows[1].label).toBe('Year 2')
  })

  test('handles invalid term gracefully', () => {
    const rows = buildMultiYearTable(5000, 'custom')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].annualAcv).toBe(5000)
  })
})

// ─── calcAllLineItems ──────────────────────────────────────────────────────────────────────────────

describe('calcAllLineItems', () => {
  test('returns one entry per product', () => {
    const snap = makeSnapshot({
      products: [makeProduct(), makeProduct({ name: 'Product 2', basePkg: 'enterprise' })],
    })
    const result = calcAllLineItems(snap)
    expect(result).toHaveLength(2)
    expect(result[0].productName).toBe('Test Product')
    expect(result[1].productName).toBe('Product 2')
  })

  test('items contain line item arrays', () => {
    const snap = makeSnapshot()
    const result = calcAllLineItems(snap)
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0].label).toBe('Professional Package')
  })

  test('proposal discount propagated to all items', () => {
    const snap = makeSnapshot({ proposalDisc: '20' })
    const result = calcAllLineItems(snap)
    expect(result[0].items[0].discPct).toBe(20)
    expect(result[0].items[0].netPrice).toBeCloseTo(18000 * 0.8, 0)
  })
})

// ─── buildAddonProductCounts ────────────────────────────────────────────────────────────────────────────

describe('buildAddonProductCounts', () => {
  test('counts products with each addon enabled', () => {
    const p1 = makeProduct()
    const p2 = makeProduct({ id: 2 })
    p1.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    p2.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    p2.addons['content'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const counts = buildAddonProductCounts([p1, p2])
    expect(counts['intent']).toBe(2)
    expect(counts['content']).toBe(1)
  })

  test('disabled addons not counted', () => {
    const p = makeProduct()
    // all addons default to off
    const counts = buildAddonProductCounts([p])
    expect(Object.keys(counts).length).toBe(0)
  })

  test('empty products array', () => {
    expect(buildAddonProductCounts([])).toEqual({})
  })
})

// ─── Rate card volume discount ───────────────────────────────────────────────────────────────────────────

const volumeRateCard: RateCardData = {
  basePkgs: {},
  addons: {
    intent: {
      tiers: [
        { label: 'Tier 1', listPrice: 12500, myPrice: 12500 },
      ],
      volumeDisc: [
        { minProducts: 2, discPct: 10 },
        { minProducts: 3, discPct: 15 },
      ],
    },
  },
  nonAcv: {},
}

describe('rate card volume discounts', () => {
  test('no volume discount when only 1 product has addon', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const counts = { intent: 1 }
    const items = calcProductLineItems(p, volumeRateCard, 0, counts)
    const intentItem = items.find(i => i.label.startsWith('Buyer Intent'))!
    expect(intentItem.listPrice).toBe(12500)
  })

  test('10% volume discount applied when 2 products have addon', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const counts = { intent: 2 }
    const items = calcProductLineItems(p, volumeRateCard, 0, counts)
    const intentItem = items.find(i => i.label.startsWith('Buyer Intent'))!
    // 12500 * (1 - 0.10) = 11250
    expect(intentItem.listPrice).toBe(11250)
  })

  test('15% volume discount applied when 3+ products have addon', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const counts = { intent: 3 }
    const items = calcProductLineItems(p, volumeRateCard, 0, counts)
    const intentItem = items.find(i => i.label.startsWith('Buyer Intent'))!
    // 12500 * (1 - 0.15) = 10625
    expect(intentItem.listPrice).toBe(10625)
  })

  test('highest applicable volume tier is chosen', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const counts = { intent: 5 }
    const items = calcProductLineItems(p, volumeRateCard, 0, counts)
    const intentItem = items.find(i => i.label.startsWith('Buyer Intent'))!
    // 5 products qualifies for both 2+ and 3+ tiers; 3+ (15%) is the highest applicable
    expect(intentItem.listPrice).toBe(10625)
  })

  test('custom rate override bypasses volume discount', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '8000', disc: '', cats: '', allCats: false }
    const counts = { intent: 3 }
    const items = calcProductLineItems(p, volumeRateCard, 0, counts)
    const intentItem = items.find(i => i.label.startsWith('Buyer Intent'))!
    expect(intentItem.listPrice).toBe(8000)
  })

  test('calcGrandTotal applies volume discounts across products', () => {
    const p1 = makeProduct()
    const p2 = makeProduct({ id: 2 })
    p1.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    p2.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    const snap = makeSnapshot({ products: [p1, p2] })
    const total = calcGrandTotal(snap, volumeRateCard)
    // 2 professional packages at list (no RC override) + 2 intent at 10% vol discount
    // professional: 18000 * 2 = 36000
    // intent: 11250 * 2 = 22500
    expect(total).toBe(36000 + 22500)
  })
})

// ─── Catalog integrity checks ───────────────────────────────────────────────────────────────────────────

describe('G2 Catalog integrity', () => {
  test('FOUNDATION_TIERS has free, professional, enterprise', () => {
    const ids = FOUNDATION_TIERS.map(t => t.id)
    expect(ids).toContain('free')
    expect(ids).toContain('professional')
    expect(ids).toContain('enterprise')
  })

  test('all FOUNDATION_TIERS have required fields', () => {
    for (const tier of FOUNDATION_TIERS) {
      expect(tier.id).toBeTruthy()
      expect(tier.name).toBeTruthy()
      expect(typeof tier.listPrice).toBe('number')
      expect(tier.listPrice).toBeGreaterThanOrEqual(0)
      expect(tier.color).toMatch(/^#/)
    }
  })

  test('ADDON_CATALOG IDs are unique', () => {
    const ids = ADDON_CATALOG.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('all ADDON_CATALOG entries have tiers', () => {
    for (const addon of ADDON_CATALOG) {
      expect(addon.tiers.length).toBeGreaterThan(0)
    }
  })

  test('all NONAVC_CATALOG items have required fields', () => {
    for (const item of NONAVC_CATALOG) {
      expect(item.id).toBeTruthy()
      expect(item.name).toBeTruthy()
      expect(typeof item.listPrice).toBe('number')
    }
  })

  test('NONAVC_CATALOG IDs are unique', () => {
    const ids = NONAVC_CATALOG.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ─── ProposalPreview calculation logic (pure math) ──────────────────────────────────────────────

describe('ProposalPreview calculation logic', () => {
  test('totalSubtotal is sum of prodSubtotals without proposal disc', () => {
    const products = [
      makeProduct({ basePkg: 'professional' }),
      makeProduct({ basePkg: 'enterprise' }),
    ]
    let totalSubtotal = 0
    for (const p of products) {
      const items = calcProductLineItems(p, null, 0)
      totalSubtotal += items.reduce((s, li) => s + li.totalNet, 0)
    }
    expect(totalSubtotal).toBe(18000 + 34000)
  })

  test('proposal discount reduces grand total correctly', () => {
    const snap = makeSnapshot({
      products: [makeProduct({ basePkg: 'professional' })],
      proposalDisc: '10',
    })
    // Without disc: 18000; with 10% off: 16200
    const total = calcGrandTotal(snap)
    expect(total).toBeCloseTo(16200, 0)
  })

  test('savings calculation: list minus ACV', () => {
    const p = makeProduct({ basePkg: 'professional', baseDisc: '15' })
    const items = calcProductLineItems(p, null, 0)
    const listTotal = items.reduce((s, li) => s + li.listPrice * li.qty, 0)
    const netTotal = items.reduce((s, li) => s + li.totalNet, 0)
    const savings = listTotal - netTotal
    expect(savings).toBeCloseTo(18000 * 0.15, 0)
  })

  test('multi-year contract value = ACV * years (integer terms)', () => {
    const snap = makeSnapshot({ contractTerm: '24' })
    const annualAcv = calcGrandTotal(snap)
    const years = 2
    expect(annualAcv * years).toBe(18000 * 2)
  })

  test('SKU count includes base + addons + non-ACV', () => {
    const p = makeProduct()
    p.addons['intent'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    p.addons['content'] = { on: true, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
    // 1 product with 2 addons = 3 SKUs (base + 2 addons)
    const items = calcProductLineItems(p)
    expect(items).toHaveLength(3)
  })
})
