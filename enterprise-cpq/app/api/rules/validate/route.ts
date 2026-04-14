import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { evaluateCustomRule } from '@/lib/ai'

export const maxDuration = 30

interface QuoteItem {
  productName?: string
  sku?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  discount_percent?: number
}

interface RuleCondition {
  value?: number
  threshold?: number
  field?: string
  severity?: 'warn' | 'block'
  description?: string
}

interface Rule {
  id: string
  name: string
  team: string
  type: string
  condition: RuleCondition
  active: boolean
}

interface Violation {
  ruleId: string
  ruleName: string
  team: string
  severity: 'warn' | 'block'
  message: string
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { quoteTotal, items, customerCompany } = body

  const { data: rules } = await supabaseAdmin.from('rules').select('*').eq('active', true)

  if (!rules || rules.length === 0) {
    return NextResponse.json({ violations: [], blocked: false })
  }

  const violations: Violation[] = []
  const itemsList = (items as QuoteItem[]) || []

  for (const rule of rules as Rule[]) {
    const { type, condition } = rule

    if (type === 'max_discount') {
      const maxDisc = condition.value || 0
      for (const item of itemsList) {
        if ((item.discount_percent || 0) > maxDisc) {
          violations.push({
            ruleId: rule.id, ruleName: rule.name, team: rule.team,
            severity: condition.severity || 'warn',
            message: `Discount ${item.discount_percent}% exceeds max ${maxDisc}% on "${item.productName || item.sku}"`,
          })
        }
      }
    } else if (type === 'max_deal_size') {
      if (quoteTotal > (condition.value || 0)) {
        violations.push({
          ruleId: rule.id, ruleName: rule.name, team: rule.team,
          severity: condition.severity || 'warn',
          message: `Quote $${quoteTotal.toFixed(2)} exceeds max deal size $${(condition.value || 0).toLocaleString()}`,
        })
      }
    } else if (type === 'min_deal_size') {
      if (quoteTotal < (condition.value || 0)) {
        violations.push({
          ruleId: rule.id, ruleName: rule.name, team: rule.team,
          severity: condition.severity || 'warn',
          message: `Quote $${quoteTotal.toFixed(2)} is below minimum deal size $${(condition.value || 0).toLocaleString()}`,
        })
      }
    } else if (type === 'approval_required') {
      if (quoteTotal >= (condition.threshold || 0)) {
        violations.push({
          ruleId: rule.id, ruleName: rule.name, team: rule.team,
          severity: 'warn',
          message: `Deal $${quoteTotal.toFixed(2)} requires manager approval (threshold: $${(condition.threshold || 0).toLocaleString()})`,
        })
      }
    } else if (type === 'required_field') {
      if (condition.field === 'company' && !customerCompany) {
        violations.push({
          ruleId: rule.id, ruleName: rule.name, team: rule.team,
          severity: condition.severity || 'warn',
          message: `Required field "${condition.field}" is missing from the quote`,
        })
      }
    } else if (type === 'custom') {
      try {
        const quoteContext = `Total: $${quoteTotal}, Items: ${itemsList.length}, Company: ${customerCompany || 'N/A'}`
        const result = await evaluateCustomRule(rule.name, condition.description || JSON.stringify(condition), quoteContext)
        if (result.violated) {
          violations.push({
            ruleId: rule.id, ruleName: rule.name, team: rule.team,
            severity: 'warn',
            message: result.reason,
          })
        }
      } catch {
        // Skip custom rule on error
      }
    }
  }

  const blocked = violations.some((v) => v.severity === 'block')
  return NextResponse.json({ violations, blocked })
}
