-- The coach now practices five model-facing skills (prompting, validation, context engineering,
-- comparing models, responsible use) instead of the four AI Fluency skills. Backward-compatible:
-- the old values stay allowed until no row uses them, so the old code keeps working during a deploy.
alter table public.rubric_checks drop constraint if exists rubric_checks_skill_check;
alter table public.rubric_checks add constraint rubric_checks_skill_check
  check (skill in ('prompting', 'validation', 'context', 'models', 'responsible',
                   'delegation', 'description', 'discernment', 'diligence'));
