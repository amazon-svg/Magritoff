---
story_id: S-QUOTES-6
epic: Bibliothèque de devis éditables (v1.1)
title: Statut & smoke E2E acheteur (DoD)
status: procédure prête — exécution après application migration
target_branch: beta/v5
agent: Dev (Claude Code)
size: S
---

# Story S-QUOTES-6 — Transitions statut & smoke E2E

## Transitions de statut
Décision : pas de RPC audit dédié pour les devis (contrairement aux commandes engagées). Un devis est un brouillon commercial ; le changement de statut est un simple `UPDATE` autorisé par la RLS (auteur OU admin/owner tenant). Géré par `QuotesContext.setStatus` et le sélecteur de l'éditeur (En cours / Validé / Rejeté).

## Smoke E2E acheteur (DoD — via testIds Chrome MCP)
Pré-requis : migration `20260702000100` appliquée + types régénérés.

1. Login boutique/atelier → configurer + ajouter **2 produits** au panier.
2. Panier → `shop-cart-create-quote-btn` → redirection `quote-editor-page`.
3. Éditeur : saisir `quote-editor-client-name-input` ; modifier `quote-editor-line-quantity-input` (total recalculé) ; `quote-editor-line-price-input` (marge recalculée) ; `quote-editor-line-margin-input` (prix recalculé) ; vérifier `quote-editor-total-ttc` live.
4. `quote-editor-line-move-up`/`-down` (réordonner) ; `quote-editor-status-select` = Validé ; `quote-editor-save-btn`.
5. `quote-editor-print-btn` (window.open non bloqué).
6. Retour `quote-lib-page` : le devis apparaît en « Validé ».
7. **Admin override** : en owner/admin → `quote-lib-scope-all` affiche les devis des autres membres (colonne Émetteur) ; un membre standard n'a pas la bascule.
8. Actions ligne : `quote-lib-row-menu-btn` → Dupliquer / Supprimer (`quote-lib-delete-dialog` → `quote-lib-delete-confirm-btn`).

## Tests automatisés livrés
- `tests/rls/quotes_lines_isolation.test.ts` — 6 cas RLS (isolation cross-tenant + override admin). À lancer avec `.env.test` (creds Supabase).
- `tests/utils/quoteMath.test.ts` — 13 cas (synchro prix/marge). Verts.
- Smoke `tests/data-testid.smoke.spec.ts` — vert (nouveaux testIds `quoteLib` déclarés).

## Reste à faire (hors code)
- ⚠️ Appliquer la migration `20260702000100_s_quotes_editable_library.sql` (PAT Supabase → demander à Arnaud) puis `npm run db:types`.
- Confirmer la sémantique de marge (markup sur coût vs taux de marque).
- Créer les cahiers de tests Notion TF-QUOTES-* (jouables IA + humain).
