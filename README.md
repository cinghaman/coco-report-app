
# Coco Reporting — Starter Kit

This repo contains:
- `supabase_schema.sql` — Postgres schema, RLS, functions
- `openapi.yaml` — REST/RPC contract for app & agents
- `edge-function-append-csv.ts` — Supabase Edge Function to append CSV rows on approval
- `sprints.md` — Phased plan to ship safely

## Quick Start

1. **Supabase**: create project → copy `SUPABASE_URL` and keys
2. **Apply Schema**: run `psql` or Supabase SQL editor with `supabase_schema.sql`
3. **Auth**: sign up as admin (email/password), then insert a row in `public.users` with your `auth.users.id`
4. **Storage**: create bucket `coco-reports` (private)
5. **Edge Function**: deploy `edge-function-append-csv.ts` and set env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Notes
- All amounts are PLN; decimals rounded to 2 places.
- Timezone for UI: Europe/Warsaw; store in UTC (timestamptz).
- CSV files: `coco-{venue-slug}-{YYYY}-{MM}-daily-line-items.csv` in `coco-reports` bucket.
