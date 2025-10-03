import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cache, generateCacheKey } from '@/lib/cache'

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, userId, userRole, venueId } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Only allow admin users to access analytics
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Only administrators can view analytics.' },
        { status: 403 }
      )
    }

    // Check cache first
    const cacheKey = generateCacheKey('analytics', {
      startDate,
      endDate,
      venueId: venueId || 'all'
    })
    
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Use optimized database functions for better performance with large datasets
    const { data: analyticsData, error: analyticsError } = await supabaseAdmin
      .rpc('get_analytics_data', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_venue_id: venueId || null
      })

    if (analyticsError) throw analyticsError

    const analytics = analyticsData?.[0]
    if (!analytics) {
      throw new Error('No analytics data returned')
    }

    const totalGrossSales = Number(analytics.total_gross_sales) || 0
    const totalTips = Number(analytics.total_tips) || 0
    const totalVoids = Number(analytics.total_voids) || 0
    const totalLoss = Number(analytics.total_loss) || 0
    const totalReports = Number(analytics.total_reports) || 0
    const approvedReportsCount = Number(analytics.approved_reports) || 0
    const pendingReports = Number(analytics.pending_reports) || 0

    // Get daily data using optimized function
    const { data: dailyAnalyticsData, error: dailyAnalyticsError } = await supabaseAdmin
      .rpc('get_daily_analytics_data', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_venue_id: venueId || null
      })

    if (dailyAnalyticsError) throw dailyAnalyticsError

    // Calculate total withdrawals from daily data
    const totalWithdrawals = dailyAnalyticsData?.reduce((sum: number, day: { withdrawals: number }) => sum + (Number(day.withdrawals) || 0), 0) || 0

    // Calculate averages based on actual days with data, not total date range
    const daysWithData = dailyAnalyticsData?.filter((day: { gross_sales: number }) => Number(day.gross_sales) > 0).length || 1
    const averageDailySales = totalGrossSales / daysWithData
    const averageDailyWithdrawals = totalWithdrawals / daysWithData

    // Prepare daily data for charts
    const dailyDataMap = new Map<string, {
      date: string
      gross_sales: number
      withdrawals: number
      tips: number
      voids: number
      loss: number
    }>()

    // Initialize daily data map with all dates in range
    const currentDate = new Date(startDate)
    const endDateTime = new Date(endDate)
    while (currentDate <= endDateTime) {
      const dateStr = currentDate.toISOString().split('T')[0]
      dailyDataMap.set(dateStr, {
        date: dateStr,
        gross_sales: 0,
        withdrawals: 0,
        tips: 0,
        voids: 0,
        loss: 0
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Populate daily data from database function results
    dailyAnalyticsData?.forEach((day: { date: string; gross_sales: number; tips: number; voids: number; loss: number; withdrawals: number }) => {
      const dateStr = day.date
      const dayData = dailyDataMap.get(dateStr)
      if (dayData) {
        dayData.gross_sales = Number(day.gross_sales) || 0
        dayData.tips = Number(day.tips) || 0
        dayData.voids = Number(day.voids) || 0
        dayData.loss = Number(day.loss) || 0
        dayData.withdrawals = Number(day.withdrawals) || 0
      }
    })

    const dailyData = Array.from(dailyDataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const result = {
      totalGrossSales,
      totalWithdrawals,
      totalTips,
      totalVoids,
      totalLoss,
      averageDailySales,
      averageDailyWithdrawals,
      totalReports,
      approvedReports: approvedReportsCount,
      pendingReports,
      dailyData
    }

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 5 * 60 * 1000)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}
