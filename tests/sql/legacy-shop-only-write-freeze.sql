begin;

create temporary table um8_write_freeze_context (
  actor_id uuid not null,
  tenant_id uuid not null,
  shop_id uuid not null,
  buyer_role_id uuid not null
);

grant select on um8_write_freeze_context to authenticated;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_buyer_role uuid;
begin
  v_actor := gen_random_uuid();
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor, 'um8-1-write-freeze-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name)
  values ('um8-shop-only-freeze', 'UM8 Shop-only Freeze')
  returning id into v_tenant;

  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um8-shop-only-freeze', 'UM8 Shop')
  returning id into v_shop;

  -- `owner` a ete converti en `admin` par la migration 20260814000200
  -- (decision Arnaud 2026-08-14 : plus de rang au-dessus de l admin,
  -- qui porte deja toutes les capabilities). L acteur du scenario UM8.1
  -- reste le membre a pleins pouvoirs du tenant, seule la valeur de role
  -- change pour respecter tenant_members_role_admin_check.
  insert into public.tenant_members (
    tenant_id, user_id, role, access_scope, allowed_shop_ids
  ) values (
    v_tenant, v_actor, 'admin', 'magrit_full', '{}'
  );

  -- Ancienne fixture assignait un role de catalogue ('UM8 Invitation
  -- Manager', can_invite) a v_actor pour lui donner la capability
  -- can_invite. Devenu a la fois superflu (user_has_capability accorde
  -- deja TOUTES les capabilities a un membre role='admin' depuis la
  -- migration 20260814000200) et rejete par le trigger
  -- restrict_magrit_assignments_to_options (20260824000200,
  -- magrit_option_required) : un membre magrit_full ne peut plus
  -- recevoir qu'une affectation d'option produit (option_shops /
  -- option_orders), jamais un role de catalogue. v_actor reste admin,
  -- ce qui suffit pour les appels api_create_tenant_invitation testes
  -- plus bas.

  -- Correction qa-review B2 (rejet round 1) : 'role_mismatch_tenant' (cote
  -- api_create_tenant_invitation, migration 20260824000700) vient de la
  -- liste blanche system_key in ('option_shops','option_orders') — une
  -- fixture SANS system_key (l ancien 'UM8 Legacy Buyer') serait refusee
  -- pour cette seule raison, meme en identity_context='magrit', et ne teste
  -- donc plus la separation par identity_context que ce scenario UM8.3 vise
  -- (migration 20260818000200). On reutilise a la place le preset
  -- 'Boutiques' (system_key='option_shops'), seede automatiquement a la
  -- creation du tenant par seed_tenant_catalogs(), et on bascule SEULEMENT
  -- son identity_context en 'storefront_legacy' : il conserve son
  -- system_key='option_shops', donc la garde EN VIGUEUR le rejette encore
  -- (role_mismatch_tenant, verifie plus bas) ; si la clause
  -- identity_context='magrit' de l API venait a etre retiree par erreur
  -- (mutation), l API laisserait passer l INSERT et ce serait alors le
  -- trigger tenant_invitations_enforce_role_identity_context (meme
  -- migration 20260818000200) qui le rejetterait avec
  -- 'role_identity_context_mismatch' — le test verifie donc les deux
  -- lectures possibles (voir plus bas et le bloc de preuve directe).
  select id into v_buyer_role
    from public.tenant_role_definitions
   where tenant_id = v_tenant and system_key = 'option_shops';
  if v_buyer_role is null then
    raise exception 'Preset option_shops introuvable : seed_tenant_catalogs() n a pas seede le tenant';
  end if;
  update public.tenant_role_definitions
     set identity_context = 'storefront_legacy'
   where id = v_buyer_role;

  insert into um8_write_freeze_context (
    actor_id, tenant_id, shop_id, buyer_role_id
  ) values (v_actor, v_tenant, v_shop, v_buyer_role);
end;
$$;

-- ── Preuve directe des gardes UM8.1/UM8.2 (correction qa-review round 1,
-- B1, BLOQUANT) ──────────────────────────────────────────────────────────
-- L assertion API plus bas (magrit_scope_required) refuse plus tot que le
-- trigger freeze_legacy_shop_only_write() (migrations 20260817000800 —
-- gel initial — et 20260818000100 — bypass explicite requis) : elle NE
-- L EXERCE PLUS DU TOUT. Le commentaire precedent de ce fichier affirmait
-- ce trigger « inatteignable par construction » : FAUX — le bypass exige
-- session_user = 'postgres' ET magrit.allow_legacy_shop_only_write = 'on'
-- (20260818000100). Cette session psql tourne bien en session_user =
-- 'postgres', mais NE POSITIONNE JAMAIS cette variable : le trigger reste
-- donc pleinement exerçable par une ecriture DIRECTE, hors de toute
-- fonction api_*. Preuve par mutation (qa-review) : les deux triggers
-- supprimes, ce fichier restait vert avant cette correction — il ne l est
-- plus depuis : les deux ecritures ci-dessous echouent immediatement si
-- l un des deux triggers disparait.
do $$
declare
  v_tenant uuid;
  v_shop uuid;
  v_actor uuid;
  v_direct_invitation_rejected boolean := false;
  v_direct_member_rejected boolean := false;
begin
  select tenant_id, shop_id, actor_id
    into v_tenant, v_shop, v_actor
    from um8_write_freeze_context;

  -- B1. INSERT direct d une tenant_invitations en shop_only (trigger
  -- tenant_invitations_freeze_legacy_shop_only).
  begin
    insert into public.tenant_invitations (
      tenant_id, email, role, token, expires_at, access_scope, allowed_shop_ids
    ) values (
      v_tenant, 'um8-direct-invitation@example.test', 'member',
      encode(extensions.gen_random_bytes(16), 'hex'), now() + interval '14 days',
      'shop_only', array[v_shop]
    );
  exception
    when others then
      if sqlerrm not like 'legacy_shop_only_frozen:%' then
        raise exception 'Refus UM8.1 (ecriture directe, invitation) inattendu : %', sqlerrm;
      end if;
      v_direct_invitation_rejected := true;
  end;
  if not v_direct_invitation_rejected then
    raise exception 'Une invitation shop_only a pu etre inseree DIRECTEMENT, hors de l API, sans le bypass explicite';
  end if;

  -- B2. UPDATE direct d un tenant_members vers shop_only (trigger
  -- tenant_members_freeze_legacy_shop_only).
  begin
    update public.tenant_members
       set access_scope = 'shop_only', allowed_shop_ids = array[v_shop]
     where tenant_id = v_tenant and user_id = v_actor;
  exception
    when others then
      if sqlerrm not like 'legacy_shop_only_frozen:%' then
        raise exception 'Refus UM8.2 (ecriture directe, membre) inattendu : %', sqlerrm;
      end if;
      v_direct_member_rejected := true;
  end;
  if not v_direct_member_rejected then
    raise exception 'Un tenant_members a pu etre bascule DIRECTEMENT vers shop_only, sans le bypass explicite';
  end if;
end;
$$;

-- ── Preuve directe de la garde UM8.3 (correction qa-review round 1, B2,
-- BLOQUANT) ──────────────────────────────────────────────────────────────
-- Le trigger tenant_invitations_enforce_role_identity_context (migration
-- 20260818000200) est la SEULE garde qui resterait si la clause
-- identity_context='magrit' de api_create_tenant_invitation venait un jour
-- a disparaitre (cf. commentaire plus bas). On l exerce ICI directement,
-- par un INSERT qui ne passe PAS par la fonction api_*, avec
-- pending_role_ids pointant vers le preset 'Boutiques' bascule en
-- storefront_legacy plus haut.
do $$
declare
  v_tenant uuid;
  v_buyer_role uuid;
  v_direct_role_rejected boolean := false;
begin
  select tenant_id, buyer_role_id into v_tenant, v_buyer_role from um8_write_freeze_context;

  begin
    insert into public.tenant_invitations (
      tenant_id, email, role, token, expires_at, pending_role_ids
    ) values (
      v_tenant, 'um8-direct-role-propagation@example.test', 'member',
      encode(extensions.gen_random_bytes(16), 'hex'), now() + interval '14 days',
      array[v_buyer_role]
    );
  exception
    when others then
      if sqlerrm not like 'role_identity_context_mismatch:%' then
        raise exception 'Refus UM8.3 (ecriture directe) inattendu : %', sqlerrm;
      end if;
      v_direct_role_rejected := true;
  end;
  if not v_direct_role_rejected then
    raise exception 'Un role storefront_legacy a pu etre propage DIRECTEMENT par pending_role_ids, hors de l API';
  end if;
end;
$$;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from um8_write_freeze_context),
  true
);

