---
id: AF16.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF15.3]
---

# AF16.1 — Isoler les redirections tenant et boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- lecture contractuelle `GET /api/v1/tenant-slugs/{slug}` pour résoudre un
  slug courant ou archivé pendant la fenêtre de redirection de 90 jours ;
- migration de `LegacySlugRedirect` vers `SessionApiClient` ;
- réutilisation de la liste RLS du module Shops pour sélectionner la première
  boutique réellement accessible parmi `allowedShopIds` ;
- migration de `ShopOnlyRedirect` vers `ShopsApiClient`.

## Invariants

- la résolution de slug exige désormais une session Magrit authentifiée ;
- seul un slug conforme est transmis au repository ;
- le chemin, la query string et le fragment sont conservés lors de la
  redirection d’un ancien slug ;
- une boutique doit être à la fois visible via la RLS et présente dans
  `allowedShopIds` pour devenir la cible ;
- les erreurs produisent les fallbacks existants, jamais l’accès au dashboard.

## Mesures

- `LegacySlugRedirect` : **1 → 0** référence Supabase ;
- `ShopOnlyRedirect` : **1 → 0** référence Supabase ;
- baseline globale : **66 → 64** références ;
- fichiers UI important Supabase : **19 → 17**.

## Validation UX attendue

Ouvrir une ancienne URL `/t/{ancienSlug}/...` avec un utilisateur connecté et
vérifier la conservation du sous-chemin. Avec un compte `shop_only`, ouvrir
une URL dashboard et vérifier la redirection immédiate vers la boutique
autorisée. Sans boutique attribuée, le message « Accès restreint » reste
affiché.
