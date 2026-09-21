---
id: UM6.6
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.5]
---
# UM6.6 — Connecter le checkout avec le compte boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- façade storefront exposant la création de session BFF existante ;
- formulaire de connexion boutique partagé entre la garde privée et le
  checkout ;
- boutique `invite_only` toujours protégée avant le chargement du catalogue ;
- suppression de `signIn`, `signUp` et de l'inscription `shop_only` héritée du
  parcours storefront ;
- aucune création ou réutilisation implicite d'un utilisateur Magrit ;
- activation du bouton Commander uniquement si la session appartient à la
  boutique exacte ;
- coexistence possible avec une session Magrit du navigateur sans assimilation
  des deux identités ;
- libellé explicite de la connexion boutique et accès secondaire vers « Mes
  espaces Magrit » pour éviter toute confusion entre les deux sessions ;
- auto-inscription storefront retirée tant que sa primitive compte boutique
  dédiée n'est pas livrée.

La récupération de mot de passe et l'auto-inscription `self_signup` devront
utiliser le même domaine boutique, sans réintroduire Supabase Auth dans le
navigateur.
