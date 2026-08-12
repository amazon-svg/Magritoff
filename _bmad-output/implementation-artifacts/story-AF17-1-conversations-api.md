---
id: AF17.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF16.3]
---

# AF17.1 — Isoler la persistance des conversations

## Résultat livré

- nouveau module `conversations` avec contrats indépendants de PostgreSQL ;
- routes authentifiées de liste, sauvegarde et suppression sous
  `/api/v1/tenants/{tenantId}/conversations` ;
- repository Supabase confiné côté serveur et exécuté avec la session RLS ;
- migration de `ConversationContext` vers `ConversationsApiClient` ;
- composition du module dans le runtime Edge Magrit.

## Invariants

- l’utilisateur est exclusivement dérivé du bearer token ;
- `user_id` et `tenant_id` ne sont jamais acceptés depuis le navigateur ;
- le cache local reste suffixé par tenant et continue de permettre la
  restauration immédiate et la migration au login ;
- un refus RLS lors de la reprise d’un ancien cache retire la conversation
  conflictuelle localement pour empêcher les rejeux en boucle ;
- la persistance des conversations reste séparée de l’appel au fournisseur IA.

## Mesures

- `ConversationContext` : **3 → 0** références Supabase ;
- baseline globale : **56 → 53** références ;
- fichiers UI important Supabase : **14 → 13**.

## Validation UX attendue

Créer une conversation, recharger l’onglet et vérifier sa restauration avec
les messages et produits. Changer de tenant et vérifier l’isolation de
l’historique. Supprimer une conversation puis recharger : elle ne doit plus
réapparaître ni localement ni depuis le serveur.
