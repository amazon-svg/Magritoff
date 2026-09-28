-- HopeStudio session persisted on the commercial project.
-- Down migration:
--   alter table public.projects drop column if exists hopstudio_session_id;

alter table public.projects
  add column if not exists hopstudio_session_id text;

comment on column public.projects.hopstudio_session_id is
  'Session HopeStudio associee au projet. Nullable avant le premier chat; identifiant opaque fourni par HopeStudio.';

alter table public.projects
  add constraint projects_hopstudio_session_id_length
  check (hopstudio_session_id is null or char_length(hopstudio_session_id) between 1 and 255);
