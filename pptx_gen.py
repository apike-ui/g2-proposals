"""
G2 Proposal Builder — PPTX generator.
Produces a 5-slide, 16:9 G2-branded PowerPoint deck from a proposal data dict.
"""

import io
from datetime import date

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

# ── Brand colours ────────────────────────────────────────────────────
NAVY   = RGBColor(0x06, 0x28, 0x46)
ORANGE = RGBColor(0xFF, 0x49, 0x2C)
TEAL   = RGBColor(0x27, 0xD3, 0xBC)
PURPLE = RGBColor(0x57, 0x46, 0xB2)
BLUE   = RGBColor(0x00, 0x73, 0xF5)
YELLOW = RGBColor(0xFF, 0xC8, 0x00)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT  = RGBColor(0xF2, 0xF4, 0xF7)
MID    = RGBColor(0x4D, 0x64, 0x80)
LGREY  = RGBColor(0xE2, 0xE8, 0xF0)

# Slide dimensions — widescreen 16:9
W = Inches(13.333)
H = Inches(7.5)

# Base package list prices per year
BASE_PRICES = {
    "free": 0,
    "professional": 18000,
    "enterprise": 36000,
}


# ── Low-level helpers ────────────────────────────────────────────────

def _rgb(r: RGBColor):
    """Return (r,g,b) tuple from RGBColor."""
    return r[0], r[1], r[2]


def add_rect(slide, x, y, w, h, fill: RGBColor, alpha=None):
    """Add a filled rectangle shape with no border."""
    from pptx.util import Emu
    shape = slide.shapes.add_shape(
        1,  # MSO_SHAPE_TYPE.RECTANGLE
        Inches(x), Inches(y), Inches(w), Inches(h)
    )
    shape.line.fill.background()  # no border
    fill_fmt = shape.fill
    fill_fmt.solid()
    fill_fmt.fore_color.rgb = fill
    if alpha is not None:
        fill_fmt.fore_color.theme_color  # touch to materialise
    return shape


def add_rounded_rect(slide, x, y, w, h, fill: RGBColor, radius_pt=8):
    """Add a rounded rectangle (MSO_SHAPE freeform fallback via auto-shape 5)."""
    from pptx.oxml.ns import qn
    from lxml import etree
    shape = slide.shapes.add_shape(
        5,  # rounded rectangle
        Inches(x), Inches(y), Inches(w), Inches(h)
    )
    shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    # set corner radius
    adj = shape.shape_element.find(qn('p:spPr') + '/' + qn('a:prstGeom') + '/' + qn('a:avLst') + '/' + qn('a:gd'))
    if adj is not None:
        # radius in EMUs as proportion of 100000
        adj.set('fmla', f'val {min(int(radius_pt * 100), 50000)}')
    return shape


def add_textbox(slide, x, y, w, h, text,
                size=12, bold=False, color: RGBColor = None,
                align=PP_ALIGN.LEFT, italic=False, wrap=True):
    """Add a text box and return the shape."""
    txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = color
    return txBox


def add_multiline_textbox(slide, x, y, w, h, lines,
                          size=12, bold=False, color: RGBColor = None,
                          align=PP_ALIGN.LEFT, line_space_pt=None):
    """Add a textbox with multiple paragraphs from a list of strings."""
    txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = line
        run.font.size = Pt(size)
        run.font.bold = bold
        if color:
            run.font.color.rgb = color
    return txBox


def fmt_money(val):
    """Format a number as $X,XXX or $X,XXX,XXX."""
    try:
        v = float(val)
        if v == int(v):
            return f"${int(v):,}"
        return f"${v:,.0f}"
    except Exception:
        return str(val)


def fmt_pct(val):
    try:
        return f"{float(val):.1f}%"
    except Exception:
        return str(val)


# ── Totals calculation ───────────────────────────────────────────────

