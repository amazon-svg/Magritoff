---
id: AF16.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF16.2]
---

# AF16.3 — Isoler l’identité checkout et le rattachement self-signup

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- connexion et création de compte du checkout via `AuthContext` ;
- extension non cassante du contrat Auth pour retourner la session obtenue et
  transmettre la société dans les métadonnées d’inscription ;
- commande authentifiée
  `POST /api/v1/shops/{shopId}/buyer-registration` ;
- confinement de `self_register_shop_buyer` dans le repository Shops ;
- retrait complet de Supabase de `CheckoutPage`.

## Invariants

- l’acheteur est dérivé exclusivement du bearer token ;
- aucun identifiant tenant, rôle ou scope n’est accepté depuis le formulaire ;
- la fonction SQL continue d’imposer `active + self_signup`, `shop_only`, une
  allow-list limitée à la boutique et le rôle Acheteur en best-effort ;
- le rattachement reste idempotent ;
- une boutique `invite_only` ne propose toujours aucune création de compte.

## Mesures

- `CheckoutPage` : **4 → 0** références Supabase ;
- baseline globale : **60 → 56** références ;
- fichiers UI important Supabase : **15 → 14**.

## Validation UX attendue

Sur une boutique `self_signup`, créer un compte au checkout puis vérifier le
rattachement et la possibilité de commander. Se déconnecter, se reconnecter
avec ce compte et vérifier que l’appel est idempotent. Sur une boutique
`invite_only`, vérifier que seule la connexion est proposée et qu’un compte
non invité reste refusé.
