import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMailgunEmails } from '@/lib/mailgun-send'
import {
  getVenueNotificationEmails,
  venueEmailFromName,
} from '@/lib/report-notifications'

/**
 * Send a venue-scoped report notification.
 * Recipient list is resolved server-side (service role) so staff submitters
 * are not blocked by RLS on public.users (staff can only SELECT their own row).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { venueId, subject, html, fromName } = body as {
      venueId?: string
      subject?: string
      html?: string
      fromName?: string
    }

    if (!venueId || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: venueId, subject, html' },
        { status: 400 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role, venue_ids, email, display_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
    }

    const isOwner = profile.role === 'owner'
    const isAdmin = profile.role === 'admin'
    const assigned = profile.venue_ids ?? []
    const canNotify =
      isOwner ||
      ((isAdmin || profile.role === 'staff') && assigned.includes(venueId))

    if (!canNotify) {
      return NextResponse.json({ error: 'Access denied for this venue' }, { status: 403 })
    }

    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { data: adminUsers, error: usersError } = await admin
      .from('users')
      .select('email, display_name, role, venue_ids')
      .in('role', ['admin', 'owner'])

    if (usersError) {
      console.error('notify-venue: failed to load recipients:', usersError)
      return NextResponse.json({ error: 'Failed to load recipients' }, { status: 500 })
    }

    const recipients = getVenueNotificationEmails(adminUsers ?? [], venueId)
    if (recipients.length === 0) {
      return NextResponse.json({
        message: 'No admins/owners assigned to this venue; skipped',
        recipients: [],
        sent: 0,
      })
    }

    const { data: venue } = await admin
      .from('venues')
      .select('name')
      .eq('id', venueId)
      .maybeSingle()

    const resolvedFromName =
      (typeof fromName === 'string' && fromName.trim()) ||
      venueEmailFromName(venue?.name || 'Coco Reporting')

    const result = await sendMailgunEmails({
      to: recipients,
      subject,
      html,
      fromName: resolvedFromName,
    })

    const sent = result.results.filter((r) => r.success).length
    console.log('notify-venue:', {
      venueId,
      venueName: venue?.name,
      submittedBy: profile.email,
      recipients,
      sent,
    })

    return NextResponse.json({
      message: result.message,
      recipients,
      sent,
      results: result.results,
    })
  } catch (error: unknown) {
    console.error('notify-venue error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
