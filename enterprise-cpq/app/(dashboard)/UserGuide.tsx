'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Color palette ─────────────────────────────────────────────────────────────
const C = {
  red: '#FF492C',
  navy: '#062846',
  blue: '#0073F5',
  green: '#27D3BC',
  purple: '#5746B2',
  mid: '#6B7280',
  light: '#F8FAFC',
  border: '#E2E8F0',
}

// ─── Step data ─────────────────────────────────────────────────────────────────
const STEPS = [
  // 0 ── Welcome
  {
    title: 'Welcome to G2 Enterprise CPQ',
    badge: 'Start here',
    badgeColor: C.red,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700 leading-relaxed">
          This tool was built because building multi-product G2 proposals used to mean
          juggling spreadsheets, PowerPoint decks, and email chains — and the numbers
          never quite lined up by the time they reached the customer.
        </p>
        <p className="text-gray-700 leading-relaxed">
          <strong>G2 Enterprise CPQ</strong> puts everything in one place: configure packages,
          apply rate cards, stack discounts correctly, preview the customer doc, generate a
          formal quote, and keep Salesforce current — all without leaving the browser.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { icon: '📋', label: 'Multi-product proposals', sub: 'One doc, many profiles' },
            { icon: '💰', label: 'Rate card pricing', sub: 'Segment & account overrides' },
            { icon: '📊', label: 'PPTX export', sub: 'Customer-ready decks' },
            { icon: '☁️', label: 'Salesforce-compatible', sub: 'Complements your CRM' },
          ].map(t => (
            <div key={t.label} className="flex items-start gap-2 p-3 rounded-lg border"
              style={{ borderColor: C.border, background: C.light }}>
              <span className="text-xl">{t.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{t.label}</p>
                <p className="text-xs text-gray-500">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 pt-2">
          This guide walks you through every workflow. Takes about 5 minutes. Use the
          <strong> ? Help</strong> button in the sidebar any time to come back.
        </p>
      </div>
    ),
  },

  // 1 ── Two paths: Proposals vs Quotes
  {
    title: 'Two ways to build a deal',
    badge: 'Core concepts',
    badgeColor: C.navy,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          G2 Enterprise CPQ has two primary workflows. Knowing which to use saves time:
        </p>
        <div className="space-y-3">
          <div className="p-4 rounded-xl border-2" style={{ borderColor: C.red, background: '#FFF5F3' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📝</span>
              <span className="font-bold text-gray-900">G2 Proposals</span>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: C.red }}>Primary</span>
            </div>
            <p className="text-sm text-gray-700">
              Start here for any enterprise account. Configure <strong>multiple G2 product profiles</strong> — one per the customer's software product on G2. Choose foundation packages (Professional/Enterprise), add-ons (Buyer Intent, G2 Content, RMS), and non-ACV items.
              The Preview tab generates a <strong>customer-ready proposal doc</strong> you can print as PDF or export as PPTX.
            </p>
            <p className="text-xs mt-2 font-medium" style={{ color: C.red }}>
              Use when: multi-product deal, customer presentation needed, rate card applies
            </p>
          </div>

          <div className="p-4 rounded-xl border-2" style={{ borderColor: C.blue, background: '#F0F7FF' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧾</span>
              <span className="font-bold text-gray-900">Quotes</span>
            </div>
            <p className="text-sm text-gray-700">
              A simpler, line-item quote for any product — not limited to G2's catalog. Enter
              SKU, quantity, unit price, and discount. The audit trail tracks every edit.
              Quotes convert directly to <strong>Orders</strong> when the customer signs.
            </p>
            <p className="text-xs mt-2 font-medium" style={{ color: C.blue }}>
              Use when: single product, ad-hoc pricing, or after converting from a Proposal
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          💡 The most common flow: build a <strong>Proposal → generate a Quote from it → convert to an Order</strong> when closed.
        </p>
      </div>
    ),
  },

  // 2 ── Building a multi-product proposal
  {
    title: 'Building a multi-product proposal',
    badge: 'Account Executives',
    badgeColor: C.purple,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Go to <strong>Proposals → New Proposal</strong>. Enter the account name and your name,
          then follow these sections:
        </p>

        <div className="space-y-3">
          <GuideStep n={1} color={C.purple} title="Add a Profile for each of the customer's products">
            <p>Each software product the customer wants on G2 is a <em>Profile</em>. A company like Salesforce with
            Sales Cloud and Marketing Cloud would have two profiles. Click <strong>+ Add Profile</strong> and
            name it (e.g. "Salesforce — Sales Cloud").</p>
          </GuideStep>

          <GuideStep n={2} color={C.purple} title="Select the Foundation Package">
            <p>Each profile needs a base package:</p>
            <ul className="mt-1 space-y-1 text-sm">
              <li><span className="font-semibold" style={{ color: '#6B7280' }}>Free</span> — basic G2 listing, no charge</li>
              <li><span className="font-semibold" style={{ color: '#5746B2' }}>Professional</span> — $18,000/yr · Seller Pages, Review Collection, Buyer Intent (basic), AI Sales Agent</li>
              <li><span className="font-semibold" style={{ color: C.red }}>Enterprise</span> — $34,000/yr · Full platform · Solutions Pages, Market Intelligence included, Video Reviews</li>
            </ul>
          </GuideStep>

          <GuideStep n={3} color={C.purple} title="Add relevant Add-Ons">
            <p>Add-ons attach to each profile independently. Common combinations:</p>
            <ul className="mt-1 space-y-1 text-sm list-disc list-inside text-gray-600">
              <li><strong>Buyer Intent</strong> — who's researching the customer's category right now (Tiers 1–10, $12.5k–$75k)</li>
              <li><strong>G2 Content</strong> — syndicated review content on buyer pages (Cat & Comparison, Grids, etc.)</li>
              <li><strong>Review Managed Services</strong> — G2 runs the review campaigns (non-discountable)</li>
              <li><strong>Market Intelligence</strong> — competitive dashboard and keyword tracking</li>
              <li><strong>AICR</strong> — AI-generated custom research reports</li>
            </ul>
          </GuideStep>

          <GuideStep n={4} color={C.purple} title="Set discounts at two levels">
            <p><strong>Line-level disc</strong>: applies to that one SKU. <strong>Proposal disc</strong>: stacks additively on
            top of all line discounts (except Review Managed Services, which is always non-discountable). A 10%
            line discount + 5% proposal discount = 15% total — not 14.5%.</p>
          </GuideStep>
        </div>
      </div>
    ),
  },

  // 3 ── Non-ACV and Account Items
  {
    title: 'Non-ACV items & account-level add-ons',
    badge: 'Account Executives',
    badgeColor: C.purple,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Some items are <strong>account-level</strong> — they apply to the whole deal, not a
          specific profile. These live in the <em>Account Items</em> section at the bottom of
          the proposal builder and show as <strong>Non-ACV</strong> in the proposal doc.
        </p>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-white" style={{ background: C.navy }}>
            Non-ACV catalog
          </div>
          {[
            ['Gift Card Add-Ons', 'Variable', 'Review incentives — most common for review campaigns'],
            ['Video Review Add-On', '$500/video', 'Additional video reviews beyond Enterprise plan'],
            ['Ad Cut (Video Reviews)', '$500/cut', '15–30s social excerpt from video review'],
            ['Social Asset Creation', '$2,500', '3 ad units built from G2 review data'],
            ['Infographics', '$2,500', 'Visual data from G2 reports'],
            ['Animated GIFs', '$2,500', 'Animated review quote assets'],
            ['Report PDF', '$2,000', 'Formatted downloadable Grid/Index report'],
          ].map(([name, price, desc], i) => (
            <div key={name} className="grid grid-cols-12 gap-2 px-4 py-2 text-sm border-t" style={{ borderColor: C.border, background: i % 2 === 0 ? '#fff' : C.light }}>
              <div className="col-span-4 font-medium text-gray-800">{name}</div>
              <div className="col-span-2 font-semibold" style={{ color: C.navy }}>{price}</div>
              <div className="col-span-6 text-gray-500">{desc}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500">
          💡 Non-ACV items are <strong>never discountable</strong> at the proposal level. They add
          directly to the grand total. They appear as a separate line on the customer doc.
        </p>
      </div>
    ),
  },

  // 4 ── Rate Cards
  {
    title: 'Rate cards: pre-negotiated pricing',
    badge: 'Rate Cards',
    badgeColor: C.blue,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          A <strong>Rate Card</strong> is a saved set of negotiated prices for a specific
          segment, region, or strategic account. When you apply a rate card to a proposal,
          it overrides the list price — no need to type custom rates into every line.
        </p>

        <div className="space-y-3">
          <div className="p-3 rounded-lg border" style={{ borderColor: C.border, background: C.light }}>
            <p className="text-sm font-semibold text-gray-800 mb-1">What a rate card controls</p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li><strong>Base package prices</strong> — e.g. Professional at $15,000 instead of $18,000 for a strategic account</li>
              <li><strong>Add-on tier prices</strong> — custom price per add-on tier</li>
              <li><strong>Non-ACV prices</strong> — custom rate for video reviews, infographics, etc.</li>
              <li><strong>Volume discounts</strong> — automatic % off when the same add-on appears across N+ profiles (e.g. 10% off Buyer Intent when 3+ profiles include it)</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg border" style={{ borderColor: C.green, background: '#F0FDF9' }}>
            <p className="text-sm font-semibold" style={{ color: '#0D7A65' }}>How to use rate cards</p>
            <ol className="text-sm text-gray-600 mt-1 space-y-1 list-decimal list-inside">
              <li>Go to <strong>Rate Cards → New Rate Card</strong> and name it (e.g. "Enterprise 2026 – Midwest")</li>
              <li>Override any base package or add-on price. Leave empty to keep list price.</li>
              <li>Add volume discount rules for add-ons if applicable</li>
              <li>In the Proposal builder, select the rate card from the dropdown — all prices update instantly</li>
            </ol>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          💡 Rate cards are managed by admins. AEs select from the available cards — they
          can't edit the underlying prices. This prevents rogue pricing in customer-facing docs.
        </p>
      </div>
    ),
  },

  // 5 ── Preview, PDF, and PPTX
  {
    title: 'Preview, print, and export to PowerPoint',
    badge: 'Customer deliverables',
    badgeColor: C.green,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Once the proposal is built, flip to the <strong>Preview</strong> tab. This generates
          a branded, customer-ready document showing:
        </p>
        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
          <li>Total Annual Investment headline with ACV + Non-ACV breakdown</li>
          <li>Customer savings vs list price (with %)</li>
          <li>Per-profile SKU summary table</li>
          <li>Cost by year (multi-year contract table with proration if applicable)</li>
          <li>Per-profile detailed pricing with all discounts shown</li>
        </ul>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border" style={{ borderColor: C.border }}>
            <p className="text-sm font-bold text-gray-800 mb-1">📄 PDF (Print)</p>
            <p className="text-xs text-gray-600">
              Click <strong>Print / Save PDF</strong> in the Preview tab or use Ctrl+P / Cmd+P.
              The app hides the sidebar and header automatically — only the proposal prints.
              Use "Save as PDF" in the print dialog.
            </p>
          </div>
          <div className="p-3 rounded-lg border" style={{ borderColor: C.border }}>
            <p className="text-sm font-bold text-gray-800 mb-1">📊 PPTX Export</p>
            <p className="text-xs text-gray-600">
              Click <strong>Export PPTX</strong> in the Preview tab. Generates a branded
              PowerPoint with: Cover, Executive Summary, per-product pricing tables,
              Pricing Details, Cost by Year, Non-ACV items, and Next Steps slides.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg border text-sm" style={{ borderColor: '#FCD34D', background: '#FFFBEB' }}>
          <p className="font-semibold text-yellow-800 mb-1">⚠️ Save the version before exporting</p>
          <p className="text-yellow-700">
            The proposal builder auto-saves field changes, but you need to click <strong>Save Version</strong>
            to snapshot the pricing. The "Create Quote" function pulls from the latest saved version —
            if you haven't saved, it will use an older snapshot.
          </p>
        </div>
      </div>
    ),
  },

  // 6 ── Proposal → Quote → Order lifecycle
  {
    title: 'From proposal to signed order',
    badge: 'Deal lifecycle',
    badgeColor: C.navy,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Here's the full lifecycle from first conversation to booked revenue:
        </p>

        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ background: C.border }} />
          <div className="space-y-4">
            {[
              {
                n: '1', color: C.purple, title: 'Build the Proposal',
                desc: 'Configure profiles, packages, add-ons, rate card. Preview and share the PDF with the customer for discovery / budget alignment.',
              },
              {
                n: '2', color: C.blue, title: 'Save a Version',
                desc: 'Click Save Version to snapshot the pricing. Versions are immutable records — great for "as quoted on [date]" situations. Every version is retrievable from the proposal history.',
              },
              {
                n: '3', color: C.red, title: 'Create a Quote',
                desc: 'In the proposal, click "Create Quote". This converts the proposal into a formal CPQ quote with line items (one per SKU), quantities, unit prices, and discounts already filled in. The quote gets a Q-YYYYMM-XXXX number.',
              },
              {
                n: '4', color: C.green, title: 'Send the Quote',
                desc: 'Update the quote status to "sent". The audit trail records who changed what and when — useful for manager review and dispute resolution.',
              },
              {
                n: '5', color: '#D97706', title: 'Convert to Order',
                desc: 'When the customer signs, click "Convert to Order" on the quote. Creates an ORD-YYYYMM-XXXX order record with status "pending → fulfilled". Reflect the closed deal in Salesforce manually, or use the Integrations connection if your admin has configured it.',
              },
            ].map(step => (
              <div key={step.n} className="flex gap-4 relative z-10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: step.color }}>
                  {step.n}
                </div>
                <div className="flex-1 pb-1">
                  <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },

  // 7 ── Quotes in detail
  {
    title: 'Working with quotes directly',
    badge: 'Quotes',
    badgeColor: C.blue,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Sometimes you need a quote without a full proposal — a quick renewal, a single add-on
          upsell, or a custom package outside the G2 catalog. Go to <strong>Quotes → New Quote</strong>.
        </p>

        <div className="space-y-3">
          <GuideStep n={1} color={C.blue} title="Fill in customer info">
            <p>Customer name, email, company, valid-until date. These pre-fill when converting from a proposal.</p>
          </GuideStep>

          <GuideStep n={2} color={C.blue} title="Add line items">
            <p>Search your product catalog or type a custom SKU. Set quantity, unit price, and discount %. The total updates in real time: <code className="text-xs bg-gray-100 px-1 rounded">total = qty × unit × (1 − disc%)</code>.</p>
          </GuideStep>

          <GuideStep n={3} color={C.blue} title="Validate against pricing rules">
            <p>Before sending, the rules engine checks: max discount %, min/max deal size, required fields, and any manager-approval thresholds. Violations show as warnings or blocks.</p>
          </GuideStep>

          <GuideStep n={4} color={C.blue} title="Track the audit trail">
            <p>Every status change and field edit is logged with who made it and the before/after values. The audit trail is append-only — nothing can be deleted.</p>
          </GuideStep>
        </div>

        <p className="text-sm text-gray-500">
          💡 <strong>Quote statuses</strong>: draft → sent → accepted (after conversion to order) or declined.
          Status updates are logged in the audit trail.
        </p>
      </div>
    ),
  },

  // 8 ── Salesforce / CRM
  {
    title: 'Salesforce: keeping the CRM current',
    badge: 'Integrations',
    badgeColor: '#0176D3',
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          G2's sales team runs on <strong>Salesforce</strong>. The CPQ tool is designed to complement
          Salesforce — you build and price the deal here, then keep Salesforce updated as the
          source of record for pipeline, forecasting, and commission.
        </p>

        <div className="space-y-3">
          {[
            {
              icon: '🔁', title: 'The intended workflow',
              desc: 'Build and price the proposal in G2 CPQ → share the PDF or PPTX with the customer → update the Salesforce opportunity stage and amount manually once the pricing is agreed. The CPQ quote number (Q-YYYYMM-XXXX) is your reference to attach to the Salesforce opportunity.',
            },
            {
              icon: '🔗', title: 'Salesforce direct connection (optional)',
              desc: 'Admins can configure a Salesforce OAuth connection under Admin → Integrations → Test Connection. Once connected, future releases can pull opportunity data into CPQ and push quote totals back. Connection requires: Instance URL, Client ID, Client Secret, username, and password + security token.',
            },
            {
              icon: '📋', title: 'What to copy into Salesforce',
              desc: 'After converting a quote to an order, paste the Order number (ORD-YYYYMM-XXXX) into the Salesforce opportunity description, set the opportunity amount to match the CPQ grand total, and advance the stage to Closed Won.',
            },
          ].map(item => (
            <div key={item.title} className="flex gap-3 p-3 rounded-lg border" style={{ borderColor: C.border, background: C.light }}>
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg border text-sm" style={{ borderColor: '#FCD34D', background: '#FFFBEB' }}>
          <p className="font-semibold text-yellow-800 mb-1">⚠️ HubSpot tab in the sidebar</p>
          <p className="text-yellow-700">
            The app includes a <strong>HubSpot</strong> section (Admin → HubSpot) for teams that use HubSpot
            as a secondary CRM or for marketing automation. Since G2 runs on Salesforce, ignore this section
            unless your admin has specifically enabled a HubSpot integration for a particular workflow.
          </p>
        </div>
      </div>
    ),
  },

  // 9 ── Admin: Users and Rules
  {
    title: 'Admin: setting up your team & guardrails',
    badge: 'Admins only',
    badgeColor: C.navy,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Admin users have access to <strong>Settings</strong> and the <strong>Rules Engine</strong> — the two
          areas that keep the team productive and pricing consistent.
        </p>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border" style={{ borderColor: C.border }}>
            <p className="font-bold text-gray-900 mb-2">👤 Adding users (Settings)</p>
            <p className="text-sm text-gray-700 mb-2">
              Go to <strong>Settings → Users → Add User</strong>. Set a username, display name,
              password, and role:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li><strong>Admin</strong> — full access including Settings, Rules, Import SKUs, Rate Card creation</li>
              <li><strong>User</strong> — can build proposals and quotes, but cannot manage users, rate cards, or rules</li>
            </ul>
            <p className="text-xs mt-2 text-gray-500">
              Passwords are bcrypt-hashed — never stored in plain text. Use "Send Credentials" to
              email the new user their login details once the users.email column migration has run.
            </p>
          </div>

          <div className="p-4 rounded-xl border" style={{ borderColor: C.border }}>
            <p className="font-bold text-gray-900 mb-2">⚖️ Rules Engine (guardrails)</p>
            <p className="text-sm text-gray-700 mb-2">Create rules that run every time a quote is validated:</p>
            <div className="space-y-2">
              {[
                ['Max Discount %', 'Warn or block if any line item discount exceeds the threshold. E.g. "Max 25%" prevents rogue 40% discounts.'],
                ['Max Deal Size', 'Flag unusually large deals for manager review before sending.'],
                ['Min Deal Size', 'Prevent sub-threshold quotes from going to customers (e.g. below $10k).'],
                ['Approval Required', 'Any deal above $X requires manager sign-off before converting to order.'],
                ['Required Field', 'Enforce company name is always populated before sending.'],
              ].map(([name, desc]) => (
                <div key={name} className="flex gap-2 text-sm">
                  <span className="font-semibold text-gray-800 whitespace-nowrap">{name}:</span>
                  <span className="text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // 10 ── Product Reference and SKU import
  {
    title: 'Product Reference & SKU management',
    badge: 'Products & SKUs',
    badgeColor: C.green,
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          The <strong>Product Reference</strong> page is a read-only cheat sheet for the full G2
          catalog — all foundation tiers, add-ons (with every tier price), and non-ACV items.
          Share it with new AEs so they understand the product line before their first call.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border" style={{ borderColor: C.border, background: C.light }}>
            <p className="text-sm font-bold text-gray-800 mb-1">📥 Import SKUs (admin)</p>
            <p className="text-xs text-gray-600">
              Have a product spreadsheet? Go to <strong>Admin → Import SKUs</strong>, download the Excel template, fill in SKU, name, description, price, category, unit,
              and upload. Products are created or updated in bulk. A batch record is saved so
              you can track what was imported and when.
            </p>
          </div>
          <div className="p-3 rounded-lg border" style={{ borderColor: C.border, background: C.light }}>
            <p className="text-sm font-bold text-gray-800 mb-1">🔧 G2 SKU Overrides (admin)</p>
            <p className="text-xs text-gray-600">
              Need to hide a G2 catalog item (e.g. a retired add-on) from the proposal builder?
              Go to <strong>Admin → Import SKUs → G2 SKU Overrides</strong> and toggle the SKU
              off. This doesn't delete it — it just suppresses it from appearing in new proposals.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg border" style={{ borderColor: C.border, background: C.light }}>
          <p className="text-sm font-bold text-gray-800 mb-1">🤖 AI Product Suggestions</p>
          <p className="text-sm text-gray-600">
            When creating a new quote, describe what the customer needs in plain English in the
            AI Suggest field (e.g. "enterprise software company, wants to capture buyer demand and
            compete against Salesforce, currently has one product listing"). Claude will recommend
            SKUs and quantities based on your catalog. Requires an Anthropic API key configured in
            your environment.
          </p>
        </div>
      </div>
    ),
  },

  // 11 ── Tips and shortcuts
  {
    title: 'Tips & shortcuts for power users',
    badge: 'Pro tips',
    badgeColor: '#D97706',
    body: (
      <div className="space-y-4">
        <p className="text-gray-700">
          A few things that aren't obvious but save a lot of time:
        </p>

        <div className="space-y-2">
          {[
            {
              tip: 'Multi-year deal math',
              detail: 'Set contract term to 24 or 36 months. The Preview doc auto-generates a "Cost by Year" table with cumulative contract value. The PPTX export includes this table — perfect for EBC decks.',
            },
            {
              tip: 'Volume discounts apply automatically',
              detail: 'If a rate card has volume discounts for Buyer Intent (e.g. 10% off when 3+ profiles use it), they apply the moment a third profile enables that add-on. No manual calculation needed.',
            },
            {
              tip: 'Review Managed Services is always non-discountable',
              detail: 'RMS (Review Managed Services) is the one add-on with a hard floor. Base discounts and proposal discounts both ignore it by design — the customer sees $10,000 no matter what discount you apply elsewhere.',
            },
            {
              tip: 'Version history for "as quoted"',
              detail: 'Customers sometimes push back on price between versions. Hit Save Version before every significant change. Each version is timestamped and retrievable, so you can prove what was on the table on a specific date.',
            },
            {
              tip: 'Proposals create quotes instantly',
              detail: 'Clicking "Create Quote" in a saved proposal converts every line item (base packages + add-ons) into a structured CPQ quote with all pricing pre-filled. Don\'t rebuild it manually.',
            },
            {
              tip: 'The Product Reference is your fastest pricing lookup',
              detail: 'Before a discovery call, open Product Reference. It lists every add-on tier price in one scrollable page — faster than digging through Confluence or asking a colleague.',
            },
            {
              tip: 'Custom rates override list price per line',
              detail: 'Don\'t want to create a full rate card for one-off pricing? In the proposal builder, type a custom rate directly into the "Rate" field on any line. It overrides list price without affecting the rate card.',
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold mt-0.5"
                style={{ background: '#D97706' }}>✓</span>
              <div>
                <span className="font-semibold text-gray-800">{item.tip}: </span>
                <span className="text-gray-600">{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // 12 ── Done
  {
    title: "You're ready to go",
    badge: 'Done',
    badgeColor: C.green,
    body: (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{ background: '#F0FDF9', border: `3px solid ${C.green}` }}>
            🎉
          </div>
        </div>

        <p className="text-gray-700 text-base">
          You've completed the G2 Enterprise CPQ walkthrough. Here's your quick reference:
        </p>

        <div className="text-left space-y-2">
          {[
            ['New enterprise deal', 'Proposals → New Proposal → configure profiles → Preview → PPTX'],
            ['Customer wants formal pricing', 'Proposals → Create Quote (after saving a version)'],
            ['Customer signed', 'Quotes → Convert to Order → update Salesforce opp'],
            ['Apply negotiated pricing', 'Rate Cards → select card in proposal'],
            ['New team member', 'Settings → Users → Add User'],
            ['Set discount limits', 'Admin → Rules Engine → Max Discount'],
            ['Check product pricing', 'Product Reference (in sidebar)'],
            ['Salesforce connection', 'Admin → Integrations → Salesforce'],
          ].map(([scenario, path]) => (
            <div key={scenario} className="flex gap-2 text-sm p-2 rounded-lg" style={{ background: C.light }}>
              <span className="font-semibold text-gray-800 min-w-48">{scenario}</span>
              <span className="text-gray-500">→</span>
              <span className="text-gray-600 font-mono text-xs pt-0.5">{path}</span>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500 pt-2">
          Click <strong>? Help</strong> in the sidebar any time to reopen this guide.
          Questions or issues? Reach Andrew Pike or the Sales Ops team.
        </p>
      </div>
    ),
  },
]

// ─── Sub-component: numbered step ──────────────────────────────────────────────
function GuideStep({ n, color, title, children }: { n: number; color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ background: color }}>
        {n}
      </div>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-gray-800 mb-0.5">{title}</p>
        <div className="text-gray-600">{children}</div>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'g2cpq_guide_done'

export function UserGuide({ trigger }: { trigger: boolean }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  // Auto-open for first-time users; also opens when trigger fires (help button)
  useEffect(() => {
    if (trigger) { setStep(0); setOpen(true); return }
    if (!localStorage.getItem(STORAGE_KEY)) { setStep(0); setOpen(true) }
  }, [trigger])

  const close = useCallback(() => setOpen(false), [])
  const finish = useCallback(() => { localStorage.setItem(STORAGE_KEY, '1'); setOpen(false) }, [])

  const prev = () => setStep(s => Math.max(0, s - 1))
  const next = () => {
    if (step === STEPS.length - 1) { finish(); return }
    setStep(s => s + 1)
  }

  if (!open) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(6,40,70,0.65)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" style={{ border: `2px solid ${C.border}` }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: C.border }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: C.red }}>
            <span className="text-white font-black text-xs">G2</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: current.badgeColor }}>
                {current.badge}
              </span>
              <h2 className="font-bold text-gray-900 text-base truncate">{current.title}</h2>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 rounded-full" style={{ background: C.border }}>
                <div className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: C.red }} />
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{step + 1} / {STEPS.length}</span>
            </div>
          </div>
          <button onClick={finish} className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Step dots ── */}
        <div className="flex gap-1.5 px-6 py-2 flex-shrink-0 flex-wrap border-b" style={{ borderColor: C.border }}>
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className="w-2 h-2 rounded-full transition-all duration-200 flex-shrink-0"
              style={{ background: i === step ? C.red : i < step ? C.green : C.border }}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {current.body}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: C.border }}>
          <button onClick={finish} className="text-sm text-gray-400 hover:text-gray-600 transition-colors mr-auto">
            Skip guide
          </button>
          {step > 0 && (
            <button onClick={prev}
              className="px-4 py-2 text-sm font-semibold rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: C.border, color: C.navy }}>
              ← Back
            </button>
          )}
          <button onClick={next}
            className="px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors"
            style={{ background: isLast ? C.green : C.red }}>
            {isLast ? '✓ Done' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Help button (always visible in sidebar) ────────────────────────────────────
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="sidebar-link w-full"
      style={{ color: C.blue }}
      title="Open user guide">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      ? Help
    </button>
  )
}
