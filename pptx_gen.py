"""
G2 Proposal Builder — PPTX generator.
Produces a professional, G2-branded 16:9 PowerPoint deck from a proposal data dict.
Optimised for Google Slides import fidelity.
"""

import io
import os
from datetime import date

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# ── Brand colours (official G2 Brand Book) ──────────────────────────
RORANGE = RGBColor(0xFF, 0x49, 0x2C)
NAVY    = RGBColor(0x06, 0x28, 0x46)
GREEN   = RGBColor(0x27, 0xD3, 0xBC)
BLUE    = RGBColor(0x00, 0x73, 0xF5)
PURPLE  = RGBColor(0x57, 0x46, 0xB2)
YELLOW  = RGBColor(0xFF, 0xC8, 0x00)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
BLACK   = RGBColor(0x00, 0x00, 0x00)

# Extended tones
LIGHT_BG     = RGBColor(0xF2, 0xF4, 0xF7)
BORDER_GREY  = RGBColor(0xD9, 0xDE, 0xE6)
MID_TEXT     = RGBColor(0x4D, 0x64, 0x80)
NAVY_DARK    = RGBColor(0x04, 0x1D, 0x35)
RORANGE_LIGHT = RGBColor(0xFF, 0xEA, 0xE7)
GREEN_LIGHT  = RGBColor(0xE0, 0xFA, 0xF6)
PURPLE_LIGHT = RGBColor(0xED, 0xEA, 0xF9)
BLUE_LIGHT   = RGBColor(0xE0, 0xEE, 0xFF)

# Slide dimensions — widescreen 16:9
W = Inches(13.333)
H = Inches(7.5)

# Font name — Figtree (falls back gracefully in Google Slides)
FONT = "Figtree"

# Assets directory
_HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(_HERE, "assets")

# Base package list prices per year
BASE_PRICES = {
    "free": 0,
    "professional": 18000,
    "enterprise": 36000,
}


# ── Low-level helpers ───────────────────────────────────────────────

def _rect(slide, x, y, w, h, fill):
    """Add a filled rectangle with no border."""
    shape = slide.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    return shape


def _text(slide, x, y, w, h, text, size=12, bold=False, color=NAVY,
          align=PP_ALIGN.LEFT, italic=False, wrap=True, font=FONT,
          anchor=MSO_ANCHOR.TOP):
    """Add a text box with a single run."""
    txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = wrap
    tf.auto_size = None
    try:
        tf.paragraphs[0].space_before = Pt(0)
        tf.paragraphs[0].space_after = Pt(0)
    except Exception:
        pass
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = str(text)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.name = font
    run.font.color.rgb = color
    return txBox


def _multitext(slide, x, y, w, h, lines, size=12, bold=False, color=NAVY,
               align=PP_ALIGN.LEFT, spacing=None, font=FONT):
    """Text box with multiple paragraphs."""
    txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if spacing:
            p.space_after = Pt(spacing)
        run = p.add_run()
        run.text = str(line)
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.name = font
        run.font.color.rgb = color
    return txBox


def _logo(slide, x, y, height, variant="white"):
    """Insert G2 logo. variant: 'white' or 'red'."""
    fname = f"G2Logo-{'White' if variant == 'white' else 'Red'}.png"
    path = os.path.join(ASSETS, fname)
    if os.path.exists(path):
        slide.shapes.add_picture(path, Inches(x), Inches(y),
                                 height=Inches(height))


def _accent_bar(slide, x, y, w, thickness=0.05):
    """Thin accent bar in Rorange."""
    _rect(slide, x, y, w, thickness, RORANGE)


def fmt_money(val):
    try:
        v = float(val)
        return f"${int(v):,}" if v == int(v) else f"${v:,.0f}"
    except Exception:
        return str(val)


def fmt_pct(val):
    try:
        return f"{float(val):.1f}%"
    except Exception:
        return str(val)


# ── Totals calculation ──────────────────────────────────────────────

