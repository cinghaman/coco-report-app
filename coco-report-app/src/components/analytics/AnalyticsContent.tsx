'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { User, Venue } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  Brush,
  ReferenceLine
} from 'recharts'
// import { FixedSizeList as List } from 'react-window'
import { format, startOfDay, endOfDay, subDays, subMonths, subYears } from 'date-fns'

interface AnalyticsData {
  totalGrossSales: number
  totalWithdrawals: number
  totalTips: number
  totalVoids: number
  totalLoss: number
  averageDailySales: number
  averageDailyWithdrawals: number
  totalReports: number
  approvedReports: number
  pendingReports: number
  dailyData: Array<{
    date: string
    gross_sales: number
    withdrawals: number
    tips: number
    voids: number
    loss: number
  }>
}

interface AnalyticsContentProps {
  user: User
}

export default function AnalyticsContent({ user }: AnalyticsContentProps) {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'biweek' | 'quarter' | 'custom'>('month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all')
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('line')
  
  // Performance and responsiveness state
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('day')
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [isVirtualized, setIsVirtualized] = useState(false)
  const [aggregationLevel, setAggregationLevel] = useState<'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly'>('daily')
  
  // Refs for performance
  const chartRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

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
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
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

  const fetchVenues = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      // Filter venues based on user access
      const accessibleVenues = data?.filter(venue => 
        user.role === 'admin' || user.venue_ids.includes(venue.id)
      ) || []

      setVenues(accessibleVenues)
    } catch (error) {
      console.error('Error fetching venues:', error)
    }
  }, [user.role, user.venue_ids])

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { startDate, endDate } = getDateRange()
      
      // For custom date range, check if dates are selected
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          userId: user.id,
          userRole: user.role,
          venueId: selectedVenueId === 'all' ? null : selectedVenueId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const data = await response.json()
      setAnalyticsData(data)
    } catch (error: unknown) {
      console.error('Error fetching analytics:', error)
      setError(error instanceof Error ? error.message : 'Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }, [dateRange, customStartDate, customEndDate, selectedVenueId, user.id, user.role])

  useEffect(() => {
    fetchVenues()
  }, [])

  useEffect(() => {
    // Don't fetch if custom date range is selected but dates are not complete
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
      setAnalyticsData(null)
      setError(null) // Clear error when custom range is selected but dates not complete
      setLoading(false)
      return
    }
    
    fetchAnalyticsData()
  }, [dateRange, customStartDate, customEndDate, selectedVenueId])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  // Smart data aggregation based on dataset size
  const getOptimalAggregation = useCallback((dataLength: number) => {
    if (dataLength <= 100) return 'raw'
    if (dataLength <= 500) return 'daily'
    if (dataLength <= 2000) return 'weekly'
    return 'monthly'
  }, [])

  // Intelligent pagination based on data size
  const getOptimalPageSize = useCallback((dataLength: number) => {
    if (dataLength <= 100) return dataLength
    if (dataLength <= 1000) return 50
    if (dataLength <= 10000) return 100
    return 200
  }, [])

  // Data virtualization threshold
  const shouldVirtualize = useCallback((dataLength: number) => {
    return dataLength > 1000
  }, [])

  // Smart data aggregation function
  const aggregateData = useCallback((data: any[], level: string) => {
    if (level === 'raw' || data.length <= 100) return data

    const grouped = new Map()
    
    data.forEach(item => {
      let key: string
      const date = new Date(item.date)
      
      switch (level) {
        case 'hourly':
          key = format(date, 'yyyy-MM-dd HH:00')
          break
        case 'daily':
          key = format(date, 'yyyy-MM-dd')
          break
        case 'weekly':
          const weekStart = startOfDay(subDays(date, date.getDay()))
          key = format(weekStart, 'yyyy-MM-dd')
          break
        case 'monthly':
          key = format(date, 'yyyy-MM')
          break
        default:
          key = format(date, 'yyyy-MM-dd')
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          gross_sales: 0,
          tips: 0,
          voids: 0,
          loss: 0,
          withdrawals: 0,
          count: 0
        })
      }

      const group = grouped.get(key)
      group.gross_sales += Number(item.gross_sales) || 0
      group.tips += Number(item.tips) || 0
      group.voids += Number(item.voids) || 0
      group.loss += Number(item.loss) || 0
      group.withdrawals += Number(item.withdrawals) || 0
      group.count += 1
    })

    return Array.from(grouped.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [])

  // Optimized chart data with memoization
  const optimizedChartData = useMemo(() => {
    if (!analyticsData?.dailyData) return []

    const rawData = analyticsData.dailyData
    const optimalAggregation = getOptimalAggregation(rawData.length)
    const aggregatedData = aggregateData(rawData, optimalAggregation)
    
    // Update aggregation level if changed
    if (optimalAggregation !== aggregationLevel) {
      setAggregationLevel(optimalAggregation)
    }

    // Determine if we should virtualize
    const shouldUseVirtualization = shouldVirtualize(aggregatedData.length)
    if (shouldUseVirtualization !== isVirtualized) {
      setIsVirtualized(shouldUseVirtualization)
    }

    // Set optimal page size
    const optimalPageSize = getOptimalPageSize(aggregatedData.length)
    if (optimalPageSize !== itemsPerPage) {
      setItemsPerPage(optimalPageSize)
    }

    return aggregatedData
  }, [analyticsData?.dailyData, getOptimalAggregation, aggregateData, aggregationLevel, isVirtualized, itemsPerPage])

  // Paginated data for large datasets
  const paginatedData = useMemo(() => {
    if (!isVirtualized) return optimizedChartData
    
    const startIndex = currentPage * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return optimizedChartData.slice(startIndex, endIndex)
  }, [optimizedChartData, isVirtualized, currentPage, itemsPerPage])

  // Total pages calculation
  const totalPages = useMemo(() => {
    return isVirtualized ? Math.ceil(optimizedChartData.length / itemsPerPage) : 1
  }, [optimizedChartData.length, isVirtualized, itemsPerPage])

  // Pagination handlers
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)))
  }, [totalPages])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }, [currentPage, totalPages])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }, [currentPage])

  // Performance monitoring
  const [renderTime, setRenderTime] = useState(0)
  const [dataSize, setDataSize] = useState(0)

  // Update performance metrics
  useEffect(() => {
    if (analyticsData?.dailyData) {
      setDataSize(analyticsData.dailyData.length)
      const startTime = performance.now()
      // Simulate render time calculation
      setTimeout(() => {
        const endTime = performance.now()
        setRenderTime(endTime - startTime)
      }, 0)
    }
  }, [analyticsData?.dailyData])

  // Chart colors
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  // Prepare pie chart data
  const getPieChartData = () => {
    if (!analyticsData) return []
    return [
      { name: 'Sales', value: analyticsData.totalGrossSales, color: '#10b981' },
      { name: 'Tips', value: analyticsData.totalTips, color: '#f59e0b' },
      { name: 'Withdrawals', value: analyticsData.totalWithdrawals, color: '#ef4444' },
      { name: 'Loss', value: analyticsData.totalLoss, color: '#8b5cf6' },
    ].filter(item => item.value > 0)
  }

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error && dateRange !== 'custom') {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-gray-600">
            View sales, withdrawals, and performance metrics across different time periods.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filters</h2>
          
          {/* Venue Selector */}
          <div className="mb-4">
            <label htmlFor="venue-select" className="block text-sm font-medium text-gray-700 mb-2">
              Venue
            </label>
            <select
              id="venue-select"
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
            >
              <option value="all">All Venues</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="flex flex-wrap gap-4 items-center">
            <div className="flex space-x-2">
              {[
                { value: 'week', label: 'Last 7 Days' },
                { value: 'biweek', label: 'Last 14 Days' },
                { value: 'month', label: 'This Month' },
                { value: 'quarter', label: 'This Quarter' },
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
              <div className="flex space-x-4 items-center">
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
                  />
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Custom Date Range Message */}
        {dateRange === 'custom' && (!customStartDate || !customEndDate) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-8">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Select Date Range</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Please select both start and end dates above to view analytics data.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        {analyticsData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Gross Sales</dt>
                        <dd className="text-lg font-medium text-gray-900">{formatCurrency(analyticsData.totalGrossSales)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Withdrawals</dt>
                        <dd className="text-lg font-medium text-gray-900">{formatCurrency(analyticsData.totalWithdrawals)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Tips</dt>
                        <dd className="text-lg font-medium text-gray-900">{formatCurrency(analyticsData.totalTips)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Loss</dt>
                        <dd className="text-lg font-medium text-gray-900">{formatCurrency(analyticsData.totalLoss)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Average Daily Sales</dt>
                        <dd className="text-lg font-medium text-gray-900">{formatCurrency(analyticsData.averageDailySales)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Average Daily Withdrawals</dt>
                        <dd className="text-lg font-medium text-gray-900">{formatCurrency(analyticsData.averageDailyWithdrawals)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Reports Status</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {analyticsData.approvedReports}/{analyticsData.totalReports} Approved
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Controls */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">Analytics Charts</h2>
                <div className="flex space-x-2">
                  {[
                    { value: 'line', label: 'Line Chart', icon: '📈' },
                    { value: 'bar', label: 'Bar Chart', icon: '📊' },
                    { value: 'pie', label: 'Pie Chart', icon: '🥧' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setChartType(option.value as typeof chartType)}
                      className={`px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${
                        chartType === option.value
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Performance Info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span>Data Points: {dataSize.toLocaleString()}</span>
                  <span>Aggregation: {aggregationLevel}</span>
                  <span>Virtualization: {isVirtualized ? 'Enabled' : 'Disabled'}</span>
                  <span>Render Time: {renderTime.toFixed(1)}ms</span>
                  {isVirtualized && (
                    <span>Page: {currentPage + 1} of {totalPages}</span>
                  )}
                </div>
              </div>

              {/* Pagination Controls for Large Datasets */}
              {isVirtualized && totalPages > 1 && (
                <div className="mb-4 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 0}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Showing {currentPage * itemsPerPage + 1}-{Math.min((currentPage + 1) * itemsPerPage, optimizedChartData.length)} of {optimizedChartData.length}
                    </span>
                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages - 1}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Items per page:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value))
                        setCurrentPage(0)
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'pie' ? (
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getPieChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} zł`} />
                      <Legend />
                    </PieChart>
                  ) : chartType === 'bar' ? (
                    <BarChart data={paginatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={formatDate}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tickFormatter={(value) => `${value} zł`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="gross_sales" fill="#10b981" name="Sales" />
                      <Bar dataKey="tips" fill="#f59e0b" name="Tips" />
                      <Bar dataKey="withdrawals" fill="#ef4444" name="Withdrawals" />
                      {isVirtualized && <Brush dataKey="date" height={30} />}
                    </BarChart>
                  ) : (
                    <LineChart data={paginatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={formatDate}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tickFormatter={(value) => `${value} zł`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="gross_sales" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        name="Sales"
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="tips" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        name="Tips"
                        dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="withdrawals" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        name="Withdrawals"
                        dot={{ fill: '#ef4444', strokeWidth: 2, r: 3 }}
                      />
                      {isVirtualized && <Brush dataKey="date" height={30} />}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
