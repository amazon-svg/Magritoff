-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10b-4c, correctif qa-review round 2
-- BLOQUANT B4 : `valid_until` doit etre resolue AVANT la generation du
-- document et transmise TELLE QUELLE a `api_send_commercial_quote`, pour que
-- le PDF et la ligne en base portent TOUJOURS la meme date — arbitrage de
-- l architecte, docs/api/CONVENTIONS.md §8.18 #10.
-- ----------------------------------------------------------------------------
-- Constat : `CommercialQuotesService.send()` generait le document avec
-- `validUntil` lu AVANT `api_send_commercial_quote` — la RPC qui resout
-- elle-meme la validite par defaut (`commercial_settings.default_validity_days`).
-- Sur le cas le plus courant (tenant avec validite par defaut, commercial qui
-- ne saisit pas de date), le PDF partait avec `quote.valid_until` VIDE tandis
-- que le courriel (E10.10b-3, qui relit la valeur A LA REMISE) annoncait une
-- date — deux representations d un MEME devis qui se contredisaient.
--
-- Options ECARTEES par l architecte (§8.18 #10) :
--   (a) Recalculer en TypeScript — refuse, deuxieme implementation qui
--       divergerait un jour, muettement.
--   (b) Une RPC qui resout ET PERSISTE valid_until AVANT la generation,
--       hors transaction d envoi — refuse : un envoi qui echoue laisserait
--       la date posee, et le rejeu ne la recalcule QUE si elle est nulle ;
--       un echec transitoire deviendrait une donnee fausse et PERMANENTE.
--
-- DECISION (c) — « resoudre une fois, en SQL, et transmettre » :
--   1. `resolve_quote_default_valid_until(p_tenant_id, p_current_valid_until)` —
--      fonction SQL pure, `stable`, SANS EFFET DE BORD : rend `p_current`
--      s il n est pas nul, sinon la date derivee de `default_validity_days`,
--      sinon `null`. C EST LE SEUL ENDROIT ou ce calcul existe desormais.
--   2. `api_resolve_commercial_quote_valid_until(p_tenant_id, p_quote_id)` —
--      LECTEUR, `security definer` ET `stable`, AUCUNE ECRITURE : rend la
--      date qui SERA posee, sans jamais la persister. Un envoi avorte ne
--      laisse donc AUCUNE trace (contrairement a l option (b)).
--   3. `api_send_commercial_quote` passe a CINQ arguments
--      (`p_resolved_valid_until date` ajoute) : applique cette valeur
--      TELLE QUELLE si elle est fournie (non nulle), ne recalcule via
--      `resolve_quote_default_valid_until()` QUE si elle est nulle (chemin
--      conserve pour tout appelant qui ne la fournirait pas). La version a
--      QUATRE arguments est SUPPRIMEE (`drop function`) — les deux ne
--      coexistent pas, sans quoi ce correctif retablirait exactement la
--      double implementation qu il vise a eliminer.
--
-- Aucun changement de contrat : ni endpoint, ni schema, ni code d erreur.
-- `SendQuoteCommand` n accepte toujours pas `valid_until` — parametre INTERNE
-- a la chaine service -> repository -> RPC, jamais une entree utilisateur.
-- Un RENVOI n est pas concerne (la validite n est jamais recalculee a un
-- renvoi, le document n est jamais regenere) : le service TypeScript n
-- appelle le lecteur qu au PREMIER envoi.
-- ============================================================================

-- ── 1. `resolve_quote_default_valid_until` — calcul UNIQUE, pur, stable ─────
create or replace function public.resolve_quote_default_valid_until(
  p_tenant_id uuid,
  p_current_valid_until date
)
returns date
language sql
stable
as $$
  select coalesce(
    p_current_valid_until,
    (
      select (now() at time zone 'utc')::date + cs.default_validity_days
        from public.commercial_settings cs
       where cs.tenant_id = p_tenant_id
         and cs.default_validity_days is not null
    )
  );
$$;

comment on function public.resolve_quote_default_valid_until(uuid, date) is
  'qa-review B4 (E10.10b-4c) — calcul UNIQUE de la validite par defaut d un devis. Rend p_current_valid_until s il n est pas nul, sinon la date derivee de commercial_settings.default_validity_days, sinon null (aucune validite par defaut configuree). Fonction SQL pure, stable, sans effet de bord : appelee par api_send_commercial_quote ET par le lecteur api_resolve_commercial_quote_valid_until, qui ne doivent plus jamais diverger.';

revoke all on function public.resolve_quote_default_valid_until(uuid, date) from public, anon;
grant execute on function public.resolve_quote_default_valid_until(uuid, date) to authenticated;

-- ── 2. Lecteur — AUCUNE ECRITURE, un envoi avorte ne laisse aucune trace ────
create or replace function public.api_resolve_commercial_quote_valid_until(
  p_tenant_id uuid,
  p_quote_id uuid
)
returns date
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_quote public.commercial_quotes;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote valid_until resolution forbidden';
  end if;

  select * into v_quote
    from public.commercial_quotes
   where id = p_quote_id
     and tenant_id = p_tenant_id;
  if v_quote.id is null then
    raise exception 'quote.not_found: devis % introuvable', p_quote_id;
  end if;

  return public.resolve_quote_default_valid_until(p_tenant_id, v_quote.valid_until);
end;
$$;

comment on function public.api_resolve_commercial_quote_valid_until(uuid, uuid) is
  'qa-review B4 (E10.10b-4c) — LECTEUR de la validite qui SERA posee au premier envoi, appele par le service AVANT la generation du document. security definer ET stable, AUCUNE ECRITURE : c est precisement ce qui le distingue de la persistance anticipee ecartee par l architecte (option (b)) — un envoi qui echoue ensuite ne laisse donc absolument rien derriere lui.';

revoke all on function public.api_resolve_commercial_quote_valid_until(uuid, uuid) from public, anon;
grant execute on function public.api_resolve_commercial_quote_valid_until(uuid, uuid) to authenticated;

-- ── 3. `api_send_commercial_quote` — cinq arguments, l ancienne version ─────
-- SUPPRIMEE (ne coexiste pas avec la nouvelle, sans quoi ce correctif
-- retablirait la double implementation qu il elimine). MEME CORPS que
-- 20260906160000, a l exception du bloc de calcul de `v_new_valid_until`
-- (remplace par un appel a `resolve_quote_default_valid_until`, applique
-- directement si `p_resolved_valid_until` est fourni).
create or replace function public.api_send_commercial_quote(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_show_discounts boolean,
  p_show_discounts_provided boolean,
  p_resolved_valid_until date
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_quote public.commercial_quotes;
  v_line_count integer;
  v_new_valid_until date;
  v_change_set uuid := gen_random_uuid();
  v_snapshot jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote send forbidden';
  end if;

  select * into v_quote
    from public.commercial_quotes
   where id = p_quote_id
     and tenant_id = p_tenant_id
   for update;
  if v_quote.id is null then
    raise exception 'quote.not_found: devis % introuvable', p_quote_id;
  end if;

  if v_quote.status not in ('draft', 'sent') then
    raise exception 'quote.send_forbidden_status: devis % a l etat % (draft ou sent requis)', p_quote_id, v_quote.status;
  end if;

  perform set_config('magrit.change_set_id', v_change_set::text, true);
  perform set_config('magrit.quote_transition', 'true', true);

  if v_quote.status = 'draft' then
    select count(*) into v_line_count from public.commercial_quote_lines where quote_id = p_quote_id;
    if v_line_count = 0 then
      raise exception 'quote.send_requires_lines: devis % sans ligne', p_quote_id;
    end if;

    -- qa-review B4 — SEUL endroit qui pose encore valid_until : applique
    -- p_resolved_valid_until TEL QUEL des qu il est fourni (deja resolu par
    -- le service via le lecteur, AVANT la generation du document — le PDF et
    -- cette ligne portent alors la MEME valeur, par construction). Ne
    -- recalcule via `resolve_quote_default_valid_until()` QUE si le
    -- parametre est nul — chemin conserve pour tout appelant qui ne le
    -- fournirait pas (defense en profondeur, pas le chemin nominal).
    v_new_valid_until := coalesce(
      p_resolved_valid_until,
      public.resolve_quote_default_valid_until(p_tenant_id, v_quote.valid_until)
    );

    update public.commercial_quotes
       set status = 'sent',
           sent_at = coalesce(v_quote.sent_at, now()),
           last_sent_at = now(),
           sent_by = v_actor,
           valid_until = v_new_valid_until,
           show_discounts = case when p_show_discounts_provided then p_show_discounts else show_discounts end
     where id = p_quote_id;

    select jsonb_build_object(
             'quote', to_jsonb(q),
             'lines', coalesce(
               (select jsonb_agg(to_jsonb(l) order by l.position)
                  from public.commercial_quote_lines l
                 where l.quote_id = q.id),
               '[]'::jsonb
             )
           )
      into v_snapshot
      from public.commercial_quotes q
     where q.id = p_quote_id;

    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
    values
      (p_quote_id, v_change_set, 'sent', null, null, null, v_snapshot, v_actor,
       (select email from auth.users where id = v_actor));
  else
    -- RENVOI : le contenu ne bouge pas, y compris valid_until (deja figee
    -- au premier envoi) — `p_resolved_valid_until` est IGNORE sur cette
    -- branche, conformement a l arbitrage (« un renvoi n est pas concerne »).
    if p_show_discounts_provided and p_show_discounts is distinct from v_quote.show_discounts then
      raise exception 'quote.resend_immutable: show_discounts ne peut pas changer sur un renvoi';
    end if;

    update public.commercial_quotes
       set last_sent_at = now()
     where id = p_quote_id;

    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
    values
      (p_quote_id, v_change_set, 'resent', null, null, null, null, v_actor,
       (select email from auth.users where id = v_actor));
  end if;

  perform set_config('magrit.quote_transition', '', true);
  perform set_config('magrit.change_set_id', '', true);

  return p_quote_id;
end;
$$;

comment on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean, date) is
  'qa-review B4 (E10.10b-4c) — cinq arguments, p_resolved_valid_until ajoute : applique TEL QUEL si fourni (deja resolu par le service AVANT la generation du document via api_resolve_commercial_quote_valid_until), ne recalcule que si nul. Remplace l ancienne fonction a QUATRE arguments (supprimee ci-dessous) : les deux ne coexistent jamais.';

revoke all on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean, date) from public, anon;
grant execute on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean, date) to authenticated;

-- Supprime l ANCIENNE signature (4 arguments) : ne doit JAMAIS coexister
-- avec la nouvelle, sans quoi ce correctif retablirait la double
-- implementation qu il elimine.
revoke all on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean) from authenticated;
drop function if exists public.api_send_commercial_quote(uuid, uuid, boolean, boolean);

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   -- Restaure la fonction a QUATRE arguments telle que 20260906160000 :
--   -- (corps identique, bloc de calcul de valid_until inline, voir ce fichier)
--   revoke execute on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean, date) from authenticated;
--   drop function if exists public.api_send_commercial_quote(uuid, uuid, boolean, boolean, date);
--   revoke execute on function public.api_resolve_commercial_quote_valid_until(uuid, uuid) from authenticated;
--   drop function if exists public.api_resolve_commercial_quote_valid_until(uuid, uuid);
--   revoke execute on function public.resolve_quote_default_valid_until(uuid, date) from authenticated;
--   drop function if exists public.resolve_quote_default_valid_until(uuid, date);
--   notify pgrst, 'reload schema';
-- ============================================================================
