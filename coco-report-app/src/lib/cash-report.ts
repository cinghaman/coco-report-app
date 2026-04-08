import type { SupabaseClient } from '@supabase/supabase-js'

/** Single-venue app: resolve Coco Lounge for `venue_id` on cash reports. */
export async function resolveCocoLoungeVenueId(
  supabase: SupabaseClient
): Promise<string | null> {
  const slugs = ['coco-lounge', 'coco_lounge']
  for (const slug of slugs) {
    const { data } = await supabase
      .from('venues')
      .select('id')
      .eq('is_active', true)
      .eq('slug', slug)
      .maybeSingle()
    if (data?.id) return data.id
  }

  const { data: byName } = await supabase
    .from('venues')
    .select('id')
    .eq('is_active', true)
    .ilike('name', '%coco lounge%')
    .limit(1)
    .maybeSingle()
  if (byName?.id) return byName.id

  const { data: fallback } = await supabase
    .from('venues')
    .select('id')
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .maybeSingle()
  return fallback?.id ?? null
}

/** Net movement from line items: sum(income) − sum(expense). */
export function netFromLines(
  lines: Array<{ income: number; expense: number }>
): number {
  return lines.reduce(
    (s, l) => s + (Number(l.income) || 0) - (Number(l.expense) || 0),
    0
  )
}

/**
 * Sum of (income − expense) per `cash_report_id` from flat line rows (e.g. one Supabase query).
 */
export function lineNetByCashReportId(
  lines: ReadonlyArray<{
    cash_report_id: string
    income?: number | null
    expense?: number | null
  }>
): Map<string, number> {
  const map = new Map<string, number>()
  for (const l of lines) {
    const id = l.cash_report_id
    const delta = (Number(l.income) || 0) - (Number(l.expense) || 0)
    map.set(id, (map.get(id) ?? 0) + delta)
  }
  return map
}

/** Closing balance for a report = opening + net from lines. */
export function closingCash(
  cashFromPreviousDay: number,
  lines: Array<{ income: number; expense: number }>
): number {
  return (Number(cashFromPreviousDay) || 0) + netFromLines(lines)
}

/**
 * Opening cash for a new report on `forDate`:
 * previous report’s closing = previous.cash_from_previous_day + net(lines on that report).
 * If there is no earlier report for the venue, returns 0.
 */
export async function fetchOpeningCashForNewReport(
  supabase: SupabaseClient,
  venueId: string,
  forDate: string
): Promise<number> {
  const { data: prev, error: prevErr } = await supabase
    .from('cash_reports')
    .select('id, cash_from_previous_day')
    .eq('venue_id', venueId)
    .lt('for_date', forDate)
    .order('for_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prevErr) {
    console.error('fetchOpeningCashForNewReport:', prevErr)
    throw prevErr
  }
  if (!prev) return 0

  const { data: lineRows, error: linesErr } = await supabase
    .from('cash_report_lines')
    .select('income, expense')
    .eq('cash_report_id', prev.id)

  if (linesErr) {
    console.error('fetchOpeningCashForNewReport lines:', linesErr)
    throw linesErr
  }

  const opening = Number(prev.cash_from_previous_day) || 0
  const net = netFromLines(lineRows ?? [])
  return opening + net
}
