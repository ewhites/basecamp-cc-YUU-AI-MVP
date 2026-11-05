-- Year Up United AI Lab: schema and row-level security for the four roles.
-- Sample data only. RLS is the source of truth for who sees what; the app never filters by role itself.

create type public.app_role as enum ('student', 'instructor', 'curriculum', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  persona text unique not null,        -- jasmine | rivera | okafor | lee (demo role switcher)
  created_at timestamptz not null default now()
);

create table public.sections (
  id text primary key,                 -- 'A' | 'B' | 'C'
  name text not null,
  cycle text not null
);

create table public.section_instructors (
  section_id text not null references public.sections (id) on delete cascade,
  instructor_id uuid not null references public.profiles (id) on delete cascade,
  primary key (section_id, instructor_id)
);

-- Students. id is the pseudonymous ID that is the only identifier ever sent to Claude.
create table public.students (
  id text primary key,                 -- e.g. 'S-B-007'
  user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null,
  track text not null,
  section_id text not null references public.sections (id),
  sample_group text not null           -- invented grouping used only for the eval fairness check
);
create index on public.students (section_id);

create table public.exercises (
  id text primary key,
  studio text not null check (studio in ('prompt', 'arena', 'agent')),
  module text not null,
  title text not null,
  track text not null,
  position int not null
);

-- Versioned rubric checks. Published rows are what the coach grades against.
create table public.rubric_checks (
  id bigint generated always as identity primary key,
  exercise_id text not null references public.exercises (id) on delete cascade,
  key text not null,
  version int not null default 1,
  text text not null,
  skill text not null check (skill in ('delegation', 'description', 'discernment', 'diligence')),
  method text not null default 'coach' check (method in ('coach', 'code')),
  status text not null default 'published' check (status in ('published', 'draft', 'retired')),
  eval_run_id uuid,                    -- the eval run that cleared this version for publishing
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (exercise_id, key, version)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  studio text not null,
  attempt_no int not null,
  input jsonb not null,                -- what the student wrote (scrubbed text is what reached Claude)
  output jsonb not null default '{}'::jsonb,   -- AI output / arena outputs / bot transcript
  status text not null check (status in ('scored', 'pending_score', 'needs_review', 'distress')),
  passed int,
  total int,
  tip text,
  model text,
  prompt_version text,
  released_at timestamptz,             -- instructor released to the (simulated) gradebook
  created_at timestamptz not null default now()
);
create index on public.attempts (student_id, created_at);
create index on public.attempts (exercise_id);

create table public.check_results (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  check_key text not null,
  skill text not null,
  pass boolean not null,
  coach_pass boolean,
  evidence text not null default '',
  evidence_verified boolean not null default false,
  reason text not null default '',
  needs_review boolean not null default false,
  overridden boolean not null default false,
  override_note text,
  overridden_by uuid references public.profiles (id),
  overridden_at timestamptz,
  primary key (attempt_id, check_key)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles (id),
  actor_role public.app_role,
  action text not null,                -- view_attempt | override_check | release_scores | admin_view_student_work | publish_rubric
  target text,
  reason text,
  created_at timestamptz not null default now()
);

