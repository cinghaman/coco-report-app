import type { User } from './supabase'

type VenueScopedUser = Pick<User, 'id' | 'role' | 'venue_ids'>

/** Owners see every venue; admins and staff are limited to `venue_ids`. */
export function userHasFullVenueAccess(user: Pick<User, 'role'>): boolean {
  return user.role === 'owner'
}

export function canAccessVenue(user: VenueScopedUser, venueId: string): boolean {
  if (userHasFullVenueAccess(user)) return true
  return (user.venue_ids ?? []).includes(venueId)
}

export function filterVenuesForUser<T extends { id: string }>(
  user: VenueScopedUser,
  venues: T[]
): T[] {
  if (userHasFullVenueAccess(user)) return venues
  const allowed = new Set(user.venue_ids ?? [])
  return venues.filter((v) => allowed.has(v.id))
}

/** `null` means no venue filter (all venues). Otherwise restrict queries to these IDs. */
export function getVenueScopeIds(user: VenueScopedUser): string[] | null {
  if (userHasFullVenueAccess(user)) return null
  return user.venue_ids ?? []
}

export function canViewReport(
  user: VenueScopedUser,
  report: { created_by: string; venue_id: string; status: string }
): boolean {
  if (user.role === 'owner') return true
  if (!canAccessVenue(user, report.venue_id)) return false
  if (report.created_by === user.id) return true
  if (user.role === 'admin') return true
  return ['approved', 'submitted', 'locked'].includes(report.status)
}

export function canEditReport(
  user: VenueScopedUser,
  report: { created_by: string; venue_id: string; status: string }
): boolean {
  if (user.role === 'owner') return true
  if (user.role === 'admin' && canAccessVenue(user, report.venue_id)) return true
  return report.created_by === user.id && report.status === 'draft'
}
