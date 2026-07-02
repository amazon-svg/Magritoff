---
story_id: S-QUOTES-3
epic: Bibliothèque de devis éditables (v1.1)
title: Éditeur de devis multi-lignes (page dédiée) + renderQuoteDocument + testIds
status: livrée (code)
delivered_at: 2026-07-02
target_branch: beta/v5
agent: Dev (Claude Code)
size: L
---

# Story S-QUOTES-3 — Éditeur de devis

## AC
- **AC1** ✅ Page `src/app/components/dashboard/DashboardQuoteEditor.tsx` + route `dashboard/quotes/:id/edit` (lazy) dans `routes.tsx`.
- **AC2** ✅ Nom client éditable, tableau lignes éditables (produit, quantité, coût HT lecture seule, prix vente HT, marge %, total).
- **AC3** ✅ Synchro live prix↔marge (`quoteMath`) : éditer prix → marge recalculée ; éditer marge → prix recalculé ; quantité → total recalculé. Champ marge désactivé si coût 0 (tooltip).
- **AC4** ✅ Réordonnancement Monter/Descendre (swap local, pattern OrderRoleAdminPage) + ajout/suppression de ligne.
- **AC5** ✅ Totaux HT/TVA/TTC recalculés live (via `getTaxRate` tenant).
- **AC6** ✅ Sélecteur gabarit (`useQuoteTemplates`) + sélecteur statut (En cours/Validé/Rejeté, util `quoteStatus.ts`).
- **AC7** ✅ Impression : `renderQuoteHtml` + helper factorisé `openQuotePrint`/`buildQuoteDocumentHtml` dans `quote.ts` (wrapper HTML dédupliqué de CartButton).
- **AC8** ✅ Sauvegarde via `saveQuote` (reécrit lignes + entête + totaux).
- **AC9** ✅ testIds déclarés dans `testIds.ts` (scope `quoteLib`, sous-groupe éditeur) — smoke data-testid vert.

## Fichiers
- `src/app/components/dashboard/DashboardQuoteEditor.tsx`, `src/app/utils/quoteStatus.ts` (nouveaux)
- `src/app/utils/quote.ts` (ajout `buildQuoteDocumentHtml` + `openQuotePrint`)
- `src/app/routes.tsx`, `src/app/lib/testIds.ts` (modifiés)
