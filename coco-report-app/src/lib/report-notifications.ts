import type { SupabaseClient } from '@supabase/supabase-js'

export type VenueNotificationUser = {
  email?: string | null
  venue_ids?: string[] | null
  role?: string | null
}

const VENUE_NOTIFICATION_ROLES = new Set(['admin', 'owner'])

/** Per-venue email sender display names (From header). */
const VENUE_REPORTING_SENDER: Record<string, string> = {
  'coco lounge': 'Coco Reporting',
  'thai varso': 'Thai Varso Reporting',
}

/** Display name for the email From header — e.g. "Thai Varso Reporting". */
export function venueEmailFromName(venueName: string): string {
  const trimmed = venueName.trim()
  if (!trimmed) return 'Coco Reporting'

  const mapped = VENUE_REPORTING_SENDER[trimmed.toLowerCase()]
  if (mapped) return mapped

  return `${trimmed} Reporting`
}

/** Resolve venue label from DB (avoids stale client state). */
export async function fetchVenueNameById(
  supabase: SupabaseClient,
  venueId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('venues')
    .select('name')
    .eq('id', venueId)
    .maybeSingle()

  if (error) {
    console.error('fetchVenueNameById:', error)
    return 'Unknown Venue'
  }

  return data?.name ?? 'Unknown Venue'
}

export function venueNameFromJoinedRow(
  row: { venues?: { name: string } | { name: string }[] | null } | null
): string | null {
  if (!row?.venues) return null
  if (Array.isArray(row.venues)) return row.venues[0]?.name ?? null
  return row.venues.name ?? null
}

/**
 * Emails for venue-specific report/cash-report alerts.
 * `venue_ids` scopes who receives alerts. Owners with empty `venue_ids` get no venue emails.
 */
export function getVenueNotificationEmails(
  users: VenueNotificationUser[],
  venueId: string
): string[] {
  const emails = users
    .filter(
      (u) =>
        Boolean(u.email) &&
        u.role &&
        VENUE_NOTIFICATION_ROLES.has(u.role) &&
        (u.venue_ids ?? []).includes(venueId)
    )
    .map((u) => u.email as string)

  return [...new Set(emails)]
}
