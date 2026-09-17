---
id: UM8.2
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM8.1]
---
# UM8.2 — Aligner la documentation sur les identités séparées

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

## Résultat

- `SHOP_ACCESS_CONTROL.md` devient la source de vérité du modèle cible ;
- les guides Admin, Client boutique et Validateur/Producteur ne recommandent
  plus de créer un acheteur `tenant_member shop_only` ;
- le parcours d’activation par boutique et la délégation Magrit sont décrits ;
- `self_signup` est explicitement marqué transitoire ;
- la coexistence legacy UM7/UM8 et le point d’arrêt avant suppression distante
  sont documentés ;
- une checklist UX couvre confidentialité, isolation multi-boutiques,
  commande et audit délégué.
