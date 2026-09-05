-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.0 (CA8) : cles d idempotence
-- ----------------------------------------------------------------------------
-- Support durable du port IdempotencyStore
-- (src/modules/_shared/application/idempotency.ts). Sans persistance, la
-- garantie ne survit pas a un redemarrage de process, ce qui la rend
-- inutilisable : c est justement apres un incident reseau que le client
-- retente.
--
-- Regle : (tenant_id, key) est unique. Meme cle + meme empreinte -> la reponse
-- memorisee est rejouee. Meme cle + empreinte differente -> 409
-- api.idempotency_key_reused, car rendre la mauvaise ressource serait pire que
-- refuser.
--
-- L empreinte couvre (methode, chemin, corps canonique) — voir
-- fingerprintRequest().
-- ============================================================================

create table if not exists public.api_idempotency_keys (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  idempotency_key  text not null,
  -- SHA-256 hexadecimal du couple (operation, corps canonique).
  fingerprint      text not null,
  -- 'in_progress' tant que l operation n a pas rendu sa reponse, 'completed'
  -- ensuite. Une requete concurrente sur une cle 'in_progress' recoit 409
  -- plutot que de dupliquer le travail.
  status           text not null default 'in_progress',
  response_status  integer,
  response_body    jsonb,
  response_etag    text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,
  -- Duree de retention : au-dela, la cle est purgee et une reutilisation
  -- redevient une creation normale.
  expires_at       timestamptz not null default (now() + interval '24 hours'),

  constraint api_idempotency_keys_unique unique (tenant_id, idempotency_key),
  constraint api_idempotency_keys_key_shape
    check (idempotency_key ~ '^[A-Za-z0-9_.:-]{8,255}$'),
  constraint api_idempotency_keys_fingerprint_shape
    check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint api_idempotency_keys_status_values
    check (status in ('in_progress', 'completed')),
  constraint api_idempotency_keys_completed_shape
    check (
      status <> 'completed'
      or (response_status is not null and response_body is not null and completed_at is not null)
    ),
  constraint api_idempotency_keys_response_status_range
    check (response_status is null or (response_status >= 100 and response_status <= 599))
);

comment on table public.api_idempotency_keys is
  'E10.0 CA8 — cles Idempotency-Key et reponses memorisees, par tenant. Purgeable au-dela de expires_at.';

create index if not exists api_idempotency_keys_expiry_idx
  on public.api_idempotency_keys (expires_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Table strictement serveur : elle memorise des corps de reponse, donc des
-- donnees metier. Aucune surface navigateur ne doit l atteindre. La RLS ferme
-- la lecture cote client meme si un grant etait accorde par erreur plus tard.
alter table public.api_idempotency_keys enable row level security;

drop policy if exists "api_idempotency_keys_select" on public.api_idempotency_keys;
drop policy if exists "api_idempotency_keys_write" on public.api_idempotency_keys;

revoke all on table public.api_idempotency_keys from public, anon, authenticated;
grant select, insert, update, delete on table public.api_idempotency_keys to service_role;

-- ============================================================================
-- REVERSIBILITE — SQL de retrait, a jouer tel quel dans une migration inverse :
--
--   drop index if exists public.api_idempotency_keys_expiry_idx;
--   drop table if exists public.api_idempotency_keys;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table n a de cle etrangere vers api_idempotency_keys.
-- ============================================================================

notify pgrst, 'reload schema';
