# Database Security Notes

## Known Security Issues

### `public.wrappers_fdw_stats` - RLS Disabled

**Status:** ⚠️ Known Issue - Requires Admin Action

**Table:** `public.wrappers_fdw_stats`

**Description:**
This is a statistics/monitoring table created by the Supabase Wrappers extension (version 0.5.4). It tracks usage and performance metrics for Foreign Data Wrappers (FDWs), which allow PostgreSQL to query external data sources (APIs, other databases, cloud storage, etc.) as if they were local tables.

**What it tracks:**
- `fdw_name` - Name of the foreign data wrapper
- `create_times` - Number of times an FDW instance has been created/initialized
- `rows_in` - Rows transferred from external source → PostgreSQL
- `rows_out` - Rows sent from PostgreSQL → external source
- `bytes_in` - Total bytes received from external source
- `bytes_out` - Total bytes sent to external source
- `metadata` - Additional FDW-specific statistics (JSONB)
- `created_at` / `updated_at` - Timestamps

**Security Issue:**
- **RLS Status:** Disabled
- **Owner:** `supabase_admin` (system role)
- **Current Access:** Full privileges granted to `anon`, `authenticated`, `postgres`, and `service_role`
- **Risk Level:** Low (table is currently empty, no FDW usage), but should be secured

**Why it matters:**
When RLS is disabled, the database cannot enforce per-user or per-tenant access rules via policies. Supabase relies on RLS + policies to safely scope requests coming from frontend clients using PostgREST and Supabase Auth. Exposed public tables without RLS are a common source of data leaks or privilege escalation in multi-tenant or user-scoped apps.

**Current Status:**
- Table is empty (0 rows)
- No foreign data wrappers are currently configured
- Cannot be fixed directly (requires `supabase_admin` privileges)

**Recommended Fix:**

Since the table is owned by `supabase_admin`, you need database superuser privileges or Supabase support to fix this. The following SQL should be executed by a database admin:

```sql
-- Step 1: Change ownership to postgres (or another role you control)
ALTER TABLE public.wrappers_fdw_stats OWNER TO postgres;

-- Step 2: Enable Row Level Security
ALTER TABLE public.wrappers_fdw_stats
  ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policy to allow authenticated users to read (SELECT)
CREATE POLICY wrappers_fdw_stats_select_authenticated
  ON public.wrappers_fdw_stats
  FOR SELECT
  TO authenticated
  USING (true);

-- Step 4: Explicitly deny INSERT for authenticated users
CREATE POLICY wrappers_fdw_stats_no_insert_for_auth
  ON public.wrappers_fdw_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Step 5: Explicitly deny UPDATE for authenticated users
CREATE POLICY wrappers_fdw_stats_no_update_for_auth
  ON public.wrappers_fdw_stats
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Step 6: Explicitly deny DELETE for authenticated users
CREATE POLICY wrappers_fdw_stats_no_delete_for_auth
  ON public.wrappers_fdw_stats
  FOR DELETE
  TO authenticated
  USING (false);

-- Step 7: Add index to improve read performance (optional)
CREATE INDEX IF NOT EXISTS idx_wrappers_fdw_stats_updated_at
  ON public.wrappers_fdw_stats (updated_at);
```

**Action Items:**
1. ✅ Documented the issue
2. ⏳ Contact Supabase support to enable RLS (or use database superuser if available)
3. ⏳ Verify RLS is enabled after fix
4. ⏳ Test access as different roles to ensure policies work correctly

**Alternative Workarounds:**
- If you're not using FDWs, you can accept the security warning (low risk since table is empty)
- Configure PostgREST to exclude this table from API exposure (if possible)
- Monitor the table if you start using FDWs in the future

**References:**
- [Supabase Wrappers Documentation](https://supabase.com/docs/guides/database/extensions/wrappers)
- [Supabase Security Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)
- [PostgreSQL Foreign Data Wrappers](https://www.postgresql.org/docs/current/postgres-fdw.html)

---

**Last Updated:** 2025-01-21
**Issue ID:** RLS-DISABLED-WRAPPERS-FDW-STATS

