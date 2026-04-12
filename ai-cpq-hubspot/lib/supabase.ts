import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
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
