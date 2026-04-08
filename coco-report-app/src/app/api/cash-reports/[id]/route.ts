import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!['admin', 'owner'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or owner access required' },
        { status: 403 }
      )
    }

    const resolvedParams = params instanceof Promise ? await params : params
    const reportId = resolvedParams.id

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const { data: report, error: reportError } = await supabase
      .from('cash_reports')
      .select('id, for_date, venue_id, cash_from_previous_day')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Cash report not found' }, { status: 404 })
    }

    const { data: venue } = await supabase
      .from('venues')
      .select('name')
      .eq('id', report.venue_id)
      .single()

    const venueName = venue?.name || 'Unknown Venue'

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { error: linesErr } = await supabaseAdmin
      .from('cash_report_lines')
      .delete()
      .eq('cash_report_id', reportId)

    if (linesErr) {
      console.error('Error deleting cash_report_lines:', linesErr)
      return NextResponse.json(
        { error: 'Failed to delete line items', details: linesErr.message },
        { status: 500 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('cash_reports')
      .delete()
      .eq('id', reportId)

    if (deleteError) {
      console.error('Error deleting cash_reports:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete cash report', details: deleteError.message },
        { status: 500 }
      )
    }

    try {
      const { data: adminUsers } = await supabaseAdmin
        .from('users')
        .select('email, display_name, role')
        .in('role', ['admin', 'owner'])

      const adminEmails = adminUsers?.map((u) => u.email).filter(Boolean) || []
      const requiredAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
      const allAdminEmails = [...new Set([...adminEmails, ...requiredAdminEmails])]

      const reportDate = new Date(report.for_date).toLocaleDateString('pl-PL')
      const opening = Number(report.cash_from_previous_day) || 0

      if (allAdminEmails.length > 0) {
        try {
          const mailgunApiKey = process.env.MAILGUN_API_KEY

          if (mailgunApiKey) {
            const mailgunDomain = process.env.MAILGUN_DOMAIN || 'coco-notifications.info'
            const fromEmail = process.env.MAILGUN_FROM_EMAIL || `postmaster@${mailgunDomain}`
            const fromName = process.env.MAILGUN_FROM_NAME || 'Coco Reporting'

            const mailgun = new Mailgun(FormData)
            const mg = mailgun.client({
              username: 'api',
              key: mailgunApiKey,
              url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net',
            })

            await mg.messages.create(mailgunDomain, {
              from: `${fromName} <${fromEmail}>`,
              to: allAdminEmails,
              subject: `Cash Report Deleted - ${venueName} - ${reportDate}`,
              html: `
                <h2>Cash Report Deleted</h2>
                <p><strong>Venue:</strong> ${venueName}</p>
                <p><strong>Date:</strong> ${reportDate}</p>
                <p><strong>Deleted by:</strong> ${currentUser.email}</p>
                <p><strong>Opening cash (prior day):</strong> ${opening.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
                <p>This cash report and all line items have been permanently deleted.</p>
              `,
            })
          }
        } catch (emailError) {
          console.error('Cash report deletion email error:', emailError)
        }
      }

      return NextResponse.json({
        message: 'Cash report deleted successfully',
        reportId,
      })
    } catch (emailOuter) {
      console.error('Cash report deletion notification:', emailOuter)
      return NextResponse.json({
        message: 'Cash report deleted successfully',
        reportId,
      })
    }
  } catch (error: unknown) {
    console.error('Error in DELETE /api/cash-reports/[id]:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
