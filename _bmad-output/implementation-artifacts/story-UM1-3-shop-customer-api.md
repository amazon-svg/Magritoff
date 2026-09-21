---
id: UM1.3
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM1.2]
---
# UM1.3 — Exposer l’API workspace des comptes boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- adaptateur `SupabaseShopCustomersRepository` ;
- vérification systématique du couple tenant/boutique ;
- routes authentifiées `GET/POST .../shops/{shopId}/customers` ;
- client HTTP partagé `ShopCustomersApiClient` composé par le runtime ;
- erreur `duplicate_email` traduite en Problem Details 409 ;
- câblage dans l’Edge Function Magrit ;
- types de base de données et tests client/serveur synchronisés.

Cette API est réservée aux utilisateurs workspace autorisés par RLS. Elle ne
crée aucune session storefront et n’expose aucune délégation.
