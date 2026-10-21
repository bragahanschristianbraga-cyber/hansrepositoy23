-- =====================================================================
-- 04_run_tests.sql  - runs TC01-TC10 against the REAL backend (RLS + RPC)
-- Prerequisites: 01, 02, 03 done (staff@sad.test, scholar1@sad.test = B01, scholar2@sad.test = B02).
-- It impersonates each user (set role authenticated + JWT claims), so the
-- results prove backend enforcement, not just hidden buttons.
-- Afterwards run 02_seed.sql again to reset the data. Paste the output table
-- into docs/test_results.md as the "actual result" column.
-- =====================================================================

create table if not exists public.test_results (
  run_at timestamptz default now(), test_id text, action text, expected text, actual text, result text);
alter table public.test_results enable row level security;   -- no policies: invisible to the app

create or replace function pg_temp._as(p_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $f$;

create or replace function pg_temp._back() returns void language plpgsql as $f$
begin execute 'reset role'; end $f$;

do $$
declare
  v_staff uuid; v_s1 uuid; v_s2 uuid;
  id01 uuid; id02 uuid; id03 uuid; id04 uuid; id05 uuid; id06 uuid;
  r public.submissions; msg text; msg2 text; msg3 text; n int; ok boolean;
  yr text := '2026-2027';

begin
  select id into v_staff from public.profiles where lower(email) = 'staff@sad.test' and role = 'staff';
  select profile_id into v_s1 from public.scholars where student_id = '2026-B01';
  select profile_id into v_s2 from public.scholars where student_id = '2026-B02';
  if v_staff is null or v_s1 is null or v_s2 is null then
    raise exception 'Create staff@sad.test, scholar1@sad.test, scholar2@sad.test, then run 02_seed.sql and 03_make_staff.sql first.';
  end if;
  select id into id01 from public.submissions where scholar_id = (select id from public.scholars where student_id='2026-B01');
  select id into id02 from public.submissions where scholar_id = (select id from public.scholars where student_id='2026-B02');
  select id into id03 from public.submissions where scholar_id = (select id from public.scholars where student_id='2026-B03');
  select id into id04 from public.submissions where scholar_id = (select id from public.scholars where student_id='2026-B04');
  select id into id05 from public.submissions where scholar_id = (select id from public.scholars where student_id='2026-B05');
  select id into id06 from public.submissions where scholar_id = (select id from public.scholars where student_id='2026-B06');

  delete from public.test_results;

  -- TC01 --------------------------------------------------------------
  perform pg_temp._as(v_staff);
  r := public.evaluate_submission(id01);
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC01','Staff evaluates B01 (GWA 2.00, submitted exactly 2026-11-06 17:00)','Compliant',
    r.compliance_result || ' (reasons: ' || coalesce(nullif(array_to_string(r.compliance_reasons,'; '),''),'none') || ')',
    case when r.compliance_result = 'Compliant' then 'PASS' else 'FAIL' end);

  -- TC02 --------------------------------------------------------------
  perform pg_temp._as(v_staff);
  r := public.evaluate_submission(id02);
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC02','Staff evaluates B02 (GWA 2.01, Excellence max 2.00)','With Deficiency + GWA reason',
    r.compliance_result || ' (' || array_to_string(r.compliance_reasons,'; ') || ')',
    case when r.compliance_result = 'With Deficiency' and array_to_string(r.compliance_reasons,';') ilike '%GWA%' then 'PASS' else 'FAIL' end);

  -- TC03 --------------------------------------------------------------
  perform pg_temp._as(v_staff);
  r := public.evaluate_submission(id03);
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC03','Staff evaluates B03 (Access, GWA 2.50, 15 units, 1 dropped)','Compliant (1 drop allowed for Access)',
    r.compliance_result || ' (reasons: ' || coalesce(nullif(array_to_string(r.compliance_reasons,'; '),''),'none') || ')',
    case when r.compliance_result = 'Compliant' then 'PASS' else 'FAIL' end);

  -- TC04 --------------------------------------------------------------
  perform pg_temp._as(v_staff);
  r := public.evaluate_submission(id04);
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC04','Staff evaluates B04 (14 units, 1 incomplete)','With Deficiency: insufficient units AND incomplete grade',
    r.compliance_result || ' (' || array_to_string(r.compliance_reasons,'; ') || ')',
    case when r.compliance_result = 'With Deficiency' and array_to_string(r.compliance_reasons,';') ilike '%units%'
          and array_to_string(r.compliance_reasons,';') ilike '%Incomplete%' then 'PASS' else 'FAIL' end);

  -- TC05 --------------------------------------------------------------
  perform pg_temp._as(v_staff);
  r := public.evaluate_submission(id05);
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC05','Staff evaluates B05 (1 failed, submitted 17:01)','With Deficiency: failed subject AND late submission',
    r.compliance_result || ' (' || array_to_string(r.compliance_reasons,'; ') || ')',
    case when r.compliance_result = 'With Deficiency' and array_to_string(r.compliance_reasons,';') ilike '%Failed%'
          and array_to_string(r.compliance_reasons,';') ilike '%Late%' then 'PASS' else 'FAIL' end);

  -- TC06 --------------------------------------------------------------
  msg := null; msg2 := null;
  perform pg_temp._as(v_staff);
  begin perform public.evaluate_submission(id06); exception when others then msg := sqlerrm; end;
  begin perform public.decide_renewal(id06, 'Approved', 'try'); exception when others then msg2 := sqlerrm; end;
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC06','Staff tries to evaluate and approve renewal for B06 (Pending verification)','Both blocked',
    'Evaluate: ' || coalesce(msg,'NOT BLOCKED') || ' | Approve: ' || coalesce(msg2,'NOT BLOCKED'),
    case when msg is not null and msg2 is not null then 'PASS' else 'FAIL' end);

  -- TC07 --------------------------------------------------------------
  msg := null; msg2 := null; msg3 := null;
  perform pg_temp._as(v_s1);
  begin perform public.submit_grades(yr, 1::smallint, 2.0, 18, 0, 0, 0, 'dup.pdf'); exception when others then msg := sqlerrm; end;
  begin perform public.submit_grades(yr, 2::smallint, 0.50, 18, 0, 0, 0, 'x.pdf'); exception when others then msg2 := sqlerrm; end;
  begin perform public.submit_grades(yr, 2::smallint, 2.0, 18, -1, 0, 0, 'x.pdf'); exception when others then msg3 := sqlerrm; end;
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC07','Scholar submits duplicate semester; GWA 0.50; negative failed count','All three rejected with clear messages',
    'Dup: ' || coalesce(msg,'ACCEPTED') || ' | GWA 0.50: ' || coalesce(msg2,'ACCEPTED') || ' | Negative: ' || coalesce(msg3,'ACCEPTED'),
    case when msg ilike '%Duplicate%' and msg2 ilike '%GWA%' and msg3 ilike '%non-negative%' then 'PASS' else 'FAIL' end);

  -- TC08 --------------------------------------------------------------
  msg := null; msg2 := null;
  perform pg_temp._as(v_s1);
  select count(*) into n from public.submissions;                          -- should see only own row
  ok := (n = 1) and not exists (select 1 from public.submissions where id = id02);
  begin perform public.verify_submission(id02, 'Verified', null); exception when others then msg := sqlerrm; end;
  begin perform public.verify_submission(id01, 'Returned', 'self'); exception when others then msg2 := sqlerrm; end;
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC08','As scholar1: read all submissions, read B02 row, call verify on B02 and on own record','Only own row visible; verify denied',
    'Rows visible: ' || n || '; B02 row visible: ' || (case when ok then 'no' else 'YES' end) || ' | Verify B02: ' || coalesce(msg,'ALLOWED') || ' | Verify own: ' || coalesce(msg2,'ALLOWED'),
    case when ok and msg is not null and msg2 is not null then 'PASS' else 'FAIL' end);

  -- TC09 --------------------------------------------------------------
  perform pg_temp._as(v_staff);
  perform public.verify_submission(id02, 'Returned', 'GWA does not match the grade document - please recheck');
  perform pg_temp._back();
  perform pg_temp._as(v_s2);
  r := public.resubmit_grades(id02, 1.95, 18, 0, 0, 0, 'GRADES-2026-B02-corrected.pdf');
  select count(*) into n from public.audit_log where submission_id = id02 and action in ('Evidence Returned','Resubmitted');
  perform pg_temp._back();
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC09','Staff returns B02; scholar2 corrects and resubmits','Status Pending verification; history kept (>= 2 return/resubmit entries)',
    'Status: ' || r.verification_status || '; GWA now ' || r.gwa || '; history entries: ' || n,
    case when r.verification_status = 'Pending' and n >= 2 then 'PASS' else 'FAIL' end);

  -- TC10 --------------------------------------------------------------
  msg := null; msg2 := null;
  perform pg_temp._as(v_staff);
  r := public.decide_renewal(id01, 'Approved', 'Meets all requirements');                -- compliant -> approve
  begin perform public.decide_renewal(id04, 'Approved', null); exception when others then msg := sqlerrm; end;  -- deficient -> blocked
  perform public.decide_renewal(id04, 'Held', 'Insufficient units and incomplete grade');
  perform pg_temp._back();
  perform pg_temp._as(v_s1);
  begin perform public.decide_renewal(id01, 'Held', 'scholar tampering'); exception when others then msg2 := sqlerrm; end;
  perform pg_temp._back();
  select * into r from public.submissions where id = id01;
  insert into public.test_results(test_id, action, expected, actual, result) values
   ('TC10','Staff approves B01, tries approving B04 then holds it; scholar tries to change a decision','Approved(B01) ok; B04 approve blocked, Held ok; scholar denied',
    'B01: ' || r.renewal_decision || ' | B04 approve: ' || coalesce(msg,'ALLOWED') || ' | Scholar change: ' || coalesce(msg2,'ALLOWED'),
    case when r.renewal_decision = 'Approved' and msg is not null and msg2 is not null
          and (select renewal_decision from public.submissions where id = id04) = 'Held' then 'PASS' else 'FAIL' end);
end $$;

select test_id, action, expected, actual, result from public.test_results order by test_id;
