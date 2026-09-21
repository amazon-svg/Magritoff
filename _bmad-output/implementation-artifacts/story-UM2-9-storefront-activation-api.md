---
id: UM2.9
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.8]
---
# UM2.9 — Exposer l’activation d’un credential boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-158](https://app.notion.com/3c6d0131973c81e680edf7450511d780) | P12 — Renvoyer une invitation client boutique et lien manuel sans Resend | À jouer | P1 — Importante | P12 — Comptes clients boutique | B5 | UM2-9, UM3-1, AF30-15 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- commande workspace authentifiée pour générer un jeton d’activation ;
- autorisation `can_manage_shop_customers` conservée dans la primitive SQL ;
- jeton renvoyé explicitement afin de permettre une transmission manuelle ;
- aucun envoi d’email annoncé tant que le port de notification UM3 n’est pas branché ;
- activation publique par jeton avec mot de passe ; à compter de UM2.11, cette
  activation émet aussi la première session storefront ;
- réponse d’échec neutre pour ne pas distinguer jeton inconnu, expiré ou déjà utilisé ;
- réponses et secrets marqués `Cache-Control: no-store`.

## Routes

- `POST /api/v1/tenants/{tenantId}/shops/{shopId}/customers/{customerId}/activation`
- `POST /api/v1/storefront/activation`

Le checkout et l’écran d’activation restent hors de cette story. UM3 pourra
consommer la première route pour envoyer un lien, sans déplacer l’émission du
jeton vers le fournisseur d’email.
