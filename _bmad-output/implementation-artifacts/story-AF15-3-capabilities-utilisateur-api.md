---
id: AF15.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF15.2]
---

# AF15.3 — Isoler la vérification des capabilities utilisateur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- lecture contractuelle
  `GET /api/v1/tenants/{tenantId}/capabilities/{capability}` ;
- validation stricte de la nomenclature `can_*` avant l’adaptateur ;
- calcul via `user_has_capability` confiné au repository Supabase du module
  Roles et exécuté avec la session RLS de l’acteur ;
- migration de `useUserCapability` vers `RolesApiClient`.

## Invariants

- l’utilisateur est exclusivement dérivé du bearer token ;
- le tenant vient de la route et reste contrôlé par les politiques/RPC SQL ;
- le navigateur ne connaît ni le RPC ni le fournisseur ;
- une erreur de vérification produit une décision UI prudente `false` et reste
  observable par le message d’erreur du hook.

## Mesures

- `useUserCapability` : **1 → 0** référence Supabase ;
- baseline globale : **67 → 66** références ;
- fichiers UI important Supabase : **20 → 19**.

## Validation UX attendue

Avec un rôle Validateur, les actions de validation de commande restent
visibles. Sans cette capability elles restent masquées. La page
« Workflow & rôles » reste inaccessible sans `can_manage_roles`.
