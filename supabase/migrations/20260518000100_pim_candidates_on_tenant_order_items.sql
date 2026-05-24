-- =============================================================================
-- Migration : trigger PIM ingestion sur tenant_order_items (Story P0.10)
-- Date      : 2026-05-18
-- Rationale : suite a la bascule submitCart -> tenant_orders + tenant_order_items
--             (Story S-MIGRATION-ORDERS, ADR-ORDERS-1 architecture.md §4.10),
--             le trigger PIM legacy trg_enqueue_pim_shop_order ne fire plus
--             car le nouveau code n'insere plus dans shop_orders.
--             Pour preserver le pipeline d'ingestion PIM, on cree un trigger
--             frere sur tenant_order_items (1 fire = 1 candidat par item,
--             coherent avec le modele relationnel vs JSONB inline legacy).
--
-- Idempotent : drop+create function + drop trigger if exists.
-- =============================================================================

-- ─── Fonction trigger ───────────────────────────────────────────────────────
create or replace function public.enqueue_pim_candidates_on_tenant_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _shop_tenant uuid;
  _shop_owner uuid;
  _order_creator uuid;
begin
  -- Recupere tenant_id (via tenant_orders) et owner du shop (via shops).
  -- Le created_by de l order est prefere comme source_user_id (acheteur
  -- authentifie qui a passe la commande). Fallback shop owner si null
  -- (cas extreme post-RLS, peu probable).
  select o.tenant_id, o.created_by, s.owner_user_id
    into _shop_tenant, _order_creator, _shop_owner
    from public.tenant_orders o
    join public.shops s on s.id = o.shop_id
    where o.id = new.order_id;

  if _shop_tenant is null then
    -- Order sans tenant (cas degenere ou shop sans tenant) : on ne pousse pas.
    return new;
  end if;

  insert into public.pim_candidates (
    source_tenant_id,
    source_user_id,
    source_quote_id,
    raw_config,
    suggested_kind,
    suggested_gamme,
    status
  ) values (
    _shop_tenant,
    coalesce(_order_creator, _shop_owner),
    null,
    -- raw_config : preference au snapshot clariprint_options (immutable
    -- au moment du commit panier). Fallback aux colonnes typees si vide.
    coalesce(
      new.clariprint_options,
      jsonb_build_object(
        'name', new.product_label,
        'quantity', new.quantity,
        'price_ht', new.unit_price_ht
      )
    ),
    new.clariprint_options->>'kind',
    new.clariprint_options->>'gamme_slug',
    'pending'
  );

  return new;
end;
$$;

-- ─── Trigger ─────────────────────────────────────────────────────────────────
drop trigger if exists trg_enqueue_pim_tenant_order_item on public.tenant_order_items;
create trigger trg_enqueue_pim_tenant_order_item
  after insert on public.tenant_order_items
  for each row execute function public.enqueue_pim_candidates_on_tenant_order_item();

-- ─── Smoke check (a executer post-application) ──────────────────────────────
-- select trigger_name, event_manipulation, event_object_table
--   from information_schema.triggers
--   where event_object_table = 'tenant_order_items';
-- Attendu : 1 ligne {trg_enqueue_pim_tenant_order_item, INSERT, tenant_order_items}