def compute_totals(data: dict) -> dict:
    products = data.get("products") or []
    acct_items = data.get("acctItems") or {}
    disc_pct = float(data.get("proposalDisc") or 0)

    line_items = []
    total_list = 0.0
    total_net = 0.0
    prod_summaries = []

    for prod in products:
        name = prod.get("name") or "Product"
        pkg = (prod.get("basePkg") or "free").lower()
        list_base = BASE_PRICES.get(pkg, 0)
        base_rate = prod.get("baseRate")
        net_base = float(base_rate) if base_rate and float(base_rate) > 0 else list_base

        prod_list = list_base
        prod_net = net_base
        addon_lines = []

        addons = prod.get("addons") or {}
        if isinstance(addons, dict):
            for addon_name, addon_price in addons.items():
                # Handle builder format: {on, tierIdx, qty, rate, ...}
                if isinstance(addon_price, dict):
                    if not addon_price.get("on", True):
                        continue
                    qty = int(addon_price.get("qty") or 1)
                    rate = float(addon_price.get("rate") or 0)
                    ap = rate * qty
                    display_name = addon_price.get("customDesc") or addon_name
                else:
                    ap = float(addon_price) if addon_price else 0.0
                    display_name = addon_name
                prod_list += ap
                prod_net += ap
                line_items.append((f"  + {display_name}", ap, ap))
                addon_lines.append((display_name, ap))

        line_items.insert(len(line_items) - len(addon_lines),
                          (f"{name} ({pkg.title()} pkg)", list_base, net_base))
        total_list += prod_list
        total_net += prod_net
        prod_summaries.append({
            "name": name, "pkg": pkg, "list_base": list_base,
            "net_base": net_base, "addons": addon_lines,
            "prod_list": prod_list, "prod_net": prod_net,
        })

    for label, price in acct_items.items():
        # Handle builder format: {on, qty, rate}
        if isinstance(price, dict):
            if not price.get("on", True):
                continue
            qty = int(price.get("qty") or 1)
            rate = float(price.get("rate") or 0)
            ap = rate * qty
        else:
            ap = float(price) if price else 0.0
        line_items.append((label, ap, ap))
        total_list += ap
        total_net += ap

    discount_amount = 0.0
    if disc_pct > 0:
        discount_amount = total_net * (disc_pct / 100.0)
        total_net -= discount_amount
        line_items.append((f"Proposal Discount ({disc_pct:.1f}%)", 0, -discount_amount))

    return {
        "line_items": line_items,
        "total_list": total_list,
        "total_net": total_net,
        "total_savings": total_list - total_net,
        "discount_amount": discount_amount,
        "disc_pct": disc_pct,
        "num_products": len(products),
        "prod_summaries": prod_summaries,
    }


# ── Shared footer ───────────────────────────────────────────────────

def _footer(slide, page_num=None, confidential=True):
    """Consistent footer bar across all content slides."""
    _rect(slide, 0, 7.08, 13.333, 0.42, NAVY)
    _text(slide, 0.55, 7.13, 5, 0.3, "g2.com", size=9, bold=True,
          color=WHITE, align=PP_ALIGN.LEFT)
    right_text = "Confidential" if confidential else ""
    if page_num:
        right_text = f"{right_text}  |  " if right_text else ""
        right_text += str(page_num)
    _text(slide, 7.5, 7.13, 5.3, 0.3, right_text, size=9,
          color=BORDER_GREY, align=PP_ALIGN.RIGHT)
    _logo(slide, 12.2, 7.12, 0.28, variant="white")


# ── Slide 1: Cover ──────────────────────────────────────────────────

