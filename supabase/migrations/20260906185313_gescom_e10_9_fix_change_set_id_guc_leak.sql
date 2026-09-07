-- ============================================================================
-- Sprint 5 Gestion commerciale — correctif E10.9 (qa-review round 5 d E10.10a,
-- bloquant B7) : fuite du GUC de correlation `magrit.change_set_id`.
-- ----------------------------------------------------------------------------
-- Migration CORRECTIVE, distincte de 20260904000100_gescom_e10_9_quote_line_
-- discounts.sql (ne la modifie pas) : cette derniere est DEJA DEPLOYEE sur le
-- projet Supabase partage (verifie via `supabase migration list --linked`,
-- local = remote sur cette entree) au moment de ce correctif — une migration
-- deployee ne change jamais apres coup (regle rappelee par elle-meme et par
-- 20260904142026/20260904150000 avant elle).
--
-- ── Le trou (meme motif que B7 sur api_send_commercial_quote, 20260906160000,
--    section 4) ────────────────────────────────────────────────────────────
-- `api_delete_commercial_quote_line` et `api_reorder_commercial_quote_lines`
-- posent `magrit.change_set_id` via `perform set_config(..., v_change_set::
-- text, true)` — semantique `SET LOCAL`, portee a la TRANSACTION englobante,
-- PAS a la fonction. Aucune des deux ne le remettait a vide avant son retour.
-- Consequence : un appel futur de l une de ces fonctions en sous-etape d une
-- transaction plus large (ex. un traitement par lot qui enchainerait
-- plusieurs ecritures de devis dans une seule transaction) verrait toute
-- ecriture SANS RAPPORT survenant plus tard dans la meme transaction
-- attribuee a tort au meme `change_set_id` que la derniere suppression/
-- reordonnancement de ligne — corruption de la correlation d audit, pas une
-- fuite d autorisation (`change_set_id` ne garde aucune donnee, il ne fait
-- que grouper des entrees du journal d audit sous un meme geste).
--
-- Meme cause racine, memes deux fonctions, que le bloquant B7 trouve sur
-- `api_send_commercial_quote` (`magrit.quote_transition`, un GUC different
-- mais le meme oubli) — corrige dans la meme session, par la premiere
-- execution reelle de `tests/sql/gescom-e10-10a-quote-send-duplicate.sql` et
-- `tests/sql/gescom-e10-9-quote-line-discounts.sql` (Colima/Docker local,
-- jamais lance avant sur ce chantier faute de Docker sur les postes de
-- redaction).
--
-- ── Correction ──────────────────────────────────────────────────────────────
-- `perform set_config('magrit.change_set_id', '', true);` ajoute juste avant
-- le `return`/la fin de chaque fonction. `CREATE OR REPLACE FUNCTION`,
-- signature inchangee, aucun impact sur les appelants (TypeScript ou SQL).
-- Definitions completes reprises telles quelles depuis la migration d origine
-- (20260904000100), avec uniquement cet ajout en fin de corps.
-- ============================================================================

create or replace function public.api_delete_commercial_quote_line(p_tenant_id uuid, p_quote_id uuid, p_line_id uuid)
 returns void
 language plpgsql
as $function$
declare
  v_change_set uuid := gen_random_uuid();
  v_deleted integer;
begin
  perform set_config('magrit.change_set_id', v_change_set::text, true);

  delete from public.commercial_quote_lines l
   using public.commercial_quotes q
   where l.id = p_line_id
     and l.quote_id = p_quote_id
     and q.id = l.quote_id
     and q.tenant_id = p_tenant_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'quote_line.not_found: ligne % introuvable dans le devis % (ou devis non brouillon)', p_line_id, p_quote_id;
  end if;

  -- Resserre les positions des lignes restantes pour rester contigues
  -- (0..n-1), meme change_set que la suppression ci-dessus.
  with ranked as (
    select id, row_number() over (order by position) - 1 as new_position
    from public.commercial_quote_lines
    where quote_id = p_quote_id
  )
  update public.commercial_quote_lines l
     set position = ranked.new_position
    from ranked
   where l.id = ranked.id
     and l.position <> ranked.new_position;

  -- (qa-review round 5, B7) `set_config(..., true)` est porte a la
  -- TRANSACTION, pas a cette fonction : sans cette remise a vide, un appel
  -- futur de cette fonction en sous-etape d une transaction plus large
  -- laisserait un `change_set_id` residuel grouper a tort une ecriture SANS
  -- RAPPORT survenant plus tard dans la meme transaction.
  perform set_config('magrit.change_set_id', '', true);
