import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMailgunEmails } from '@/lib/mailgun-send'
import {
  getVenueNotificationEmails,
  venueEmailFromName,
} from '@/lib/report-notifications'
import {
  buildMonthlyReportEmailHtml,
  getPriorMonthWindow,
  loadVenueMonthTotals,
  resolveMonthWindow,
} from '@/lib/monthly-report'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type VenueRow = { id: string; name: string }

function authorizeCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

async function runMonthlyReports(options: {
  monthKey?: string
  venueIds?: string[] | null
  dryRun?: boolean
}) {
  const admin = supabaseAdmin
  if (!admin) {
    throw new Error('Supabase admin client not configured')
  }

  const month = resolveMonthWindow(options.monthKey)
  const prior = getPriorMonthWindow(month)

  let venuesQuery = admin.from('venues').select('id, name').eq('is_active', true).order('name')
  if (options.venueIds && options.venueIds.length > 0) {
    venuesQuery = venuesQuery.in('id', options.venueIds)
  }

  const { data: venues, error: venuesError } = await venuesQuery
  if (venuesError) throw venuesError

  const { data: adminUsers, error: usersError } = await admin
    .from('users')
    .select('email, display_name, role, venue_ids')
    .in('role', ['admin', 'owner'])

  if (usersError) throw usersError

  const results: Array<{
    venueId: string
    venueName: string
    recipients: string[]
    reportCount: number
    priorReportCount: number
    emailsSent?: number
    skipped?: string
    dryRun?: boolean
    error?: string
  }> = []

  for (const venue of (venues ?? []) as VenueRow[]) {
    try {
      const recipients = getVenueNotificationEmails(adminUsers ?? [], venue.id)
      if (recipients.length === 0) {
        results.push({
          venueId: venue.id,
          venueName: venue.name,
          recipients: [],
          reportCount: 0,
          priorReportCount: 0,
          skipped: 'No admins/owners assigned to this venue',
        })
        continue
      }

      const [current, previous] = await Promise.all([
        loadVenueMonthTotals(admin, venue.id, month.start, month.end),
        loadVenueMonthTotals(admin, venue.id, prior.start, prior.end),
      ])

      if (current.reportCount === 0 && previous.reportCount === 0) {
        results.push({
          venueId: venue.id,
          venueName: venue.name,
          recipients,
          reportCount: 0,
          priorReportCount: 0,
          skipped: 'No approved reports in either month',
        })
        continue
      }

      const subject = `End of Month Report - ${venue.name} - ${month.label}`
      const html = buildMonthlyReportEmailHtml({
        venueName: venue.name,
        monthLabel: month.label,
        priorMonthLabel: prior.label,
        current,
        previous,
      })

      if (options.dryRun) {
        results.push({
          venueId: venue.id,
          venueName: venue.name,
          recipients,
          reportCount: current.reportCount,
          priorReportCount: previous.reportCount,
          dryRun: true,
        })
        continue
      }

      const emailResult = await sendMailgunEmails({
        to: recipients,
        subject,
        html,
        fromName: venueEmailFromName(venue.name),
      })

      results.push({
        venueId: venue.id,
        venueName: venue.name,
        recipients,
        reportCount: current.reportCount,
        priorReportCount: previous.reportCount,
        emailsSent: emailResult.results.filter((r) => r.success).length,
      })
    } catch (error: unknown) {
      results.push({
        venueId: venue.id,
        venueName: venue.name,
        recipients: [],
        reportCount: 0,
        priorReportCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    month: month.label,
    priorMonth: prior.label,
    monthKey: month.key,
    results,
  }
}

async function resolveCallerVenueScope(): Promise<
  | { ok: true; venueIds: string[] | null }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, venue_ids')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'owner' && profile.role !== 'admin')) {
    return { ok: false, status: 403, error: 'Only admins and owners can send monthly reports' }
  }

  if (profile.role === 'owner') {
    return { ok: true, venueIds: null }
  }

  const assigned = profile.venue_ids ?? []
  if (assigned.length === 0) {
    return { ok: false, status: 403, error: 'No venues assigned' }
  }
  return { ok: true, venueIds: assigned }
}

/**
 * Vercel Cron (1st of each month). Auth: Authorization: Bearer CRON_SECRET
 * Query: ?month=yyyy-MM&venueId=&dryRun=1
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const monthKey = request.nextUrl.searchParams.get('month') || undefined
    const venueId = request.nextUrl.searchParams.get('venueId') || undefined
    const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
    const payload = await runMonthlyReports({
      monthKey,
      venueIds: venueId ? [venueId] : null,
      dryRun,
    })
    return NextResponse.json({ ok: true, ...payload })
  } catch (error: unknown) {
    console.error('monthly-reports cron GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send monthly reports' },
      { status: 500 }
    )
  }
}

/**
 * Manual send by admin/owner, or cron POST with Bearer CRON_SECRET.
 * Body: { monthKey?: "yyyy-MM", venueId?: string, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      monthKey?: string
      venueId?: string
      dryRun?: boolean
    }

    let venueIds: string[] | null = body.venueId ? [body.venueId] : null

    if (authorizeCron(request)) {
      // cron can send all venues or a single venueId
    } else {
      const scope = await resolveCallerVenueScope()
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status })
      }

      if (body.venueId) {
        if (scope.venueIds && !scope.venueIds.includes(body.venueId)) {
          return NextResponse.json({ error: 'Access denied for this venue' }, { status: 403 })
        }
        venueIds = [body.venueId]
      } else {
        venueIds = scope.venueIds
      }
    }

    const payload = await runMonthlyReports({
      monthKey: body.monthKey,
      venueIds,
      dryRun: body.dryRun,
    })
    return NextResponse.json({ ok: true, ...payload })
  } catch (error: unknown) {
    console.error('monthly-reports cron POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send monthly reports' },
      { status: 500 }
    )
  }
}
