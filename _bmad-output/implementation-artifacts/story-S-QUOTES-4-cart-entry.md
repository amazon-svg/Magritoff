---
story_id: S-QUOTES-4
epic: Bibliothèque de devis éditables (v1.1)
title: Création d'un devis multi-lignes depuis le panier
status: livrée (code)
delivered_at: 2026-07-02
target_branch: beta/v5
agent: Dev (Claude Code)
size: S
---

# Story S-QUOTES-4 — Création depuis le panier

## AC
- **AC1** ✅ Bouton primaire « Créer un devis » dans `CartButton` (testid `shop-cart-create-quote-btn`).
- **AC2** ✅ `handleCreateQuote` → `createQuoteFromCart(items)` (1 devis multi-lignes, 1 ligne par item) → `clearCart` → `navigate` vers l'éditeur.
- **AC3** ✅ Ancien comportement N-devis conservé en action secondaire « Imprimer directement » (impression rapide sans persistance éditable).
- **AC4** ✅ Garde : si pas de user/tenant, message explicite (pas de crash).

## Fichiers
- `src/app/components/CartButton.tsx` (modifié)
