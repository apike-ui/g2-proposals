import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
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
  if (!client) return 'Add ANTHROPIC_API_KEY to Vercel environment variables to enable AI summaries.'

  const itemsList = quote.items
    .slice(0, 10)
    .map((i) => `  - ${i.productName} (${i.sku}): ${i.quantity} x $${i.unitPrice.toFixed(2)}`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system: 'You are a professional B2B sales assistant. Write concise, value-focused quote summaries in 2 short paragraphs.',
    messages: [{
      role: 'user',
      content: `Customer: ${quote.customerName} at ${quote.customerCompany}\nItems:\n${itemsList}\nTotal: $${quote.total.toFixed(2)}\nNotes: ${quote.notes || 'None'}`,
    }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function suggestProducts(
  requirement: string,
  products: Array<{ sku: string; name: string; description: string | null; price: number }>,
): Promise<{ suggestions: Array<{ sku: string; name: string; reason: string; quantity: number }>; summary: string }> {
  const client = getClient()
  if (!client) {
    return { suggestions: [], summary: 'Add ANTHROPIC_API_KEY to Vercel environment variables to enable AI suggestions.' }
  }

  const productList = products
    .slice(0, 25)
    .map((p) => `${p.sku}|${p.name}|$${p.price}`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: 'You are a CPQ assistant. Respond only with valid JSON, no markdown.',
    messages: [{
      role: 'user',
      content: `Requirement: "${requirement}"\n\nProducts (SKU|Name|Price):\n${productList}\n\nReturn JSON: {"suggestions":[{"sku":"","name":"","reason":"","quantity":1}],"summary":""}`,
    }],
  })

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    return JSON.parse(text)
  } catch {
    return { suggestions: [], summary: 'Could not parse AI response.' }
  }
}

export async function categorizeProduct(name: string, description: string): Promise<string> {
  const client = getClient()
  if (!client) return 'Uncategorized'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    messages: [{ role: 'user', content: `Categorize in 1-3 words only: ${name}. ${description}` }],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : 'Uncategorized'
}
