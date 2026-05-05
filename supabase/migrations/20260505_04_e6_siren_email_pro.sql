-- =============================================================================
-- Migration E6.1 / v4 — Validation SIREN + email professionnel
-- -----------------------------------------------------------------------------
-- Ajoute aux tenants les champs d'identification entreprise :
--   * siren        : numero SIREN FR (9 chiffres) ou tax id international
--   * siren_data   : payload JSON de la verification INSEE (raison sociale,
--                    code NAF, etat actif/cesse...)
--   * verified     : true si le SIREN a ete valide par l'API INSEE (ou son
--                    bouchon en attendant l'integration reelle)
--   * verified_at  : horodatage de la verification
--
-- L'API INSEE Sirene V3 reelle sera branchee plus tard. En attendant, le
-- service cote front mock la reponse pour ne pas bloquer le dev.
-- =============================================================================

alter table public.tenants
  add column if not exists siren        text;

alter table public.tenants
  add column if not exists siren_data   jsonb default '{}'::jsonb;

alter table public.tenants
  add column if not exists verified     boolean not null default false;

alter table public.tenants
  add column if not exists verified_at  timestamptz;

-- Unicite du SIREN (un meme SIREN ne peut etre utilise par 2 tenants).
-- Mais permettre les NULLs (un tenant systeme ou freemium peut etre sans SIREN).
create unique index if not exists tenants_siren_idx
  on public.tenants(siren) where siren is not null;

notify pgrst, 'reload schema';
