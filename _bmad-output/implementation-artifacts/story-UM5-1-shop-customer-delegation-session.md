---
id: UM5.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM4.1]
---
# UM5.1 — Émettre une session storefront déléguée

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- table privée de délégations auditant acteur Magrit, compte joué, boutique,
  motif, émission, expiration et révocation ;
- orchestration SQL atomique : vérification de la boutique et de la capability,
  garantie du compte miroir UM4, délégation et session ;
- session de trente minutes, bornée entre cinq minutes et une heure côté SQL ;
- jeton aléatoire dont seul le SHA-256 est stocké ;
- cookie storefront HttpOnly, `SameSite=Lax`, jamais inclus dans le JSON ;
- remplacement de l’ancienne délégation du même acteur sur la boutique ;
- résolution des comptes `delegated_only`, `invited` ou `active`, mais jamais
  `suspended` ;
- déconnexion storefront révoquant également l’enregistrement d’audit ;
- réponse limitée au compte, à la délégation et au chemin de boutique.

## Route

`POST /api/v1/tenants/{tenantId}/shops/{shopId}/customers/self-delegation`

UM5.2 branchera cette route sur l’action Magrit « Se connecter à la boutique »
et affichera dans le storefront un bandeau permanent permettant de quitter le
mode délégué.
