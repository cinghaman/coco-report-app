import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  emptyFinancialTotals,
  finalizeFinancialTotals,
  sumReportRow,
  type ApprovedReportRow,
  type FinancialTotals,
} from '@/lib/financial-report'

const REPORT_FIELDS = `
  id, for_date, venue_id, status,
  total_sale_gross, gross_revenue, net_revenue,
  card_1, card_2, cash, flavor, cash_deposits,
  przelew, glovo, uber, wolt, pyszne, bolt,
  total_sale_with_special_payment,
  staff_cost, staff_spent, service_10_percent,
  locker_withdrawal, deposit, drawer, withdrawal
`

export type MonthWindow = {
  start: string
  end: string
  label: string
  key: string
}

function monthWindowFromDate(actual: Date): MonthWindow {
  return {
    start: format(actual, 'yyyy-MM-dd'),
    end: format(endOfMonth(actual), 'yyyy-MM-dd'),
    label: format(actual, 'MMMM yyyy'),
    key: format(actual, 'yyyy-MM'),
  }
}

/** Previous calendar month (what the end-of-month cron should send). */
export function getPreviousMonthWindow(now: Date = new Date()): MonthWindow {
  return monthWindowFromDate(startOfMonth(subMonths(now, 1)))
}

/** Month immediately before the given window. */
export function getPriorMonthWindow(month: MonthWindow): MonthWindow {
  return monthWindowFromDate(startOfMonth(subMonths(parseISO(month.start), 1)))
}

/** Resolve a `yyyy-MM` key (or omit for previous month). */
export function resolveMonthWindow(monthKey?: string, now: Date = new Date()): MonthWindow {
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    return monthWindowFromDate(startOfMonth(parseISO(`${monthKey}-01`)))
  }
  return getPreviousMonthWindow(now)
}

function n(v: number | null | undefined) {
  return Number(v) || 0
}

export async function loadVenueMonthTotals(
  admin: SupabaseClient,
  venueId: string,
  start: string,
  end: string
): Promise<FinancialTotals> {
  const PAGE = 1000
  let offset = 0
  const reports: Array<ApprovedReportRow & { id: string }> = []

  for (;;) {
    const { data, error } = await admin
      .from('daily_reports')
      .select(REPORT_FIELDS)
      .eq('venue_id', venueId)
      .eq('status', 'approved')
      .gte('for_date', start)
      .lte('for_date', end)
      .order('for_date')
      .range(offset, offset + PAGE - 1)

    if (error) throw error
    if (!data?.length) break
    reports.push(...(data as typeof reports))
    if (data.length < PAGE) break
    offset += PAGE
  }

  const extrasByReport = new Map<
    string,
    { tableWithdrawals: number; serviceKwotowy: number; representacja1: number }
  >()
  for (const r of reports) {
    extrasByReport.set(r.id, { tableWithdrawals: 0, serviceKwotowy: 0, representacja1: 0 })
  }

  const reportIds = reports.map((r) => r.id)
  const loadExtras = async (
    table: 'report_withdrawals' | 'report_service_kwotowy' | 'report_representacja_1',
    field: 'tableWithdrawals' | 'serviceKwotowy' | 'representacja1'
  ) => {
    if (!reportIds.length) return
    const CHUNK = 200
    for (let i = 0; i < reportIds.length; i += CHUNK) {
      const chunk = reportIds.slice(i, i + CHUNK)
      const { data, error } = await admin.from(table).select('report_id, amount').in('report_id', chunk)
      if (error) throw error
      for (const row of data ?? []) {
        const entry = extrasByReport.get(row.report_id)
        if (entry) entry[field] += n(row.amount)
      }
    }
  }

  await Promise.all([
    loadExtras('report_withdrawals', 'tableWithdrawals'),
    loadExtras('report_service_kwotowy', 'serviceKwotowy'),
    loadExtras('report_representacja_1', 'representacja1'),
  ])

  const totals = emptyFinancialTotals()
  for (const report of reports) {
    sumReportRow(totals, report, extrasByReport.get(report.id))
  }
  return finalizeFinancialTotals(totals)
}

