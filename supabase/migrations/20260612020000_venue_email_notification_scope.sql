-- venue_ids scopes email alerts for admins/owners (app access unchanged).
COMMENT ON COLUMN public.users.venue_ids IS
  'Assigned venue UUIDs. Staff: limits report access. Admin/owner: limits report/cash-report email notifications; empty means no venue emails.';

-- Primary operator: both active venues for email alerts
UPDATE public.users
SET venue_ids = ARRAY[
  '7c8cf6f7-74fe-4ec6-9233-3da22c41c157'::uuid,
  '616ed18e-bbe3-48b2-8bf2-c39c2a5fd1b6'::uuid
]
WHERE email = 'shetty.aneet@gmail.com'
  AND role IN ('admin', 'owner');
