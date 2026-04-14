import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { calcGrandTotal, calcAllLineItems, buildMultiYearTable, fmtUSD } from '@/lib/g2-pricing'
import type { ProposalSnapshot, RateCardData } from '@/lib/g2-catalog'
import { NONAVC_CATALOG } from '@/lib/g2-catalog'

export const maxDuration = 30

const NAVY = '062846'
const RORANGE = 'FF492C'
const WHITE = 'FFFFFF'
const LIGHT_GRAY = 'F3F4F6'
const DARK_GRAY = '374151'

export async function POST(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const snapshot: ProposalSnapshot = body.snapshot
    const rateCard: RateCardData | null = body.rateCard || null
    const proposalName: string = body.proposalName || 'G2 Proposal'

    if (!snapshot) return NextResponse.json({ error: 'snapshot is required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PptxGenJS = require('pptxgenjs')
    const pptx = new PptxGenJS()

    pptx.layout = 'LAYOUT_WIDE'
    pptx.author = session.displayName || 'G2'
    pptx.subject = proposalName

    const grandTotal = calcGrandTotal(snapshot, rateCard)
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    // ─── Helper: add branded section header bar ───────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addSlideHeader = (slide: any, title: string) => {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: NAVY } })
      slide.addText(title, {
        x: 0.4, y: 0.1, w: 9, h: 0.6,
        color: WHITE, fontSize: 20, bold: true, fontFace: 'Arial',
      })
      // G2 rorange accent bar at bottom of header
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.78, w: '100%', h: 0.04, fill: { color: RORANGE } })
    }

    // ─── Slide 1: Cover ───────────────────────────────────────────────────────
    const cover = pptx.addSlide()
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: NAVY } })
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 4.6, w: '100%', h: 0.08, fill: { color: RORANGE } })

    cover.addText('G2', {
      x: 0.5, y: 0.6, w: 2, h: 1,
      color: RORANGE, fontSize: 72, bold: true, fontFace: 'Arial',
    })

    cover.addText(proposalName, {
      x: 0.5, y: 1.7, w: 8.5, h: 0.8,
      color: WHITE, fontSize: 28, bold: true, fontFace: 'Arial',
    })

    if (snapshot.cust) {
      cover.addText(`Prepared for: ${snapshot.cust}`, {
        x: 0.5, y: 2.6, w: 8.5, h: 0.5,
        color: WHITE, fontSize: 16, fontFace: 'Arial',
      })
    }

    if (snapshot.rep) {
      cover.addText(`Account Executive: ${snapshot.rep}`, {
        x: 0.5, y: 3.15, w: 8.5, h: 0.4,
        color: 'A0B0C0', fontSize: 13, fontFace: 'Arial',
      })
    }

    cover.addText(today, {
      x: 0.5, y: 4.8, w: 8.5, h: 0.4,
      color: 'A0B0C0', fontSize: 12, fontFace: 'Arial',
    })

    // ─── Slide 2: Executive Summary ───────────────────────────────────────────
    const exec = pptx.addSlide()
    addSlideHeader(exec, 'Executive Summary')

    const termLabel = snapshot.contractTerm === 'custom' ? 'Custom Term'
      : `${snapshot.contractTerm}-Month Contract`

    const summaryRows = [
      ['Customer', snapshot.cust || '—'],
      ['Account Executive', snapshot.rep || '—'],
      ['Contract Term', termLabel],
      ['Start Date', snapshot.startDate || '—'],
      ['End Date', snapshot.endDate || '—'],
      ['Total Products', String(snapshot.products.length)],
      ['Total ACV', fmtUSD(grandTotal)],
    ]

    exec.addTable(summaryRows.map(([k, v]) => [
      { text: k, options: { bold: true, color: DARK_GRAY, fill: { color: LIGHT_GRAY }, fontSize: 12, fontFace: 'Arial' } },
      { text: v, options: { color: DARK_GRAY, fontSize: 12, fontFace: 'Arial' } },
    ]), { x: 0.5, y: 1.1, w: 8.5, h: 3, colW: [3, 5.5], border: { pt: 0.5, color: 'E5E7EB' } })

    // ─── Slide 3+: Per-Product Detail ─────────────────────────────────────────
    const allItems = calcAllLineItems(snapshot, rateCard)
    for (const { productName, items } of allItems) {
      const slide = pptx.addSlide()
      addSlideHeader(slide, `Product: ${productName}`)

      const rows = items.map(li => [
        li.label,
        String(li.qty),
        fmtUSD(li.listPrice),
        li.discPct > 0 ? `${li.discPct.toFixed(1)}%` : '—',
        fmtUSD(li.totalNet),
      ])

      const headers = [
        [
          { text: 'Line Item', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11, fontFace: 'Arial' } },
          { text: 'Qty', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11, fontFace: 'Arial' } },
          { text: 'List Price', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11, fontFace: 'Arial' } },
          { text: 'Discount', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11, fontFace: 'Arial' } },
          { text: 'Net Price', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11, fontFace: 'Arial' } },
        ],
      ]

      const dataRows = rows.map(r => r.map(cell => ({ text: cell, options: { fontSize: 10, fontFace: 'Arial', color: DARK_GRAY } })))
      const productTotal = items.reduce((s, i) => s + i.totalNet, 0)

      const totalRow = [
        { text: 'Product Total', options: { bold: true, fontSize: 10, fontFace: 'Arial', color: DARK_GRAY, fill: { color: LIGHT_GRAY } } },
        { text: '', options: { fill: { color: LIGHT_GRAY } } },
        { text: '', options: { fill: { color: LIGHT_GRAY } } },
        { text: '', options: { fill: { color: LIGHT_GRAY } } },
        { text: fmtUSD(productTotal), options: { bold: true, fontSize: 10, fontFace: 'Arial', color: RORANGE, fill: { color: LIGHT_GRAY } } },
      ]

      slide.addTable([...headers, ...dataRows, totalRow], {
        x: 0.5, y: 1.0, w: 8.5,
        colW: [4, 0.6, 1.3, 1.1, 1.5],
        border: { pt: 0.5, color: 'E5E7EB' },
        autoPage: true,
      })
    }

    // ─── Pricing Details Slide ────────────────────────────────────────────────
    const pricing = pptx.addSlide()
    addSlideHeader(pricing, 'Pricing Details')

    const allRows: string[][] = []
    for (const { productName, items } of allItems) {
      allRows.push([productName, '', '', '', ''])
      for (const li of items) {
        allRows.push([`  ${li.label}`, String(li.qty), fmtUSD(li.listPrice), li.discPct > 0 ? `${li.discPct.toFixed(1)}%` : '—', fmtUSD(li.totalNet)])
      }
    }

    pricing.addTable(
      [
        [
          { text: 'Product / Line Item', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 10 } },
          { text: 'Qty', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 10 } },
          { text: 'List', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 10 } },
          { text: 'Disc', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 10 } },
          { text: 'Net', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 10 } },
        ],
        ...allRows.map((r, i) => r.map(cell => ({
          text: cell,
          options: { fontSize: 9, color: DARK_GRAY, fill: { color: i % 2 === 0 ? LIGHT_GRAY : WHITE } },
        }))),
      ],
      { x: 0.5, y: 1.0, w: 8.5, colW: [3.8, 0.6, 1.3, 1.1, 1.7], border: { pt: 0.5, color: 'E5E7EB' }, autoPage: true }
    )

    // ─── Cost by Year Slide ───────────────────────────────────────────────────
    const costSlide = pptx.addSlide()
    addSlideHeader(costSlide, 'Cost by Year')

    const term = parseInt(snapshot.contractTerm) || 12
    const annualAcv = grandTotal * (12 / term)
    const yearRows = buildMultiYearTable(annualAcv, snapshot.contractTerm)

    costSlide.addTable(
      [
        [
          { text: 'Period', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 12 } },
          { text: 'Annual ACV', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 12 } },
          { text: 'Cumulative Value', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 12 } },
        ],
        ...yearRows.map(r => [
          { text: r.label, options: { fontSize: 12, color: DARK_GRAY } },
          { text: fmtUSD(r.annualAcv), options: { fontSize: 12, color: DARK_GRAY } },
          { text: fmtUSD(r.totalValue), options: { fontSize: 12, bold: true, color: RORANGE } },
        ]),
      ],
      { x: 1, y: 1.3, w: 7, h: 2.5, colW: [2.5, 2.5, 2], border: { pt: 0.5, color: 'E5E7EB' } }
    )

    // ─── Non-ACV Items (if any) ───────────────────────────────────────────────
    const hasNonAcv = Object.values(snapshot.acctItems).some(i => i.qty > 0)
    if (hasNonAcv) {
      const nonAcvSlide = pptx.addSlide()
      addSlideHeader(nonAcvSlide, 'Non-ACV Items')

      const nonAcvRows = Object.entries(snapshot.acctItems)
        .filter(([, s]) => s.qty > 0)
        .map(([id, s]) => {
          const item = NONAVC_CATALOG.find(n => n.id === id)
          const price = s.rate ? parseFloat(s.rate) : (item?.listPrice ?? 0)
          return [item?.name ?? id, String(s.qty), fmtUSD(price), fmtUSD(price * s.qty)]
        })

      nonAcvSlide.addTable(
        [
          [
            { text: 'Item', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11 } },
            { text: 'Qty', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11 } },
            { text: 'Unit Price', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11 } },
            { text: 'Total', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11 } },
          ],
          ...nonAcvRows.map(r => r.map(cell => ({ text: cell, options: { fontSize: 10, color: DARK_GRAY } }))),
        ],
        { x: 0.5, y: 1.0, w: 8.5, colW: [4, 1, 1.8, 1.7], border: { pt: 0.5, color: 'E5E7EB' } }
      )
    }

    // ─── Next Steps Slide ─────────────────────────────────────────────────────
    const next = pptx.addSlide()
    next.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: NAVY } })
    next.addShape(pptx.ShapeType.rect, { x: 0, y: 4.6, w: '100%', h: 0.08, fill: { color: RORANGE } })

    next.addText('Next Steps', {
      x: 0.5, y: 0.5, w: 8.5, h: 0.7,
      color: WHITE, fontSize: 28, bold: true, fontFace: 'Arial',
    })

    const steps = [
      '1. Review this proposal with your team',
      '2. Schedule a follow-up call to discuss any questions',
      '3. Confirm product selection and contract terms',
      '4. Execute the agreement',
      '5. Onboarding begins within 5 business days of signature',
    ]

    next.addText(steps.join('\n'), {
      x: 0.5, y: 1.4, w: 8.5, h: 3,
      color: WHITE, fontSize: 14, fontFace: 'Arial', lineSpacingMultiple: 1.8,
    })

    // ─── Export ───────────────────────────────────────────────────────────────
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' })

    const filename = `${proposalName.replace(/[^a-z0-9]/gi, '_')}_Proposal.pptx`
    return new Response(pptxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Export PPTX:', err)
    return NextResponse.json({ error: 'Failed to generate PPTX' }, { status: 500 })
  }
}
