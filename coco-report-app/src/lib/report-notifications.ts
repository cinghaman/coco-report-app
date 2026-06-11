export type VenueNotificationUser = {
  email?: string | null
  venue_ids?: string[] | null
  role?: string | null
}

const VENUE_NOTIFICATION_ROLES = new Set(['admin', 'owner'])

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
