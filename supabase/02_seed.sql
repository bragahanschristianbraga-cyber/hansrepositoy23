-- =====================================================================
-- 02_seed.sql  - six fictional scholars B01-B06 (AY 2026-2027, Semester 1)
-- Run after 01_schema.sql. Re-run any time to RESET the test data.
-- Synthetic records only. Seeded summaries are test inputs, NOT official grades.
-- Evidence is present + Verified, submitted one day before the deadline,
-- except where the special condition says otherwise.
-- =====================================================================

delete from public.scholars where student_id in ('2026-B01','2026-B02','2026-B03','2026-B04','2026-B05','2026-B06');

with prog as (select code, id from public.programs),
sch as (
  insert into public.scholars (student_id, full_name, email, program_id)
  select v.sid, v.name, v.email, (select id from prog where code = v.pcode)
  from (values
    ('2026-B01','Alyssa Reyes',    'scholar1@sad.test',   'EXC'),
    ('2026-B02','Brandon Cruz',    'scholar2@sad.test',   'EXC'),
    ('2026-B03','Carla Mendoza',   'b03@scholars.test',   'ACC'),
    ('2026-B04','Daniel Santos',   'b04@scholars.test',   'ACC'),
    ('2026-B05','Elena Garcia',    'b05@scholars.test',   'EXC'),
    ('2026-B06','Felix Navarro',   'b06@scholars.test',   'ACC')
  ) as v(sid, name, email, pcode)
  returning id, student_id
),
sub as (
  insert into public.submissions
    (scholar_id, academic_year, semester, gwa, enrolled_units, failed_count, incomplete_count, dropped_count,
     evidence_ref, submitted_at, verification_status, verified_at)
  select sch.id, '2026-2027', 1, v.gwa, v.units, v.failed, v.inc, v.drop_, 'GRADES-' || v.sid || '.pdf', v.sub_at,
         v.vstatus, case when v.vstatus = 'Verified' then v.sub_at + interval '2 hours' end
  from sch
  join (values
    ('2026-B01', 2.00, 18, 0, 0, 0, timestamptz '2026-11-06 17:00:00+08', 'Verified'),  -- exactly at deadline
    ('2026-B02', 2.01, 18, 0, 0, 0, timestamptz '2026-11-05 17:00:00+08', 'Verified'),
    ('2026-B03', 2.50, 15, 0, 0, 1, timestamptz '2026-11-05 17:00:00+08', 'Verified'),
    ('2026-B04', 2.50, 14, 0, 1, 0, timestamptz '2026-11-05 17:00:00+08', 'Verified'),
    ('2026-B05', 1.75, 18, 1, 0, 0, timestamptz '2026-11-06 17:01:00+08', 'Verified'),  -- one minute late
    ('2026-B06', 2.25, 15, 0, 0, 0, timestamptz '2026-11-05 17:00:00+08', 'Pending')    -- pending verification
  ) as v(sid, gwa, units, failed, inc, drop_, sub_at, vstatus) on v.sid = sch.student_id
  returning id, scholar_id, verification_status, submitted_at
)
insert into public.audit_log (actor_name, actor_role, action, submission_id, scholar_id, details, created_at)
select 'Seed script', 'system', a.action, sub.id, sub.scholar_id, 'Synthetic test record', sub.submitted_at + a.delay
from sub
join lateral (values ('Submitted', interval '0'), ('Evidence Verified', interval '2 hours')) as a(action, delay)
  on (a.action = 'Submitted' or sub.verification_status = 'Verified');

-- link any test accounts that already exist (matching the e-mails above)
update public.scholars s set profile_id = p.id
  from public.profiles p
 where s.profile_id is null and s.email is not null and lower(p.email) = lower(s.email)
   and not exists (select 1 from public.scholars x where x.profile_id = p.id);

select s.student_id, s.full_name, pr.name as program, sub.gwa, sub.enrolled_units as units, sub.failed_count as failed,
       sub.incomplete_count as inc, sub.dropped_count as dropped,
       to_char(sub.submitted_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI') as submitted_manila,
       sub.verification_status
from public.scholars s join public.programs pr on pr.id = s.program_id
join public.submissions sub on sub.scholar_id = s.id
where s.student_id like '2026-B0%' order by s.student_id;
