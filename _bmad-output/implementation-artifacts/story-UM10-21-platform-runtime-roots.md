---
id: UM10.21
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.20]
---
# UM10.21 — Séparer les racines de runtime navigateur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

La frontière de route storefront ne montait plus l'authentification Magrit,
mais elle importait encore le runtime navigateur commun. Ce module chargeait
statiquement l'adaptateur Supabase Auth du workspace. La séparation des
providers était donc correcte à l'exécution sans être complète dans le graphe
de dépendances.

## Résultat

- le runtime workspace conserve Auth Magrit, assistant interne, mockups et
  tarification ;
- un runtime storefront distinct ne contient que l'assistant boutique et la
  passerelle de tarification publique ;
- la frontière `/shop/...` ne référence plus le runtime workspace ;
- le contexte de services storefront exige désormais le type minimal
  `StorefrontBrowserRuntime` ;
- aucun import Supabase Auth ou `AuthenticationGateway` n'est autorisé dans la
  racine de runtime storefront.

## Validation

- garde-fou sur l'absence de l'adaptateur Supabase Auth dans le runtime
  storefront ;
- garde-fou sur le runtime explicitement injecté dans la frontière boutique ;
- typecheck, suite Vitest complète et build de production.
