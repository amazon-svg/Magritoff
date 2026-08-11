-- ============================================================================
-- 20260811000200 — Ordre d affichage du referentiel Fournisseur (BK-07/BK-08)
-- ----------------------------------------------------------------------------
-- Defaut constate en recette du 2026-08-11, introduit par la migration
-- precedente : les fournisseurs etaient servis triES PAR NOM. « Antalis »
-- passait donc devant « Mon stock papier », et se retrouvait preselectionne
-- a l ouverture du wizard.
--
-- Ce n est pas un detail d affichage. BK-08 dit que **l imprimeur est lui-meme
-- un fournisseur de papier** — il stocke ses papiers courants et pratique un
-- prix a la feuille — et il en va de meme du transport, ou la livraison par
-- vehicule interne est le cas courant. Ces deux entrees etaient
-- deliberement en tete de liste dans la maquette. L ordre alphabetique les
-- avait noyees, et proposait par defaut un grossiste a un imprimeur qui
-- achete d abord dans son propre stock.
--
-- Correctif : une colonne de rang, et un tri `rank, name`. Le nom seul ne
-- pouvait pas porter cette intention.
--
-- Idempotente.
-- ============================================================================

alter table public.supplier_directory
  add column if not exists rank integer not null default 100;

comment on column public.supplier_directory.rank is
  'Ordre d affichage — 1 = propose en tete. Les ressources propres de l imprimeur '
  '(son stock papier, ses livraisons) passent avant les tiers : BK-08, c est le cas courant.';

-- Les ressources propres de l imprimeur en tete du referentiel commun.
update public.supplier_directory
   set rank = 1
 where tenant_id is null
   and name in (
     'Mon stock papier (prix à la feuille)',
     'Mes livraisons (véhicule interne)'
   );

create index if not exists supplier_directory_order_idx
  on public.supplier_directory (kind, rank, name);
