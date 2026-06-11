'use client'

import { useState, useEffect, useMemo } from 'react'
import type { User, Venue } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import {
  defaultGroupByForRange,
  formatPeriodLabel,
  type AnalyticsGroupBy,
} from '@/lib/analytics-aggregation'
import type {
  FinancialPeriodRow,
  FinancialTotals,
  PaymentMixRow,
  VenueFinancialRow,
} from '@/lib/financial-report'
import { filterVenuesForUser, userHasFullVenueAccess } from '@/lib/venue-access'

type CashReportSummary = {
  reportCount: number
  totalOpening: number
  totalClosing: number
  totalIncome: number
  totalExpense: number
  netMovement: number
}

type OperatingCostRow = { label: string; amount: number }

interface FinancialReportData {
  periodStart?: string
  periodEnd?: string
  daysInRange?: number
  daysWithReportData?: number
  totalReports: number
  approvedReports: number
  pendingReports: number
  summary: FinancialTotals
  averages: {
    grossSales: number
    grossRevenue: number
    netRevenue: number
    todaysCash: number
  }
  paymentMix: PaymentMixRow[]
  operatingCosts: OperatingCostRow[]
  venueFinancial: VenueFinancialRow[]
  dailyFinancial: FinancialPeriodRow[]
  weeklyFinancial: FinancialPeriodRow[]
  monthlyFinancial: FinancialPeriodRow[]
  cashReportSummary: CashReportSummary
  // legacy
  totalGrossSales: number
  totalGrossRevenue: number
  totalNetRevenue: number
  totalWithdrawals: number
  totalTodaysCash?: number
}