create table public.safety_flags (
  id bigint generated always as identity primary key,
  student_id text references public.students (id) on delete cascade,
  kind text not null check (kind in ('distress', 'pii_removed', 'prompt_injection', 'refusal')),
  detail text not null,                -- never the student's raw message for distress flags
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.usage_ledger (
  id bigint generated always as identity primary key,
  student_id text references public.students (id) on delete set null,
  purpose text not null,               -- grade | run_prompt | arena | bot | qa | eval
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.usage_ledger (created_at);
create index on public.usage_ledger (student_id, created_at);

create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('grading', 'safety', 'rubric_draft')),
  model text not null,
  prompt_version text not null,
  summary jsonb not null,
  passed_gate boolean not null,
  rubric_draft_id bigint references public.rubric_checks (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.eval_results (
  run_id uuid not null references public.eval_runs (id) on delete cascade,
  case_id text not null,
  split text not null,
  rep int not null default 1,
  pass boolean not null,
  detail jsonb not null,
  primary key (run_id, case_id, rep)
);

-- Program-level rollups scaled to a full 1,700-student cycle (labeled "scaled from sample" in the UI).
create table public.program_rollups (
  cycle text not null,
  week int not null,
  skill text not null,
  pass_rate numeric(5, 4) not null,
  students int not null,
  primary key (cycle, week, skill)
);

-- ---------------------------------------------------------------- helper functions
-- security definer so policies can read the caller's role without recursive RLS.

create function public.auth_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.my_student_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid()
$$;

create function public.my_sections() returns setof text
language sql stable security definer set search_path = public as $$
  select section_id from public.section_instructors where instructor_id = auth.uid()
$$;

create function public.can_see_student(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.students s
    where s.id = sid
      and (
        s.user_id = auth.uid()
        or (public.auth_role() = 'instructor' and s.section_id in (select public.my_sections()))
      )
  )
$$;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.section_instructors enable row level security;
alter table public.students enable row level security;
alter table public.exercises enable row level security;
alter table public.rubric_checks enable row level security;
alter table public.attempts enable row level security;
alter table public.check_results enable row level security;
alter table public.audit_log enable row level security;
alter table public.safety_flags enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.eval_runs enable row level security;
alter table public.eval_results enable row level security;
alter table public.program_rollups enable row level security;

-- profiles: everyone sees their own; admins see all accounts and roles.
create policy profiles_self on public.profiles for select using (id = auth.uid());
create policy profiles_admin on public.profiles for select using (public.auth_role() = 'admin');

-- reference data
create policy sections_read on public.sections for select to authenticated using (true);
create policy exercises_read on public.exercises for select to authenticated using (true);
create policy section_instructors_read on public.section_instructors for select
  using (instructor_id = auth.uid() or public.auth_role() = 'admin');

-- students: a student sees only themself; an instructor only their own sections.
-- Curriculum and admin roles never see student rows directly (names hidden).
create policy students_visible on public.students for select using (public.can_see_student(id));

-- attempts and check results follow the student they belong to.
create policy attempts_visible on public.attempts for select using (public.can_see_student(student_id));
create policy check_results_visible on public.check_results for select using (
  exists (select 1 from public.attempts a where a.id = attempt_id and public.can_see_student(a.student_id))
);
-- No insert/update policies: only the server (service role, after verifying the session) writes
-- attempts and scores, so a student can never write their own grade. Overrides go through
-- override_check(), which re-checks the instructor's sections.

-- rubric: everyone reads published; curriculum and admin also read drafts.
create policy rubric_read on public.rubric_checks for select to authenticated
  using (status = 'published' or public.auth_role() in ('curriculum', 'admin'));

-- staff-only tables
create policy audit_admin on public.audit_log for select using (public.auth_role() = 'admin');
create policy flags_admin on public.safety_flags for select using (
  public.auth_role() = 'admin'
  or (public.auth_role() = 'instructor' and public.can_see_student(student_id))
);
create policy usage_admin on public.usage_ledger for select using (public.auth_role() = 'admin');
create policy eval_runs_staff on public.eval_runs for select using (public.auth_role() in ('admin', 'curriculum'));
create policy eval_results_staff on public.eval_results for select using (public.auth_role() in ('admin', 'curriculum'));
create policy rollups_staff on public.program_rollups for select using (public.auth_role() in ('admin', 'curriculum', 'instructor'));

-- ---------------------------------------------------------------- staff actions (audited)

create function public.log_attempt_view(p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_student text;
begin
  select student_id into v_student from attempts where id = p_attempt;
  if v_student is null or not can_see_student(v_student) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if auth_role() is distinct from 'student' then
    insert into audit_log (actor, actor_role, action, target) values (auth.uid(), auth_role(), 'view_attempt', p_attempt::text);
  end if;
end $$;

create function public.override_check(p_attempt uuid, p_key text, p_pass boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v_student text;
begin
  if auth_role() is distinct from 'instructor' then raise exception 'only instructors can override' using errcode = '42501'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'a note is required'; end if;
  select student_id into v_student from attempts where id = p_attempt;
  if v_student is null or not can_see_student(v_student) then raise exception 'not allowed' using errcode = '42501'; end if;

  update check_results
     set pass = p_pass, overridden = true, override_note = p_note, overridden_by = auth.uid(),
         overridden_at = now(), needs_review = false
   where attempt_id = p_attempt and check_key = p_key;
  if not found then raise exception 'no such check'; end if;

  update attempts a
     set passed = (select count(*) from check_results c where c.attempt_id = a.id and c.pass),
         status = case when exists (select 1 from check_results c where c.attempt_id = a.id and c.needs_review)
                       then 'needs_review' else 'scored' end
   where a.id = p_attempt;

  insert into audit_log (actor, actor_role, action, target, reason)
  values (auth.uid(), 'instructor', 'override_check', p_attempt::text || ':' || p_key, p_note);
end $$;

-- Simulated gradebook sync: marks scored attempts in one of the instructor's sections as released.
create function public.release_scores(p_section text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth_role() is distinct from 'instructor' or p_section not in (select my_sections()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update attempts a set released_at = now()
   from students s
   where s.id = a.student_id and s.section_id = p_section and a.released_at is null and a.status = 'scored';
  get diagnostics n = row_count;
  insert into audit_log (actor, actor_role, action, target, reason)
  values (auth.uid(), 'instructor', 'release_scores', 'section ' || p_section, n || ' attempts sent to gradebook (simulated)');
  return n;
end $$;

-- Admin break-glass read of one student's work: requires a reason and is always logged.
create function public.admin_view_student_work(p_student text, p_reason text)
returns table (attempt_id uuid, exercise_id text, attempt_no int, status text, passed int, total int, input jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() is distinct from 'admin' then raise exception 'admins only' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then raise exception 'a reason of at least 10 characters is required'; end if;
  insert into audit_log (actor, actor_role, action, target, reason)
  values (auth.uid(), 'admin', 'admin_view_student_work', p_student, p_reason);
  return query
    select a.id, a.exercise_id, a.attempt_no, a.status, a.passed, a.total, a.input, a.created_at
      from attempts a where a.student_id = p_student order by a.created_at;
end $$;

-- Curriculum view: pass rates by exercise and check across sections, no student names or IDs.
create function public.curriculum_check_stats()
returns table (exercise_id text, check_key text, skill text, section_id text, attempts bigint, pass_rate numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth_role() is null or auth_role() not in ('curriculum', 'admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select a.exercise_id, c.check_key, c.skill, s.section_id, count(*), round(avg(case when c.pass then 1 else 0 end), 4)
      from check_results c
      join attempts a on a.id = c.attempt_id
      join students s on s.id = a.student_id
     group by a.exercise_id, c.check_key, c.skill, s.section_id;
end $$;

-- Admin usage: spend by section (cohort) and purpose, no student identities.
create function public.usage_by_cohort(p_since timestamptz)
returns table (section_id text, purpose text, calls bigint, tokens bigint, cost_usd numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth_role() is distinct from 'admin' then raise exception 'admins only' using errcode = '42501'; end if;
  return query
    select coalesce(s.section_id, 'staff/eval'), u.purpose, count(*),
           sum(u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_write_tokens)::bigint,
           round(sum(u.cost_usd), 4)
      from usage_ledger u left join students s on s.id = u.student_id
     where u.created_at >= p_since
     group by 1, 2;
end $$;

-- Publishing a rubric draft requires an eval run on that draft that passed the gate.
create function public.publish_rubric_draft(p_draft bigint) returns void
language plpgsql security definer set search_path = public as $$
declare d rubric_checks%rowtype; ok boolean;
begin
  if auth_role() is null or auth_role() not in ('curriculum', 'admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from rubric_checks where id = p_draft and status = 'draft';
  if not found then raise exception 'no such draft'; end if;
  select exists (select 1 from eval_runs where rubric_draft_id = p_draft and passed_gate) into ok;
  if not ok then raise exception 'run the eval on this draft and pass the gate before publishing'; end if;
  update rubric_checks set status = 'retired' where exercise_id = d.exercise_id and key = d.key and status = 'published';
  update rubric_checks set status = 'published' where id = p_draft;
  insert into audit_log (actor, actor_role, action, target, reason)
  values (auth.uid(), auth_role(), 'publish_rubric', d.exercise_id || ':' || d.key || ' v' || d.version, 'eval gate passed');
end $$;

-- Lock function execution down to signed-in users (and the service role).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
