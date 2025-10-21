'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User, DailyReport, Venue } from '@/lib/supabase'

interface ReportDetailProps {
  reportId: string
  user: User
}

interface Withdrawal {
  id: string
  amount: number
  reason: string
}

interface Representacja1 {
  id: string
  amount: number
  reason: string
}

interface ServiceKwotowy {
  id: string
  amount: number
  reason: string
}

interface Strata {
  id: string
  amount: number
  reason: string
}

export default function ReportDetail({ reportId, user }: ReportDetailProps) {
  const router = useRouter()
  const [report, setReport] = useState<DailyReport | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [representacja1, setRepresentacja1] = useState<Representacja1[]>([])
  const [serviceKwotowy, setServiceKwotowy] = useState<ServiceKwotowy[]>([])
  const [strata, setStrata] = useState<Strata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }
      
      const { data: reportData, error: reportError } = await supabase
        .from('daily_reports')
        .select(`
          *,
          venues!inner(*),
          created_by_user:users!daily_reports_created_by_fkey(
            display_name,
            email
          ),
          approved_by_user:users!daily_reports_approved_by_fkey(
            display_name,
            email
          )
        `)
        .eq('id', reportId)
        .single()

      if (reportError) throw reportError

      // Check if user can access this report
      if (reportData.created_by !== user.id && !hasRole(user.role, 'admin')) {
        // Check if user has access to this venue and report is approved/submitted
        if (!user.venue_ids.includes(reportData.venue_id) || 
            !['approved', 'submitted', 'locked'].includes(reportData.status)) {
          setError('You do not have permission to view this report')
          return
        }
      }

      // Fetch withdrawals for this report
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('report_withdrawals')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at')

      if (withdrawalsError) {
        console.error('Error fetching withdrawals:', withdrawalsError)
      }

      // Fetch representacja1 entries for this report
      const { data: representacja1Data, error: representacja1Error } = await supabase
        .from('report_representacja_1')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at')

      if (representacja1Error) {
        console.error('Error fetching representacja1:', representacja1Error)
      }

      // Fetch service_kwotowy entries for this report
      const { data: serviceKwotowyData, error: serviceKwotowyError } = await supabase
        .from('report_service_kwotowy')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at')

      if (serviceKwotowyError) {
        console.error('Error fetching service kwotowy:', serviceKwotowyError)
      }

      // Fetch strata entries for this report
      const { data: strataData, error: strataError } = await supabase
        .from('report_strata')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at')

      if (strataError) {
        console.error('Error fetching strata:', strataError)
      }

      setReport(reportData)
      setVenue(reportData.venues)
      setWithdrawals(withdrawalsData || [])
      setRepresentacja1(representacja1Data || [])
      setServiceKwotowy(serviceKwotowyData || [])
      setStrata(strataData || [])
    } catch (error) {
      console.error('Error fetching report:', error)
      setError('Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [reportId, user.id, user.role, user.venue_ids])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const hasRole = (userRole: string, requiredRole: string): boolean => {
    const roleHierarchy: Record<string, number> = {
      staff: 1,
      admin: 2,
      owner: 3
    }
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  }


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'locked': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const canEdit = () => {
    if (!report) return false
    // Admins can edit any report, staff can only edit their own drafts
    if (hasRole(user.role, 'admin')) return true
    return report.created_by === user.id && report.status === 'draft'
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Report not found</h3>
        <p className="mt-2 text-sm text-gray-500">The requested report could not be found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Daily Report - {venue?.name}
              </h2>
              <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V6a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 011-1h2a1 1 0 011 1v1" />
                  </svg>
                  {formatDate(report.for_date)}
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                    {report.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Created by {report.created_by_user?.display_name || report.created_by_user?.email || 'Unknown'}
                </div>
              </div>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
              <button
                onClick={() => router.back()}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Back
              </button>
              {canEdit() && (
                <button
                  onClick={() => router.push(`/reports/${reportId}/edit`)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Sales Summary</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Total sales and payment breakdown
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Total Sales (Gross)</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.total_sale_gross)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Card Payments</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.card_1 + report.card_2)}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Cash</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.cash)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Flavor</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.flavor || 0)}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Cash Deposits</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.cash_deposits)}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Drawer</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.drawer)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Delivery Platforms</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.glovo + report.uber + report.wolt + report.pyszne + report.bolt)}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Przelew</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.przelew)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Representacja 2</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.total_sale_with_special_payment)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Expenditure Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Expenditure</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Withdrawals and service costs
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Withdrawals</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {withdrawals.length > 0 ? (
                  <div className="space-y-2">
                    {withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="flex justify-between items-center">
                        <span>{formatCurrency(withdrawal.amount)}</span>
                        {withdrawal.reason && (
                          <span className="text-gray-500 text-xs">({withdrawal.reason})</span>
                        )}
                      </div>
                    ))}
                    <div className="border-t pt-2 font-medium">
                      Total: {formatCurrency(withdrawals.reduce((sum, w) => sum + w.amount, 0))}
                    </div>
                  </div>
                ) : (
                  formatCurrency(0)
                )}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Service (Kwotowy)</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {serviceKwotowy.length > 0 ? (
                  <div className="space-y-2">
                    {serviceKwotowy.map((service) => (
                      <div key={service.id} className="flex justify-between items-center">
                        <span>{formatCurrency(service.amount)}</span>
                        {service.reason && (
                          <span className="text-gray-500 text-xs">({service.reason})</span>
                        )}
                      </div>
                    ))}
                    <div className="border-t pt-2 font-medium">
                      Total: {formatCurrency(serviceKwotowy.reduce((sum, s) => sum + s.amount, 0))}
                    </div>
                  </div>
                ) : (
                  formatCurrency(0)
                )}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Service (10%)</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.service_10_percent)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Management Info Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Management Info</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Management-specific information
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Representacja 1</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {representacja1.length > 0 ? (
                  <div className="space-y-2">
                    {representacja1.map((item) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <span>{formatCurrency(item.amount)}</span>
                        {item.reason && (
                          <span className="text-gray-500 text-xs">({item.reason})</span>
                        )}
                      </div>
                    ))}
                    <div className="border-t pt-2 font-medium">
                      Total: {formatCurrency(representacja1.reduce((sum, r) => sum + r.amount, 0))}
                    </div>
                  </div>
                ) : (
                  formatCurrency(0)
                )}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Staff Spent</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.staff_spent)}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Strata</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {strata.length > 0 ? (
                  <div className="space-y-2">
                    {strata.map((item) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <span>{formatCurrency(item.amount)}</span>
                        {item.reason && (
                          <span className="text-gray-500 text-xs">({item.reason})</span>
                        )}
                      </div>
                    ))}
                    <div className="border-t pt-2 font-medium">
                      Total: {formatCurrency(strata.reduce((sum, s) => sum + s.amount, 0))}
                    </div>
                  </div>
                ) : (
                  formatCurrency(0)
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Mini Calculations Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Mini Calculations</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Auto-calculated summary values
          </p>
        </div>
        <div className="border-t border-gray-200 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Total Service */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-sm font-medium text-purple-700 mb-1">Total Service</div>
              <div className="text-xl font-bold text-purple-900">
                {formatCurrency((serviceKwotowy.reduce((sum, s) => sum + s.amount, 0) + report.service_10_percent) * 0.75)}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                (Service Kwotowy + Service 10%) × 0.75
              </div>
            </div>

            {/* Total Card Payment */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-700 mb-1">Total Card Payment</div>
              <div className="text-xl font-bold text-blue-900">
                {formatCurrency(report.card_1 + report.card_2)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Card 1 + Card 2
              </div>
            </div>

            {/* Total Cash */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-700 mb-1">Total Cash</div>
              <div className="text-xl font-bold text-green-900">
                {formatCurrency(
                  report.cash + (report.flavor || 0) + report.cash_deposits + report.total_sale_with_special_payment + report.drawer - 
                  withdrawals.reduce((sum, w) => sum + w.amount, 0) - 
                  ((serviceKwotowy.reduce((sum, s) => sum + s.amount, 0) + report.service_10_percent) * 0.75)
                )}
              </div>
              <div className="text-xs text-green-600 mt-1">
                Cash + Flavor + Cash Deposits + Representacja 2 + Drawer - Withdrawals - Total Service
              </div>
            </div>

            {/* Total Income from Delivery Apps */}
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="text-sm font-medium text-orange-700 mb-1">Total Income from Delivery Apps</div>
              <div className="text-xl font-bold text-orange-900">
                {formatCurrency(
                  (report.przelew + report.glovo + report.uber + report.wolt + report.pyszne + report.bolt) * 0.70
                )}
              </div>
              <div className="text-xs text-orange-600 mt-1">
                (Przelew + Glovo + Uber + Wolt + Pyszne + Bolt) × 0.70
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* End of Day Sales Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">End of Day Sales</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Revenue calculations and summaries
          </p>
        </div>
        <div className="border-t border-gray-200 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Gross Revenue */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-700 mb-1">Gross Revenue</div>
              <div className="text-xl font-bold text-green-900">
                {formatCurrency(report.gross_revenue || 0)}
              </div>
              <div className="text-xs text-green-600 mt-1">
                Total Card Payment + Total Income from Delivery + Representacja 2 + Cash + Cash Deposits
              </div>
            </div>

            {/* Net Revenue */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-700 mb-1">Net Revenue</div>
              <div className="text-xl font-bold text-blue-900">
                {formatCurrency(report.net_revenue || 0)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Gross Revenue - Total Withdrawals - Total Service
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Metadata */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Report Information</h3>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {report.created_at && formatDateTime(report.created_at)}
              </dd>
            </div>
            {report.submitted_at && (
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDateTime(report.submitted_at)}
                </dd>
              </div>
            )}
            {report.approved_at && (
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Approved</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDateTime(report.approved_at)} by {report.approved_by_user?.display_name || report.approved_by_user?.email || 'Unknown'}
                </dd>
              </div>
            )}
            {report.updated_at && report.updated_at !== report.created_at && (
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDateTime(report.updated_at)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}
