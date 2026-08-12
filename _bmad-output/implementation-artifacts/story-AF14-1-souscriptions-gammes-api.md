---
id: AF14.1
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF13.4]
---

# AF14.1 — Isoler les souscriptions de gammes du tenant

## Résultat livré

- création du module `catalog` avec contrats, client, service et port ;
- routes GET/PUT tenant-scoped pour les souscriptions de gammes ;
- commande groupée pour les parents et leurs enfants ;
- tenant et acteur dérivés côté serveur ;
- adaptateur Supabase confiné au runtime Edge ;
- erreurs visibles dans l’interface et état recalé sur la réponse serveur.

## Invariants

- une même gamme ne peut apparaître deux fois dans une commande ;
- une commande contient de 1 à 200 souscriptions ;
- seuls owner/admin ou super-admin peuvent écrire, sous contrôle RLS ;
- désactiver conserve la ligne et son historique.

## Mesures

- `DashboardTenantGammes` : **3 → 0** références Supabase ;
- baseline globale : **84 → 81** références ;
- fichiers UI important Supabase : **25 → 24**.

## Validation UX attendue

Dans « Gammes actives », activer puis désactiver une gamme enfant, puis faire
la même opération sur un parent. Après rechargement, les cases et compteurs
doivent refléter la réponse serveur. Un membre non administrateur doit rester
en lecture seule.
