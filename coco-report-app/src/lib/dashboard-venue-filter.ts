/** Venues hidden from the dashboard (cards, stats, recent reports). */
const HIDDEN_SLUGS = new Set(['coco-chmielna'])

export function isHiddenFromDashboard(venue: { slug: string }): boolean {
  return HIDDEN_SLUGS.has(venue.slug.toLowerCase())
}
