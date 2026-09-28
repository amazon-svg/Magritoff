-- Une session HopeStudio appartient a un seul projet dans un tenant.
-- L index est partiel afin que tous les projets puissent rester sans session
-- avant leur premier chat.
--
-- La migration echoue volontairement si des doublons existent deja : il faut
-- alors les auditer et les dissocier plutot que choisir silencieusement quel
-- projet conserverait l historique HopeStudio.

create unique index if not exists projects_tenant_hopstudio_session_id_unique
  on public.projects (tenant_id, hopstudio_session_id)
  where hopstudio_session_id is not null;

comment on index public.projects_tenant_hopstudio_session_id_unique is
  'Garantit qu une session HopeStudio n est associee qu a un seul projet par tenant.';
