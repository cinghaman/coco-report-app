import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verify the current user is an admin
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if current user is admin
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only admins and owners can delete reports
    if (!['admin', 'owner'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // 2. Get the report ID from params
    const reportId = params.id

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // 3. Verify the report exists and get details for email notification
    const { data: report, error: reportError } = await supabase
      .from('daily_reports')
      .select(`
        id, 
        status, 
        for_date,
        venue_id,
        gross_revenue,
        net_revenue
      `)
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Get venue name separately
    const { data: venue } = await supabase
      .from('venues')
      .select('name')
      .eq('id', report.venue_id)
      .single()
    
    const venueName = venue?.name || 'Unknown Venue'

    // 4. Use Service Role Key to delete the report and all related data
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Delete related data first (due to foreign key constraints)
    // Note: Most have CASCADE, but we delete explicitly for clarity and safety
    // Delete withdrawals
    await supabaseAdmin
      .from('report_withdrawals')
      .delete()
      .eq('report_id', reportId)

    // Delete representacja1
    await supabaseAdmin
      .from('report_representacja_1')
      .delete()
      .eq('report_id', reportId)

    // Delete service_kwotowy
    await supabaseAdmin
      .from('report_service_kwotowy')
      .delete()
      .eq('report_id', reportId)

    // Delete strata
    await supabaseAdmin
      .from('report_strata')
      .delete()
      .eq('report_id', reportId)

    // Delete field values
    await supabaseAdmin
      .from('report_field_values')
      .delete()
      .eq('report_id', reportId)

    // Delete attachments
    await supabaseAdmin
      .from('report_attachments')
      .delete()
      .eq('report_id', reportId)

    // Finally, delete the report itself
    const { error: deleteError } = await supabaseAdmin
      .from('daily_reports')
      .delete()
      .eq('id', reportId)

    if (deleteError) {
      console.error('Error deleting report:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete report',
        details: deleteError.message 
      }, { status: 500 })
    }

    // Send email notification to admins about the deletion
    try {
      // Get all admin emails
      const { data: adminUsers } = await supabaseAdmin
        .from('users')
        .select('email, display_name')
        .in('role', ['admin', 'owner'])

      const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []
      const reportDate = new Date(report.for_date).toLocaleDateString('pl-PL')

      // Send email notification via API
      if (adminEmails.length > 0) {
        try {
          const emailResponse = await fetch(`${request.nextUrl.origin}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: adminEmails,
              subject: `Report Deleted - ${venueName} - ${reportDate}`,
              html: `
                <h2>Report Deleted</h2>
                <p><strong>Venue:</strong> ${venueName}</p>
                <p><strong>Date:</strong> ${reportDate}</p>
                <p><strong>Deleted by:</strong> ${currentUser.email}</p>
                <p><strong>Gross Revenue:</strong> ${(report.gross_revenue || 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
                <p><strong>Net Revenue:</strong> ${(report.net_revenue || 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
                <p>This report and all associated data have been permanently deleted.</p>
              `
            })
          })

          if (emailResponse.ok) {
            console.log('Deletion email notifications sent successfully')
          } else {
            const errorData = await emailResponse.json()
            console.error('Failed to send deletion email notifications:', errorData)
          }
        } catch (emailError) {
          console.error('Error sending deletion email notification:', emailError)
          // Don't fail the deletion if email fails
        }
      }

      return NextResponse.json({ 
        message: 'Report deleted successfully',
        reportId 
      })
    } catch (emailError) {
      // Don't fail the deletion if email notification fails
      console.error('Error preparing email notification:', emailError)
      return NextResponse.json({ 
        message: 'Report deleted successfully',
        reportId 
      })
    }

  } catch (error: unknown) {
    console.error('Error in delete report endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

