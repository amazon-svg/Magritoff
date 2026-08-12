# TF-AF2 — Bootstrap session, tenant et préférences

## Preuves automatisées

| ID | Scénario | Résultat | Statut |
|---|---|---|---|
| AF2-01 | Bootstrap avec owner `magrit_full` | Tenant direct et enfant hérités, rôle effectif conservé | OK |
| AF2-02 | Bootstrap avec member, partner ou `shop_only` | Aucun héritage descendant | OK |
| AF2-03 | Enfant déjà membre direct | Une seule entrée, membership direct prioritaire | OK |
| AF2-04 | Tenant système owner/admin | `isSuperAdmin=true` | OK |
| AF2-05 | Session sans préférence | Valeurs par défaut stables | OK |
| AF2-06 | GET session via client et handler | Même contrat validé aux deux frontières | OK |
| AF2-07 | PATCH préférences | Réponse réconciliée et typée | OK |
| AF2-08 | PUT tenant accessible | Dernier tenant persisté | OK |
| AF2-09 | PUT tenant inaccessible | 403 `session.tenant_access_denied` | OK |
| AF2-10 | Session sans acteur | 401 avant le cas d usage | OK |
| AF2-11 | Inspection des contexts | Aucune lecture directe des tables de bootstrap | OK |
| AF2-12 | Inspection composition Edge | Clé anonyme + bearer utilisateur, aucune service role | OK |

## Recette externe après confirmation

1. Déployer `magrit-api` selon `docs/architecture/api/deployment.md`.
2. Appeler le healthcheck puis la session avec un JWT de recette.
3. Vérifier un owner avec enfant, un member et un acheteur `shop_only`.
4. Modifier thème et tenant courant, recharger et vérifier la persistance.
5. Contrôler dans le navigateur que les requêtes sont limitées à `/api/v1/*` pour ce bootstrap.

Statut Notion : fiche locale prête, connecteur indisponible dans cette session.
