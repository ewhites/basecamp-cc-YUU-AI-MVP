-- Instructors can close a safety flag after they follow up, with a required note.
-- Additive only: new nullable columns and a new function.

alter table public.safety_flags
  add column if not exists resolved_by uuid references auth.users (id),
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;

create or replace function public.resolve_safety_flag(p_flag bigint, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student text;
begin
  if public.auth_role() is distinct from 'instructor' then
    raise exception 'only instructors can close a flag' using errcode = '42501';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'a note is required';
  end if;
  select student_id into v_student from public.safety_flags where id = p_flag;
  if v_student is null or not public.can_see_student(v_student) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.safety_flags
     set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolution_note = btrim(p_note)
   where id = p_flag and status = 'open';
  insert into public.audit_log (actor, actor_role, action, target, reason)
  values (auth.uid(), 'instructor', 'resolve_safety_flag', p_flag::text, btrim(p_note));
end;
$$;

revoke all on function public.resolve_safety_flag(bigint, text) from public;
grant execute on function public.resolve_safety_flag(bigint, text) to authenticated;
