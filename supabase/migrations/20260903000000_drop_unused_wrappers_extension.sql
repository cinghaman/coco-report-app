-- Fix Supabase advisor "rls_disabled_in_public" on public.wrappers_fdw_stats.
--
-- That table belongs to the `wrappers` FDW extension and is owned by
-- supabase_admin, so the postgres role cannot ALTER it to enable RLS (which is
-- why enable_rls_wrappers_fdw_stats() never worked). The extension is unused in
-- this project (no foreign servers, no foreign tables, table has 0 rows), so the
-- clean fix is to drop it. This also clears the "extension_in_public" warning.
DROP FUNCTION IF EXISTS public.enable_rls_wrappers_fdw_stats();
DROP EXTENSION IF EXISTS wrappers CASCADE;
