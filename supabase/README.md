# Supabase migrations

Project: **coco-reporting-system** (`wnwzifhngkynpxknovii`)

Migrations live in `supabase/migrations/`. Filenames use UTC timestamps; Supabase runs them in sorted order.

## June 2026 changes (venues + analytics)

| File | Purpose |
|------|---------|
| `20260612000000_add_thai_varso_venue.sql` | Adds Thai Varso venue (idempotent) |
| `20260612010000_remove_coco_chmielna_venue.sql` | Removes closed Coco Chmielna + cleans `users.venue_ids` |
| `20260612020000_venue_email_notification_scope.sql` | Documents `users.venue_ids` email scope; seeds operator assignments |
| `20260612030000_fix_analytics_withdrawal_join.sql` | Fixes inflated analytics when multiple withdrawals exist |
| `20260612040000_admin_venue_scoped_access.sql` | Admins limited to `venue_ids`; owners see all venues (RLS) |

Production already has equivalent changes applied via MCP under different migration version IDs (`20260611224431`, etc.). Content matches; only timestamps differ.

## Linking an existing production project

```bash
cd /path/to/coco-report-app
supabase link --project-ref wnwzifhngkynpxknovii
```

If `db push` tries to re-apply June 2026 migrations that are already live, mark them applied without re-running:

```bash
supabase migration repair --status applied 20260612000000
supabase migration repair --status applied 20260612010000
supabase migration repair --status applied 20260612020000
supabase migration repair --status applied 20260612030000
```

## Fresh database

```bash
supabase db push
```

Or apply via Supabase Dashboard → SQL, in filename order.