end;
$function$;

create or replace function public.api_reorder_commercial_quote_lines(p_tenant_id uuid, p_quote_id uuid, p_line_ids uuid[])
 returns void
 language plpgsql
as $function$
declare
  v_change_set uuid := gen_random_uuid();
  v_existing_count integer;
  v_requested_count integer;
begin
  perform set_config('magrit.change_set_id', v_change_set::text, true);

  v_requested_count := coalesce(array_length(p_line_ids, 1), 0);

  select count(*) into v_existing_count
    from public.commercial_quote_lines l
    join public.commercial_quotes q on q.id = l.quote_id
   where l.quote_id = p_quote_id
     and q.tenant_id = p_tenant_id;

  -- `line_ids` doit recouvrir EXACTEMENT les lignes existantes : meme
  -- cardinalite, aucun doublon, et chaque id appartient reellement a CE
  -- devis. Verifie ENTIEREMENT avant tout UPDATE — un `UPDATE ... FROM`
  -- ignore silencieusement les lignes de `wanted` sans correspondance, ce qui
  -- masquerait `positions_mismatch` si on se fiait au nombre de lignes
  -- affectees (`GET DIAGNOSTICS`), lui-meme legitimement nul quand l ordre
  -- demande est deja l ordre courant.
  if v_requested_count <> v_existing_count
     or v_requested_count <> (select count(distinct x) from unnest(p_line_ids) as x)
     or v_requested_count <> (
       select count(*) from unnest(p_line_ids) as x(id)
        where exists (
          select 1 from public.commercial_quote_lines l2
           where l2.id = x.id and l2.quote_id = p_quote_id
        )
     )
  then
    raise exception 'quote_line.positions_mismatch: % ligne(s) fournie(s), % attendue(s) dans le devis %',
      v_requested_count, v_existing_count, p_quote_id;
  end if;

  with wanted as (
    select id, ord - 1 as new_position
    from unnest(p_line_ids) with ordinality as t(id, ord)
  )
  update public.commercial_quote_lines l
     set position = wanted.new_position
    from wanted
   where l.id = wanted.id
     and l.quote_id = p_quote_id
     and l.position <> wanted.new_position;

  -- (qa-review round 5, B7) meme correctif que api_delete_commercial_quote_
  -- line ci-dessus : remise a vide du GUC de correlation, porte a la
  -- transaction et non a cette fonction.
  perform set_config('magrit.change_set_id', '', true);
end;
$function$;

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si ce correctif doit etre
-- annule (restaure exactement les corps de fonction tels qu issus de
-- 20260904000100_gescom_e10_9_quote_line_discounts.sql, SANS la remise a
-- vide du GUC) :
--
--   create or replace function public.api_delete_commercial_quote_line(p_tenant_id uuid, p_quote_id uuid, p_line_id uuid)
--    returns void
--    language plpgsql
--   as $function$
--   declare
--     v_change_set uuid := gen_random_uuid();
--     v_deleted integer;
--   begin
--     perform set_config('magrit.change_set_id', v_change_set::text, true);
--     delete from public.commercial_quote_lines l
--      using public.commercial_quotes q
--      where l.id = p_line_id
--        and l.quote_id = p_quote_id
--        and q.id = l.quote_id
--        and q.tenant_id = p_tenant_id;
--     get diagnostics v_deleted = row_count;
--     if v_deleted = 0 then
--       raise exception 'quote_line.not_found: ligne % introuvable dans le devis % (ou devis non brouillon)', p_line_id, p_quote_id;
--     end if;
--     with ranked as (
--       select id, row_number() over (order by position) - 1 as new_position
--       from public.commercial_quote_lines
--       where quote_id = p_quote_id
--     )
--     update public.commercial_quote_lines l
--        set position = ranked.new_position
--       from ranked
--      where l.id = ranked.id
--        and l.position <> ranked.new_position;
--   end;
--   $function$;
--
--   -- (idem pour api_reorder_commercial_quote_lines, corps d origine sans la
--   -- remise a vide finale — voir 20260904000100 pour le texte complet.)
-- ============================================================================
