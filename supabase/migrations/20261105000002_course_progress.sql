-- Course player: skills-check tasks, lesson progress, and instructors reading coach accuracy.
-- Additive only (backward compatible with 20261105000001).

alter table public.exercises drop constraint if exists exercises_studio_check;
alter table public.exercises add constraint exercises_studio_check check (studio in ('prompt', 'arena', 'agent', 'check'));

-- One row per lesson a student has finished. Written only by the server after it verifies the session.
create table public.lesson_progress (
  student_id text not null references public.students (id) on delete cascade,
  step_id text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, step_id)
);
alter table public.lesson_progress enable row level security;
create policy lesson_progress_visible on public.lesson_progress for select using (public.can_see_student(student_id));

-- Instructors see the coach's measured accuracy (aggregate eval numbers, no student data).
drop policy if exists eval_runs_staff on public.eval_runs;
create policy eval_runs_staff on public.eval_runs for select using (public.auth_role() in ('admin', 'curriculum', 'instructor'));

-- Skills checks are never graded for credit: release only practice attempts to the gradebook.
create or replace function public.release_scores(p_section text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth_role() is distinct from 'instructor' or p_section not in (select my_sections()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update attempts a set released_at = now()
   from students s
   where s.id = a.student_id and s.section_id = p_section and a.released_at is null and a.status = 'scored'
     and a.studio <> 'check';
  get diagnostics n = row_count;
  insert into audit_log (actor, actor_role, action, target, reason)
  values (auth.uid(), 'instructor', 'release_scores', 'section ' || p_section, n || ' attempts sent to gradebook (simulated)');
  return n;
end $$;
