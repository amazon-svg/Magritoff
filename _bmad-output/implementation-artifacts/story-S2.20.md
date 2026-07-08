# Story S2.20 — Landing catégorie éditorialisée (contenu auto-généré LLM)

- **Epic** : Epic 2 — Extension boutique e-commerce standard
- **Sprint** : E3 Navigation
- **FR couverts** : FR-ECOM-10
- **ADR liés** : §4.17 (gamme = catégorie), §4.15 (résilience IA / jamais de page vide)
- **Auteur** : Amelia (Dev) — 2026-07-08
- **Statut** : livrée (enrichissement LLM en attente déploiement edge — voir §Déploiement)

## Contexte

Ouvrir une famille (méga-menu, home, autocomplétion S2.21) amène aujourd'hui sur
une **grille brute filtrée**. S2.20 la transforme en **landing structurée** :
titre + intro + tuiles sous-catégories + best-sellers + grille.

`product_gammes` n'a **aucun champ éditorial** (slug/name/parent/display_order/
matching_rules). Le contenu (titre marketing, intro, SEO) est donc
**auto-généré par LLM** (option 2 retenue par Arnaud, 2026-07-08), avec un
**socle déterministe** garantissant « jamais de page vide » même sans IA.

## Décisions de conception

1. **Deux couches** :
   - **Socle déterministe** (`buildCategoryLandingModel`) : titre = nom de famille,
     intro templatée, sous-catégories (gammes enfants avec produits), best-sellers
     (top display_order). Toujours non vide, aucun appel réseau.
   - **Enrichissement LLM** (`mergeEditorial`) : overlay `{title, intro, seo}`
     renvoyé par l'edge function, applique uniquement les champs non vides.
2. **Endpoint edge** `make-server-e3db71a4/category-editorial` : modèle **Haiku**
   (génération rapide, `claude-haiku-4-5-20251001`), maxTokens 600, retourne
   `{title, intro, seo}` JSON. Fallback démo gracieux (clé absente / billing / réseau)
   → le client garde le socle déterministe (ADR §4.15, même pattern que S-CONSO-4).
3. **Cache client** sessionStorage par slug de famille → 1 appel LLM par famille et
   par session (pas de re-génération à chaque navigation).
4. **Rendu conditionnel** : la landing s'affiche quand **exactement une famille**
   est active (réutilise la détection `activeFamily` du fil d'Ariane S2.19). Vue
   « toutes familles » → pas de landing, grille directe.
5. **Sous-catégories** : masquées si aucune enfant avec produits (POC seedé au niveau
   racine) — dégradé gracieux, la landing reste utile (titre + intro + best-sellers).

## Acceptance Criteria

- **AC1** — Given l'acheteur ouvre une famille, When la landing rend, Then elle
  affiche titre + intro + (sous-catégories si présentes) + best-sellers + grille.
- **AC2** — Given une famille sans contenu éditorial saisi, When la landing rend,
  Then le socle auto-généré est utilisé — jamais de page vide.
- **AC3** — Given l'edge LLM répond, When le contenu arrive, Then l'intro/titre/SEO
  éditoriaux remplacent le socle (champs non vides seulement), sans clignotement bloquant.
- **AC4** — Given un clic sur une tuile sous-catégorie ou un best-seller, When clic,
  Then le catalogue filtre la sous-catégorie (`selectGammes`) / ouvre la fiche produit.

## Implémentation

- `src/app/utils/catalogLanding.ts` (NEW, purs) : `buildCategoryLandingModel`,
  `buildFallbackIntro`, `mergeEditorial`, `categoryEditorialCacheKey`.
- `src/app/components/shop/portal/PortalCategoryLanding.tsx` (NEW) : rendu landing.
- `src/app/components/shop/portal/PortalCatalog.tsx` : détecte `activeFamily`,
  fetch éditorial (useEffect + timeout + cache session), rend la landing en tête.
- `supabase/functions/make-server-e3db71a4/index.ts` : endpoint `category-editorial`.
- `src/app/lib/testIds.ts` : `catalogLanding`, `catalogLandingSubcat`,
  `catalogLandingBestseller`.

## Tests

- `tests/utils/catalogLanding.test.ts` — socle déterministe, intro fallback,
  best-sellers (tri + cap), merge (champs vides ignorés), cache key.
- Baseline 700 verts, cible 0 régression.

## Déploiement (post-merge)

L'endpoint `category-editorial` doit être déployé (`supabase functions deploy
make-server-e3db71a4`) — **nécessite un PAT** (à demander à Arnaud). Tant qu'il
n'est pas déployé, le socle déterministe couvre l'AC2 (jamais de page vide) ;
l'enrichissement LLM s'active automatiquement au déploiement.

## TF Notion

`_bmad-output/implementation-artifacts/TF-NOTION-S2.20.md` (3 cas P09).

## DoD

- [x] Story doc
- [x] Helpers purs + tests vitest
- [x] Endpoint edge (code)
- [x] TF Notion
- [x] testIds déclarés
- [x] Microcopy FR sans anglicisme
- [ ] Déploiement edge (PAT requis)
- [ ] Confirmation Arnaud avant push
