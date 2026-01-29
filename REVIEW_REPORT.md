# Coco Sales System – Review Report

**Date:** 2025-01-29  
**Scope:** Login, user add, admin role, location assignment, reports, Supabase implementation.

---

## 1. Login review

**Flow:**
- **Page:** `src/app/login/page.tsx` – client component with email/password form.
- **Auth:** `supabase.auth.signInWithPassword()` via browser client (`createClientComponentClient` from `@/lib/supabase`).
- **Session check:** `useEffect` calls `getSession()` when client is ready; if session exists, redirects to `/dashboard`.
- **Post-login:** Success message then `router.push('/dashboard')` after 1s.
- **Forgot password:** Toggle to reset form; submits to `/api/auth/reset-password`.

**Fixes applied:**
- Removed duplicate `setMessage('')` in `handleLogin`.

**Notes:**
- Login uses `getSession()` for “already logged in” redirect. Supabase recommends `getUser()` for server-side validation; for client-side redirect-on-load, `getSession()` is acceptable.
- Proxy (see §7) now protects `/dashboard`, `/reports`, `/admin`, `/analytics` and redirects unauthenticated users to `/login`.

---

## 2. User-add review

**Two entry points:**

| Entry point | Route | API | Auth |
|-------------|--------|-----|------|
| **Admin users page** | `/admin/users` | `POST /api/admin/users/create` | Super-admin only (hardcoded emails) |
| **Dashboard UserManagement** | `/dashboard` (admin tab) | `POST /api/admin/users` | None (relies on UI access) |

**Create user API (`/api/admin/users/create`):**
- **Auth:** Verifies current user is super-admin (`admin@thoughtbulb.dev`, `shetty.aneet@gmail.com`).
- **Body:** `email`, `password`, `displayName`, `role` (`staff` \| `admin` \| `owner`), `venue_ids` (array).
- **Process:** Uses service-role client; optionally deletes existing auth user + profile if same email; `auth.admin.createUser` with `email_confirm: true` and `user_metadata`; waits for `handle_new_user` trigger; updates `users` with `display_name`, `role`, `approved`, `venue_ids` or calls `upsert_user_profile` RPC if no profile.
- **Notifications:** Fire-and-forget Mailgun emails to admins and welcome email to new user.

**Legacy create API (`POST /api/admin/users`):**
- No auth check; uses `supabaseAdmin` only.
- Expects `display_name` (snake_case). Inserts into `users` after `createUser`; no `approved`/`venue_ids` handling like create route.

**Admin users page (`/admin/users`):**
- Uses **create** route; form has `displayName`, `role` (staff/admin/owner), `venue_ids` (venue checkboxes). Staff require ≥1 venue.
- Fetches users from `GET /api/users`, venues from Supabase `venues`.

**Recommendation:** Prefer **create** route and `/admin/users` for creating users (super-admin gated, approval, venues, emails). Consider deprecating or securing `POST /api/admin/users` and aligning UserManagement with the create API if still used.

---

## 3. Test creating a user

**How to test:**
1. Log in as super-admin (`admin@thoughtbulb.dev` or `shetty.aneet@gmail.com`).
2. Open `/admin/users` → “Create User”.
3. Submit email, password, display name, role (e.g. staff), and ≥1 venue for staff.
4. Confirm user appears in list and can log in.

**DB check (Supabase MCP):** `users` has admin and test users; `venues` has “Coco Chmielna” and “Coco Lounge”. Create flow is compatible with current schema.

---

## 4. Test giving admin role

**How to test:**
1. Create a user with role **staff** (or use existing test user).
2. In **UserManagement** (dashboard): Edit user → set Role to **Admin** → Update.
3. UserManagement calls `PUT /api/admin/users` with `role`, `venue_ids`, etc.

**Note:** Role change is done via `PUT /api/admin/users`. The **create** route is only for creation. Admin users page currently lists users and approve/revoke; role editing there would require calling the same update API or adding equivalent UI.

---

## 5. Test assigning location (venue)

**Venues = locations.** Stored in `users.venue_ids` (UUID[]).

**Create:** On create, `venue_ids` is sent in the request and stored (create route or RPC).

**Update:** UserManagement edit form has “Venue Access” checkboxes; `PUT /api/admin/users` sends `venue_ids` and updates `users`.

**Access control:** `auth.canAccessVenue(user, venueId)` and dashboard/analytics filter venues by `user.role === 'admin'` or `user.venue_ids.includes(venue.id)`.

**How to test:**
1. Edit a staff user in UserManagement.
2. Change venue checkboxes → Update.
3. Log in as that user, open dashboard/reports – only assigned venues should appear.

---

## 6. Add a report

