---
id: UM8.2
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM8.1]
---
# UM8.2 — Aligner la documentation sur les identités séparées

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
