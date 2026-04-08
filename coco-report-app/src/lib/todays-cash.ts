import type { DailyReport } from '@/lib/supabase'

/** Cash + Flavor + Cash Deposits + Representacja 2 — same for new and legacy stored rows. */
export function getTodaysCash(
  report: Pick<
    DailyReport,
    'cash' | 'flavor' | 'cash_deposits' | 'total_sale_with_special_payment'
  >
): number {
  return (
    (Number(report.cash) || 0) +
    (Number(report.flavor) || 0) +
    (Number(report.cash_deposits) || 0) +
    (Number(report.total_sale_with_special_payment) || 0)
  )
}
