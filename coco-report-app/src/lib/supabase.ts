import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Singleton browser client instance to avoid multiple GoTrueClient instances
// Using a function to lazily initialize the client only when needed
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null

function getBrowserClient() {
  if (typeof window === 'undefined') {
    return null
  }
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured')
  }
  
  // Return singleton instance if it exists
  if (browserClientInstance) {
    return browserClientInstance
  }
  
  // Create new instance only if it doesn't exist
  // createBrowserClient handles its own singleton internally based on storage key
  // but we also maintain a module-level singleton to ensure consistency
  browserClientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return browserClientInstance
}

// Browser client for SSR - returns singleton instance
export const createClientComponentClient = () => {
  const client = getBrowserClient()
  if (!client) {
    throw new Error('createClientComponentClient can only be called in browser environment')
  }
  return client
}

// Export singleton for backward compatibility
// This ensures existing code continues to work while we migrate
// Only available in browser environment
export const supabase = getBrowserClient()

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
  flavor: number
  przelew: number
  glovo: number
  uber: number
  wolt: number
  pyszne: number
  bolt: number
  total_sale_with_special_payment: number
  cash_deposits: number
  drawer: number
  withdrawal: number
  locker_withdrawal: number
  deposit: number
  staff_cost: number
  service_10_percent: number
  staff_spent: number
  // Revenue fields
  gross_revenue: number
  net_revenue: number
  // Carryover & derived snapshots
  cash_previous_day: number
  calculated_cash_expected: number
  reconciliation_diff: number
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

export interface Representacja1 {
  id: string
  report_id: string
  amount: number
  reason: string
  created_at?: string
}

export interface Withdrawal {
  id: string
  report_id: string
  amount: number
  reason: string
  created_at?: string
}

export interface ServiceKwotowy {
  id: string
  report_id: string
  amount: number
  reason: string
  created_at?: string
}

export interface Strata {
  id: string
  report_id: string
  amount: number
  reason: string
  created_at?: string
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