def compute_totals(data: dict) -> dict:
    """
    Compute pricing totals from the proposal data dict.

    Expected data shape:
      data["products"]    — list of product dicts:
          { "name": str, "basePkg": "free"|"professional"|"enterprise",
            "baseRate": number (override, or 0/None to use list price),
            "addons": { "addonName": price_number, ... } }
      data["acctItems"]   — dict of account-level line items { label: price }
      data["proposalDisc"]— optional proposal-level discount % (0-100)
    """
    products = data.get("products") or []
    acct_items = data.get("acctItems") or {}
    disc_pct = float(data.get("proposalDisc") or 0)

    line_items = []   # (label, list_price, net_price)
    total_list = 0.0
    total_net = 0.0
    prod_summaries = []

    for prod in products:
        name = prod.get("name") or "Product"
        pkg = (prod.get("basePkg") or "free").lower()
        list_base = BASE_PRICES.get(pkg, 0)
        # If rep supplied a baseRate override, use it; else use list
        base_rate = prod.get("baseRate")
        if base_rate is not None and float(base_rate) > 0:
            net_base = float(base_rate)
        else:
            net_base = list_base

        prod_list = list_base
        prod_net = net_base
        addon_lines = []

        addons = prod.get("addons") or {}
        if isinstance(addons, dict):
            for addon_name, addon_price in addons.items():
                try:
                    ap = float(addon_price)
                except Exception:
                    ap = 0.0
                prod_list += ap
                prod_net += ap
                line_items.append((f"  + {addon_name}", ap, ap))
                addon_lines.append((addon_name, ap))

        line_items.insert(len(line_items) - len(addon_lines),
                          (f"{name} ({pkg.title()} pkg)", list_base, net_base))
        total_list += prod_list
        total_net += prod_net

        prod_summaries.append({
            "name": name,
            "pkg": pkg,
            "list_base": list_base,
            "net_base": net_base,
            "addons": addon_lines,
            "prod_list": prod_list,
            "prod_net": prod_net,
        })

    # Account-level items
    for label, price in acct_items.items():
        try:
            ap = float(price)
        except Exception:
            ap = 0.0
        line_items.append((label, ap, ap))
        total_list += ap
        total_net += ap

    # Proposal discount
    discount_amount = 0.0
    if disc_pct > 0:
        discount_amount = total_net * (disc_pct / 100.0)
        total_net -= discount_amount
        line_items.append((f"Proposal Discount ({disc_pct:.1f}%)", 0, -discount_amount))

    total_savings = total_list - total_net

    return {
        "line_items": line_items,
        "total_list": total_list,
        "total_net": total_net,
        "total_savings": total_savings,
        "discount_amount": discount_amount,
        "disc_pct": disc_pct,
        "num_products": len(products),
        "prod_summaries": prod_summaries,
    }


# ── Slide builders ───────────────────────────────────────────────────