def slide_cover(prs, data):
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    # Full navy background
    _rect(slide, 0, 0, 13.333, 7.5, NAVY)

    # Rorange accent bar — left edge
    _rect(slide, 0, 0, 0.08, 7.5, RORANGE)

    # G2 logo top-right
    _logo(slide, 11.5, 0.4, 0.65, variant="white")

    # "PROPOSAL" label
    _text(slide, 0.7, 0.5, 4, 0.35, "PROPOSAL", size=13, bold=True,
          color=RORANGE, align=PP_ALIGN.LEFT)

    # Customer name — hero headline
    cust = data.get("cust") or data.get("customer") or "Your Company"
    _text(slide, 0.7, 1.4, 11.5, 1.8, cust, size=48, bold=True,
          color=WHITE, align=PP_ALIGN.LEFT, wrap=True)

    # Accent bar under name
    _accent_bar(slide, 0.7, 3.35, 4.5)

    # Subtitle
    _text(slide, 0.7, 3.65, 9, 0.5,
          "Custom Investment Summary  |  G2 Buyer Intelligence Platform",
          size=16, color=BORDER_GREY, align=PP_ALIGN.LEFT)

    # Rep, date, term, valid through
    rep = data.get("rep") or ""
    today = data.get("date") or date.today().strftime("%B %d, %Y")
    contract_term = data.get("contractTerm") or "12"
    valid_through = data.get("validThrough") or ""

    info_y = 4.4
    if rep:
        _text(slide, 0.7, info_y, 6, 0.35, f"Prepared by  {rep}",
              size=13, color=MID_TEXT, align=PP_ALIGN.LEFT)
        info_y += 0.4
    _text(slide, 0.7, info_y, 6, 0.35, today,
          size=13, color=MID_TEXT, align=PP_ALIGN.LEFT)
    info_y += 0.4

    # Contract term
    term_str = f"{contract_term}-month term" if contract_term and contract_term != "custom" else "Custom term"
    _text(slide, 0.7, info_y, 6, 0.35, term_str,
          size=13, color=MID_TEXT, align=PP_ALIGN.LEFT)

    # Valid through date
    if valid_through:
        info_y += 0.4
        try:
            from datetime import datetime
            vt = datetime.strptime(valid_through, "%Y-%m-%d")
            vt_str = f"Valid through {vt.strftime('%B %d, %Y')}"
        except Exception:
            vt_str = f"Valid through {valid_through}"
        _text(slide, 0.7, info_y, 6, 0.35, vt_str,
              size=13, bold=True, color=RORANGE, align=PP_ALIGN.LEFT)

    # Right-side proof point cards
    card_x = 9.0
    card_w = 3.8
    card_h = 0.95
    cards = [
        ("90M+",  "annual buyer interactions", RORANGE),
        ("#1",    "software marketplace", GREEN),
        ("2.6M+", "verified reviews", YELLOW),
        ("160K+", "products & services", BLUE),
    ]
    for i, (stat, desc, accent) in enumerate(cards):
        cy = 1.4 + i * 1.15
        _rect(slide, card_x, cy, card_w, card_h, NAVY_DARK)
        _rect(slide, card_x, cy, 0.06, card_h, accent)
        _text(slide, card_x + 0.25, cy + 0.1, 1.6, 0.5, stat,
              size=22, bold=True, color=accent, align=PP_ALIGN.LEFT)
        _text(slide, card_x + 1.9, cy + 0.18, 1.8, 0.55, desc,
              size=10, color=BORDER_GREY, align=PP_ALIGN.LEFT, wrap=True)

    # Bottom bar
    _rect(slide, 0, 6.95, 13.333, 0.55, RORANGE)
    _text(slide, 0.7, 7.0, 8, 0.4,
          f"Prepared exclusively for {cust}",
          size=10, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    _logo(slide, 12.1, 7.0, 0.38, variant="white")


# ── Slide 2: Investment Summary ─────────────────────────────────────

def slide_summary(prs, data, totals):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _rect(slide, 0, 0, 13.333, 7.5, WHITE)

    # Header
    _rect(slide, 0, 0, 13.333, 1.25, NAVY)
    _rect(slide, 0, 0, 0.08, 1.25, RORANGE)
    _logo(slide, 12.1, 0.28, 0.55, variant="white")
    _text(slide, 0.7, 0.15, 8, 0.55, "Investment Summary",
          size=28, bold=True, color=WHITE)
    cust = data.get("cust") or data.get("customer") or ""
    _text(slide, 0.7, 0.72, 8, 0.35, cust, size=13, color=BORDER_GREY)
    _accent_bar(slide, 0, 1.25, 13.333, 0.05)

    # Stat cards row
    card_data = [
        ("Total ACV",     fmt_money(totals["total_net"]),    RORANGE, WHITE),
        ("List Price",    fmt_money(totals["total_list"]),   NAVY,    WHITE),
        ("Products",      str(totals["num_products"]),       PURPLE,  WHITE),
        ("Your Savings",  fmt_money(totals["total_savings"]),GREEN,   WHITE),
    ]
    card_w = 2.75
    gap = 0.35
    total_w = 4 * card_w + 3 * gap
    start_x = (13.333 - total_w) / 2
    card_y = 1.65

    for i, (label, value, bg, text_c) in enumerate(card_data):
        cx = start_x + i * (card_w + gap)

        # Card background
        _rect(slide, cx, card_y, card_w, 1.85, bg)

        # Label
        _text(slide, cx, card_y + 0.2, card_w, 0.3, label,
              size=11, bold=True, color=text_c, align=PP_ALIGN.CENTER)

        # Value
        _text(slide, cx, card_y + 0.65, card_w, 0.8, value,
              size=32, bold=True, color=text_c, align=PP_ALIGN.CENTER)

        # Thin bottom accent
        if i == 0:
            _rect(slide, cx, card_y + 1.75, card_w, 0.1, WHITE)

    # SKU Summary Table
    _text(slide, 0.7, 3.85, 12, 0.35, "SKU Summary by Profile",
          size=14, bold=True, color=NAVY)
    _accent_bar(slide, 0.7, 4.2, 2.0)

    prod_summaries = totals.get("prod_summaries") or []

    # Table layout
    tx = 0.7
    tw = 11.9
    col_profile = 3.0
    col_pkg = 1.6
    col_addons = 5.3
    col_acv = 2.0

    # Table header
    th_y = 4.4
    _rect(slide, tx, th_y, tw, 0.38, NAVY)
    _text(slide, tx + 0.15, th_y + 0.05, col_profile, 0.28, "Profile",
          size=10, bold=True, color=WHITE)
    _text(slide, tx + col_profile, th_y + 0.05, col_pkg, 0.28, "Package",
          size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    _text(slide, tx + col_profile + col_pkg, th_y + 0.05, col_addons, 0.28, "Add-Ons",
          size=10, bold=True, color=WHITE)
    _text(slide, tx + tw - col_acv, th_y + 0.05, col_acv - 0.15, 0.28, "ACV",
          size=10, bold=True, color=WHITE, align=PP_ALIGN.RIGHT)

    # Table rows — compact to fit many products
    row_h = 0.34
    max_rows = min(len(prod_summaries), 6)  # fit on slide
    ry = th_y + 0.38

    for j, ps in enumerate(prod_summaries[:max_rows]):
        bg = LIGHT_BG if j % 2 == 0 else WHITE
        _rect(slide, tx, ry, tw, row_h, bg)

        # Profile name
        _text(slide, tx + 0.15, ry + 0.04, col_profile - 0.2, row_h - 0.08,
              ps["name"], size=10, bold=True, color=NAVY)

        # Package
        pkg_label = ps["pkg"].title()
        _text(slide, tx + col_profile, ry + 0.04, col_pkg, row_h - 0.08,
              pkg_label, size=10, color=MID_TEXT, align=PP_ALIGN.CENTER)

        # Add-ons — comma-separated list
        addon_names = [a[0] for a in (ps.get("addons") or [])]
        addon_str = ", ".join(addon_names) if addon_names else "—"
        _text(slide, tx + col_profile + col_pkg + 0.1, ry + 0.04,
              col_addons - 0.2, row_h - 0.08,
              addon_str, size=9, color=MID_TEXT)

        # ACV
        _text(slide, tx + tw - col_acv, ry + 0.04, col_acv - 0.15, row_h - 0.08,
              fmt_money(ps["prod_net"]), size=10, bold=True, color=RORANGE,
              align=PP_ALIGN.RIGHT)

        ry += row_h

    # Overflow indicator
    if len(prod_summaries) > max_rows:
        _text(slide, tx, ry + 0.02, tw, 0.25,
              f"+ {len(prod_summaries) - max_rows} more profiles (see detail slides)",
              size=9, color=MID_TEXT, align=PP_ALIGN.CENTER)

    # Discount callout
    disc_y = ry + 0.15
    if totals["disc_pct"] > 0 and disc_y < 6.4:
        _rect(slide, 0.7, disc_y, tw, 0.4, GREEN_LIGHT)
        _rect(slide, 0.7, disc_y, 0.05, 0.4, GREEN)
        _text(slide, 0.9, disc_y + 0.06, 9, 0.28,
              f"Proposal discount of {totals['disc_pct']:.1f}% applied — saving you {fmt_money(totals['discount_amount'])}",
              size=10, bold=True, color=NAVY)

    _footer(slide, page_num=2)


# ── Slide 3+: Per-product detail ────────────────────────────────────

def slide_product(prs, data, prod_summary, page_num):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _rect(slide, 0, 0, 13.333, 7.5, WHITE)

    # Header
    _rect(slide, 0, 0, 13.333, 1.25, NAVY)
    _rect(slide, 0, 0, 0.08, 1.25, RORANGE)
    _logo(slide, 12.1, 0.28, 0.55, variant="white")

    pname = prod_summary.get("name") or "Product"
    _text(slide, 0.7, 0.15, 8, 0.55, pname, size=28, bold=True, color=WHITE)
    pkg = prod_summary.get("pkg", "free").title()
    _text(slide, 0.7, 0.72, 6, 0.35, f"{pkg} Package", size=13, color=BORDER_GREY)
    _accent_bar(slide, 0, 1.25, 13.333, 0.05)

    # Left column — pricing overview
    left_x = 0.7
    left_w = 5.5

    # ACV card
    _rect(slide, left_x, 1.65, left_w, 1.6, LIGHT_BG)
    _rect(slide, left_x, 1.65, left_w, 0.05, RORANGE)
    _text(slide, left_x + 0.3, 1.85, 3, 0.3, "ANNUAL CONTRACT VALUE",
          size=10, bold=True, color=MID_TEXT)
    acv = fmt_money(prod_summary.get("prod_net", 0))
    _text(slide, left_x + 0.3, 2.2, 4, 0.7, acv,
          size=40, bold=True, color=RORANGE)

    list_p = prod_summary.get("prod_list", 0)
    net_p = prod_summary.get("prod_net", 0)
    if list_p != net_p and list_p > 0:
        savings = fmt_money(list_p - net_p)
        _text(slide, left_x + 0.3, 2.8, 4.5, 0.3,
              f"List price: {fmt_money(list_p)}/yr  |  You save: {savings}",
              size=10, color=MID_TEXT)

    # Add-ons list
    addons = prod_summary.get("addons") or []
    if addons:
        _text(slide, left_x, 3.55, left_w, 0.35, "Included Add-Ons",
              size=16, bold=True, color=NAVY)
        _accent_bar(slide, left_x, 3.92, 2.0)

        for k, (addon_name, addon_price) in enumerate(addons[:8]):
            ay = 4.15 + k * 0.55
            bg = LIGHT_BG if k % 2 == 0 else WHITE
            _rect(slide, left_x, ay, left_w, 0.48, bg)
            _rect(slide, left_x, ay, 0.05, 0.48, GREEN)
            _text(slide, left_x + 0.2, ay + 0.08, 3.5, 0.3, addon_name,
                  size=12, bold=True, color=NAVY)
            _text(slide, left_x + left_w - 1.6, ay + 0.08, 1.4, 0.3,
                  f"{fmt_money(addon_price)}/yr",
                  size=12, bold=True, color=RORANGE, align=PP_ALIGN.RIGHT)

    # Right column — value propositions
    right_x = 6.8
    right_w = 5.85

    _text(slide, right_x, 1.65, right_w, 0.35, "Why This Matters",
          size=16, bold=True, color=NAVY)
    _accent_bar(slide, right_x, 2.02, 2.0)

    value_props = [
        ("Buyer Intent Data", "Know who is in-market for your category before they contact you.", RORANGE),
        ("Competitive Intelligence", "Real-time visibility into how buyers compare you to competitors.", BLUE),
        ("Verified Reviews", "2.6M+ authentic peer reviews that drive purchase decisions.", GREEN),
        ("Market Presence", "Improve your G2 Grid rank and visibility for target buyers.", PURPLE),
    ]

    for k, (title, desc, accent) in enumerate(value_props):
        vy = 2.3 + k * 1.15
        _rect(slide, right_x, vy, right_w, 0.95, LIGHT_BG)
        _rect(slide, right_x, vy, 0.06, 0.95, accent)
        _text(slide, right_x + 0.2, vy + 0.1, right_w - 0.4, 0.3,
              title, size=13, bold=True, color=NAVY)
        _text(slide, right_x + 0.2, vy + 0.42, right_w - 0.4, 0.48,
              desc, size=11, color=MID_TEXT, wrap=True)

    _footer(slide, page_num=page_num)


# ── Pricing Table slide ─────────────────────────────────────────────

def slide_pricing_table(prs, data, totals, page_num):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _rect(slide, 0, 0, 13.333, 7.5, WHITE)

    # Header
    _rect(slide, 0, 0, 13.333, 1.25, NAVY)
    _rect(slide, 0, 0, 0.08, 1.25, RORANGE)
    _logo(slide, 12.1, 0.28, 0.55, variant="white")
    _text(slide, 0.7, 0.15, 8, 0.55, "Pricing Details",
          size=28, bold=True, color=WHITE)
    cust = data.get("cust") or data.get("customer") or ""
    _text(slide, 0.7, 0.72, 8, 0.35, cust, size=13, color=BORDER_GREY)
    _accent_bar(slide, 0, 1.25, 13.333, 0.05)

    # Table
    margin_x = 0.7
    table_w = 11.9
    col_item = 7.5
    col_list = 2.2
    col_net = 2.2

    # Table header
    th_y = 1.6
    _rect(slide, margin_x, th_y, table_w, 0.48, NAVY)
    _text(slide, margin_x + 0.2, th_y + 0.08, col_item - 0.4, 0.3, "Item",
          size=11, bold=True, color=WHITE)
    _text(slide, margin_x + col_item, th_y + 0.08, col_list, 0.3, "List Price",
          size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    _text(slide, margin_x + col_item + col_list, th_y + 0.08, col_net, 0.3,
          "Your Price", size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # Rows
    row_y = th_y + 0.48
    row_h = 0.42
    line_items = totals.get("line_items") or []
    max_rows = 12

    for idx, (label, list_price, net_price) in enumerate(line_items[:max_rows]):
        bg = LIGHT_BG if idx % 2 == 0 else WHITE
        is_indent = label.startswith("  +")
        is_discount = net_price < 0

        _rect(slide, margin_x, row_y, table_w, row_h, bg)

        # Rorange left accent for discount rows
        if is_discount:
            _rect(slide, margin_x, row_y, 0.05, row_h, RORANGE)

        label_color = RORANGE if is_discount else (MID_TEXT if is_indent else NAVY)
        label_weight = not is_indent and not is_discount
        label_x = margin_x + (0.5 if is_indent else 0.2)

        _text(slide, label_x, row_y + 0.06, col_item - 0.7, row_h - 0.12,
              label, size=11, bold=label_weight, color=label_color)

        if list_price > 0:
            _text(slide, margin_x + col_item, row_y + 0.06, col_list, row_h - 0.12,
                  fmt_money(list_price), size=11, color=MID_TEXT, align=PP_ALIGN.CENTER)

        if net_price != 0:
            val_color = RORANGE if is_discount else NAVY
            net_str = f"-{fmt_money(abs(net_price))}" if is_discount else fmt_money(net_price)
            _text(slide, margin_x + col_item + col_list, row_y + 0.06,
                  col_net, row_h - 0.12, net_str,
                  size=11, bold=True, color=val_color, align=PP_ALIGN.CENTER)

        row_y += row_h

    # Totals
    total_y = max(row_y + 0.2, 5.4)

    # Divider
    _rect(slide, margin_x, total_y, table_w, 0.03, NAVY)

    # Total ACV row
    _rect(slide, margin_x, total_y + 0.1, table_w, 0.55, NAVY)
    _text(slide, margin_x + 0.2, total_y + 0.18, col_item - 0.4, 0.35,
          "Total Annual Contract Value", size=14, bold=True, color=WHITE)
    _text(slide, margin_x + col_item + col_list, total_y + 0.18,
          col_net, 0.35, fmt_money(totals["total_net"]),
          size=16, bold=True, color=RORANGE, align=PP_ALIGN.CENTER)

    # Savings callout
    if totals["total_savings"] > 0:
        sy = total_y + 0.75
        _rect(slide, margin_x, sy, table_w, 0.4, GREEN_LIGHT)
        _rect(slide, margin_x, sy, 0.05, 0.4, GREEN)
        _text(slide, margin_x + 0.25, sy + 0.06, 8, 0.28,
              f"Total savings: {fmt_money(totals['total_savings'])}",
              size=12, bold=True, color=NAVY)
        if totals["disc_pct"] > 0:
            _text(slide, margin_x + col_item, sy + 0.06, col_list + col_net, 0.28,
                  f"{totals['disc_pct']:.1f}% proposal discount applied",
                  size=10, color=MID_TEXT, align=PP_ALIGN.RIGHT)

    _footer(slide, page_num=page_num)


# ── Next Steps slide ────────────────────────────────────────────────

def slide_next_steps(prs, data, page_num):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _rect(slide, 0, 0, 13.333, 7.5, NAVY)

    # Rorange accent — left edge
    _rect(slide, 0, 0, 0.08, 7.5, RORANGE)

    # G2 logo
    _logo(slide, 11.5, 0.4, 0.55, variant="white")

    # Section label
    _text(slide, 0.7, 0.5, 4, 0.3, "NEXT STEPS", size=12, bold=True, color=RORANGE)

    # Headline
    _text(slide, 0.7, 1.0, 7.5, 0.8, "Let's Move Forward",
          size=40, bold=True, color=WHITE)
    _accent_bar(slide, 0.7, 1.9, 3.5)

    # Steps — left column
    steps = [
        ("01", "Review This Proposal",
         "Share with your stakeholders and confirm the products and pricing align with your goals."),
        ("02", "Sign the Agreement",
         "We'll send over the MSA and Order Form for e-signature via DocuSign."),
        ("03", "Onboarding Kickoff",
         "Your dedicated Customer Success Manager will schedule onboarding within 5 business days."),
        ("04", "Go Live",
         "Access your G2 dashboard, integrate your CRM, and start capturing buyer intent signals."),
    ]

    step_colors = [RORANGE, GREEN, BLUE, PURPLE]

    for i, (num, title, desc) in enumerate(steps):
        sy = 2.25 + i * 1.1

        # Number badge
        _rect(slide, 0.7, sy, 0.65, 0.55, step_colors[i])
        _text(slide, 0.7, sy + 0.08, 0.65, 0.4, num,
              size=16, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

        # Title + description
        _text(slide, 1.55, sy + 0.02, 6.5, 0.3, title,
              size=14, bold=True, color=WHITE)
        _text(slide, 1.55, sy + 0.35, 6.5, 0.5, desc,
              size=11, color=BORDER_GREY, wrap=True)

    # Right panel — rep contact card
    card_x = 8.8
    card_w = 4.0
    card_y = 1.0

    _rect(slide, card_x, card_y, card_w, 5.5, NAVY_DARK)
    _rect(slide, card_x, card_y, card_w, 0.06, RORANGE)

    _text(slide, card_x + 0.35, card_y + 0.35, card_w - 0.7, 0.3,
          "YOUR G2 CONTACT", size=10, bold=True, color=RORANGE)

    rep = data.get("rep") or "Your G2 Account Executive"
    rep_title = data.get("repTitle") or "Account Executive"
    rep_email = data.get("repEmail") or ""
    rep_phone = data.get("repPhone") or ""

    _text(slide, card_x + 0.35, card_y + 0.8, card_w - 0.7, 0.7, rep,
          size=20, bold=True, color=WHITE, wrap=True)
    _text(slide, card_x + 0.35, card_y + 1.55, card_w - 0.7, 0.3, rep_title,
          size=12, color=BORDER_GREY)

    _rect(slide, card_x + 0.35, card_y + 2.0, card_w - 0.7, 0.03, RORANGE)

    info_y = card_y + 2.25
    if rep_email:
        _text(slide, card_x + 0.35, info_y, card_w - 0.7, 0.3, rep_email,
              size=12, color=WHITE)
        info_y += 0.38
    if rep_phone:
        _text(slide, card_x + 0.35, info_y, card_w - 0.7, 0.3, rep_phone,
              size=12, color=WHITE)

    # G2 branding in card
    _logo(slide, card_x + 0.35, card_y + 3.6, 0.5, variant="white")
    _text(slide, card_x + 1.0, card_y + 3.65, 2.8, 0.4,
          "The World's Largest\nSoftware Marketplace",
          size=10, color=BORDER_GREY, wrap=True)

    _text(slide, card_x + 0.35, card_y + 4.4, card_w - 0.7, 0.9,
          "Questions? Reach out anytime.\nWe're committed to your success with G2.",
          size=11, color=MID_TEXT, wrap=True)

    # Bottom bar
    cust = data.get("cust") or data.get("customer") or ""
    _rect(slide, 0, 6.95, 13.333, 0.55, RORANGE)
    _text(slide, 0.7, 7.0, 8, 0.4,
          f"Prepared for {cust}  |  Confidential",
          size=10, bold=True, color=WHITE)
    _logo(slide, 12.1, 7.0, 0.38, variant="white")


# ── Main entry point ────────────────────────────────────────────────

def build_pptx(data: dict) -> bytes:
    """Build a complete G2 Proposal PPTX and return bytes."""
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    totals = compute_totals(data)

    # Slide 1: Cover
    slide_cover(prs, data)

    # Slide 2: Investment Summary
    slide_summary(prs, data, totals)

    # Slide 3+: Per-product detail
    page = 3
    for ps in totals.get("prod_summaries") or []:
        slide_product(prs, data, ps, page_num=page)
        page += 1

    # Pricing table
    slide_pricing_table(prs, data, totals, page_num=page)
    page += 1

    # Next steps
    slide_next_steps(prs, data, page_num=page)

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


# ── CLI test ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    sample = {
        "cust": "Acme Corp",
        "rep": "Jane Smith",
        "repEmail": "jane.smith@g2.com",
        "repPhone": "(312) 555-0100",
        "repTitle": "Senior Account Executive",
        "date": "April 10, 2026",
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
    out_path = os.path.join(_HERE, "test_proposal.pptx")
    pptx_bytes = build_pptx(sample)
    with open(out_path, "wb") as f:
        f.write(pptx_bytes)
    print(f"Test PPTX written -> {out_path}")
    sys.exit(0)
