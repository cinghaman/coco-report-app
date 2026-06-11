import { getTodaysCash } from '@/lib/todays-cash'
import { format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { AnalyticsGroupBy } from '@/lib/analytics-aggregation'

export type ApprovedReportRow = {
  for_date: string
  venue_id: string
  total_sale_gross: number | null
  gross_revenue: number | null
  net_revenue: number | null
  card_1: number | null
  card_2: number | null
  cash: number | null
  flavor: number | null
  cash_deposits: number | null
  przelew: number | null
  glovo: number | null
  uber: number | null
  wolt: number | null
  pyszne: number | null
  bolt: number | null
  total_sale_with_special_payment: number | null
  staff_cost: number | null
  staff_spent: number | null
  service_10_percent: number | null
  locker_withdrawal: number | null
  deposit: number | null
  drawer: number | null
  withdrawal: number | null
}

export type FinancialTotals = {
  reportCount: number
  grossSales: number
  grossRevenue: number
  netRevenue: number
  card1: number
  card2: number
  cardsTotal: number
  cash: number
  flavor: number
  cashDeposits: number
  przelew: number
  glovo: number
  uber: number
  wolt: number
  pyszne: number
  bolt: number
  deliveryAppsTotal: number
  representacja2: number
  staffCost: number
  staffSpent: number
  service10Percent: number
  lockerWithdrawal: number
  deposit: number
  drawer: number
  lineWithdrawals: number
  tableWithdrawals: number
  serviceKwotowy: number
  representacja1: number
  todaysCash: number
}

export type FinancialPeriodRow = FinancialTotals & { date: string }

export type VenueFinancialRow = FinancialTotals & {
  venueId: string
  venueName: string
}

export type PaymentMixRow = {
  key: string
  label: string
  amount: number
  share: number
}

const n = (v: number | null | undefined) => Number(v) || 0

export function emptyFinancialTotals(): FinancialTotals {
  return {
    reportCount: 0,
    grossSales: 0,
    grossRevenue: 0,
    netRevenue: 0,
    card1: 0,
    card2: 0,
    cardsTotal: 0,
    cash: 0,
    flavor: 0,
    cashDeposits: 0,
    przelew: 0,
    glovo: 0,
    uber: 0,
    wolt: 0,
    pyszne: 0,
    bolt: 0,
    deliveryAppsTotal: 0,
    representacja2: 0,
    staffCost: 0,
    staffSpent: 0,
    service10Percent: 0,
    lockerWithdrawal: 0,
    deposit: 0,
    drawer: 0,
    lineWithdrawals: 0,
    tableWithdrawals: 0,
    serviceKwotowy: 0,
    representacja1: 0,
    todaysCash: 0,
  }
}

export function sumReportRow(
  totals: FinancialTotals,
  row: ApprovedReportRow,
  extras?: {
    tableWithdrawals?: number
    serviceKwotowy?: number
    representacja1?: number
  }
): void {
  totals.reportCount += 1
  totals.grossSales += n(row.total_sale_gross)
  totals.grossRevenue += n(row.gross_revenue)
  totals.netRevenue += n(row.net_revenue)
  totals.card1 += n(row.card_1)
  totals.card2 += n(row.card_2)
  totals.cash += n(row.cash)
  totals.flavor += n(row.flavor)
  totals.cashDeposits += n(row.cash_deposits)
  totals.przelew += n(row.przelew)
  totals.glovo += n(row.glovo)
  totals.uber += n(row.uber)
  totals.wolt += n(row.wolt)
  totals.pyszne += n(row.pyszne)
  totals.bolt += n(row.bolt)
  totals.representacja2 += n(row.total_sale_with_special_payment)
  totals.staffCost += n(row.staff_cost)
  totals.staffSpent += n(row.staff_spent)
  totals.service10Percent += n(row.service_10_percent)
  totals.lockerWithdrawal += n(row.locker_withdrawal)
  totals.deposit += n(row.deposit)
  totals.drawer += n(row.drawer)
  totals.lineWithdrawals += n(row.withdrawal)
  totals.todaysCash += getTodaysCash({
    cash: n(row.cash),
    flavor: n(row.flavor),
    cash_deposits: n(row.cash_deposits),
    total_sale_with_special_payment: n(row.total_sale_with_special_payment),
  })

  if (extras?.tableWithdrawals) totals.tableWithdrawals += extras.tableWithdrawals
  if (extras?.serviceKwotowy) totals.serviceKwotowy += extras.serviceKwotowy
  if (extras?.representacja1) totals.representacja1 += extras.representacja1
}

export function finalizeFinancialTotals(totals: FinancialTotals): FinancialTotals {
  totals.cardsTotal = totals.card1 + totals.card2
  totals.deliveryAppsTotal =
    totals.przelew + totals.glovo + totals.uber + totals.wolt + totals.pyszne + totals.bolt
  return totals
}

export function buildPaymentMix(totals: FinancialTotals): PaymentMixRow[] {
  const base = [
    { key: 'card1', label: 'Card 1', amount: totals.card1 },
    { key: 'card2', label: 'Card 2', amount: totals.card2 },
    { key: 'cash', label: 'Cash', amount: totals.cash },
    { key: 'flavor', label: 'Flavor sold', amount: totals.flavor },
    { key: 'cashDeposits', label: 'Cash deposits', amount: totals.cashDeposits },
    { key: 'przelew', label: 'Przelew', amount: totals.przelew },
    { key: 'glovo', label: 'Glovo', amount: totals.glovo },
    { key: 'uber', label: 'Uber Eats', amount: totals.uber },
    { key: 'wolt', label: 'Wolt', amount: totals.wolt },
    { key: 'pyszne', label: 'Pyszne', amount: totals.pyszne },
    { key: 'bolt', label: 'Bolt Food', amount: totals.bolt },
    { key: 'representacja2', label: 'Representacja 2', amount: totals.representacja2 },
  ].filter((row) => row.amount > 0)

  const total = base.reduce((s, r) => s + r.amount, 0) || 1
  return base.map((row) => ({
    ...row,
    share: (row.amount / total) * 100,
  }))
}

export function buildOperatingCosts(totals: FinancialTotals) {
  return [
    { label: 'Withdrawals (line items)', amount: totals.tableWithdrawals },
    { label: 'Withdrawals (report field)', amount: totals.lineWithdrawals },
    { label: 'Staff cost', amount: totals.staffCost },
    { label: 'Staff spent', amount: totals.staffSpent },
    { label: 'Service 10%', amount: totals.service10Percent },
    { label: 'Service kwotowy', amount: totals.serviceKwotowy },
    { label: 'Representacja 1', amount: totals.representacja1 },
    { label: 'Locker withdrawal', amount: totals.lockerWithdrawal },
    { label: 'Deposits', amount: totals.deposit },
  ].filter((row) => row.amount > 0)
}

function periodKey(date: string, groupBy: AnalyticsGroupBy): string {
  const parsed = parseISO(date)
  if (groupBy === 'weekly') {
    return format(startOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  }
  if (groupBy === 'monthly') {
    return format(startOfMonth(parsed), 'yyyy-MM')
  }
  return date
}

export function aggregateFinancialByDate(
  rows: Array<{ date: string; totals: FinancialTotals }>,
  groupBy: AnalyticsGroupBy
): FinancialPeriodRow[] {
  const bucket = new Map<string, FinancialPeriodRow>()

  for (const row of rows) {
    const key = periodKey(row.date, groupBy)
    if (!bucket.has(key)) {
      bucket.set(key, { date: key, ...emptyFinancialTotals() })
    }
    const target = bucket.get(key)!
    const finalized = finalizeFinancialTotals({ ...row.totals })
    const keys = Object.keys(emptyFinancialTotals()) as Array<keyof FinancialTotals>
    for (const k of keys) {
      if (k === 'cardsTotal' || k === 'deliveryAppsTotal') continue
      ;(target[k] as number) += finalized[k] as number
    }
  }

  return Array.from(bucket.values())
    .map((row) => {
      const { date, ...totals } = row
      return { date, ...finalizeFinancialTotals(totals) }
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}
