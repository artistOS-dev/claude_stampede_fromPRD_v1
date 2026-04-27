-- ── Script: Sync super admins as board members in all circles ────
-- Run this any time a new circle is created or a new super admin
-- is added. Safe to re-run (uses ON CONFLICT DO UPDATE only when
-- a downgrade would not occur — founders are left untouched).
--
-- Effect:
--   • Super admins not yet in a circle  → inserted as 'board', 'active'
--   • Super admins who are 'member'     → upgraded to 'board'
--   • Super admins already 'board'      → no change
--   • Super admins who are 'founder'    → left as 'founder' (no downgrade)

insert into public.circle_members (circle_id, user_id, role, status, joined_at)
select
  c.id          as circle_id,
  p.id          as user_id,
  'board'       as role,
  'active'      as status,
  now()         as joined_at
from public.circles c
cross join public.profiles p
where p.is_super_admin = true
on conflict (circle_id, user_id) do update
  set role   = case when excluded.role = 'founder' then 'founder' else 'board' end,
      status = 'active';
