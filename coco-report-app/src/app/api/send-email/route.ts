import { NextRequest, NextResponse } from 'next/server'
import { sendReportSubmissionNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { venueName, forDate, submittedBy, totalSales, grossRevenue, netRevenue } = body

    // Validate required fields
    if (!venueName || !forDate || !submittedBy || totalSales === undefined || grossRevenue === undefined || netRevenue === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: venueName, forDate, submittedBy, totalSales, grossRevenue, netRevenue' },
        { status: 400 }
      )
    }

    // Send email notification
    const result = await sendReportSubmissionNotification({
      venueName,
      forDate,
      submittedBy,
      totalSales,
      grossRevenue,
      netRevenue,
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Email notification sent successfully',
      mailgunId: result.id 
    })

  } catch (error: unknown) {
    console.error('Error sending email notification:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to send email notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
