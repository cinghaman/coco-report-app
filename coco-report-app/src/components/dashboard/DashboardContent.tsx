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
    totalSales: number
  }>>({})
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalReports, setTotalReports] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const reportsPerPage = 10

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)

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
        totalSales: number
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

        // Get total sales for approved reports only
        const { data: salesData, error: salesError } = await supabase
          .from('daily_reports')
          .select('total_sale_gross')
          .eq('venue_id', venue.id)
          .eq('status', 'approved')

        if (salesError) throw salesError

        const totalSales = salesData?.reduce((sum, r) => sum + (r.total_sale_gross || 0), 0) || 0

        venueStatsMap[venue.id] = {
          totalReports: totalReports || 0,
          approvedReports: approvedReports || 0,
          totalSales
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'locked': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
            const stats = venueStats[venue.id] || { totalReports: 0, approvedReports: 0, totalSales: 0 }
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
                      <div className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(stats.totalSales)}
                      </div>
                      <div className="text-sm text-gray-500">Total Sales</div>
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
              <li key={report.id}>
                <Link href={`/reports/${report.id}`} className="block hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
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
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(report.total_sale_gross)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {report.cash > 0 && `${formatCurrency(report.cash)} cash`}
                        </div>
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

    </div>
  )
}
