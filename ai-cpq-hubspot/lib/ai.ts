import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

export async function generateQuoteSummary(quote: {
  customerName: string
  customerCompany: string
  items: Array<{ productName: string; sku: string; quantity: number; unitPrice: number; totalPrice: number }>
  total: number
  notes: string
}): Promise<string> {
  const client = getClient()
  if (!client) return 'Configure ANTHROPIC_API_KEY in .env.local to enable AI summaries.'

  const itemsList = quote.items
    .map((i) => `  - ${i.productName} (${i.sku}): ${i.quantity} × $${i.unitPrice.toFixed(2)} = $${i.totalPrice.toFixed(2)}`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: 'You are a professional B2B sales assistant. Write concise, value-focused quote summaries.',
    messages: [
      {
        role: 'user',
        content: `Write a 2-paragraph professional quote summary for this proposal:

Customer: ${quote.customerName} at ${quote.customerCompany}
Line Items:
${itemsList}
Total Value: $${quote.total.toFixed(2)}
Notes: ${quote.notes || 'None'}

Focus on business value and outcomes, not just product names.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
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
    return { suggestions: [], summary: 'Configure ANTHROPIC_API_KEY in .env.local to enable AI suggestions.' }
  }

  const productList = products
    .slice(0, 60)
    .map((p) => `${p.sku} | ${p.name} | $${p.price} | ${p.description || 'No description'}`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: 'You are a CPQ assistant. Respond only with valid JSON, no markdown fences.',
    messages: [
      {
        role: 'user',
        content: `Customer requirement: "${requirement}"

Available products (SKU | Name | Price | Description):
${productList}

Respond with JSON only:
{"suggestions":[{"sku":"...","name":"...","reason":"...","quantity":1}],"summary":"..."}`,
      },
    ],
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
    max_tokens: 30,
    messages: [
      {
        role: 'user',
        content: `Categorize in 1-3 words (output only the category):
Product: ${name}
Description: ${description}`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : 'Uncategorized'
}
