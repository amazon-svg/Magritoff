---
story_id: S0.2-extension (Concept Prix marché)
epic: 0 (extension post-livraison) — Pré-sprint Démo Readiness
title: Concept "Prix marché" + débridage bouton panier sans Clariprint
status: livrée (B5 + back-port B4)
delivered_at: 2026-05-09
target_branches: [beta/v5, beta/v4]
agent: Dev (rétrofit document 2026-05-10)
size: M
commits: [ebaf76f (B5), b10a209 (B4)]
---

# Story Prix marché — Débridage bouton panier

## Contexte (issue détectée)

Après livraison S0.2 (sanitization Clariprint) + S1.4 (Order entity tables), Arnaud teste en local sur la boutique B2B (`/shop/:slug`) → constate :

1. ❌ **Aucun prix affiché** dans la boutique client (Clariprint pas encore intégré dans le flux test).
2. ❌ **Bouton "Ajouter au panier" désactivé** (`disabled={!hasCalcd && !calcLoading}` dans `PortalProduct.tsx`).
3. ❌ **Impossibilité de tester le flow commande** en démo.

→ **Régression bloquante** identifiée 2026-05-09. Fix requis avant la démo client 2026-05-23.

## Décision Arnaud (2026-05-09) — élévation du concept

> *« Il faut que tu fasses un fix pour que le prix alternatif à celui de Clariprint que l'on voit dans la ProductCard aille jusqu'à la boutique client, dans le contexte démo. Nous remplacerons ce prix non-Clariprint par le "prix marché" que nous élaborerons à partir des parcs imprimeurs anonymisés. Donc tu intègres bien dans la vision et les spécifications du projet ce concept, et nous appellerons dorénavant cette variable "prix marché", aujourd'hui ayant la valeur qu'on lui connaît et demain sera alimentée par Clariprint. »*

**Le concept "Prix marché" devient un concept structurant Magrit**, pas un simple fallback technique.

## Story (Given/When/Then)

**As an** acheteur B2B sur une boutique de mon imprimeur (en démo, sans Clariprint actif),
**I want** voir un prix toujours disponible (estimé, badgé "Prix marché") et pouvoir ajouter au panier,
**So that** je peux tester le flow commande complet en démo + l'imprimeur peut réviser le prix réel à la validation Clariprint plus tard.

## Définition produit retenue (intégrée Vision + PRD)

| Phase | Source du Prix marché |
|---|---|
| **v1.0 / v1.1 (aujourd'hui)** | Estimation heuristique `estimateMarketPriceHT()` (dans `priceResolver.ts`) — calcul basé sur type produit + qty + grammage + finitions + dégressivité volume |
| **V2+ (panel Magrit)** | Calcul agrégé anonymisé à partir des parcs imprimeurs Pro souscrits, alimenté par Clariprint. **Levier commercial** : argument Pro = "ton parc enrichit le panel Magrit, en échange tu accèdes aux benchmarks marché" |

## AC validés

**AC1** ✅ `estimateMarketPriceHT(product)` exporté depuis `priceResolver.ts` — heuristique sur 9 types produits + paramètres
**AC2** ✅ `PriceSource = 'prix_marche'` (rename depuis `'estimated'`), `isMarketPrice: boolean` ajouté à `PriceResolution`
**AC3** ✅ `formatPrice` affiche "(Prix marché)" au lieu de "(Estimation)"
**AC4** ✅ `PortalProduct.tsx` : bouton "Ajouter au panier" actif tant que calcul Clariprint pas en cours (anciennement bloqué tant que pas de Clariprint)
**AC5** ✅ Si Clariprint absent → `activePriceHT` calculé via `estimateMarketPriceHT` en scaling sur quantité courante
**AC6** ✅ Alerte UI "⚠️ Prix marché (estimation Magrit). Le prix réel Clariprint sera confirmé à la validation par l'imprimeur." sous le bouton
**AC7** ✅ Le produit ajouté au panier porte `price_ht` renseigné (Clariprint OU prix marché) — total panier jamais 0
**AC8** ✅ `PortalCart.tsx` : totaux calculés via `resolvePrice()` (ligne par ligne). Badge global "⚠️ Prix marché" en bas du récap si au moins une ligne en fallback
**AC9** ✅ `PricingPanel.tsx` : badge "Prix marché" au lieu de "Estimation"
**AC10** ✅ Concept documenté dans PRD (FR47-FR50, nouveau Domaine 10) + memory `project_magrit_prix_marche.md`

## Fichiers touchés (4 par branche)

| Fichier | Modification |
|---|---|
| `src/app/utils/priceResolver.ts` | +170 lignes : `estimateMarketPriceHT()` + rename `prix_marche` + champ `isMarketPrice` |
| `src/app/components/shop/portal/PortalProduct.tsx` | +27 lignes : bouton débridé + alerte UI |
| `src/app/components/shop/portal/PortalCart.tsx` | +14 lignes : totaux via `resolvePrice` + badge global |
| `src/app/components/PricingPanel.tsx` | +1 ligne : badge label "Prix marché" |
| `_bmad-output/planning-artifacts/prd.md` | +9 lignes : Domaine 10 (FR47-FR50) |

## Écarts vs spec initiale

- **Concept ajouté en cours** : pas dans le PRD initial — issu d'une régression détectée par Arnaud en testant. **PRD étendu en conséquence** (FR47-FR50).
- **DRY incomplet** : `ProductCard.tsx` (atelier Magrit) implémente toujours sa propre `estimatePrice()` locale — à migrer vers le module commun lors d'un sprint ultérieur (mineure).

## Commits

- `ebaf76f` (sur `beta/v5`) : `feat(v5): concept "Prix marche" + debridage bouton panier sans Clariprint`
- `b10a209` (sur `beta/v4`) : `feat(v4): back-port concept "Prix marche" + debridage bouton panier (depuis v5)`

## Statut

✅ **Livrée et pushée sur `beta/v5` ET `beta/v4`** (back-port pour démo 2026-05-23).
✅ **Concept officialisé** : PRD § Domaine 10 + memory persistant.
⏳ **Validation Arnaud en local** : à confirmer (test sur ports 5176 + 5177).
⏳ **Cas TF Notion** : à créer (cf. Action 2).
