# Story S7.13 — Sitemap par boutique + indexabilité (Epic 7, Sprint V2-C)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **ADR** : §4.19-4 — seules les boutiques `self_signup` sont indexables ;
> `invite_only` = noindex + exclues du sitemap.

## Décisions d'implémentation

1. **Edge function `shop-sitemap`** (GET `?slug=<shop_slug>&base=<origin>`) :
   service role → boutique `active` ET `access_mode='self_signup'` sinon 404 ;
   XML urlset = home boutique + une URL `/g/:slug` par gamme SOUSCRITE active
   du tenant (repli : gammes racines du PIM si aucune souscription).
   `Content-Type: application/xml` + cache 1 h. Déployée prod B5 (PAT).
2. **noindex boutiques privées** : `useSeoMeta({ robots: 'noindex, nofollow' })`
   posé par PublicShop sur TOUTES les vues quand `access_mode !== 'self_signup'`
   (défaut sûr : privé). La page gamme (S7.5) hérite du même robots via son
   propre `useSeoMeta`.

## Acceptance Criteria

- **AC1** : `GET /shop-sitemap?slug=<self_signup>` → XML valide (home + gammes
  souscrites) ; boutique privée/inconnue → 404.
- **AC2** : boutique privée : `<meta name="robots" content="noindex, nofollow">`
  présent sur home ET page gamme ; boutique self_signup : absent.
- **AC3** : déployé + vérifié live prod B5 ; 0 régression.

## TF Notion — créé directement dans la DB (TF-S7.13)
