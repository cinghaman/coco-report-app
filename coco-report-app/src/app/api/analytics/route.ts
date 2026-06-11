import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cache, generateCacheKey } from '@/lib/cache'
import { aggregateAnalyticsByPeriod } from '@/lib/analytics-aggregation'
import {
  aggregateFinancialByDate,
  buildOperatingCosts,
  buildPaymentMix,
  emptyFinancialTotals,
  finalizeFinancialTotals,
  sumReportRow,
  type ApprovedReportRow,
  type FinancialPeriodRow,
  type VenueFinancialRow,
} from '@/lib/financial-report'
import { netFromLines } from '@/lib/cash-report'

function toDateOnly(isoOrDate: string): string {
  if (isoOrDate.includes('T')) return isoOrDate.split('T')[0]
  return isoOrDate.slice(0, 10)
}

const REPORT_FIELDS = `
  id, for_date, venue_id, status,
  total_sale_gross, gross_revenue, net_revenue,
  card_1, card_2, cash, flavor, cash_deposits,
  przelew, glovo, uber, wolt, pyszne, bolt,
  total_sale_with_special_payment,
  staff_cost, staff_spent, service_10_percent,
  locker_withdrawal, deposit, drawer, withdrawal
`

export async function POST(request: NextRequest) {
  try {
    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const { startDate, endDate, userId, userRole, venueId } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 })
    }

    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Access denied. Only administrators can view analytics.' }, { status: 403 })
    }

    const { data: requester, error: requesterError } = await admin
      .from('users')
      .select('id, role, venue_ids')
      .eq('id', userId)
      .single()

    if (requesterError || !requester) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 })
    }

    if (requester.role !== userRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const scopedVenueIds: string[] | null =
      requester.role === 'owner' ? null : (requester.venue_ids ?? [])

    if (scopedVenueIds && scopedVenueIds.length === 0) {
      return NextResponse.json({ error: 'No venues assigned to this account' }, { status: 403 })
    }

    let effectiveVenueId: string | null = venueId || null
    if (effectiveVenueId && scopedVenueIds && !scopedVenueIds.includes(effectiveVenueId)) {
      return NextResponse.json({ error: 'Access denied for this venue' }, { status: 403 })
    }

    const startStr = toDateOnly(startDate)
    const endStr = toDateOnly(endDate)

    const cacheKey = generateCacheKey('financial-report-v3', {
      startDate: startStr,
      endDate: endStr,
      userId,
      venueId: effectiveVenueId || (scopedVenueIds ? scopedVenueIds.join(',') : 'all'),
    })

    const cached = cache.get(cacheKey)
    if (cached) return NextResponse.json(cached)

    const PAGE = 1000
    let offset = 0
    const reports: Array<ApprovedReportRow & { id: string; venue_id: string; status: string }> = []

    for (;;) {
      let q = admin
        .from('daily_reports')
        .select(REPORT_FIELDS)
        .gte('for_date', startStr)
        .lte('for_date', endStr)
        .eq('status', 'approved')
        .order('for_date')
        .range(offset, offset + PAGE - 1)

      if (effectiveVenueId) {
        q = q.eq('venue_id', effectiveVenueId)
      } else if (scopedVenueIds) {
        q = q.in('venue_id', scopedVenueIds)
      }

      const { data, error } = await q
      if (error) throw error
      if (!data?.length) break
      reports.push(...(data as typeof reports))
      if (data.length < PAGE) break
      offset += PAGE
    }

    const reportIds = reports.map((r) => r.id)
    const extrasByReport = new Map<
      string,
      { tableWithdrawals: number; serviceKwotowy: number; representacja1: number }
    >()

    for (const id of reportIds) {
      extrasByReport.set(id, { tableWithdrawals: 0, serviceKwotowy: 0, representacja1: 0 })
    }

    const loadExtras = async (
      table: 'report_withdrawals' | 'report_service_kwotowy' | 'report_representacja_1',
      field: 'tableWithdrawals' | 'serviceKwotowy' | 'representacja1'
    ) => {
      if (!reportIds.length) return
      const CHUNK = 200
      for (let i = 0; i < reportIds.length; i += CHUNK) {
        const chunk = reportIds.slice(i, i + CHUNK)
        const { data, error } = await admin
          .from(table)
          .select('report_id, amount')
          .in('report_id', chunk)
        if (error) throw error
        for (const row of data ?? []) {
          const entry = extrasByReport.get(row.report_id)
          if (entry) entry[field] += Number(row.amount) || 0
        }
      }
    }

    await Promise.all([
      loadExtras('report_withdrawals', 'tableWithdrawals'),
      loadExtras('report_service_kwotowy', 'serviceKwotowy'),
      loadExtras('report_representacja_1', 'representacja1'),
    ])

    const { data: venues } = await admin
      .from('venues')
      .select('id, name')
      .eq('is_active', true)

    const venueNames = new Map((venues ?? []).map((v) => [v.id, v.name]))

    const summary = emptyFinancialTotals()
    const byDate = new Map<string, ReturnType<typeof emptyFinancialTotals>>()
    const byVenue = new Map<string, ReturnType<typeof emptyFinancialTotals>>()

    for (const report of reports) {
      const extras = extrasByReport.get(report.id)
      sumReportRow(summary, report, extras)
      sumReportRow(
        byDate.get(report.for_date.slice(0, 10)) ?? (() => {
          const t = emptyFinancialTotals()
          byDate.set(report.for_date.slice(0, 10), t)
          return t
        })(),
        report,
        extras
      )
      sumReportRow(
        byVenue.get(report.venue_id) ?? (() => {
          const t = emptyFinancialTotals()
          byVenue.set(report.venue_id, t)
          return t
        })(),
        report,
        extras
      )
    }

    finalizeFinancialTotals(summary)

    const dailyFinancial: FinancialPeriodRow[] = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => ({
        date,
        ...finalizeFinancialTotals({ ...totals }),
      }))

    const toDateTotals = (r: FinancialPeriodRow) => {
      const { date, ...totals } = r
      return { date, totals }
    }

    const weeklyFinancial = aggregateFinancialByDate(
      dailyFinancial.map(toDateTotals),
      'weekly'
    )
    const monthlyFinancial = aggregateFinancialByDate(
      dailyFinancial.map(toDateTotals),
      'monthly'
    )

    const venueFinancial: VenueFinancialRow[] = Array.from(byVenue.entries())
      .map(([venueIdKey, totals]) => ({
        venueId: venueIdKey,
        venueName: venueNames.get(venueIdKey) ?? 'Unknown venue',
        ...finalizeFinancialTotals({ ...totals }),
      }))
      .sort((a, b) => a.venueName.localeCompare(b.venueName))

    if (!effectiveVenueId) {
      const visibleVenues =
        scopedVenueIds != null
          ? (venues ?? []).filter((v) => scopedVenueIds.includes(v.id))
          : (venues ?? [])
      for (const v of visibleVenues) {
        if (!byVenue.has(v.id)) {
          venueFinancial.push({
            venueId: v.id,
            venueName: v.name,
            ...emptyFinancialTotals(),
          })
        }
      }
      venueFinancial.sort((a, b) => a.venueName.localeCompare(b.venueName))
    }

    let totalReportsQuery = admin
      .from('daily_reports')
      .select('*', { count: 'exact', head: true })
      .gte('for_date', startStr)
      .lte('for_date', endStr)
    if (effectiveVenueId) {
      totalReportsQuery = totalReportsQuery.eq('venue_id', effectiveVenueId)
    } else if (scopedVenueIds) {
      totalReportsQuery = totalReportsQuery.in('venue_id', scopedVenueIds)
    }
    const { count: totalReports } = await totalReportsQuery

    let pendingReportsQuery = admin
      .from('daily_reports')
      .select('*', { count: 'exact', head: true })
      .gte('for_date', startStr)
      .lte('for_date', endStr)
      .in('status', ['draft', 'submitted'])
    if (effectiveVenueId) {
      pendingReportsQuery = pendingReportsQuery.eq('venue_id', effectiveVenueId)
    } else if (scopedVenueIds) {
      pendingReportsQuery = pendingReportsQuery.in('venue_id', scopedVenueIds)
    }
    const { count: pendingReports } = await pendingReportsQuery

    let cashReportSummary = {
      reportCount: 0,
      totalOpening: 0,
      totalClosing: 0,
      totalIncome: 0,
      totalExpense: 0,
      netMovement: 0,
    }

    let cashQ = admin
      .from('cash_reports')
      .select('id, cash_from_previous_day')
      .gte('for_date', startStr)
      .lte('for_date', endStr)

    if (effectiveVenueId) {
      cashQ = cashQ.eq('venue_id', effectiveVenueId)
    } else if (scopedVenueIds) {
      cashQ = cashQ.in('venue_id', scopedVenueIds)
    }

    const { data: cashReports } = await cashQ
    const cashIds = (cashReports ?? []).map((r) => r.id)

    if (cashIds.length > 0) {
      const { data: lines } = await admin
        .from('cash_report_lines')
        .select('cash_report_id, income, expense')
        .in('cash_report_id', cashIds)

      let totalIncome = 0
      let totalExpense = 0
      for (const line of lines ?? []) {
        totalIncome += Number(line.income) || 0
        totalExpense += Number(line.expense) || 0
      }

      let totalOpening = 0
      let totalClosing = 0
      for (const cr of cashReports ?? []) {
        const opening = Number(cr.cash_from_previous_day) || 0
        const reportLines = (lines ?? []).filter((l) => l.cash_report_id === cr.id)
        const closing = opening + netFromLines(reportLines)
        totalOpening += opening
        totalClosing += closing
      }

      cashReportSummary = {
        reportCount: cashIds.length,
        totalOpening,
        totalClosing,
        totalIncome,
        totalExpense,
        netMovement: totalIncome - totalExpense,
      }
    }

    const daysWithData = dailyFinancial.filter((d) => d.grossRevenue > 0).length || 1

    const legacyDaily = dailyFinancial.map((d) => ({
      date: d.date,
      gross_sales: d.grossSales,
      gross_revenue: d.grossRevenue,
      net_revenue: d.netRevenue,
      withdrawals: d.tableWithdrawals + d.lineWithdrawals,
      todays_cash: d.todaysCash,
      tips: 0,
      voids: 0,
      loss: 0,
    }))

    const result = {
      periodStart: startStr,
      periodEnd: endStr,
      daysInRange: legacyDaily.length,
      daysWithReportData: daysWithData,
      totalReports: totalReports ?? 0,
      approvedReports: summary.reportCount,
      pendingReports: pendingReports ?? 0,
      summary: finalizeFinancialTotals(summary),
      paymentMix: buildPaymentMix(summary),
      operatingCosts: buildOperatingCosts(summary),
      averages: {
        grossSales: summary.grossSales / daysWithData,
        grossRevenue: summary.grossRevenue / daysWithData,
        netRevenue: summary.netRevenue / daysWithData,
        todaysCash: summary.todaysCash / daysWithData,
      },
      venueFinancial,
      dailyFinancial,
      weeklyFinancial,
      monthlyFinancial,
      cashReportSummary,
      // legacy fields for any older consumers
      totalGrossSales: summary.grossSales,
      totalGrossRevenue: summary.grossRevenue,
      totalNetRevenue: summary.netRevenue,
      totalWithdrawals: summary.tableWithdrawals + summary.lineWithdrawals,
      totalTodaysCash: summary.todaysCash,
      dailyData: legacyDaily,
      weeklyData: aggregateAnalyticsByPeriod(legacyDaily, 'weekly'),
      monthlyData: aggregateAnalyticsByPeriod(legacyDaily, 'monthly'),
      venueBreakdown: venueFinancial.map((v) => ({
        venueId: v.venueId,
        venueName: v.venueName,
        totalGrossSales: v.grossSales,
        totalGrossRevenue: v.grossRevenue,
        totalNetRevenue: v.netRevenue,
        totalReports: v.reportCount,
        approvedReports: v.reportCount,
      })),
    }

    cache.set(cacheKey, result, 5 * 60 * 1000)
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error fetching financial report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch financial report' },
      { status: 500 }
    )
  }
}
