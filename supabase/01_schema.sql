-- =====================================================================
-- SAD Lab Exam Section B - Scholarship Monitoring and Academic Compliance
-- 01_schema.sql  (run first, in the Supabase SQL Editor)
-- Safe to re-run: tables use IF NOT EXISTS, functions/policies are replaced.
-- All business rules are enforced HERE (RLS + RPC functions), not in the UI.
-- =====================================================================

-- ---------- TABLES ---------------------------------------------------

create table if not exists public.programs (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null unique,
  max_gwa        numeric(3,2) not null check (max_gwa between 1.00 and 5.00),
  min_units      integer not null check (min_units >= 0),
  max_failed     integer not null check (max_failed >= 0),
  max_incomplete integer not null check (max_incomplete >= 0),
  max_dropped    integer not null check (max_dropped >= 0),
  deadline       timestamptz not null,               -- stored absolute; shown in Asia/Manila
  requires_evidence boolean not null default true
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text not null default '',
  role       text not null default 'scholar' check (role in ('scholar','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.scholars (
  id           uuid primary key default gen_random_uuid(),
  student_id   text not null unique,
  full_name    text not null,
  email        text unique,
  profile_id   uuid unique references public.profiles(id) on delete set null,
  program_id   uuid not null references public.programs(id),
  award_status text not null default 'Active' check (award_status in ('Active','Suspended','Terminated')),
  created_at   timestamptz not null default now()
);

create table if not exists public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  scholar_id          uuid not null references public.scholars(id) on delete cascade,
  academic_year       text not null check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  semester            smallint not null check (semester in (1,2,3)),   -- 3 = Summer
  gwa                 numeric(3,2) not null check (gwa between 1.00 and 5.00),
  enrolled_units      integer not null check (enrolled_units >= 0),
  failed_count        integer not null check (failed_count >= 0),
  incomplete_count    integer not null check (incomplete_count >= 0),
  dropped_count       integer not null check (dropped_count >= 0),
  evidence_ref        text not null check (length(btrim(evidence_ref)) > 0),
  submitted_at        timestamptz not null default now(),   -- original submission time (used for lateness)
  resubmitted_at      timestamptz,
  resubmit_count      integer not null default 0,
  verification_status text not null default 'Pending' check (verification_status in ('Pending','Verified','Returned')),
  verification_reason text,
  verified_by         uuid references public.profiles(id),
  verified_at         timestamptz,
  compliance_result   text not null default 'Not Evaluated' check (compliance_result in ('Not Evaluated','Compliant','With Deficiency')),
  compliance_checks   jsonb,
  compliance_reasons  text[] not null default '{}',
  evaluated_by        uuid references public.profiles(id),
  evaluated_at        timestamptz,
  renewal_decision    text not null default 'Pending' check (renewal_decision in ('Pending','Approved','Held')),
  decision_note       text,
  decided_by          uuid references public.profiles(id),
  decided_at          timestamptz,
  constraint uq_scholar_term unique (scholar_id, academic_year, semester)   -- duplicate prevention
);

create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  actor_id      uuid,
  actor_name    text not null,
  actor_role    text,
  action        text not null,
  submission_id uuid references public.submissions(id) on delete cascade,
  scholar_id    uuid references public.scholars(id) on delete cascade,
  details       text
);

create index if not exists idx_sub_scholar on public.submissions(scholar_id);
create index if not exists idx_log_sub on public.audit_log(submission_id);

-- ---------- DEFAULT POLICY RECORDS (editable by staff in the app) ----------

insert into public.programs (code, name, max_gwa, min_units, max_failed, max_incomplete, max_dropped, deadline)
values
 ('EXC','Excellence Scholar',2.00,18,0,0,0,'2026-11-06 17:00:00+08'),
 ('ACC','Access Scholar',    2.50,15,0,0,1,'2026-11-06 17:00:00+08')
on conflict (code) do nothing;

-- ---------- HELPER FUNCTIONS ------------------------------------------------

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

create or replace function public.my_scholar_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.scholars where profile_id = auth.uid();
$$;

create or replace function public._require_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Access denied: only Scholarship Staff can perform this action.' using errcode = '42501';
  end if;
end $$;