export type MomMetric = {
  label: string
  current: number
  previous: number
  changePct: number | null
}

export function momMetric(label: string, current: number, previous: number): MomMetric {
  let changePct: number | null = null
  if (previous !== 0) {
    changePct = ((current - previous) / Math.abs(previous)) * 100
  } else if (current !== 0) {
    changePct = 100
  } else {
    changePct = 0
  }
  return { label, current, previous, changePct }
}

export function buildMonthlyMomMetrics(
  current: FinancialTotals,
  previous: FinancialTotals
): MomMetric[] {
  return [
    momMetric('Gross sales', current.grossSales, previous.grossSales),
    momMetric('Gross revenue', current.grossRevenue, previous.grossRevenue),
    momMetric('Net revenue', current.netRevenue, previous.netRevenue),
    momMetric('Card payments', current.cardsTotal, previous.cardsTotal),
    momMetric('Delivery apps', current.deliveryAppsTotal, previous.deliveryAppsTotal),
    momMetric("Today's cash (sum)", current.todaysCash, previous.todaysCash),
    momMetric(
      'Withdrawals',
      current.tableWithdrawals + current.lineWithdrawals,
      previous.tableWithdrawals + previous.lineWithdrawals
    ),
    momMetric('Staff cost', current.staffCost, previous.staffCost),
  ]
}

const fmtPln = (amount: number) =>
  amount.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })

function fmtChange(pct: number | null): string {
  if (pct === null) return '—'
  const rounded = Math.round(pct * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}%`
}

function changeColor(pct: number | null): string {
  if (pct === null || pct === 0) return '#6b7280'
  return pct > 0 ? '#15803d' : '#b91c1c'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildMonthlyReportEmailHtml(params: {
  venueName: string
  monthLabel: string
  priorMonthLabel: string
  current: FinancialTotals
  previous: FinancialTotals
  appUrl?: string
}): string {
  const { venueName, monthLabel, priorMonthLabel, current, previous } = params
  const appUrl = params.appUrl || 'https://coco-report-app.vercel.app'
  const metrics = buildMonthlyMomMetrics(current, previous)
  const safeVenue = escapeHtml(venueName)
  const safeMonth = escapeHtml(monthLabel)
  const safePrior = escapeHtml(priorMonthLabel)

  const rows = metrics
    .map(
      (m) => `
      <tr>
        <td style="padding:8px 12px 8px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(m.label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111;">${fmtPln(m.current)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmtPln(m.previous)}</td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${changeColor(m.changePct)};">${fmtChange(m.changePct)}</td>
      </tr>`
    )
    .join('')

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#111; max-width:640px;">
      <h2 style="margin:0 0 8px;">End of Month Report</h2>
      <p style="margin:0 0 4px;"><strong>Venue:</strong> ${safeVenue}</p>
      <p style="margin:0 0 16px;"><strong>Period:</strong> ${safeMonth}</p>
      <p style="margin:0 0 20px; color:#4b5563; font-size:14px; line-height:1.5;">
        Short summary for ${safeVenue} in ${safeMonth}, with month-on-month change vs ${safePrior}.
        Based on ${current.reportCount} approved daily report${current.reportCount === 1 ? '' : 's'}
        (${previous.reportCount} in ${safePrior}).
      </p>

      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:20px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 12px 8px 0;border-bottom:2px solid #d1d5db;">Metric</th>
            <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #d1d5db;">${safeMonth}</th>
            <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #d1d5db;">${safePrior}</th>
            <th style="text-align:right;padding:8px 0 8px 12px;border-bottom:2px solid #d1d5db;">MoM</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="font-size:14px;margin:0;">
        <a href="${appUrl}/analytics" target="_blank">Open Financial Report</a>
      </p>
    </div>
  `
}
