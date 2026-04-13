import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  // timeout: 25s — stays under Vercel's 30s maxDuration
  return new Anthropic({ apiKey, timeout: 25000 })
}

export async function generateQuoteSummary(quote: {
  customerName: string
  customerCompany: string
  items: Array<{ productName: string; sku: string; quantity: number; unitPrice: number; totalPrice: number }>
  total: number
  notes: string
}): Promise<string> {
  const client = getClient()
  if (!client) return 'AI summary unavailable — ANTHROPIC_API_KEY not configured.'

  try {
    const itemsList = quote.items
      .slice(0, 10)
      .map((i) => `${i.productName} (${i.sku}): ${i.quantity}x $${i.unitPrice.toFixed(2)} = $${i.totalPrice.toFixed(2)}`)
      .join(', ')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: 'You are a B2B sales assistant. Write a concise 2-sentence professional quote summary focused on business value.',
      messages: [{
        role: 'user',
        content: `Customer: ${quote.customerName} at ${quote.customerCompany}. Items: ${itemsList}. Total: $${quote.total.toFixed(2)}.`,
      }],
    })

    return message.content[0].type === 'text' ? message.content[0].text : ''
  } catch {
    return 'AI summary unavailable. Please review the line items above.'
  }
}

export async function suggestProducts(
  requirement: string,
  products: Array<{ sku: string; name: string; description: string | null; price: number }>,
): Promise<{
  suggestions: Array<{ sku: string; name: string; reason: string; quantity: number }>
  summary: string
}> {
  const client = getClient()
  if (!client) {
    return { suggestions: [], summary: 'AI suggestions unavailable — ANTHROPIC_API_KEY not configured in Vercel.' }
  }

  try {
    const productList = products
      .slice(0, 25)
      .map((p) => `${p.sku}|${p.name}|$${p.price}`)
      .join('\n')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'You are a CPQ assistant. Respond only with valid JSON, no markdown fences or extra text.',
      messages: [{
        role: 'user',
        content: `Requirement: "${requirement}"\nProducts (SKU|Name|Price):\n${productList}\nReturn JSON: {"suggestions":[{"sku":"","name":"","reason":"","quantity":1}],"summary":""}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    return JSON.parse(text)
  } catch {
    return { suggestions: [], summary: 'AI suggestions temporarily unavailable. Please browse the product catalog.' }
  }
}

export async function evaluateCustomRule(
  ruleName: string,
  ruleDescription: string,
  quoteContext: string,
): Promise<{ violated: boolean; reason: string }> {
  const client = getClient()
  if (!client) return { violated: false, reason: 'AI not configured — rule skipped.' }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: 'Evaluate business rules against quotes. Respond only with valid JSON.',
      messages: [{
        role: 'user',
        content: `Rule "${ruleName}": ${ruleDescription}\nQuote context: ${quoteContext}\nJSON: {"violated":true,"reason":"explanation"}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    return JSON.parse(text)
  } catch {
    return { violated: false, reason: 'Could not evaluate rule automatically.' }
  }
}

export async function categorizeProduct(name: string, description: string): Promise<string> {
  const client = getClient()
  if (!client) return 'Uncategorized'

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      messages: [{
        role: 'user',
        content: `Categorize in 1-3 words (output only the category): ${name}`,
      }],
    })
    return message.content[0].type === 'text' ? message.content[0].text.trim() : 'Uncategorized'
  } catch {
    return 'Uncategorized'
  }
}
