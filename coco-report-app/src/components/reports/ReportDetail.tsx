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

export default function ReportDetail({ reportId, user }: ReportDetailProps) {
  const router = useRouter()
  const [report, setReport] = useState<DailyReport | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
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

      setReport(reportData)
      setVenue(reportData.venues)
      setWithdrawals(withdrawalsData || [])
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
              <dt className="text-sm font-medium text-gray-500">Delivery Platforms</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.glovo + report.uber + report.wolt + report.pyszne + report.bolt)}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Other Payments</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.przelew + report.total_sale_with_special_payment)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Cash Management */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Cash Management</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Cash flow and locker management
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Previous Day Cash</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.cash_previous_day)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
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
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Deposits</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.deposit)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Cash in Envelope (After Tips)</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.cash_in_envelope_after_tips)}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Left in Drawer</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.left_in_drawer)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Total Cash in Locker</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.total_cash_in_locker)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Tips</h3>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Tips (Cash)</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.tips_cash)}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Tips (Card)</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(report.tips_card)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Additional Information */}
      {(report.notes || report.representation_note) && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Additional Information</h3>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              {report.representation_note && (
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Representation Note</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {report.representation_note}
                  </dd>
                </div>
              )}
              {report.notes && (
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {report.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}


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