do $$
declare
  v_tenant uuid;
  v_shop uuid;
  v_buyer_role uuid;
  v_rejected boolean := false;
  v_role_rejected boolean := false;
begin
  select tenant_id, shop_id, buyer_role_id
    into v_tenant, v_shop, v_buyer_role
    from um8_write_freeze_context;

  -- api_create_tenant_invitation a ete reecrite par la migration
  -- 20260824000700 (UM1, "aligne le cycle de vie des invitations Magrit sur
  -- les activations boutique") : elle rejette desormais TOUT access_scope
  -- different de 'magrit_full' des la premiere validation, avec
  -- 'invalid_request: magrit_scope_required' — avant meme d atteindre l ancien
  -- garde-fou 'legacy_shop_only_frozen' (migration 20260817000800). Ce
  -- garde-fou n est PAS inatteignable pour autant (correction qa-review
  -- round 1, B1) : une ecriture DIRECTE, hors de cette fonction api_*, le
  -- rencontre toujours — exerce plus haut, avant le changement de role.
  -- L invariant du scenario UM8.1 cote API (aucune invitation shop_only ne
  -- peut plus etre creee par ce chemin applicatif) est preserve, impose de
  -- façon encore plus stricte qu avant.
  begin
    perform public.api_create_tenant_invitation(
      v_tenant,
      'um8-shop-only@example.test',
      'shop_only',
      array[v_shop],
      '{}'
    );
  exception
    when others then
      if sqlerrm not like 'invalid_request: magrit_scope_required%' then
        raise exception 'Refus UM8.1 inattendu : %', sqlerrm;
      end if;
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'Une session applicative a encore créé une invitation shop_only';
  end if;

  -- Meme migration 20260824000700 : la propagation de role par invitation
  -- n accepte plus que les deux presets d option produit
  -- (identity_context='magrit' ET system_key in ('option_shops','option_orders')),
  -- sous peine de 'role_mismatch_tenant'. Le preset 'Boutiques' bascule plus
  -- haut garde son system_key='option_shops' mais plus son
  -- identity_context='magrit' : la garde API rejette donc precisement avec
  -- 'role_mismatch_tenant'. Cette assertion tient la clause identity_context
  -- DE L API elle-meme (403, cf. toRejectionCode) : elle ne doit PAS accepter
  -- 'role_identity_context_mismatch' (qa-review round 2, B2) — ce libelle
  -- correspond a un contrat different (delivery_failed, 502,
  -- src/adapters/supabase/invitations-repository.ts:146 et
  -- src/server/api/invitations-routes.ts:107) et ne doit apparaitre ici QUE
  -- si la clause API a reellement disparu, ce que cette assertion doit alors
  -- detecter comme un ECHEC, pas absorber silencieusement. Le trigger
  -- tenant_invitations_enforce_role_identity_context (20260818000200) est
  -- deja tenu, INDEPENDAMMENT de cette assertion, par l ecriture directe
  -- plus haut (bloc de preuve UM8.3) : doublon inutile de l accepter aussi
  -- ici.
  begin
    perform public.api_create_tenant_invitation(
      v_tenant,
      'um8-legacy-buyer-role@example.test',
      'magrit_full',
      '{}',
      array[v_buyer_role]
    );
  exception
    when others then
      if sqlerrm not like 'role_mismatch_tenant%' then
        raise exception 'Refus UM8.3 inattendu : %', sqlerrm;
      end if;
      v_role_rejected := true;
  end;

  if not v_role_rejected then
    raise exception 'Une invitation Magrit a encore propage un role storefront_legacy';
  end if;

  perform public.api_create_tenant_invitation(
    v_tenant,
    'um8-magrit@example.test',
    'magrit_full',
    '{}',
    '{}'
  );

  if not exists (
    select 1
      from public.tenant_invitations
     where tenant_id = v_tenant
       and email = 'um8-magrit@example.test'
       and access_scope = 'magrit_full'
  ) then
    raise exception 'L''invitation Magrit autorisée n''a pas été créée';
  end if;
end;
$$;

reset role;

rollback;
