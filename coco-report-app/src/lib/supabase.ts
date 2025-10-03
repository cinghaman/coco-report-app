import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Debug logging
console.log('Supabase client initialization:', {
  url: supabaseUrl ? 'SET' : 'NOT SET',
  key: supabaseAnonKey ? 'SET' : 'NOT SET'
})

// Client-side Supabase client (only create if env vars are available)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Browser client for SSR
export const createClientComponentClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured')
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Database types based on our schema
export type UserRole = 'staff' | 'admin' | 'owner'
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'locked'
export type FieldType = 'decimal' | 'integer' | 'text' | 'boolean' | 'date'

export interface Venue {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
}

export interface User {
  id: string
  email: string
  display_name?: string
  role: UserRole
  venue_ids: string[]
  created_at: string
}

export interface DailyReport {
  id?: string
  venue_id: string
  for_date: string
  status: ReportStatus
  // Core numeric fields (PLN; 2 decimals)
  total_sale_gross: number
  card_1: number
  card_2: number
  cash: number
  przelew: number
  glovo: number
  uber: number
  wolt: number
  pyszne: number
  bolt: number
  total_sale_with_special_payment: number
  representation_note?: string
  representation_amount: number
  strata_loss: number
  flavour: number
  withdrawal: number
  locker_withdrawal: number
  deposit: number
  representacja: number
  staff_cost: number
  tips_cash: number
  tips_card: number
  cash_in_envelope_after_tips: number
  left_in_drawer: number
  total_cash_in_locker: number
  serwis: number
  serwis_k: number
  company: number
  voids: number
  // Carryover & derived snapshots
  cash_previous_day: number
  calculated_cash_expected: number
  reconciliation_diff: number
  notes?: string
  created_by: string
  submitted_at?: string
  approved_by?: string
  approved_at?: string
  locked_at?: string
  created_at?: string
  updated_at?: string
}


export interface FieldDefinition {
  id?: string
  venue_id?: string
  key: string
  label: string
  data_type: FieldType
  min_value?: number
  max_value?: number
  required: boolean
  default_value?: string
  group?: string
  order_index: number
  is_active: boolean
}

export interface ReportFieldValue {
  id?: string
  report_id: string
  field_definition_id: string
  value_text?: string
}

export interface AuditLog {
  id?: string
  entity: string
  entity_id: string
  action: string
  changed_by: string
  changed_at?: string
  diff_json?: Record<string, unknown>
}
