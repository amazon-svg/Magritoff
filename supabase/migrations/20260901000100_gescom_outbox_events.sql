-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.0 (CA10) : bus d evenements sortants
-- ----------------------------------------------------------------------------
-- Pattern outbox. L evenement est ecrit ICI dans la meme transaction que la
-- modification metier, puis relaye par un dispatcher. Publier directement en
-- HTTP depuis le service casserait l atomicite : la commande passerait mais
-- l evenement se perdrait, ou l inverse.
--
-- Evenements prevus par le sprint (la contrainte reste ouverte, la liste est
-- additive — CA13) : quote.converted, order.step_changed,
-- order.files_submitted, customer.created, price_rule.changed.
--
-- Contrat d enveloppe : openapi/magrit-core.v1.yaml, schema EventEnvelope.
-- Signature de livraison : X-Magrit-Signature: sha256=<hmac>, calculee par
-- src/modules/_shared/application/outbox.ts. La signature n est PAS stockee :
-- elle porte sur le corps effectivement transmis, au moment de la livraison.
--
-- APPEND-ONLY : le contenu metier d une ligne n est jamais modifie. Seul le
-- suivi de livraison (published_at, delivery_attempts, last_error) evolue.
-- ============================================================================

create table if not exists public.outbox_events (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  event_name         text not null,
  -- Version du schema de payload pour ce event_name. Incrementee uniquement
  -- sur changement cassant ; un ajout de champ optionnel ne l incremente pas.
  event_version      integer not null default 1,
  aggregate_type     text not null,
  aggregate_id       uuid not null,
  payload            jsonb not null default '{}'::jsonb,
  occurred_at        timestamptz not null default now(),
  -- Suivi de livraison (seules colonnes mutables).
  published_at       timestamptz,
  delivery_attempts  integer not null default 0,
  last_error         text,
  created_at         timestamptz not null default now(),

  constraint outbox_events_name_shape
    check (event_name ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  constraint outbox_events_aggregate_type_shape
    check (aggregate_type ~ '^[a-z][a-z0-9_]*$'),
  constraint outbox_events_version_positive
    check (event_version >= 1),
  constraint outbox_events_attempts_positive
    check (delivery_attempts >= 0),
  constraint outbox_events_payload_is_object
    check (jsonb_typeof(payload) = 'object')
);

comment on table public.outbox_events is
  'E10.0 CA10 — evenements sortants en attente de relais. Append-only : seules published_at, delivery_attempts et last_error sont mutables.';

-- File de livraison : le dispatcher lit les non publies, du plus ancien au
-- plus recent. Index partiel — la file utile reste petite meme quand la table
-- accumule l historique.
create index if not exists outbox_events_pending_idx
  on public.outbox_events (occurred_at)
  where published_at is null;

create index if not exists outbox_events_tenant_idx
  on public.outbox_events (tenant_id, occurred_at desc);

create index if not exists outbox_events_aggregate_idx
  on public.outbox_events (aggregate_type, aggregate_id, occurred_at desc);

-- ── Append-only : garde structurelle, pas une convention d equipe ───────────
create or replace function public.outbox_events_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    -- Purger l historique reste possible, mais uniquement pour des evenements
    -- deja relayes : supprimer une ligne en attente perdrait l evenement.
    if old.published_at is null then
      raise exception using
        errcode = '42501',
        message = 'outbox_append_only: un evenement non publie ne peut pas etre supprime';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.event_name is distinct from old.event_name
     or new.event_version is distinct from old.event_version
     or new.aggregate_type is distinct from old.aggregate_type
     or new.aggregate_id is distinct from old.aggregate_id
     or new.payload is distinct from old.payload
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'outbox_append_only: le contenu d un evenement est immuable';
  end if;

  return new;
end;
$$;

drop trigger if exists outbox_events_append_only on public.outbox_events;
create trigger outbox_events_append_only
  before update or delete on public.outbox_events
  for each row execute function public.outbox_events_reject_mutation();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Defense en profondeur. En exploitation, l ecriture et le relais passent par
-- service_role (qui contourne la RLS) ; aucune surface navigateur n atteint
-- cette table. Les policies couvrent le cas ou un role authentifie se verrait
-- accorder un acces plus tard.
alter table public.outbox_events enable row level security;

drop policy if exists "outbox_events_select" on public.outbox_events;
create policy "outbox_events_select" on public.outbox_events for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- Aucune policy d ecriture : l insertion d un evenement n est jamais le fait
-- d un client, c est celui du service qui commet la transaction metier.
drop policy if exists "outbox_events_write" on public.outbox_events;

revoke all on table public.outbox_events from public, anon, authenticated;
revoke all on function public.outbox_events_reject_mutation() from public, anon, authenticated;

grant select, insert on table public.outbox_events to service_role;
grant update (published_at, delivery_attempts, last_error)
  on table public.outbox_events to service_role;
grant delete on table public.outbox_events to service_role;

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   drop trigger if exists outbox_events_append_only on public.outbox_events;
--   drop function if exists public.outbox_events_reject_mutation();
--   drop policy if exists "outbox_events_select" on public.outbox_events;
--   drop index if exists public.outbox_events_pending_idx;
--   drop index if exists public.outbox_events_tenant_idx;
--   drop index if exists public.outbox_events_aggregate_idx;
--   drop table if exists public.outbox_events;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table n a de cle etrangere vers outbox_events : le retrait est
-- sans effet de bord.
-- ============================================================================

notify pgrst, 'reload schema';
