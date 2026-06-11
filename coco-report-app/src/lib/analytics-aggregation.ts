import {
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
} from 'date-fns'

export type AnalyticsPoint = {
  date: string
  gross_sales: number
  gross_revenue: number
  net_revenue: number
  withdrawals: number
  todays_cash: number
  tips: number
  voids: number
  loss: number
}

export type AnalyticsGroupBy = 'daily' | 'weekly' | 'monthly'

export function defaultGroupByForRange(
  range: 'week' | 'biweek' | 'month' | 'quarter' | 'year' | 'last-year' | 'custom',
  dayCount: number
): AnalyticsGroupBy {
  if (range === 'week' || range === 'biweek') return 'daily'
  if (range === 'month' || range === 'quarter') return 'weekly'
  if (range === 'year' || range === 'last-year') return 'monthly'
  if (dayCount <= 14) return 'daily'
  if (dayCount <= 120) return 'weekly'
  return 'monthly'
}

export function aggregateAnalyticsByPeriod(
  daily: AnalyticsPoint[],
  groupBy: AnalyticsGroupBy
): AnalyticsPoint[] {
  if (groupBy === 'daily') return daily

  const grouped = new Map<string, AnalyticsPoint>()

  for (const item of daily) {
    const date = parseISO(item.date)
    const key =
      groupBy === 'weekly'
        ? format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(startOfMonth(date), 'yyyy-MM')

    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        date: key,
        gross_sales: 0,
        gross_revenue: 0,
        net_revenue: 0,
        withdrawals: 0,
        todays_cash: 0,
        tips: 0,
        voids: 0,
        loss: 0,
      })
    }

    const bucket = grouped.get(key)!
    bucket.gross_sales += Number(item.gross_sales) || 0
    bucket.gross_revenue += Number(item.gross_revenue) || 0
    bucket.net_revenue += Number(item.net_revenue) || 0
    bucket.withdrawals += Number(item.withdrawals) || 0
    bucket.todays_cash += Number(item.todays_cash) || 0
    bucket.tips += Number(item.tips) || 0
    bucket.voids += Number(item.voids) || 0
    bucket.loss += Number(item.loss) || 0
  }

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
}

export function formatPeriodLabel(date: string, groupBy: AnalyticsGroupBy): string {
  const parsed = parseISO(groupBy === 'monthly' ? `${date}-01` : date)
  if (groupBy === 'monthly') return format(parsed, 'MMM yyyy')
  if (groupBy === 'weekly') return `Week of ${format(parsed, 'd MMM yyyy')}`
  return format(parsed, 'd MMM yyyy')
}
