-- =====================================================================
-- 03_make_staff.sql
-- 1) In Supabase: Authentication > Users > Add user (tick "Auto Confirm User")
--      staff@sad.test, scholar1@sad.test, scholar2@sad.test   (passwords: choose your own; give them to the instructor privately)
-- 2) Run this script. It makes staff@sad.test a Scholarship Staff and links scholar1/scholar2 to B01/B02.
-- Never put passwords or the service-role key in source code.
-- =====================================================================
update public.profiles set role = 'staff', full_name = 'Staff Reviewer' where lower(email) = 'staff@sad.test';

update public.scholars s set profile_id = p.id
  from public.profiles p
 where s.profile_id is null and lower(p.email) = lower(s.email);

select p.email, p.role, s.student_id as linked_scholar
from public.profiles p left join public.scholars s on s.profile_id = p.id
order by p.role, p.email;
