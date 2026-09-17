---
id: UM8.1
epic: EPIC-UM-STORE-IDENTITY
status: done-code
branch: feat/storefront-identity-um2
depends_on: [UM7.3]
---
# UM8.1 — Geler les écritures `shop_only`

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-149](https://app.notion.com/3c6d0131973c81e2abadd93317bda387) | UM — Connexion d un ancien accès shop_only : écran Activation boutique nécessaire, plus de redirection boutique | OK | P0 — Critique | P01 — Onboarding premier login | B5 | UM7-1, UM8-1, UM8-2, AF30-5, AF30-7 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Objectif

Arrêter immédiatement la création de dette legacy sans supprimer les comptes
historiques avant leur contrôle sur la base distante.

## Résultat

- une invitation depuis « Utilisateurs Magrit » crée uniquement un membre
  `magrit_full` ;
- les contrats HTTP refusent les anciens champs `accessScope=shop_only` et
  `allowedShopIds` ;
- un ancien membre peut uniquement être converti vers un utilisateur Magrit ;
- un trigger PostgreSQL bloque les nouveaux membres et invitations
  `shop_only` provenant d'une session applicative ;
- les lignes existantes restent lisibles et la connexion postgres de migration
  peut encore exécuter les reprises UM7 ;
- aucune suppression de compte, invitation ou commande.

## Validation

- tests contrats client/serveur ;
- tests d'architecture UI et SQL ;
- typecheck et suite applicative.

L'application locale de la migration et les scénarios SQL doivent être rejoués
dès que Docker Desktop est disponible.
