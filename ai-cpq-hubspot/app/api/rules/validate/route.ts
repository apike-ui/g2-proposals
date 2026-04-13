import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

interface QuoteItem {
  product_name?: string
  quantity: number
  unit_price: number
  discount?: number
}

interface RuleViolation {
  ruleId: string
  title: string
  team: string
  severity: 'block' | 'warn'
  message: string
}

function evaluateRule(rule: Record<string, unknown>, quote: Record<string, unknown>, items: QuoteItem[]): RuleViolation | null {
  const conditions = (rule.conditions as Record<string, unknown>) || {}
  const totalAmount = quote.total_amount as number || 0
  const maxDiscount = items.length > 0
    ? Math.max(...items.map(i => i.discount || 0))
    : 0

  const ruleType = rule.rule_type as string

  if (ruleType === 'max_discount') {
    const limit = Number(conditions.value) || 0
    if (maxDiscount > limit) {
      return {
        ruleId: rule.id as string,
        title: rule.title as string,
        team: rule.team as string,
        severity: (conditions.severity as 'block' | 'warn') || 'warn',
        message: `Discount of ${maxDiscount}% exceeds the ${limit}% limit set by ${rule.team}`,
      }
    }
  }

  if (ruleType === 'min_deal_size') {
    const limit = Number(conditions.value) || 0
    if (totalAmount < limit) {
      return {
        ruleId: rule.id as string,
        title: rule.title as string,
        team: rule.team as string,
        severity: (conditions.severity as 'block' | 'warn') || 'warn',
        message: `Deal total $${totalAmount.toLocaleString()} is below the $${limit.toLocaleString()} minimum`,
      }
    }
  }

  if (ruleType === 'max_deal_size') {
    const limit = Number(conditions.value) || 0
    if (totalAmount > limit) {
      return {
        ruleId: rule.id as string,
        title: rule.title as string,
        team: rule.team as string,
        severity: (conditions.severity as 'block' | 'warn') || 'block',
        message: `Deal total $${totalAmount.toLocaleString()} exceeds $${limit.toLocaleString()} — ${rule.team} approval required`,
      }
    }
  }

  if (ruleType === 'approval_required') {
    const threshold = Number(conditions.threshold) || 0
    if (totalAmount >= threshold) {
      return {
        ruleId: rule.id as string,
        title: rule.title as string,
        team: rule.team as string,
        severity: 'warn',
        message: `Deals over $${threshold.toLocaleString()} require approval from ${rule.team}`,
      }
    }
  }

  if (ruleType === 'required_field') {
    const field = conditions.field as string
    if (field && !quote[field]) {
      return {
        ruleId: rule.id as string,
        title: rule.title as string,
        team: rule.team as string,
        severity: (conditions.severity as 'block' | 'warn') || 'warn',
        message: `Field "${field}" is required by ${rule.team}`,
      }
    }
  }

  if (ruleType === 'custom') {
    // AI-evaluated — always flag for AI review
    return {
      ruleId: rule.id as string,
      title: rule.title as string,
      team: rule.team as string,
      severity: 'warn',
      message: `Custom rule requires AI review: ${rule.description || rule.title}`,
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const { quote, items } = await request.json()

    const { data: rules, error } = await supabaseAdmin
      .from('rules').select('*').eq('is_active', true)
    if (error) throw error

    const violations: RuleViolation[] = []
    for (const rule of rules || []) {
      const v = evaluateRule(rule, quote, items || [])
      if (v) violations.push(v)
    }

    // If there are custom rules, use AI to narrate a summary
    let aiSummary: string | null = null
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey && violations.length > 0) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey })
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `You are a deal desk assistant. A quote has ${violations.length} rule violation(s):\n${violations.map(v => `- [${v.team}] ${v.message}`).join('\n')}\n\nWrite a concise 2-3 sentence summary for the sales rep explaining what needs to be addressed before this deal can proceed.`,
          }],
        })
        aiSummary = msg.content[0].type === 'text' ? msg.content[0].text : null
      } catch {
        // AI summary is optional
      }
    }

    return NextResponse.json({
      violations,
      blocked: violations.some(v => v.severity === 'block'),
      aiSummary,
    })
  } catch (err) {
    console.error('Rules validate error:', err)
    return NextResponse.json({ error: 'Failed to validate rules' }, { status: 500 })
  }
}