def slide_cover(prs: Presentation, data: dict):
    """Slide 1: Navy cover with G2 logo badge, customer name, rep, date."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank

    # Full navy background
    add_rect(slide, 0, 0, 13.333, 7.5, NAVY)

    # Orange accent bar at bottom
    add_rect(slide, 0, 6.9, 13.333, 0.6, ORANGE)

    # Subtle teal decorative stripe left edge
    add_rect(slide, 0, 0, 0.12, 7.5, TEAL)

    # G2 logo badge — orange rounded rect top-left area
    logo_bg = add_rect(slide, 0.55, 0.45, 1.4, 1.1, ORANGE)
    logo_bg.line.fill.background()
    add_textbox(slide, 0.55, 0.45, 1.4, 1.1, "G2",
                size=42, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # "PROPOSAL" tag beside logo
    add_textbox(slide, 2.15, 0.55, 3.0, 0.4, "PROPOSAL",
                size=11, bold=True, color=ORANGE, align=PP_ALIGN.LEFT)
    add_textbox(slide, 2.15, 0.88, 5.5, 0.35, "Custom Investment Summary",
                size=13, bold=False, color=LGREY, align=PP_ALIGN.LEFT)

    # Customer name — large centred
    cust = data.get("cust") or data.get("customer") or "Your Company"
    add_textbox(slide, 0.55, 2.0, 12.2, 1.5, cust,
                size=52, bold=True, color=WHITE, align=PP_ALIGN.LEFT, wrap=True)

    # Divider line
    add_rect(slide, 0.55, 3.65, 6.0, 0.04, TEAL)

    # Subtitle
    add_textbox(slide, 0.55, 3.85, 9.0, 0.5,
                "Powered by G2's buyer intelligence platform",
                size=15, bold=False, color=LGREY, align=PP_ALIGN.LEFT)

    # Rep name and date block
    rep = data.get("rep") or ""
    today = data.get("date") or date.today().strftime("%B %d, %Y")
    if rep:
        add_textbox(slide, 0.55, 4.55, 5.0, 0.4, f"Prepared by: {rep}",
                    size=12, bold=False, color=MID, align=PP_ALIGN.LEFT)
    add_textbox(slide, 0.55, 4.95, 5.0, 0.4, f"Date: {today}",
                size=12, bold=False, color=MID, align=PP_ALIGN.LEFT)

    # Right-side decorative stat callout
    add_rect(slide, 9.5, 1.8, 3.3, 1.1, RGBColor(0x0A, 0x3A, 0x5E))
    add_textbox(slide, 9.5, 1.85, 3.3, 0.45, "90M+",
                size=26, bold=True, color=ORANGE, align=PP_ALIGN.CENTER)
    add_textbox(slide, 9.5, 2.25, 3.3, 0.5, "buyer interactions tracked annually",
                size=10, bold=False, color=LGREY, align=PP_ALIGN.CENTER, wrap=True)

    add_rect(slide, 9.5, 3.1, 3.3, 1.1, RGBColor(0x0A, 0x3A, 0x5E))
    add_textbox(slide, 9.5, 3.15, 3.3, 0.45, "#1",
                size=26, bold=True, color=TEAL, align=PP_ALIGN.CENTER)
    add_textbox(slide, 9.5, 3.55, 3.3, 0.5, "software marketplace for buyers",
                size=10, bold=False, color=LGREY, align=PP_ALIGN.CENTER, wrap=True)

    add_rect(slide, 9.5, 4.4, 3.3, 1.1, RGBColor(0x0A, 0x3A, 0x5E))
    add_textbox(slide, 9.5, 4.45, 3.3, 0.45, "2.5M+",
                size=26, bold=True, color=YELLOW, align=PP_ALIGN.CENTER)
    add_textbox(slide, 9.5, 4.85, 3.3, 0.5, "verified software reviews",
                size=10, bold=False, color=LGREY, align=PP_ALIGN.CENTER, wrap=True)

    # Bottom bar text
    add_textbox(slide, 0.4, 6.92, 12.5, 0.4,
                "Confidential — prepared exclusively for " + cust,
                size=9, bold=False, color=WHITE, align=PP_ALIGN.CENTER)


def slide_summary(prs: Presentation, data: dict, totals: dict):
    """Slide 2: Investment Summary with 4 stat cards."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    # White background
    add_rect(slide, 0, 0, 13.333, 7.5, WHITE)

    # Navy header bar
    add_rect(slide, 0, 0, 13.333, 1.35, NAVY)
    add_textbox(slide, 0.5, 0.2, 10.0, 0.6, "Investment Summary",
                size=28, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    cust = data.get("cust") or data.get("customer") or ""
    add_textbox(slide, 0.5, 0.82, 10.0, 0.38, cust,
                size=14, bold=False, color=LGREY, align=PP_ALIGN.LEFT)

    # Orange accent strip
    add_rect(slide, 0, 1.35, 13.333, 0.06, ORANGE)

    # ── 4 stat cards ─────────────────────────────────────────────────
    # Card positions: 4 cards in a row, with spacing
    card_w = 2.8
    card_h = 2.0
    card_y = 1.8
    gap = 0.28
    start_x = (13.333 - (4 * card_w + 3 * gap)) / 2

    cards = [
        ("Total ACV",        fmt_money(totals["total_net"]),    NAVY,   WHITE),
        ("List Price",       fmt_money(totals["total_list"]),   LGREY,  NAVY),
        ("# Products",       str(totals["num_products"]),       TEAL,   WHITE),
        ("Total Savings",    fmt_money(totals["total_savings"]), ORANGE, WHITE),
    ]

    for i, (label, value, header_color, header_text_color) in enumerate(cards):
        cx = start_x + i * (card_w + gap)
        # Card shadow/border
        add_rect(slide, cx + 0.04, card_y + 0.04, card_w, card_h, LGREY)
        # Card body
        card_bg = add_rect(slide, cx, card_y, card_w, card_h, WHITE)
        # Card header
        add_rect(slide, cx, card_y, card_w, 0.55, header_color)
        add_textbox(slide, cx, card_y + 0.08, card_w, 0.42, label,
                    size=12, bold=True, color=header_text_color, align=PP_ALIGN.CENTER)
        # Card value
        add_textbox(slide, cx, card_y + 0.65, card_w, 1.1, value,
                    size=30, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

    # ── Summary breakdown ─────────────────────────────────────────────
    row_y = 4.25
    add_rect(slide, 0.5, row_y, 12.333, 0.04, LGREY)
    row_y += 0.18

    add_textbox(slide, 0.5, row_y, 12.0, 0.4,
                "What's included in your G2 investment:",
                size=13, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
    row_y += 0.5

    prod_summaries = totals.get("prod_summaries") or []
    col_x = [0.5, 4.5, 8.5]
    bullets = []
    for ps in prod_summaries:
        pkg_label = ps["pkg"].title()
        net = fmt_money(ps["prod_net"])
        bullets.append(f"• {ps['name']} ({pkg_label})  —  {net}/yr")

    # Render up to 3 bullets per column (2 columns used)
    left_bullets = bullets[:4]
    right_bullets = bullets[4:8]

    for j, b in enumerate(left_bullets):
        add_textbox(slide, 0.6, row_y + j * 0.38, 5.8, 0.38, b,
                    size=11, bold=False, color=MID, align=PP_ALIGN.LEFT)
    for j, b in enumerate(right_bullets):
        add_textbox(slide, 7.0, row_y + j * 0.38, 5.8, 0.38, b,
                    size=11, bold=False, color=MID, align=PP_ALIGN.LEFT)

    if totals["disc_pct"] > 0:
        add_textbox(slide, 0.6, 6.5, 12.0, 0.4,
                    f"Proposal discount of {totals['disc_pct']:.1f}% applied — saving you {fmt_money(totals['discount_amount'])}",
                    size=11, bold=True, color=ORANGE, align=PP_ALIGN.LEFT)

    # Footer
    add_rect(slide, 0, 7.2, 13.333, 0.3, LIGHT)
    add_textbox(slide, 0.5, 7.22, 12.333, 0.25, "G2 | The World's Largest Software Marketplace",
                size=8, bold=False, color=MID, align=PP_ALIGN.LEFT)
    add_textbox(slide, 0.5, 7.22, 12.333, 0.25, "Confidential",
                size=8, bold=False, color=MID, align=PP_ALIGN.RIGHT)


def slide_product(prs: Presentation, data: dict, prod_summary: dict):
    """Slide 3+: Per-product detail slide."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    add_rect(slide, 0, 0, 13.333, 7.5, WHITE)

    # Navy left sidebar
    sidebar_w = 3.8
    add_rect(slide, 0, 0, sidebar_w, 7.5, NAVY)

    # Sidebar: product name
    pname = prod_summary.get("name") or "Product"
    add_textbox(slide, 0.2, 0.3, sidebar_w - 0.3, 0.5, "PRODUCT",
                size=9, bold=True, color=ORANGE, align=PP_ALIGN.LEFT)
    add_textbox(slide, 0.2, 0.75, sidebar_w - 0.3, 1.2, pname,
                size=24, bold=True, color=WHITE, align=PP_ALIGN.LEFT, wrap=True)

    # Orange accent
    add_rect(slide, 0.2, 2.1, sidebar_w - 0.4, 0.05, ORANGE)

    # Package badge
    pkg = prod_summary.get("pkg", "free").title()
    add_textbox(slide, 0.2, 2.3, sidebar_w - 0.3, 0.35, "PACKAGE",
                size=9, bold=True, color=LGREY, align=PP_ALIGN.LEFT)
    add_rect(slide, 0.2, 2.65, sidebar_w - 0.4, 0.55, ORANGE)
    add_textbox(slide, 0.2, 2.65, sidebar_w - 0.4, 0.55, pkg,
                size=16, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # ACV
    add_textbox(slide, 0.2, 3.45, sidebar_w - 0.3, 0.35, "ANNUAL CONTRACT VALUE",
                size=9, bold=True, color=LGREY, align=PP_ALIGN.LEFT)
    acv_val = fmt_money(prod_summary.get("prod_net", 0))
    add_textbox(slide, 0.2, 3.82, sidebar_w - 0.3, 0.65, acv_val,
                size=28, bold=True, color=TEAL, align=PP_ALIGN.LEFT)

    # List price if different
    list_p = prod_summary.get("prod_list", 0)
    net_p = prod_summary.get("prod_net", 0)
    if list_p != net_p and list_p > 0:
        add_textbox(slide, 0.2, 4.5, sidebar_w - 0.3, 0.35,
                    f"List: {fmt_money(list_p)}/yr",
                    size=10, bold=False, color=MID, align=PP_ALIGN.LEFT)

    # Sidebar footer
    add_rect(slide, 0, 6.9, sidebar_w, 0.6, ORANGE)
    add_textbox(slide, 0.1, 6.93, sidebar_w - 0.1, 0.5, "G2",
                size=22, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # ── Right panel ───────────────────────────────────────────────────
    rx = sidebar_w + 0.4
    rw = 13.333 - rx - 0.4

    # Section: Add-ons or value props
    addons = prod_summary.get("addons") or []

    if addons:
        add_textbox(slide, rx, 0.3, rw, 0.45, "Add-Ons Included",
                    size=18, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
        add_rect(slide, rx, 0.82, rw, 0.04, LGREY)

        for k, (addon_name, addon_price) in enumerate(addons):
            ay = 1.05 + k * 0.72
            add_rect(slide, rx, ay, rw, 0.6, LIGHT)
            add_rect(slide, rx, ay, 0.06, 0.6, TEAL)
            add_textbox(slide, rx + 0.18, ay + 0.08, rw - 2.2, 0.42, addon_name,
                        size=13, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
            add_textbox(slide, rx + rw - 2.0, ay + 0.08, 1.9, 0.42,
                        fmt_money(addon_price) + "/yr",
                        size=13, bold=True, color=ORANGE, align=PP_ALIGN.RIGHT)
    else:
        # G2 Value props
        add_textbox(slide, rx, 0.3, rw, 0.45, "Why G2?",
                    size=18, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
        add_rect(slide, rx, 0.82, rw, 0.04, LGREY)

        value_props = [
            ("Buyer Intent Data",
             "Know who is in-market for your category right now — before they contact you."),
            ("Competitive Intelligence",
             "Real-time visibility into how buyers compare you to the competition."),
            ("Verified Reviews",
             "2.5M+ authentic peer reviews that drive purchase decisions."),
            ("Market Presence",
             "Improve G2 Grid rank and category visibility for your target buyers."),
        ]
        for k, (vp_title, vp_desc) in enumerate(value_props):
            vy = 1.1 + k * 1.3
            add_rect(slide, rx, vy, rw, 1.1, LIGHT)
            add_rect(slide, rx, vy, 0.08, 1.1, BLUE)
            add_textbox(slide, rx + 0.22, vy + 0.1, rw - 0.3, 0.38, vp_title,
                        size=13, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
            add_textbox(slide, rx + 0.22, vy + 0.5, rw - 0.3, 0.55, vp_desc,
                        size=11, bold=False, color=MID, align=PP_ALIGN.LEFT, wrap=True)

    # Footer
    add_rect(slide, 0, 7.2, 13.333, 0.3, LIGHT)
    add_textbox(slide, 0.5, 7.22, 12.333, 0.25, "G2 | The World's Largest Software Marketplace",
                size=8, bold=False, color=MID, align=PP_ALIGN.LEFT)
    add_textbox(slide, 0.5, 7.22, 12.333, 0.25, "Confidential",
                size=8, bold=False, color=MID, align=PP_ALIGN.RIGHT)


def slide_pricing_table(prs: Presentation, data: dict, totals: dict):
    """Slide: Full line-item pricing table."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    add_rect(slide, 0, 0, 13.333, 7.5, WHITE)

    # Navy header bar
    add_rect(slide, 0, 0, 13.333, 1.2, NAVY)
    add_textbox(slide, 0.5, 0.18, 9.0, 0.55, "Pricing Details",
                size=26, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    cust = data.get("cust") or data.get("customer") or ""
    add_textbox(slide, 0.5, 0.76, 9.0, 0.35, cust,
                size=13, bold=False, color=LGREY, align=PP_ALIGN.LEFT)
    add_rect(slide, 0, 1.2, 13.333, 0.06, ORANGE)

    # Table header row
    th_y = 1.45
    add_rect(slide, 0.4, th_y, 9.2, 0.42, NAVY)
    add_rect(slide, 9.6, th_y, 1.6, 0.42, NAVY)
    add_rect(slide, 11.2, th_y, 1.7, 0.42, NAVY)

    add_textbox(slide, 0.5, th_y + 0.04, 9.1, 0.34, "Item",
                size=11, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_textbox(slide, 9.6, th_y + 0.04, 1.6, 0.34, "List Price",
                size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(slide, 11.2, th_y + 0.04, 1.7, 0.34, "Your Price",
                size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # Line items
    row_y = th_y + 0.45
    row_h = 0.38
    line_items = totals.get("line_items") or []
    max_rows = 14

    for idx, (label, list_price, net_price) in enumerate(line_items[:max_rows]):
        bg = LIGHT if idx % 2 == 0 else WHITE
        add_rect(slide, 0.4, row_y, 9.2, row_h, bg)
        add_rect(slide, 9.6, row_y, 1.6, row_h, bg)
        add_rect(slide, 11.2, row_y, 1.7, row_h, bg)

        is_discount = net_price < 0
        label_color = ORANGE if is_discount else NAVY
        val_color = ORANGE if is_discount else MID

        add_textbox(slide, 0.55, row_y + 0.04, 9.0, row_h - 0.08, label,
                    size=10, bold=False, color=label_color, align=PP_ALIGN.LEFT)
        if list_price > 0:
            add_textbox(slide, 9.6, row_y + 0.04, 1.6, row_h - 0.08,
                        fmt_money(list_price),
                        size=10, bold=False, color=MID, align=PP_ALIGN.CENTER)
        if net_price != 0:
            net_str = f"-{fmt_money(abs(net_price))}" if is_discount else fmt_money(net_price)
            add_textbox(slide, 11.2, row_y + 0.04, 1.7, row_h - 0.08,
                        net_str,
                        size=10, bold=is_discount, color=val_color, align=PP_ALIGN.CENTER)
        row_y += row_h

    # Totals area
    total_y = max(row_y + 0.1, 5.6)
    add_rect(slide, 0.4, total_y, 12.5, 0.04, LGREY)

    add_rect(slide, 8.5, total_y + 0.12, 3.4, 0.42, LIGHT)
    add_textbox(slide, 8.5, total_y + 0.15, 2.0, 0.35, "Total ACV:",
                size=13, bold=True, color=NAVY, align=PP_ALIGN.RIGHT)
    add_textbox(slide, 10.5, total_y + 0.15, 1.4, 0.35,
                fmt_money(totals["total_net"]),
                size=13, bold=True, color=ORANGE, align=PP_ALIGN.RIGHT)

    if totals["total_savings"] > 0:
        add_textbox(slide, 8.5, total_y + 0.62, 3.4, 0.35,
                    f"You save: {fmt_money(totals['total_savings'])}",
                    size=11, bold=True, color=TEAL, align=PP_ALIGN.RIGHT)

    # Navy footer with G2 stats
    add_rect(slide, 0, 6.85, 13.333, 0.65, NAVY)
    stats_text = ("G2 — 90M+ annual buyer interactions  |  2.5M+ verified reviews  |  "
                  "#1 software marketplace  |  100K+ listed products")
    add_textbox(slide, 0.5, 6.9, 12.333, 0.5, stats_text,
                size=9, bold=False, color=LGREY, align=PP_ALIGN.CENTER)


def slide_next_steps(prs: Presentation, data: dict):
    """Slide 5: Next steps and rep contact info."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    add_rect(slide, 0, 0, 13.333, 7.5, NAVY)

    # Orange right panel
    add_rect(slide, 8.5, 0, 4.833, 7.5, ORANGE)

    # Teal accent strip
    add_rect(slide, 0, 0, 0.12, 7.5, TEAL)

    # Left: heading
    add_textbox(slide, 0.55, 0.35, 5.0, 0.4, "WHAT HAPPENS NEXT",
                size=11, bold=True, color=ORANGE, align=PP_ALIGN.LEFT)
    add_textbox(slide, 0.55, 0.78, 7.5, 1.0, "Let's Move Forward",
                size=40, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_rect(slide, 0.55, 1.85, 5.5, 0.05, TEAL)

    # Next steps list
    steps = [
        ("1", "Review this proposal",
         "Share with your stakeholders and confirm the products and pricing align with your goals."),
        ("2", "Sign the agreement",
         "We'll send over the MSA and Order Form for e-signature via DocuSign."),
        ("3", "Onboarding kickoff",
         "Your dedicated G2 Customer Success Manager will schedule your onboarding within 5 business days."),
        ("4", "Go live",
         "Access your G2 dashboard, integrate your CRM, and start capturing buyer intent signals."),
    ]

    for i, (num, title, desc) in enumerate(steps):
        sy = 2.15 + i * 1.1
        # Number circle (simulated with rect)
        add_rect(slide, 0.55, sy, 0.5, 0.5, ORANGE)
        add_textbox(slide, 0.55, sy, 0.5, 0.5, num,
                    size=16, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        add_textbox(slide, 1.2, sy, 6.8, 0.38, title,
                    size=13, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
        add_textbox(slide, 1.2, sy + 0.38, 6.8, 0.6, desc,
                    size=10, bold=False, color=LGREY, align=PP_ALIGN.LEFT, wrap=True)

    # Right orange panel: rep contact
    add_textbox(slide, 8.7, 0.4, 4.4, 0.45, "YOUR G2 REP",
                size=11, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_rect(slide, 8.7, 0.88, 4.2, 0.05, WHITE)

    rep = data.get("rep") or "Your G2 Account Executive"
    rep_email = data.get("repEmail") or ""
    rep_phone = data.get("repPhone") or ""
    rep_title = data.get("repTitle") or "Account Executive"

    add_textbox(slide, 8.7, 1.08, 4.4, 0.75, rep,
                size=22, bold=True, color=WHITE, align=PP_ALIGN.LEFT, wrap=True)
    add_textbox(slide, 8.7, 1.88, 4.4, 0.38, rep_title,
                size=12, bold=False, color=WHITE, align=PP_ALIGN.LEFT)

    add_rect(slide, 8.7, 2.45, 4.2, 0.05, RGBColor(0xFF, 0x7A, 0x65))

    if rep_email:
        add_textbox(slide, 8.7, 2.65, 4.4, 0.38, rep_email,
                    size=12, bold=False, color=WHITE, align=PP_ALIGN.LEFT)
    if rep_phone:
        add_textbox(slide, 8.7, 3.05, 4.4, 0.38, rep_phone,
                    size=12, bold=False, color=WHITE, align=PP_ALIGN.LEFT)

    # G2 branding on right panel
    add_rect(slide, 8.7, 4.2, 1.3, 0.85, WHITE)
    add_textbox(slide, 8.7, 4.2, 1.3, 0.85, "G2",
                size=32, bold=True, color=ORANGE, align=PP_ALIGN.CENTER)
    add_textbox(slide, 10.1, 4.3, 3.1, 0.65,
                "The World's Largest\nSoftware Marketplace",
                size=10, bold=False, color=WHITE, align=PP_ALIGN.LEFT, wrap=True)

    add_textbox(slide, 8.7, 5.3, 4.4, 0.4, "g2.com",
                size=14, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_textbox(slide, 8.7, 5.72, 4.4, 1.3,
                "Questions? Reach out anytime — we're committed to your success with G2.",
                size=10, bold=False, color=WHITE, align=PP_ALIGN.LEFT, wrap=True)

    # Bottom bar
    add_rect(slide, 0, 7.15, 8.5, 0.35, RGBColor(0x03, 0x19, 0x2C))
    cust = data.get("cust") or data.get("customer") or ""
    add_textbox(slide, 0.5, 7.17, 7.5, 0.28,
                f"Prepared for {cust}  |  Confidential",
                size=9, bold=False, color=MID, align=PP_ALIGN.LEFT)


# ── Main entry point ─────────────────────────────────────────────────

def build_pptx(data: dict) -> bytes:
    """
    Build a complete G2 Proposal PPTX from a data dict and return bytes.

    Expected top-level keys in data:
      cust          — customer name (str)
      rep           — rep name (str)
      repEmail      — rep email (str, optional)
      repPhone      — rep phone (str, optional)
      repTitle      — rep title (str, optional)
      date          — proposal date string (str, optional; defaults to today)
      products      — list of product dicts (see compute_totals)
      acctItems     — dict of account-level line items
      proposalDisc  — proposal discount % (number, optional)
    """
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    totals = compute_totals(data)

    # Slide 1: Cover
    slide_cover(prs, data)

    # Slide 2: Investment Summary
    slide_summary(prs, data, totals)

    # Slide 3+: Per-product slides
    for ps in totals.get("prod_summaries") or []:
        slide_product(prs, data, ps)

    # Slide N-1: Pricing table
    slide_pricing_table(prs, data, totals)

    # Slide N: Next steps
    slide_next_steps(prs, data)

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


# ── CLI test ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys, os
    sample = {
        "cust": "Acme Corp",
        "rep": "Jane Smith",
        "repEmail": "jane.smith@g2.com",
        "repPhone": "(312) 555-0100",
        "repTitle": "Senior Account Executive",
        "date": "April 9, 2026",
        "products": [
            {
                "name": "Buyer Intent",
                "basePkg": "professional",
                "baseRate": 15000,
                "addons": {
                    "CRM Integration": 3000,
                    "Slack Alerts": 1500,
                }
            },
            {
                "name": "Market Intelligence",
                "basePkg": "enterprise",
                "baseRate": 0,
                "addons": {}
            },
        ],
        "acctItems": {
            "Review Booster": 5000,
        },
        "proposalDisc": 10,
    }
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_proposal.pptx")
    pptx_bytes = build_pptx(sample)
    with open(out_path, "wb") as f:
        f.write(pptx_bytes)
    print(f"Test PPTX written → {out_path}")
    sys.exit(0)