**Flow:**
- **Page:** `/reports/new` → `EODForm` with `user` from profile.
- **Venues:** From `venues` filtered by `user.venue_ids` or all if admin.
- **Save:** `EODForm.handleSave('draft' \| 'submitted')` builds `DailyReport`, then:
  - **Create:** `supabase.from('daily_reports').insert([...]).select().single()`.
  - **Edit:** `update(...).eq('id', ...).select().single()`.
- **Submit:** Status `approved`, `submitted_at` / `approved_at` / `approved_by` set; optional email to admins via `/api/send-email`.

**Tables:** `daily_reports`; related `report_withdrawals`, `report_representacja_1`, `report_service_kwotowy`, `report_strata`.

**How to test:**
1. Log in as staff (with venue) or admin.
2. Go to **New Daily Report** (or dashboard → add report).
3. Select venue, date, fill required fields (e.g. total sales > 0).
4. Save draft or submit → redirect to report detail.

---

## 7. Supabase implementation review

**Project:** `coco-reporting-system` (Supabase MCP `wnwzifhngkynpxknovii`).

**Clients:**
- **Browser:** `@/lib/supabase` – `createBrowserClient` singleton, used in login, dashboard, reports, analytics.
- **Server (Route Handlers / Server Components):** `createServerSupabaseClient` in `@/lib/auth` (cookies).
- **Admin / service:** `@/lib/supabase-admin` – service-role client for user create/update/delete, bypassing RLS.

**Proxy (Next.js 16 `src/proxy.ts`):**
- **Role:** Refresh auth (session) and protect routes.
- **Auth check:** `supabase.auth.getUser()` (validates JWT server-side; prefer over `getSession()` in proxy).
- **Updates applied:**
  - Preserve auth cookies on redirects: `copyCookiesTo(redirectRes)` for all redirect responses so refreshed tokens are sent.
  - Explicitly allow `/login`, `/auth`, `/pending-approval`; protect `/dashboard`, `/reports`, `/admin`, `/analytics`; redirect unauthenticated users to `/login`.
  - Approval check for protected routes: unapproved users (except super-admins) redirect to `/pending-approval`.

**Schema (relevant):**
- **`users`:** `id`, `email`, `display_name`, `role` (staff/admin/owner), `venue_ids`, `approved`, `approved_by`, `approved_at`. RLS enabled.
- **`venues`:** `id`, `name`, `slug`, `is_active`. RLS enabled.
- **`daily_reports`:** EOD fields, `venue_id`, `created_by`, `status`, etc. RLS enabled.
- **Report aux tables:** `report_withdrawals`, `report_representacja_1`, `report_service_kwotowy`, `report_strata`.

**Database logic:**
- **`handle_new_user`:** Trigger on `auth.users` insert → create row in `public.users`.
- **`upsert_user_profile`:** RPC used by create route when profile is missing; handles enum casting and `venue_ids`.

**Auth callback:** `GET /auth/callback` exchanges `code` for session, handles signup/recovery, notifies admins for new unapproved signups.

**Recommendations:**
- Consider `getClaims()` in proxy (per latest Supabase Next.js examples) for token refresh; both `getUser()` and `getClaims()` validate the JWT.
- Move super-admin emails to env or config (e.g. `SUPER_ADMIN_EMAILS`) instead of hardcoding.
- Ensure `POST /api/admin/users` is either removed or secured (e.g. same super-admin check as create route) if still in use.

---

## Summary

| Item | Status |
|------|--------|
| 1. Login | Reviewed; duplicate `setMessage` removed |
| 2. User add | Reviewed; create vs legacy API clarified |
| 3. Create user | Testable via `/admin/users` as super-admin |
| 4. Admin role | Testable via UserManagement → Edit → Role |
| 5. Assign location | Testable via UserManagement → Edit → Venue Access |
| 6. Add report | Testable via `/reports/new` with EODForm |
| 7. Supabase | Reviewed; proxy fixes and recommendations noted |

**Code changes made:**
- `src/app/login/page.tsx`: Removed duplicate `setMessage('')` in `handleLogin`.
- `src/proxy.ts`: Cookie preservation on redirects; explicit allowlist for login/auth/pending-approval; protection for dashboard, reports, admin, analytics; approval check on all protected routes.

**Verification (2025-01-29):**
- `npm run dev` → app runs; `GET /login` → 200.
- Unauthenticated `GET /dashboard`, `GET /reports/new`, `GET /admin/users` → 307 redirect (to login). Proxy protection confirmed.
- Supabase project `coco-reporting-system`: venues (Coco Chmielna, Coco Lounge) and users (incl. super-admins) present; create user / add report flows are testable.
