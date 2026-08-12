---
id: AF20.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF20.1]
---
# AF20.2 — Isoler les mutations commerciales

## Résultat livré

- création et suppression des groupes via Commercial ;
- lecture et modification des appartenances aux groupes ;
- création, activation/désactivation et suppression des règles de prix ;
- les identifiants de tenant et d'auteur sont imposés côté serveur ;
- les opérations sur un groupe vérifient son rattachement tenant avant de
  toucher ses membres ;
- le dashboard commercial ne connaît plus Supabase.

## Mesures

- dashboard commercial : **8 → 0** références Supabase ;
- baseline globale : **16 → 8** références ;
- fichiers importeurs : **6 → 5**.

## Validation UX attendue

Créer puis supprimer un groupe, ajouter et retirer un membre, créer une règle,
la désactiver/réactiver puis la supprimer. Un rechargement doit restituer chaque
état persistant.
