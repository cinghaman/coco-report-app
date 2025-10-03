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

    // Use database aggregation for better performance with large datasets
    let aggregateQuery = supabaseAdmin
      .from('daily_reports')
      .select(`
        status,
        total_sale_gross,
        tips_cash,
        tips_card,
        voids,
        strata_loss,
        total_cash_in_locker,
        for_date,
        venues!inner(name)
      `)
      .gte('for_date', startDate)
      .lte('for_date', endDate)

    // Handle venue filtering for admin users
    if (venueId) {
      aggregateQuery = aggregateQuery.eq('venue_id', venueId)
    }

    const { data: reports, error: reportsError } = await aggregateQuery

    if (reportsError) throw reportsError

    // Filter approved reports for financial calculations
    const approvedReports = reports?.filter(report => report.status === 'approved') || []
    
    // Calculate totals (only from approved reports for financial accuracy)
    const totalGrossSales = approvedReports?.reduce((sum, report) => sum + (report.total_sale_gross || 0), 0) || 0
    const totalTips = approvedReports?.reduce((sum, report) => sum + ((report.tips_cash || 0) + (report.tips_card || 0)), 0) || 0
    const totalVoids = approvedReports?.reduce((sum, report) => sum + (report.voids || 0), 0) || 0
    const totalLoss = approvedReports?.reduce((sum, report) => sum + (report.strata_loss || 0), 0) || 0

    // Calculate total withdrawals from the new withdrawals table
    const approvedReportIds = approvedReports?.map(r => r.id) || []
    let totalWithdrawals = 0
    if (approvedReportIds.length > 0) {
      const { data: withdrawalsData, error: withdrawalsError } = await supabaseAdmin
        .from('report_withdrawals')
        .select('amount')
        .in('report_id', approvedReportIds)
      
      if (!withdrawalsError && withdrawalsData) {
        totalWithdrawals = withdrawalsData.reduce((sum, w) => sum + (w.amount || 0), 0)
      }
    }

    // Calculate averages (based on approved reports only)
    const uniqueDays = new Set(approvedReports?.map(r => r.for_date) || []).size
    const averageDailySales = uniqueDays > 0 ? totalGrossSales / uniqueDays : 0
    const averageDailyWithdrawals = uniqueDays > 0 ? totalWithdrawals / uniqueDays : 0

    // Get total report counts (including pending)
    let totalReportsQuery = supabaseAdmin
      .from('daily_reports')
      .select('id, status, venue_id')
      .gte('for_date', startDate)
      .lte('for_date', endDate)

    // Apply same venue filtering to total reports query
    if (userRole === 'staff') {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('venue_ids')
        .eq('id', userId)
        .single()

      if (userData?.venue_ids && userData.venue_ids.length > 0) {
        if (venueId) {
          if (!userData.venue_ids.includes(venueId)) {
            return NextResponse.json({ error: 'Unauthorized venue access' }, { status: 403 })
          }
          totalReportsQuery = totalReportsQuery.eq('venue_id', venueId)
        } else {
          totalReportsQuery = totalReportsQuery.in('venue_id', userData.venue_ids)
        }
      } else {
        return NextResponse.json({
          totalGrossSales: 0,
          totalWithdrawals: 0,
          totalTips: 0,
          totalVoids: 0,
          totalLoss: 0,
          averageDailySales: 0,
          averageDailyWithdrawals: 0,
          totalReports: 0,
          approvedReports: 0,
          pendingReports: 0,
          dailyData: []
        })
      }
    } else if (userRole === 'admin' && venueId) {
      totalReportsQuery = totalReportsQuery.eq('venue_id', venueId)
    }

    const { data: allReports, error: allReportsError } = await totalReportsQuery

    if (allReportsError) throw allReportsError

    const totalReports = allReports?.length || 0
    const approvedReportsCount = allReports?.filter(r => r.status === 'approved').length || 0
    const pendingReports = allReports?.filter(r => r.status === 'draft' || r.status === 'submitted').length || 0

    // Create daily data for chart (only from approved reports)
    const dailyDataMap = new Map()
    
    // First, initialize daily data with report data
    approvedReports?.forEach(report => {
      const date = report.for_date
      if (!dailyDataMap.has(date)) {
        dailyDataMap.set(date, {
          date,
          gross_sales: 0,
          withdrawals: 0,
          tips: 0,
          voids: 0,
          loss: 0
        })
      }
      
      const dayData = dailyDataMap.get(date)
      dayData.gross_sales += report.total_sale_gross || 0
      dayData.tips += (report.tips_cash || 0) + (report.tips_card || 0)
      dayData.voids += report.voids || 0
      dayData.loss += report.strata_loss || 0
    })

    // Then, add withdrawals data
    if (approvedReportIds.length > 0) {
      const { data: withdrawalsData, error: withdrawalsError } = await supabaseAdmin
        .from('report_withdrawals')
        .select('amount, report_id')
        .in('report_id', approvedReportIds)
      
      if (!withdrawalsError && withdrawalsData) {
        // Create a map of report_id to date for quick lookup
        const reportDateMap = new Map()
        approvedReports?.forEach(report => {
          reportDateMap.set(report.id, report.for_date)
        })

        withdrawalsData.forEach(withdrawal => {
          const date = reportDateMap.get(withdrawal.report_id)
          if (date && dailyDataMap.has(date)) {
            const dayData = dailyDataMap.get(date)
            dayData.withdrawals += withdrawal.amount || 0
          }
        })
      }
    }

    const dailyData = Array.from(dailyDataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const analyticsData = {
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
    cache.set(cacheKey, analyticsData, 5 * 60 * 1000)

    return NextResponse.json(analyticsData)
  } catch (error: unknown) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}
