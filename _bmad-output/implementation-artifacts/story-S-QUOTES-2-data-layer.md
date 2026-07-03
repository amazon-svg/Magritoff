---
story_id: S-QUOTES-2
epic: Bibliothèque de devis éditables (v1.1)
title: Couche data — quoteMath + QuotesContext + montage AppShell
status: livrée (code)
delivered_at: 2026-07-02
target_branch: beta/v5
agent: Dev (Claude Code)
size: M
---

# Story S-QUOTES-2 — Couche data devis

## AC
- **AC1** ✅ `src/app/utils/quoteMath.ts` : `priceFromMargin`, `marginFromPrice`, `lineTotal`, `isMarginEditable`, `sumLinesHT`, `round2`. Convention **marge sur coût (markup)** : `prix = coût × (1 + marge%/100)`.
- **AC2** ✅ Tests unitaires `tests/utils/quoteMath.test.ts` (13 cas, verts) — synchro prix↔marge, réciprocité, piège coût 0.
- **AC3** ✅ `src/app/contexts/QuotesContext.tsx` : `createQuoteFromCart`, `getQuote`, `saveQuote` (delete+reinsert lignes + recalcul entête), `setStatus`, `deleteQuote`, `duplicateQuote`, `reload`, `scope` mine/all + `canViewAll` (owner/admin/superadmin).
- **AC4** ✅ Provider monté dans `AppShell` sous `CartProvider`.
- **AC5** ✅ Cloisonnement applicatif : scope `mine` filtre `.eq('user_id')` ; `all` (RLS laisse passer le tenant) exposé seulement si `canViewAll`.

## Décision à confirmer (Arnaud)
- **Sémantique marge** : markup sur coût retenu par défaut. À valider vs taux de marque sur prix de vente. Le point d'entrée `createQuoteFromCart` initialise coût = prix (marge 0) : le deviseur ajoute sa marge dans l'éditeur. `unit_price` = forfait / quantité (modèle linéaire éditable).

## Fichiers
- `src/app/utils/quoteMath.ts`, `src/app/contexts/QuotesContext.tsx` (nouveaux)
- `src/app/AppShell.tsx` (modifié), `tests/utils/quoteMath.test.ts` (nouveau)
