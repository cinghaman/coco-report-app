import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cache, generateCacheKey } from '@/lib/cache'

// Updated analytics API with enhanced error handling and revenue reporting

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

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

    if (analyticsError) {
      console.error('Analytics function error:', analyticsError)
      throw analyticsError
    }

    const analytics = analyticsData?.[0]
    if (!analytics) {
      console.log('No analytics data returned for date range:', startDate, 'to', endDate)
      // Return empty data structure instead of throwing error
      const result = {
        totalGrossSales: 0,
        totalWithdrawals: 0,
        totalTips: 0,
        totalVoids: 0,
        totalLoss: 0,
        averageDailySales: 0,
        averageDailyWithdrawals: 0,
        totalGrossRevenue: 0,
        totalNetRevenue: 0,
        averageDailyGrossRevenue: 0,
        averageDailyNetRevenue: 0,
        totalReports: 0,
        approvedReports: 0,
        pendingReports: 0,
        dailyData: []
      }
      return NextResponse.json(result)
    }

    const totalGrossSales = Number(analytics.total_gross_sales) || 0
    const totalTips = Number(analytics.total_tips) || 0
    const totalVoids = Number(analytics.total_voids) || 0
    const totalLoss = Number(analytics.total_loss) || 0
    const totalReports = Number(analytics.total_reports) || 0
    const approvedReportsCount = Number(analytics.approved_reports) || 0
    const pendingReports = Number(analytics.pending_reports) || 0
    const totalGrossRevenue = Number(analytics.total_gross_revenue) || 0
    const totalNetRevenue = Number(analytics.total_net_revenue) || 0

    // Get daily data using optimized function
    const { data: dailyAnalyticsData, error: dailyAnalyticsError } = await supabaseAdmin
      .rpc('get_daily_analytics_data', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_venue_id: venueId || null
      })

    if (dailyAnalyticsError) {
      console.error('Daily analytics function error:', dailyAnalyticsError)
      throw dailyAnalyticsError
    }

    // Calculate total withdrawals from daily data
    const totalWithdrawals = dailyAnalyticsData?.reduce((sum: number, day: { withdrawals: number }) => sum + (Number(day.withdrawals) || 0), 0) || 0

    // Calculate averages based on actual days with data, not total date range
    const daysWithData = dailyAnalyticsData?.filter((day: { gross_sales: number }) => Number(day.gross_sales) > 0).length || 1
    const averageDailySales = totalGrossSales / daysWithData
    const averageDailyWithdrawals = totalWithdrawals / daysWithData
    const averageDailyGrossRevenue = totalGrossRevenue / daysWithData
    const averageDailyNetRevenue = totalNetRevenue / daysWithData

    // Prepare daily data for charts
    const dailyDataMap = new Map<string, {
      date: string
      gross_sales: number
      withdrawals: number
      tips: number
      voids: number
      loss: number
      gross_revenue: number
      net_revenue: number
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
        loss: 0,
        gross_revenue: 0,
        net_revenue: 0
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Populate daily data from database function results
    dailyAnalyticsData?.forEach((day: { date: string; gross_sales: number; tips: number; voids: number; loss: number; withdrawals: number; gross_revenue: number; net_revenue: number }) => {
      const dateStr = day.date
      const dayData = dailyDataMap.get(dateStr)
      if (dayData) {
        dayData.gross_sales = Number(day.gross_sales) || 0
        dayData.tips = Number(day.tips) || 0
        dayData.voids = Number(day.voids) || 0
        dayData.loss = Number(day.loss) || 0
        dayData.withdrawals = Number(day.withdrawals) || 0
        dayData.gross_revenue = Number(day.gross_revenue) || 0
        dayData.net_revenue = Number(day.net_revenue) || 0
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
      totalGrossRevenue,
      totalNetRevenue,
      averageDailyGrossRevenue,
      averageDailyNetRevenue,
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
