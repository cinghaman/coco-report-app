
# Coco Reporting — Phased Sprints

> Goal: Keep the AI/dev agents focused, limit surface area per sprint, and ship value fast.

## Sprint 0 — Foundations (DB + Auth) — 2–3 days
**Deliverables**
- Supabase project setup (Auth, Postgres, Storage)
- Apply `supabase_schema.sql`
- Seed venues; create admin user profile (after Auth signup)
- RLS policies enabled and verified

**Acceptance Criteria**
- Admin can sign in; staff user exists
- `venues`, `users`, `daily_reports` tables accessible via PostgREST with correct permissions

---

## Sprint 1 — Staff EOD Flow (Create/Save/Submit) — 3–4 days
**Deliverables**
- Mobile-first EOD form (Next.js/SvelteKit + Tailwind)
- Live client-side validation
- Pre-fill `cash_previous_day` using `/rpc/fn_prev_day_cash`
- Draft save + submit transitions

**Acceptance Criteria**
- Staff user can: select venue + date, fill form, submit
- Server validates required fields

---

## Sprint 2 — Reconciliation Engine + Admin Review — 3–4 days
**Deliverables**
- Server-side checks via `/rpc/fn_calc_reconciliation`
- Snapshot trigger on submit/approve
- Admin report list + detail view with warnings
- Admin edit with audit log entries
- Approve / revert to draft / lock actions

**Acceptance Criteria**
- Out-of-bounds payment/cash rules block submission
- Admin can edit values and see audit trail
- Approved report is immutable to staff

---

## Sprint 3 — Exports (CSV) + Dashboard KPIs — 3–4 days
**Deliverables**
- Edge Function `append-csv` (deployed)
- On approval → call edge function to append line
- Monthly/date-range CSV download links
- Dashboard tiles: sales total, payments breakdown, tips, voids%, loss%
- Simple daily trend chart

**Acceptance Criteria**
- Approving a report updates the monthly CSV
- Dashboard loads 30-day range < 1.5s

---

## Sprint 4 — Custom Fields + Threshold Config — 3–4 days
**Deliverables**
- Admin UI to add/edit `field_definitions`
- Dynamic rendering of extra fields in Staff form
- Export includes `custom.{key}` columns
- Config UI for tolerances (payment ±, voids%, loss%) stored in a config table (optional)

**Acceptance Criteria**
- New fields appear instantly in the form and exports
- Reconciliation thresholds adjustable without code changes

---

## Sprint 5 — Hardening, QA, Docs — 2–3 days
**Deliverables**
- CI (lint, typecheck, vitest, playwright)
- Accessibility pass
- Perf budgets enforced
- README + runbooks (onboarding, field-add process)

**Acceptance Criteria**
- >90% unit coverage on calc + RLS
- Zero PII leaks; attachments private with signed URLs
