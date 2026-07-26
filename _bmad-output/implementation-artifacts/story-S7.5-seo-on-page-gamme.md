# Story S7.5 — SEO on-page des pages gammes (Epic 7, Sprint V2-A)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **ADR** : §4.19-2 (meta dynamiques client-side, hook maison) + §4.19-3
> (JSON-LD Product/Offer/BreadcrumbList — jamais de lowPrice sur un prix
> estimé).

## Contexte

Le parcours 1 (Google → `/shop/:slug/g/:gamme`) exige des meta par page.
`product_definitions.seo_title/seo_description` (templatisés) existent depuis
S-PIM-EXAPRINT. Googlebot rend le JS : meta client-side suffisantes (POC).

## Décisions d'implémentation

1. **`src/app/hooks/useSeoMeta.ts`** : hook maison (~60 lignes de DOM, pas de
   react-helmet — ADR Rule of Three) : `document.title`, `meta[description]`,
   `link[canonical]`, `meta[robots]`, `og:title/description/url`, + injection
   d'un `<script type="application/ld+json">` par identifiant. Cleanup au
   unmount (restaure l'état antérieur).
2. **Helpers PURS** `src/app/components/shop/gamme/gammeSeo.helpers.ts` :
   - `buildGammeSeo(definition, gamme, shopName, options)` → {title,
     description} : `seo_title/seo_description` résolus (placeholders S7.4),
     repli « Impression {Gamme} — {Boutique} ».
   - `buildGammeJsonLd(...)` → Product (+ `offers` UNIQUEMENT si
     `phase.kind === 'ready'`, prix Clariprint réel — jamais le prix marché
     estimé, ADR §4.19-3) + BreadcrumbList.
3. **Intégration GammePage** : `useSeoMeta` avec canonical
   `origin + /shop/:slug/g/:gamme`. Le title portail (PublicShop) reprend la
   main en quittant la page (cleanup).
4. **robots noindex boutiques privées** : branché en S7.13 (dépend de
   `shops.access_mode`, S7.11) — le hook expose déjà le paramètre.

## Acceptance Criteria

- **AC1** : sur `/g/flyer`, `document.title` = seo_title FR résolu (ou repli),
  meta description présente, canonical exact, og:* posés.
- **AC2** : un `<script type="application/ld+json">` Product + BreadcrumbList
  est présent et parseable ; AUCUN champ `offers` quand le prix est une
  estimation marché.
- **AC3** : quitter la page gamme restaure le title portail ; aucune meta
  orpheline dupliquée après navigations répétées.
- **AC4** : helpers purs testés ; 0 régression.

## Fichiers

- `src/app/hooks/useSeoMeta.ts` (nouveau)
- `src/app/components/shop/gamme/gammeSeo.helpers.ts` + tests
- `src/app/components/shop/gamme/GammePage.tsx` (intégration)

## TF Notion (copy-paste)

**TF-S7.5 — Meta SEO et données structurées de la page gamme**
- **Parcours** : P09 · **Persona** : Visiteur SEO · **Type** : IA Chrome
- **Étapes** : (1) Ouvrir `/shop/<slug>/g/flyer` → l'onglet navigateur affiche
  un titre parlant (pas « MAGRIT_OFF »). (2) Console :
  `document.querySelector('link[rel=canonical]').href` = URL de la page.
  (3) `JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)`
  → @type Product + BreadcrumbList, sans `offers` si badge ⚠️ Prix marché.
  (4) Naviguer vers Accueil boutique → le titre redevient « {Boutique} ·
  Portail impression ».
- **Hints DOM** : `head > title`, `link[rel=canonical]`,
  `script[type="application/ld+json"]#magrit-gamme-jsonld`.
