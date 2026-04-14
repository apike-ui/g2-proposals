import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy clients — only created when first used (prevents build-time errors)
let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
    _supabase = createClient(url, key)
  }
  return _supabase
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !serviceKey) throw new Error('Supabase env vars not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local')
    _supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabaseAdmin
}

// Proxy objects for backwards-compatible usage (supabaseAdmin.from(...))
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => getSupabaseClient()[prop as keyof SupabaseClient],
})

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get: (_, prop) => getSupabaseAdmin()[prop as keyof SupabaseClient],
})

export type Product = {
  id: string
  sku: string
  name: string
  description: string | null
  price: number
  category: string | null
  unit: string
  hubspot_product_id: string | null
  created_at: string
  updated_at: string
}

export type Quote = {
  id: string
  quote_number: string
  customer_name: string | null
  customer_email: string | null
  customer_company: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  notes: string | null
  ai_summary: string | null
  hubspot_deal_id: string | null
  total_amount: number
  valid_until: string | null
  rate_card_id: string | null
  created_at: string
  updated_at: string
  items?: QuoteItem[]
}

export type QuoteItem = {
  id: string
  quote_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
  notes: string | null
  product?: Product
}

export type Order = {
  id: string
  order_number: string
  quote_id: string | null
  status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'
  customer_name: string | null
  customer_email: string | null
  customer_company: string | null
  shipping_address: string | null
  total_amount: number
  hubspot_deal_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  quote?: Quote
}
