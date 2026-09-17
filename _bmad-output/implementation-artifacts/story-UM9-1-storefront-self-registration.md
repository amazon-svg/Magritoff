---
id: UM9.1
epic: EPIC-UM-STORE-IDENTITY
status: done-code
branch: feat/storefront-identity-um2
depends_on: [UM8.1, UM8.3]
---
# UM9.1 — Auto-inscription sur une boutique publique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-151](https://app.notion.com/3c6d0131973c8148a459e5fbe3aca0e7) | P12 — Boutique privée (invite_only) : aucun branding, aucun catalogue, pas de création libre, connexion seule | OK | P0 — Critique | P12 — Comptes clients boutique | B5 | UM8-4, UM9-1, SHOP_ACCESS_CONTROL invariants 1-2 et 9 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Objectif

Rétablir le parcours `self_signup` sans recréer de profil mixte : le visiteur
obtient un compte client propre à la boutique et aucune identité Magrit.

## Résultat

- le checkout d’une boutique `self_signup` propose connexion ou création ;
- une commande BFF publique valide le contrat et place la session en cookie
  HttpOnly sans exposer son secret à React ;
- une transaction SQL crée le compte, le credential privé et la session ;
- un même email reste indépendant dans chaque boutique ;
- `invite_only`, doublon et données invalides produisent le même refus neutre ;
- l’ancien endpoint `buyer-registration` et son client sont supprimés ;
- l’exécution de `self_register_shop_buyer` est retirée à `authenticated`.

## Invariants de sécurité

- aucun `auth.users`, `tenant_members`, `allowed_shop_ids` ou rôle Acheteur ;
- compte limité au `shop_id` choisi par le slug serveur ;
- mot de passe haché en bcrypt après pré-hachage SHA-256 ;
- token opaque stocké uniquement sous forme de digest ;
- aucune distinction publique entre doublon et boutique non ouverte.

## Validation

- 23 tests ciblés TypeScript ;
- 10 scénarios SQL storefront, dont création, doublon, `invite_only`,
  credential et session ;
- migration appliquée sur Supabase local.

## Suite connue

La bêta active immédiatement le compte. La vérification de propriété de l’email
et la protection anti-abus (rate-limit/CAPTCHA) restent à planifier avant une
ouverture publique à fort trafic.
