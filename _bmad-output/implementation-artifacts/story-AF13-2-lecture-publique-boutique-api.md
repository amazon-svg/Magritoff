---
id: AF13.2
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF13.1]
---

# AF13.2 — Charger une boutique publique via l’API Magrit

## Résultat livré

- sonde publique minimale par slug : identifiant, tenant et mode d’accès ;
- route catalogue distincte, refusée côté serveur avant toute lecture métier
  pour une boutique privée sans membership autorisée ;
- catalogue agrégé serveur : boutique, produits manuels, bibliothèques, mode
  PIM, exclusions, prix négociés, gammes, définitions et souscriptions ;
- déduplication des produits bibliothèque/PIM et application des overrides de
  prix dans le repository serveur ;
- migration de `PublicShop` vers `ShopsApiClient` ;
- remplacement du canal PostgreSQL direct par un rafraîchissement API au focus
  et toutes les 15 secondes lorsque l’onglet est visible.

## Sécurité

1. La sonde ne contient aucune marque ni donnée catalogue.
2. `self_signup` autorise le catalogue sans session.
3. `invite_only` exige un acteur puis appelle
   `current_user_can_access_shop`, qui couvre tenant, scope boutique et
   super-administration.
4. Le navigateur ne peut pas contourner le garde React en appelant directement
   le catalogue API.

## Mesures et validation

- baseline UI : **29 → 28** fichiers importeurs Supabase ;
- références directes : **106 → 95** ;
- tests de sonde anonyme, refus catalogue privé, client et frontière UI ;
- typecheck modulaire, suite complète et build de production.

## Suite

AF13.3 migre l’upload logo/hero et les prix négociés encore gérés directement
par `DashboardShopEditor`.
