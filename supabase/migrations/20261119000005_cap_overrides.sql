-- Cost console (WCR spec, decided by Logan 2026-11-19, item 4).
-- Facilitators can change one student's daily token limit, with a reason; every change is logged.
-- Admins get a totals-only cost summary. Backward-compatible: only adds a table, a nullable column and functions.

-- Which lesson task a model call belonged to, so the admin view can rank lessons by usage. Null for lesson Q&A.
alter table public.usage_ledger add column if not exists exercise_id text references public.exercises (id);
create index if not exists usage_ledger_exercise_idx on public.usage_ledger (exercise_id, created_at);

create table if not exists public.cap_overrides (
  id bigint generated always as identity primary key,
  student_id text not null references public.students (id),
  daily_tokens integer not null check (daily_tokens between 1000 and 300000),
  previous_tokens integer,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  actor uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists cap_overrides_student_idx on public.cap_overrides (student_id, created_at desc);

alter table public.cap_overrides enable row level security;

-- Students read their own limit changes, facilitators those for students in their sections, admins all.
create policy cap_overrides_read on public.cap_overrides for select using (
  public.auth_role() = 'admin' or public.can_see_student(student_id)
);
-- No insert, update or delete policy, and no table grants for those: the log is append-only, and the only way
-- to write it is set_daily_cap (security definer), which also writes the audit log and computes the old limit
-- and the time on the server. A direct insert could skip the audit log or record a false old limit.
revoke insert, update, delete on public.cap_overrides from anon, authenticated;

-- The default daily limit (DEFAULT_DAILY_TOKENS in src/lib/coach/budget.ts). Fixed here, never from the caller,
-- so the "old limit" in the log cannot be set by whoever makes the change.
create or replace function public.default_daily_tokens() returns integer language sql immutable as $$ select 60000 $$;

create or replace function public.set_daily_cap(p_student text, p_tokens integer, p_reason text)
returns public.cap_overrides
language plpgsql security definer set search_path = public as $$
declare
  v_prev integer;
  v_row cap_overrides;
begin
  if auth_role() is distinct from 'instructor' then raise exception 'only facilitators can change a daily limit' using errcode = '42501'; end if;
  if not can_see_student(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_tokens is null or p_tokens < 1000 or p_tokens > 300000 then raise exception 'the limit must be a whole number from 1000 to 300000'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'a reason is required'; end if;
  select daily_tokens into v_prev from cap_overrides where student_id = p_student order by created_at desc, id desc limit 1;
  v_prev := coalesce(v_prev, default_daily_tokens());
  insert into cap_overrides (student_id, daily_tokens, previous_tokens, reason, actor)
  values (p_student, p_tokens, v_prev, btrim(p_reason), auth.uid()) returning * into v_row;
  insert into audit_log (actor, actor_role, action, target, reason)
  values (auth.uid(), auth_role(), 'set_daily_cap', p_student || ': ' || v_prev || ' to ' || p_tokens || ' tokens', btrim(p_reason));
  return v_row;
end $$;

-- One student's limit and today's token use (totals only).
create or replace function public.daily_cap_status(p_student text, p_since timestamptz)
returns table (default_tokens integer, daily_tokens integer, used_today bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth_role() is distinct from 'admin' and not can_see_student(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select default_daily_tokens(),
           coalesce((select o.daily_tokens from cap_overrides o where o.student_id = p_student order by o.created_at desc, o.id desc limit 1), default_daily_tokens()),
           coalesce((select sum(u.input_tokens + u.output_tokens) from usage_ledger u where u.student_id = p_student and u.created_at >= p_since), 0)::bigint;
end $$;

-- Admin cost summary: spend per student by pseudonymous ID, tokens by model, usage by lesson. Never message content.
create or replace function public.admin_cost_summary(p_month_start timestamptz, p_week_start timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if auth_role() is distinct from 'admin' then raise exception 'admins only' using errcode = '42501'; end if;
  with m as (select * from usage_ledger where created_at >= p_month_start)
  select jsonb_build_object(
    'spend_usd', coalesce((select sum(cost_usd) from m), 0),
    'calls', (select count(*) from m),
    'tokens', (select jsonb_build_object('input', coalesce(sum(input_tokens), 0), 'output', coalesce(sum(output_tokens), 0),
                                         'cache_read', coalesce(sum(cache_read_tokens), 0), 'cache_write', coalesce(sum(cache_write_tokens), 0)) from m),
    'cache_hit_rate', (select case when sum(input_tokens + cache_read_tokens + cache_write_tokens) > 0
                                   then sum(cache_read_tokens)::numeric / sum(input_tokens + cache_read_tokens + cache_write_tokens) end from m),
    'active_students', (select count(distinct sid) from (
        select student_id sid from usage_ledger where student_id is not null and created_at >= p_week_start
        union select student_id from attempts where created_at >= p_week_start) a),
    'students_total', (select count(*) from students),
    'top_spenders', coalesce((select jsonb_agg(t) from (
        select m.student_id, s.section_id, sum(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) tokens, sum(cost_usd) cost_usd, count(*) calls
        from m join students s on s.id = m.student_id group by m.student_id, s.section_id order by sum(cost_usd) desc, m.student_id limit 8) t), '[]'::jsonb),
    'by_model', coalesce((select jsonb_agg(t) from (
        select model, count(*) calls, sum(input_tokens) input, sum(output_tokens) output, sum(cache_read_tokens) cache_read,
               sum(cache_write_tokens) cache_write, sum(cost_usd) cost_usd
        from m group by model order by sum(cost_usd) desc) t), '[]'::jsonb),
    'top_lessons', coalesce((select jsonb_agg(t) from (
        select exercise_id, sum(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) tokens, sum(cost_usd) cost_usd, count(distinct student_id) students
        from m where exercise_id is not null group by exercise_id order by 2 desc, exercise_id limit 8) t), '[]'::jsonb)
  ) into v;
  return v;
end $$;

grant execute on function public.set_daily_cap(text, integer, text) to authenticated, service_role;
grant execute on function public.daily_cap_status(text, timestamptz) to authenticated, service_role;
grant execute on function public.admin_cost_summary(timestamptz, timestamptz) to authenticated, service_role;