interface AnalyticsContentProps {
  user: User
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(amount)
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`
}

const amountCell = 'text-right tabular-nums text-gray-900 font-medium'
const countCell = 'text-right tabular-nums text-gray-800'

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{value}</dd>
      {sub && <p className="mt-1 text-xs text-gray-500 tabular-nums">{sub}</p>}
    </div>
  )
}

function SectionTable({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500 mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  )
}

export default function AnalyticsContent({ user }: AnalyticsContentProps) {
  const [dateRange, setDateRange] = useState<
    'week' | 'month' | 'biweek' | 'quarter' | 'year' | 'last-year' | 'custom'
  >('month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<FinancialReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<AnalyticsGroupBy>('daily')

  const getDateRange = () => {
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (dateRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'biweek':
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      }
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'last-year':
        startDate = new Date(now.getFullYear() - 1, 0, 1)
        endDate = new Date(now.getFullYear() - 1, 11, 31)
        break
      case 'custom':
        if (!customStartDate || !customEndDate) {
          return { startDate: null, endDate: null }
        }
        startDate = new Date(customStartDate)
        endDate = new Date(customEndDate)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    return { startDate, endDate }
  }

  const fetchVenues = async () => {
    try {
      if (!supabase) throw new Error('Supabase client not configured')

      const { data, error: venueError } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (venueError) throw venueError

      const accessibleVenues = filterVenuesForUser(user, data ?? [])
      setVenues(accessibleVenues)

      if (!userHasFullVenueAccess(user)) {
        if (accessibleVenues.length === 1) {
          setSelectedVenueId(accessibleVenues[0].id)
        } else if (
          selectedVenueId !== 'all' &&
          !accessibleVenues.some((v) => v.id === selectedVenueId)
        ) {
          setSelectedVenueId(accessibleVenues[0]?.id ?? 'all')
        }
      }
    } catch (err) {
      console.error('Error fetching venues:', err)
    }
  }

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { startDate, endDate } = getDateRange()

      if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
        setError('Please select both start and end dates for custom range')
        setLoading(false)
        return
      }

      if (!startDate || !endDate) {
        setError('Please select a valid date range')
        setLoading(false)
        return
      }

      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          userId: user.id,
          userRole: user.role,
          venueId: selectedVenueId === 'all' ? null : selectedVenueId,
        }),
      })

      if (!response.ok) throw new Error('Failed to fetch financial report')

      const data = await response.json()
      setReportData(data)
    } catch (err: unknown) {
      console.error('Error fetching financial report:', err)
      setError(err instanceof Error ? err.message : 'Failed to load financial report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVenues()
  }, [user.role, user.venue_ids])

  useEffect(() => {
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
      setReportData(null)
      setError(null)
      setLoading(false)
      return
    }
    fetchReportData()
  }, [dateRange, customStartDate, customEndDate, selectedVenueId, user.id, user.role])

  useEffect(() => {
    const dayCount = reportData?.daysInRange ?? 30
    setGroupBy(defaultGroupByForRange(dateRange, dayCount))
  }, [dateRange, reportData?.periodStart, reportData?.periodEnd, reportData?.daysInRange])

  const periodSummaryLabel = useMemo(() => {
    if (!reportData?.periodStart || !reportData?.periodEnd) return ''
    const start = format(parseISO(reportData.periodStart), 'd MMM yyyy')
    const end = format(parseISO(reportData.periodEnd), 'd MMM yyyy')
    const venueLabel =
      selectedVenueId === 'all'
        ? 'All venues'
        : venues.find((v) => v.id === selectedVenueId)?.name ?? 'Selected venue'
    return `${start} – ${end} · ${venueLabel}`
  }, [reportData?.periodStart, reportData?.periodEnd, selectedVenueId, venues])

  const dateRangeLabels: Record<typeof dateRange, string> = {
    week: 'Last 7 days',
    biweek: 'Last 14 days',
    month: 'This month',
    quarter: 'This quarter',
    year: 'This year',
    'last-year': 'Last year',
    custom: 'Custom range',
  }

  const periodRows = useMemo(() => {
    if (!reportData) return []
    if (groupBy === 'weekly') return reportData.weeklyFinancial ?? []
    if (groupBy === 'monthly') return reportData.monthlyFinancial ?? []
    return reportData.dailyFinancial ?? []
  }, [reportData, groupBy])

  const formatPeriod = (dateString: string) => formatPeriodLabel(dateString, groupBy)

  const s = reportData?.summary
  const totalWithdrawals =
    (s?.tableWithdrawals ?? 0) + (s?.lineWithdrawals ?? 0)
  const totalOperatingCosts =
    reportData?.operatingCosts.reduce((sum, row) => sum + row.amount, 0) ?? 0

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error && dateRange !== 'custom') {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Report</h1>
          <p className="mt-2 text-gray-600">
            Revenue, payment channels, operating costs, and cash position — all numbers, no charts.
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filters</h2>

          <div className="mb-4">
            <label htmlFor="venue-select" className="block text-sm font-medium text-gray-700 mb-2">
              Venue
            </label>
            <select
              id="venue-select"
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
            >
              {userHasFullVenueAccess(user) && <option value="all">All Venues</option>}
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'week', label: 'Last 7 Days' },
                  { value: 'biweek', label: 'Last 14 Days' },
                  { value: 'month', label: 'This Month' },
                  { value: 'quarter', label: 'This Quarter' },
                  { value: 'year', label: 'This Year' },
                  { value: 'last-year', label: 'Last Year' },
                  { value: 'custom', label: 'Custom Range' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateRange(option.value as typeof dateRange)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      dateRange === option.value
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {dateRange === 'custom' && (
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start-date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="mt-1 block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end-date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="mt-1 block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {dateRange === 'custom' && (!customStartDate || !customEndDate) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-700">
              Please select both start and end dates above to view the financial report.
            </p>
          </div>
        )}

        {venues.length === 0 && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <p className="text-sm text-amber-900">
              No venues are assigned to your account. Ask an owner to assign locations in Admin → Users.
            </p>
          </div>
        )}

        {reportData && s && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-emerald-900">
                {dateRangeLabels[dateRange]} · {periodSummaryLabel}
              </p>
              <p className="text-xs text-emerald-800 mt-1">
                {reportData.approvedReports} approved EOD reports
                {reportData.pendingReports > 0 && ` · ${reportData.pendingReports} pending`}
                {reportData.daysWithReportData != null &&
                  ` · ${reportData.daysWithReportData} days with activity`}
              </p>
            </div>

            {/* P&L headline */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Revenue summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Gross sales" value={formatCurrency(s.grossSales)} />
                <MetricCard label="Gross revenue" value={formatCurrency(s.grossRevenue)} />
                <MetricCard label="Net revenue" value={formatCurrency(s.netRevenue)} />
                <MetricCard label="Today's cash" value={formatCurrency(s.todaysCash)} />
                <MetricCard
                  label="Avg gross revenue / day"
                  value={formatCurrency(reportData.averages.grossRevenue)}
                  sub={`over ${reportData.daysWithReportData ?? 0} active days`}
                />
                <MetricCard
                  label="Avg net revenue / day"
                  value={formatCurrency(reportData.averages.netRevenue)}
                />
                <MetricCard label="Total withdrawals" value={formatCurrency(totalWithdrawals)} />
                <MetricCard
                  label="Operating costs"
                  value={formatCurrency(totalOperatingCosts)}
                  sub="Staff, service, representacja, locker, deposits"
                />
              </div>
            </div>

            {/* Payment channels */}
            <SectionTable
              title="Payment channels"
              description="How revenue came in — share of total payment mix"
            >
              <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-900">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Channel</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.paymentMix.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-2 text-gray-900">{row.label}</td>
                      <td className={`px-4 py-2 ${amountCell}`}>{formatCurrency(row.amount)}</td>
                      <td className={`px-4 py-2 ${countCell}`}>{formatPct(row.share)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-900">Cards total</td>
                    <td className={`px-4 py-2 ${amountCell}`}>{formatCurrency(s.cardsTotal)}</td>
                    <td className="px-4 py-2" />
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-900">Delivery apps total</td>
                    <td className={`px-4 py-2 ${amountCell}`}>
                      {formatCurrency(s.deliveryAppsTotal)}
                    </td>
                    <td className="px-4 py-2" />
                  </tr>
                </tbody>
              </table>
            </SectionTable>

            {/* Delivery breakdown */}
            <SectionTable title="Delivery platforms">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Glovo', 'Uber Eats', 'Wolt', 'Pyszne', 'Bolt Food', 'Przelew'].map((h) => (
                      <th key={h} className="px-4 py-2 text-right font-medium text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[s.glovo, s.uber, s.wolt, s.pyszne, s.bolt, s.przelew].map((val, i) => (
                      <td key={i} className={`px-4 py-2 ${amountCell}`}>
                        {formatCurrency(val)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </SectionTable>

            {/* Operating costs */}
            {reportData.operatingCosts.length > 0 && (
              <SectionTable title="Operating costs & deductions">
              <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-900">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Category</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.operatingCosts.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2 text-gray-900">{row.label}</td>
                      <td className={`px-4 py-2 ${amountCell}`}>{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-900">Total</td>
                    <td className={`px-4 py-2 ${amountCell}`}>
                      {formatCurrency(totalOperatingCosts)}
                    </td>
                  </tr>
                </tbody>
              </table>
              </SectionTable>
            )}

            {/* Cash position */}
            {reportData.cashReportSummary.reportCount > 0 && (
              <SectionTable
                title="Cash reports"
                description={`${reportData.cashReportSummary.reportCount} cash reports in this period`}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <MetricCard
                    label="Opening cash"
                    value={formatCurrency(reportData.cashReportSummary.totalOpening)}
                  />
                  <MetricCard
                    label="Closing cash"
                    value={formatCurrency(reportData.cashReportSummary.totalClosing)}
                  />
                  <MetricCard
                    label="Net movement"
                    value={formatCurrency(reportData.cashReportSummary.netMovement)}
                    sub={`Income ${formatCurrency(reportData.cashReportSummary.totalIncome)} · Expense ${formatCurrency(reportData.cashReportSummary.totalExpense)}`}
                  />
                </div>
              </SectionTable>
            )}

            {/* Cash drawer from EOD */}
            <SectionTable title="Cash & drawer (from EOD reports)">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Cash', 'Cash deposits', 'Flavor sold', 'Drawer', 'Locker withdrawal'].map(
                      (h) => (
                        <th key={h} className="px-4 py-2 text-right font-medium text-gray-500">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[s.cash, s.cashDeposits, s.flavor, s.drawer, s.lockerWithdrawal].map(
                      (val, i) => (
                        <td key={i} className={`px-4 py-2 ${amountCell}`}>
                          {formatCurrency(val)}
                        </td>
                      )
                    )}
                  </tr>
                </tbody>
              </table>
            </SectionTable>

            {/* By venue */}
            {selectedVenueId === 'all' && (reportData.venueFinancial?.length ?? 0) > 0 && (
              <SectionTable title="By venue">
                <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-900">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Venue</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Reports</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Gross sales</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Gross rev.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Net rev.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Cards</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Cash</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Delivery</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Withdrawals</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Today&apos;s cash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.venueFinancial.map((row) => (
                      <tr key={row.venueId}>
                        <td className="px-3 py-2 font-medium text-gray-900">{row.venueName}</td>
                        <td className={`px-3 py-2 ${countCell}`}>{row.reportCount}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.grossSales)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.grossRevenue)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.netRevenue)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.cardsTotal)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.cash)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>
                          {formatCurrency(row.deliveryAppsTotal)}
                        </td>
                        <td className={`px-3 py-2 ${amountCell}`}>
                          {formatCurrency(row.tableWithdrawals + row.lineWithdrawals)}
                        </td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.todaysCash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionTable>
            )}

            {/* Period detail */}
            <div className="bg-white shadow rounded-lg p-6 overflow-x-auto">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Period breakdown</h2>
                <div className="flex gap-2">
                  {([
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setGroupBy(option.value)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                        groupBy === option.value
                          ? 'bg-slate-800 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {periodRows.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-900">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50">
                        Period
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Reports</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Gross sales</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Gross rev.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Net rev.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Card 1</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Card 2</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Cash</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Delivery</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Withdrawals</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Staff cost</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Today&apos;s cash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[...periodRows].reverse().map((row) => (
                      <tr key={row.date}>
                        <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                          {formatPeriod(row.date)}
                        </td>
                        <td className={`px-3 py-2 ${countCell}`}>{row.reportCount}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.grossSales)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.grossRevenue)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.netRevenue)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.card1)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.card2)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.cash)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>
                          {formatCurrency(row.deliveryAppsTotal)}
                        </td>
                        <td className={`px-3 py-2 ${amountCell}`}>
                          {formatCurrency(row.tableWithdrawals + row.lineWithdrawals)}
                        </td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.staffCost)}</td>
                        <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(row.todaysCash)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2 text-gray-900 sticky left-0 bg-gray-50">Total</td>
                      <td className={`px-3 py-2 ${countCell}`}>{s.reportCount}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.grossSales)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.grossRevenue)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.netRevenue)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.card1)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.card2)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.cash)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>
                        {formatCurrency(s.deliveryAppsTotal)}
                      </td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(totalWithdrawals)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.staffCost)}</td>
                      <td className={`px-3 py-2 ${amountCell}`}>{formatCurrency(s.todaysCash)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="text-sm text-gray-500">No approved reports in this period.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
