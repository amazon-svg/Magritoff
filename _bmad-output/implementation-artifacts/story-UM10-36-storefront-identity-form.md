---
id: UM10.36
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.35]
---
# UM10.36 — Isoler le formulaire d'identité storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- `useStorefrontIdentityForm` pilote connexion, inscription et récupération ;
- chaque commande conserve obligatoirement le `shopSlug` courant ;
- les modes et messages d'erreur restent propres au compte boutique ;
- `StorefrontLoginForm` devient une vue sans accès au client identité ;
- aucun lien, bearer ou mécanisme Supabase Auth de Magrit n'est réutilisé.

## Validation

- garde-fous checkout et API-first adaptés à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
