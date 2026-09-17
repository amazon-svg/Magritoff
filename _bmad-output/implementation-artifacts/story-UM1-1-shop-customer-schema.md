---
id: UM1.1
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM0.1]
---
# UM1.1 — Créer le schéma des comptes clients boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-152](https://app.notion.com/3c6d0131973c81df8252fc0a6936848b) | P12 — Un compte par boutique : même email = deux comptes, une session ne vaut que pour sa boutique | OK | P0 — Critique | P12 — Comptes clients boutique | B5 | SPEC-IDENTITY-STORE-01, UM1-1, UM2-1, UM10-4, invariant 3 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- table additive `shop_customer_accounts` liée à `shops` ;
- email normalisé calculé par PostgreSQL et unicité
  `(shop_id, normalized_email)` ;
- états `delegated_only`, `invited`, `active`, `suspended` ;
- références Auth technique et acteur Magrit séparées ;
- contraintes de cohérence activation/suspension ;
- RLS activée et accès navigateur révoqué par défaut ;
- aucun changement sur `tenant_members`, `shop_only`, commandes ou invitations.

Les policies workspace et le BFF storefront seront livrés avec leurs
capabilities et contrats respectifs. Cette story ne rend donc pas encore la
table accessible à l’interface.