create or replace function public._log(p_sub uuid, p_scholar uuid, p_action text, p_details text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_role text;
begin
  select coalesce(nullif(full_name,''), email), role into v_name, v_role from public.profiles where id = auth.uid();
  insert into public.audit_log(actor_id, actor_name, actor_role, action, submission_id, scholar_id, details)
  values (auth.uid(), coalesce(v_name,'System'), v_role, p_action, p_sub, p_scholar, p_details);
end $$;

create or replace function public._validate_summary(
  p_gwa numeric, p_units integer, p_failed integer, p_inc integer, p_drop integer, p_evidence text)
returns void language plpgsql immutable as $$
begin
  if p_gwa is null or p_gwa < 1.00 or p_gwa > 5.00 then
    raise exception 'Invalid GWA: enter a value from 1.00 to 5.00 (1.00 is best, 5.00 is failing).';
  end if;
  if p_gwa <> round(p_gwa, 2) then
    raise exception 'Invalid GWA: use at most 2 decimal places.';
  end if;
  if p_units is null or p_units < 0 then raise exception 'Invalid enrolled units: must be a non-negative whole number.'; end if;
  if p_failed is null or p_failed < 0 then raise exception 'Invalid failed count: must be a non-negative whole number.'; end if;
  if p_inc is null or p_inc < 0 then raise exception 'Invalid incomplete count: must be a non-negative whole number.'; end if;
  if p_drop is null or p_drop < 0 then raise exception 'Invalid dropped count: must be a non-negative whole number.'; end if;
  if p_evidence is null or length(btrim(p_evidence)) = 0 then
    raise exception 'Grade-document reference is required.';
  end if;
  if length(p_evidence) > 300 then raise exception 'Grade-document reference is too long (max 300 characters).'; end if;
end $$;

-- ---------- STAFF: scholars and policies ------------------------------------

create or replace function public.register_scholar(p_student_id text, p_full_name text, p_email text, p_program_id uuid)
returns public.scholars language plpgsql security definer set search_path = public as $$
declare r public.scholars; v_profile uuid;
begin
  perform public._require_staff();
  if p_student_id is null or btrim(p_student_id) = '' then raise exception 'Student ID is required.'; end if;
  if p_full_name is null or btrim(p_full_name) = '' then raise exception 'Full name is required.'; end if;
  if not exists (select 1 from public.programs where id = p_program_id) then raise exception 'Choose a scholarship program.'; end if;
  if p_email is not null and btrim(p_email) <> '' then
    select id into v_profile from public.profiles where lower(email) = lower(btrim(p_email))
      and not exists (select 1 from public.scholars s where s.profile_id = profiles.id);
  end if;
  insert into public.scholars(student_id, full_name, email, profile_id, program_id)
  values (btrim(p_student_id), btrim(p_full_name), nullif(btrim(coalesce(p_email,'')), ''), v_profile, p_program_id)
  returning * into r;
  perform public._log(null, r.id, 'Scholar registered', r.student_id || ' assigned to program ' ||
          (select name from public.programs where id = p_program_id));
  return r;
exception when unique_violation then
  raise exception 'That student ID or email is already registered.';
end $$;

create or replace function public.assign_program(p_scholar_id uuid, p_program_id uuid)
returns public.scholars language plpgsql security definer set search_path = public as $$
declare r public.scholars; v_old text; v_new text;
begin
  perform public._require_staff();
  select p.name into v_old from public.scholars s join public.programs p on p.id = s.program_id where s.id = p_scholar_id;
  select name into v_new from public.programs where id = p_program_id;
  if v_new is null or v_old is null then raise exception 'Scholar or program not found.'; end if;
  update public.scholars set program_id = p_program_id where id = p_scholar_id returning * into r;
  perform public._log(null, r.id, 'Program reassigned', v_old || ' -> ' || v_new || '. Re-run evaluation for existing submissions.');
  return r;
end $$;

create or replace function public.update_program(
  p_id uuid, p_max_gwa numeric, p_min_units integer, p_max_failed integer,
  p_max_incomplete integer, p_max_dropped integer, p_deadline timestamptz)
returns public.programs language plpgsql security definer set search_path = public as $$
declare r public.programs;
begin
  perform public._require_staff();
  if p_max_gwa is null or p_max_gwa < 1 or p_max_gwa > 5 then raise exception 'Maximum GWA must be between 1.00 and 5.00.'; end if;
  if least(p_min_units, p_max_failed, p_max_incomplete, p_max_dropped) < 0 then raise exception 'Unit and count limits cannot be negative.'; end if;
  if p_deadline is null then raise exception 'Deadline is required.'; end if;
  update public.programs set max_gwa = p_max_gwa, min_units = p_min_units, max_failed = p_max_failed,
         max_incomplete = p_max_incomplete, max_dropped = p_max_dropped, deadline = p_deadline
   where id = p_id returning * into r;
  if r.id is null then raise exception 'Program not found.'; end if;
  perform public._log(null, null, 'Policy updated', r.name || ': GWA<=' || r.max_gwa || ', units>=' || r.min_units ||
     ', failed<=' || r.max_failed || ', INC<=' || r.max_incomplete || ', dropped<=' || r.max_dropped ||
     ', deadline ' || to_char(r.deadline at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI'));
  return r;
end $$;

-- ---------- SCHOLAR: submit and correct -------------------------------------

create or replace function public.submit_grades(
  p_year text, p_semester smallint, p_gwa numeric, p_units integer,
  p_failed integer, p_inc integer, p_drop integer, p_evidence text)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_scholar_id(); r public.submissions;
begin
  if v_sid is null then
    raise exception 'Your account is not registered as a scholar yet. Ask Scholarship Staff to register your email.';
  end if;
  if p_year is null or p_year !~ '^[0-9]{4}-[0-9]{4}$' then raise exception 'Academic year must look like 2026-2027.'; end if;
  if p_semester is null or p_semester not in (1,2,3) then raise exception 'Choose a semester.'; end if;
  perform public._validate_summary(p_gwa, p_units, p_failed, p_inc, p_drop, p_evidence);
  if exists (select 1 from public.submissions where scholar_id = v_sid and academic_year = p_year and semester = p_semester) then
    raise exception 'Duplicate rejected: you already have a submission for AY % semester %. Open it under My submissions to check its status or correct it.', p_year, p_semester;
  end if;
  insert into public.submissions(scholar_id, academic_year, semester, gwa, enrolled_units, failed_count,
                                 incomplete_count, dropped_count, evidence_ref)
  values (v_sid, p_year, p_semester, p_gwa, p_units, p_failed, p_inc, p_drop, btrim(p_evidence))
  returning * into r;
  perform public._log(r.id, v_sid, 'Submitted', 'AY ' || p_year || ' semester ' || p_semester || ', GWA ' || p_gwa);
  return r;
exception when unique_violation then
  raise exception 'Duplicate rejected: a submission for AY % semester % already exists.', p_year, p_semester;
end $$;

create or replace function public.resubmit_grades(
  p_id uuid, p_gwa numeric, p_units integer, p_failed integer, p_inc integer, p_drop integer, p_evidence text)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare r public.submissions;
begin
  select * into r from public.submissions where id = p_id and scholar_id = public.my_scholar_id();
  if r.id is null then raise exception 'Submission not found.'; end if;
  if r.verification_status <> 'Returned' then
    raise exception 'Only submissions returned by staff can be corrected and resubmitted.';
  end if;
  perform public._validate_summary(p_gwa, p_units, p_failed, p_inc, p_drop, p_evidence);
  update public.submissions set
      gwa = p_gwa, enrolled_units = p_units, failed_count = p_failed, incomplete_count = p_inc,
      dropped_count = p_drop, evidence_ref = btrim(p_evidence),
      resubmitted_at = now(), resubmit_count = resubmit_count + 1,
      verification_status = 'Pending', verified_by = null, verified_at = null,
      compliance_result = 'Not Evaluated', compliance_checks = null, compliance_reasons = '{}',
      evaluated_by = null, evaluated_at = null,
      renewal_decision = 'Pending', decision_note = null, decided_by = null, decided_at = null
   where id = p_id returning * into r;
  perform public._log(r.id, r.scholar_id, 'Resubmitted', 'Correction sent; status returned to Pending verification.');
  return r;
end $$;

-- ---------- STAFF: verify, evaluate, decide ---------------------------------

create or replace function public.verify_submission(p_id uuid, p_status text, p_reason text)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare r public.submissions;
begin
  perform public._require_staff();
  if p_status not in ('Verified','Returned') then raise exception 'Verification status must be Verified or Returned.'; end if;
  select * into r from public.submissions where id = p_id;
  if r.id is null then raise exception 'Submission not found.'; end if;
  if r.verification_status = 'Returned' then
    raise exception 'This submission was returned and is waiting for the scholar to correct and resubmit it.';
  end if;
  if r.verification_status = p_status then raise exception 'Submission is already %.', p_status; end if;
  if p_status = 'Returned' and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception 'A reason is required when returning evidence.';
  end if;
  if p_status = 'Verified' and length(btrim(r.evidence_ref)) = 0 then
    raise exception 'Cannot verify: grade-document reference is missing.';
  end if;
  update public.submissions set verification_status = p_status, verification_reason = nullif(btrim(coalesce(p_reason,'')),''),
      verified_by = auth.uid(), verified_at = now(),
      compliance_result = 'Not Evaluated', compliance_checks = null, compliance_reasons = '{}',
      evaluated_by = null, evaluated_at = null,
      renewal_decision = 'Pending', decision_note = null, decided_by = null, decided_at = null
   where id = p_id returning * into r;
  perform public._log(r.id, r.scholar_id, 'Evidence ' || p_status, coalesce(nullif(btrim(coalesce(p_reason,'')),''), 'No reason given'));
  return r;
end $$;

create or replace function public.evaluate_submission(p_id uuid)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare
  s public.submissions; p public.programs;
  v_checks jsonb := '[]'::jsonb; v_reasons text[] := '{}'; v_late boolean; v_result text;
begin
  perform public._require_staff();
  select * into s from public.submissions where id = p_id;
  if s.id is null then raise exception 'Submission not found.'; end if;
  select pr.* into p from public.programs pr join public.scholars sc on sc.program_id = pr.id where sc.id = s.scholar_id;
  if s.verification_status <> 'Verified' or (p.requires_evidence and length(btrim(coalesce(s.evidence_ref,''))) = 0) then
    raise exception 'Cannot evaluate: evidence is %. Only Verified submissions with a grade-document reference can be evaluated.', s.verification_status;
  end if;

  -- thresholds come from the persisted program record, never from code constants
  v_checks := v_checks || jsonb_build_object('label','GWA','rule','<= ' || to_char(p.max_gwa,'FM0.00'),
                'actual', to_char(s.gwa,'FM0.00'), 'passed', s.gwa <= p.max_gwa);
  if s.gwa > p.max_gwa then v_reasons := v_reasons || format('GWA %s is above the maximum of %s', to_char(s.gwa,'FM0.00'), to_char(p.max_gwa,'FM0.00')); end if;

  v_checks := v_checks || jsonb_build_object('label','Enrolled units','rule','>= ' || p.min_units,
                'actual', s.enrolled_units::text, 'passed', s.enrolled_units >= p.min_units);
  if s.enrolled_units < p.min_units then v_reasons := v_reasons || format('Enrolled units %s is below the minimum of %s', s.enrolled_units, p.min_units); end if;

  v_checks := v_checks || jsonb_build_object('label','Failed subjects','rule','<= ' || p.max_failed,
                'actual', s.failed_count::text, 'passed', s.failed_count <= p.max_failed);
  if s.failed_count > p.max_failed then v_reasons := v_reasons || format('Failed subjects: %s (allowed %s)', s.failed_count, p.max_failed); end if;

  v_checks := v_checks || jsonb_build_object('label','Incomplete grades','rule','<= ' || p.max_incomplete,
                'actual', s.incomplete_count::text, 'passed', s.incomplete_count <= p.max_incomplete);
  if s.incomplete_count > p.max_incomplete then v_reasons := v_reasons || format('Incomplete grades: %s (allowed %s)', s.incomplete_count, p.max_incomplete); end if;

  v_checks := v_checks || jsonb_build_object('label','Dropped subjects','rule','<= ' || p.max_dropped,
                'actual', s.dropped_count::text, 'passed', s.dropped_count <= p.max_dropped);
  if s.dropped_count > p.max_dropped then v_reasons := v_reasons || format('Dropped subjects: %s (allowed %s)', s.dropped_count, p.max_dropped); end if;

  v_late := s.submitted_at > p.deadline;     -- exactly at the deadline is on time
  v_checks := v_checks || jsonb_build_object('label','Submission deadline',
                'rule','on or before ' || to_char(p.deadline at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI') || ' (Manila)',
                'actual', to_char(s.submitted_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI:SS'), 'passed', not v_late);
  if v_late then v_reasons := v_reasons || format('Late submission: received %s, deadline %s (Manila time)',
        to_char(s.submitted_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI:SS'),
        to_char(p.deadline at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI')); end if;

  v_result := case when cardinality(v_reasons) = 0 then 'Compliant' else 'With Deficiency' end;

  update public.submissions set compliance_result = v_result, compliance_checks = v_checks, compliance_reasons = v_reasons,
      evaluated_by = auth.uid(), evaluated_at = now(),
      renewal_decision = 'Pending', decision_note = null, decided_by = null, decided_at = null
   where id = p_id returning * into s;
  perform public._log(s.id, s.scholar_id, 'Evaluated: ' || v_result,
        case when v_result = 'Compliant' then 'All policy checks passed' else array_to_string(v_reasons, '; ') end);
  return s;
end $$;

create or replace function public.decide_renewal(p_id uuid, p_decision text, p_note text)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare s public.submissions;
begin
  perform public._require_staff();
  if p_decision not in ('Approved','Held') then raise exception 'Decision must be Approved or Held.'; end if;
  select * into s from public.submissions where id = p_id;
  if s.id is null then raise exception 'Submission not found.'; end if;
  if s.verification_status <> 'Verified' or s.compliance_result = 'Not Evaluated' then
    raise exception 'Cannot record a renewal decision: the submission must be Verified and evaluated first.';
  end if;
  if p_decision = 'Approved' and s.compliance_result <> 'Compliant' then
    raise exception 'Cannot approve renewal: the evaluation is With Deficiency. Staff may only hold this renewal.';
  end if;
  if p_decision = 'Held' and (p_note is null or length(btrim(p_note)) = 0) then
    raise exception 'A decision note is required when holding a renewal.';
  end if;
  update public.submissions set renewal_decision = p_decision, decision_note = nullif(btrim(coalesce(p_note,'')),''),
      decided_by = auth.uid(), decided_at = now()
   where id = p_id returning * into s;
  perform public._log(s.id, s.scholar_id, 'Renewal ' || p_decision, coalesce(nullif(btrim(coalesce(p_note,'')),''),'No note'));
  return s;
end $$;

-- ---------- NEW USER TRIGGER (role is ALWAYS scholar; staff is granted in SQL) ----

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, role)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), 'scholar')
  on conflict (id) do nothing;
  update public.scholars set profile_id = new.id
   where profile_id is null and email is not null and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ROW LEVEL SECURITY ---------------------------------------------

alter table public.programs    enable row level security;
alter table public.profiles    enable row level security;
alter table public.scholars    enable row level security;
alter table public.submissions enable row level security;
alter table public.audit_log   enable row level security;

drop policy if exists programs_read    on public.programs;
drop policy if exists profiles_read    on public.profiles;
drop policy if exists scholars_read    on public.scholars;
drop policy if exists submissions_read on public.submissions;
drop policy if exists audit_read       on public.audit_log;

create policy programs_read    on public.programs    for select to authenticated using (true);
create policy profiles_read    on public.profiles    for select to authenticated using (id = auth.uid() or public.is_staff());
create policy scholars_read    on public.scholars    for select to authenticated using (public.is_staff() or profile_id = auth.uid());
create policy submissions_read on public.submissions for select to authenticated using (public.is_staff() or scholar_id = public.my_scholar_id());
create policy audit_read       on public.audit_log   for select to authenticated using (public.is_staff() or (scholar_id is not null and scholar_id = public.my_scholar_id()));

-- No INSERT/UPDATE/DELETE policies exist: every change goes through the RPC functions above.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.programs, public.profiles, public.scholars, public.submissions, public.audit_log to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.register_scholar(text,text,text,uuid), public.assign_program(uuid,uuid),
  public.update_program(uuid,numeric,integer,integer,integer,integer,timestamptz),
  public.submit_grades(text,smallint,numeric,integer,integer,integer,integer,text),
  public.resubmit_grades(uuid,numeric,integer,integer,integer,integer,text),
  public.verify_submission(uuid,text,text), public.evaluate_submission(uuid),
  public.decide_renewal(uuid,text,text), public.is_staff(), public.my_scholar_id()
to authenticated;
