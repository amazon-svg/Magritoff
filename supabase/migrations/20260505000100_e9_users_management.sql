-- =============================================================================
-- Migration E9.2 / v4 — Gestion utilisateurs par admin d'espace
-- -----------------------------------------------------------------------------
-- Ajoute :
--   1. RPC get_tenant_members_with_email : permet a l'UI de lister les membres
--      avec leur email (auth.users non lisible cote client).
--   2. Table tenant_member_events : audit trail des actions sur memberships
--      (created, role_changed, removed, invited, invitation_revoked).
-- =============================================================================

-- ─── 1. RPC get_tenant_members_with_email ──────────────────────────────────
-- Retourne (user_id, email, role, joined_at) pour les membres d'un tenant.
-- Gardes :
--   * security definer pour pouvoir joindre auth.users
--   * verification d'acces : caller doit etre membre du tenant OU superadmin
create or replace function public.get_tenant_members_with_email(p_tenant_id uuid)
returns table (
  user_id   uuid,
  email     text,
  role      text,
  joined_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select tm.user_id, u.email::text, tm.role, tm.joined_at
  from public.tenant_members tm
  join auth.users u on u.id = tm.user_id
  where tm.tenant_id = p_tenant_id
    and (
      public.is_super_admin()
      or p_tenant_id in (select public.current_user_tenant_ids())
    )
  order by tm.joined_at asc;
$$;

grant execute on function public.get_tenant_members_with_email(uuid) to authenticated;

-- ─── 2. Audit trail tenant_member_events ───────────────────────────────────
create table if not exists public.tenant_member_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  target_user_id  uuid references auth.users(id) on delete set null,
  event_type      text not null check (event_type in (
                    'created', 'role_changed', 'removed',
                    'invited', 'invitation_revoked'
                  )),
  performed_by    uuid not null references auth.users(id),
  metadata        jsonb default '{}'::jsonb,  -- ex: {"old_role": "member", "new_role": "admin"}
  created_at      timestamptz not null default now()
);

create index if not exists tenant_member_events_tenant_idx
  on public.tenant_member_events(tenant_id);
create index if not exists tenant_member_events_created_idx
  on public.tenant_member_events(tenant_id, created_at desc);

alter table public.tenant_member_events enable row level security;

drop policy if exists "tenant_member_events_select" on public.tenant_member_events;
create policy "tenant_member_events_select" on public.tenant_member_events
  for select using (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  );

drop policy if exists "tenant_member_events_insert" on public.tenant_member_events;
create policy "tenant_member_events_insert" on public.tenant_member_events
  for insert with check (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  );

-- Reload PostgREST schema cache (pour que les nouveaux objets soient exposes
-- sans redeploy de l'API Supabase).
notify pgrst, 'reload schema';
