'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, DailyReport, Venue } from '@/lib/supabase'
import Link from 'next/link'

interface DashboardContentProps {
  user: User
}

export default function DashboardContent({ user }: DashboardContentProps) {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [venueStats, setVenueStats] = useState<Record<string, {
    totalReports: number
    approvedReports: number
    totalGrossRevenue: number
    totalNetRevenue: number
  }>>({})
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalReports, setTotalReports] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const reportsPerPage = 10

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; reportId: string | null; reportDate: string | null }>({
    show: false,
    reportId: null,
    reportDate: null
  })
  const [deleting, setDeleting] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)

      if (!supabase) {
        throw new Error('Supabase client not configured')
      }

      // Fetch venues
      const { data: allVenuesData, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (venuesError) throw venuesError

      // Filter venues based on user access
      const accessibleVenues = allVenuesData?.filter(venue => 
        user.role === 'admin' || user.venue_ids.includes(venue.id)
      ) || []

      setVenues(accessibleVenues)

      // Get total count of reports for pagination
      let countQuery = supabase
        .from('daily_reports')
        .select('*', { count: 'exact', head: true })

      // If user is not admin, filter by their accessible venues
      if (user.role !== 'admin') {
        countQuery = countQuery.in('venue_id', user.venue_ids)
      }

      const { count, error: countError } = await countQuery

      if (countError) throw countError
      setTotalReports(count || 0)
      setTotalPages(Math.ceil((count || 0) / reportsPerPage))

      // Fetch paginated reports
      const offset = (currentPage - 1) * reportsPerPage
      let reportsQuery = supabase
        .from('daily_reports')
        .select('*')
        .order('for_date', { ascending: false })
        .range(offset, offset + reportsPerPage - 1)

      // If user is not admin, filter by their accessible venues
      if (user.role !== 'admin') {
        reportsQuery = reportsQuery.in('venue_id', user.venue_ids)
      }

      const { data: reportsData, error: reportsError } = await reportsQuery

      if (reportsError) throw reportsError
      setReports(reportsData || [])

      // Calculate venue-specific stats using database aggregation for better performance
      const venueStatsMap: Record<string, {
        totalReports: number
        approvedReports: number
        totalGrossRevenue: number
        totalNetRevenue: number
      }> = {}

      // Use database aggregation for venue stats instead of fetching all reports
      for (const venue of accessibleVenues) {
        // Get count of total reports for this venue
        const { count: totalReports, error: totalError } = await supabase
          .from('daily_reports')
          .select('*', { count: 'exact', head: true })
          .eq('venue_id', venue.id)

        if (totalError) throw totalError

        // Get count of approved reports for this venue
        const { count: approvedReports, error: approvedError } = await supabase
          .from('daily_reports')
          .select('*', { count: 'exact', head: true })
          .eq('venue_id', venue.id)
          .eq('status', 'approved')

        if (approvedError) throw approvedError

        // Get gross and net revenue for approved reports only
        const { data: revenueData, error: revenueError } = await supabase
          .from('daily_reports')
          .select('gross_revenue, net_revenue')
          .eq('venue_id', venue.id)
          .eq('status', 'approved')

        if (revenueError) throw revenueError

        const totalGrossRevenue = revenueData?.reduce((sum, r) => sum + (r.gross_revenue || 0), 0) || 0
        const totalNetRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0

        venueStatsMap[venue.id] = {
          totalReports: totalReports || 0,
          approvedReports: approvedReports || 0,
          totalGrossRevenue,
          totalNetRevenue
        }
      }

      setVenueStats(venueStatsMap)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [user.role, user.venue_ids, currentPage])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL')
  }

  const calculateTotalCash = (report: DailyReport) => {
    // Calculate total service kwotowy (we'll need to fetch this data separately for accurate calculation)
    // For now, using service_10_percent as approximation
    const totalService = (report.service_10_percent || 0) * 0.75
    
    // Total Cash formula: Cash + Flavor + Cash Deposits + Representacja 2 + Drawer - Withdrawals - Total Service
    return (report.cash || 0) + 
           (report.flavor || 0) + 
           (report.cash_deposits || 0) + 
           (report.drawer || 0) + 
           (report.total_sale_with_special_payment || 0) - 
           (report.withdrawal || 0) - 
           totalService
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

  const handleDeleteClick = (e: React.MouseEvent, reportId: string, reportDate: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteConfirm({ show: true, reportId, reportDate })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.reportId) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/reports/${deleteConfirm.reportId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete report')
      }

      const result = await response.json()

      // Send email notification if provided
      if (result.emailNotification?.shouldSend) {
        try {
          const { to, subject, html } = result.emailNotification
          console.log('Sending deletion email notifications to:', Array.isArray(to) ? to : [to])
          
          // Use server-side API to send emails (avoids CORS issues)
          const emailResponse = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: Array.isArray(to) ? to : [to],
              subject: subject,
              html: html
            }),
          })

          const emailResult = await emailResponse.json()
          
          if (emailResponse.ok) {
            console.log('Deletion email notifications:', emailResult.message)
            if (emailResult.results) {
              emailResult.results.forEach((r: any) => {
                if (r.success) {
                  console.log(`✓ Deletion email sent to ${r.recipient}`)
                } else {
                  console.error(`✗ Failed to send deletion email to ${r.recipient}:`, r.error, r.status || '')
                }
              })
            }
          } else {
            console.error('Failed to send deletion email notifications:', emailResult)
            if (emailResult.config) {
              console.error('SMTP Config Status:', emailResult.config)
            }
          }
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError)
          // Don't fail the deletion if email fails
        }
      }

      // Refresh the reports list
      await fetchDashboardData()
      
      // Close confirmation dialog
      setDeleteConfirm({ show: false, reportId: null, reportDate: null })
    } catch (error) {
      console.error('Error deleting report:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete report')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, reportId: null, reportDate: null })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user.display_name || user.email}
          </p>
        </div>
      </div>

      {/* Venue Sales Cards - Admin only */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {venues.map((venue) => {
            const stats = venueStats[venue.id] || { totalReports: 0, approvedReports: 0, totalGrossRevenue: 0, totalNetRevenue: 0 }
            return (
              <div key={venue.id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-medium text-gray-900">{venue.name}</h3>
                        <p className="text-sm text-gray-500">
                          {stats.totalReports} reports • {stats.approvedReports} approved
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-emerald-600">
                        {formatCurrency(stats.totalGrossRevenue)} gross
                      </div>
                      <div className="text-lg font-semibold text-blue-600">
                        {formatCurrency(stats.totalNetRevenue)} net
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Reports */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Reports</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {user.role === 'admin' 
              ? 'Latest daily reports from all venues' 
              : 'Latest daily reports from your assigned venues'
            }
          </p>
        </div>
        <ul className="divide-y divide-gray-200">
          {reports.length === 0 ? (
            <li className="px-4 py-5 sm:px-6">
              <div className="text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No reports</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new report.</p>
                <div className="mt-6">
                  <Link
                    href="/reports/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
                  >
                    New Report
                  </Link>
                </div>
              </div>
            </li>
          ) : (
            reports.map((report) => (
              <li key={report.id} className="relative">
                <Link href={`/reports/${report.id}`} className="block hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(report.for_date)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {venues.find(v => v.id === report.venue_id)?.name || 'Unknown Venue'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(report.gross_revenue || 0)} gross
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatCurrency(report.net_revenue || 0)} net
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatCurrency(calculateTotalCash(report))} cash
                          </div>
                        </div>
                        {user.role === 'admin' && (
                          <button
                            onClick={(e) => handleDeleteClick(e, report.id, formatDate(report.for_date))}
                            className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete report"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(currentPage - 1) * reportsPerPage + 1}</span>
                {' '}to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * reportsPerPage, totalReports)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{totalReports}</span>
                {' '}results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === currentPage
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={handleDeleteCancel}>
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4 text-center">Delete Report</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 text-center">
                  Are you sure you want to delete the report for <strong>{deleteConfirm.reportDate}</strong>? 
                  This action cannot be undone and will remove all associated data.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 px-4 py-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
