---
story_id: S-PIM-VISUELS
epic: 4 — Mockup Engine paramétrique (extension visuels enrichis)
title: Gabarits visuels produits réalistes + fond personnalisable (upload ou bibliothèque)
status: spec-pending-validation
created_at: 2026-05-11
target_branch: beta/v5
agent: TBD
size: L (à confirmer)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR25-27 mockup engine)
predecessors: [S4.1a/b/c bucket+renderer+edge livré, S4.2 5 templates SVG MVP, S4.3 MockupImage livré]
successors: []
---

# Story S-PIM-VISUELS — Gabarits visuels réalistes + fond personnalisable

## Contexte

Précision Arnaud 2026-05-11 sur la stratégie visuels produit :
> *"On génère des gabarits de visuels de produits qui doivent évidemment ressembler au produit qu'ils illustrent. Nous laissons le 'fond' du produit en blanc et en // nous proposons à l'utilisateur soit d'uploader un visuel qui sera appliqué à l'ensemble des produits, soit il choisira parmi une bibliothèque de visuels de fond que nous lui proposerons. Le but étant d'arriver à une bonne représentation du visuel du produit, tout en permettant de personnaliser l'environnement graphique. Nous offrirons cette personnalisation dans le PIM, soit un visuel pour l'ensemble des gammes, soit un visuel par gamme."*

**État actuel** (post S4.x) : 5 templates SVG paramétriques génèrent des PNG 1024×1024 brandés en `--shop-primary`. Cohérent visuellement mais **abstraits** — un flyer = un rectangle + pattern dots, une carte de visite = un rectangle + liseré. Pas photo-réaliste.

**Cible** : 2 niveaux de personnalisation visuelle distincts :

| Niveau | Objet | Personnalisation |
|---|---|---|
| **1 — Produit** (forme + finition) | Le gabarit ressemble vraiment au produit print (carte horizontale 3D, brochure 2 panneaux entrouverts avec ombre, kakémono debout avec pied réaliste, étiquette adhésive perspective...) | **Fond du produit en blanc** (zone d'impression neutre, prête à recevoir le design client) |
| **2 — Environnement** (background) | Le décor derrière le produit (desk en bois, mains qui tiennent, papier kraft, marbre, etc.) | **Personnalisable par l'utilisateur** via 2 chemins (upload OU bibliothèque) |

## Stratégie technique proposée (à valider)

### Architecture des couches visuelles

Composer un mockup final via **3 couches superposées** :
1. **Layer Background** (fond environnement) : image PNG/JPG personnalisée OU bibliothèque OU couleur unie blanche default
2. **Layer Product Shape** (gabarit produit) : SVG réaliste plus avancé que S4.2 (forme + ombres + finition + perspective), zone d'impression en blanc/transparente
3. **Layer Product Imprint** *(optionnel V2+)* : design client uploadé (PDF/image) projeté dans la zone d'impression

Composition via `@resvg/resvg-wasm` (déjà en place S4.1b) ou via un compositing PNG côté edge function.

### Sources de la couche Background

| Source | Persistance | Granularité |
|---|---|---|
| **Default neutre** (blanc cassé / dégradé sobre) | Pas de persistance, fallback systématique | Tous produits |
| **Bibliothèque Magrit** (ex: 10-15 environnements pré-conçus stockés dans Storage `public_backgrounds/`) | Bucket Supabase Storage public, séant via UI Magrit | Par tenant ou par gamme |
| **Upload utilisateur** (image custom du tenant) | Bucket Storage `tenant_assets/<tenant_id>/backgrounds/`, RLS tenant-scoped | Par tenant (tous produits) ou par gamme (1 image par gamme souscrite) |

### Granularité PIM

Décision Arnaud : *"soit un visuel pour l'ensemble des gammes, soit un visuel par gamme"*.

Modélisation :
- **Tenant-wide** : table `tenant_visual_preferences(tenant_id, background_url, ...)` — 1 image partagée par tous les produits du tenant
- **Override par gamme** : table `tenant_gamme_visual_preferences(tenant_id, gamme_slug, background_url, ...)` — précise par gamme, prime sur tenant-wide
- Si rien : default Magrit

Helper résolution : `resolveProductBackground(tenant_id, gamme_slug) → url` qui cascade gamme → tenant → default.

### UI d'administration dans DashboardAdminPIM

Composant `<TenantVisualSettings>` :
- Section "Fond pour tous mes produits" : upload + preview + bibliothèque selector
- Section "Fond par gamme" (collapsible) : 1 ligne par gamme souscrite (E9.6), upload/bibliothèque par gamme

### Refonte mockup-generator (edge function)

L'edge function actuelle (`supabase/functions/mockup-generator/`) reçoit `template`, `width`, `height`, `productName`, `primaryColor`. À étendre avec :
- `background_url?` : URL de l'image de fond (résolue côté caller via `resolveProductBackground`)
- `imprint_url?` : V2+ (design client) — out of scope MVP

Le renderer compose les couches avant le `Resvg.render()`.

### Refonte gabarits SVG (S4.2 → S4.2bis)

Les 5 templates actuels (flyer / carteVisite / brochure / etiquette / kakemono) sont à upgrader pour être plus réalistes : ombres portées réalistes, perspective, finition (pelliculage = reflet subtil), etc. Le `--shop-primary` reste utilisé mais plus comme accent que comme couleur dominante (sinon écrase l'effet "fond blanc"). Décision Arnaud à confirmer : on **upgrade** S4.2 ou on **crée S4.2bis** en parallèle ?

## Questions à arbitrer AVANT spec finale

| # | Question | Décision attendue Arnaud |
|---|---|---|
| Q1 | Bibliothèque Magrit : combien d'environnements pré-conçus pour MVP ? (5 / 10 / 15) Et qui les conçoit (Sally UX / stock photos / IA générative) ? | À préciser |
| Q2 | Format upload utilisateur : JPG/PNG/WebP autorisés ? Taille max (ex: 5 MB) ? Dimensions min/max ? Crop automatique au ratio mockup 1024×1024 ? | À préciser |
| Q3 | Sécurité upload : scan virus / NSFW filter ? Modération préalable Magrit ? | À trancher |
| Q4 | Granularité : on commence par "tenant-wide" et on ajoute "par gamme" en V2, ou les 2 directement MVP ? | Recommandation : tenant-wide MVP, par gamme V2 |
| Q5 | Gabarits S4.2 à upgrader OU créer S4.2bis en parallèle ? | À trancher |
| Q6 | "Zone d'impression en blanc" : on garde un cadre / bordure visible (pour signaler la zone) ou totalement transparent (le fond se voit directement à travers) ? | À trancher UX |
| Q7 | Cache `product_mockups` actuel (S4.1a bucket) : doit-on inclure `background_url` dans la cache key pour éviter de re-rendre quand background change ? (cf. invalidation actuelle par shop) | Probablement oui |
| Q8 | Layer "Imprint" (design client uploadé projeté sur la zone) : V2+ ou MVP ? | Recommandation : V2+ (chantier conséquent) |

## Out of scope explicite

- Imprint du design client uploadé (V2+)
- Génération d'environnements via Imagen 4 / Flux (V2+, déjà mentionné architecture.md S4.4)
- Marketplace de fonds Canva-like (Vision V3+)
- Personnalisation par produit individuel (uniquement par tenant ou par gamme — décision Arnaud)

## Effort estimé (à raffiner)

- **L** (Large) — story conséquente, probablement à découper en 3-4 sous-stories :
  - S-PIM-VISUELS-1 : bibliothèque Magrit + bucket public_backgrounds + 5-10 environnements pré-conçus
  - S-PIM-VISUELS-2 : upload utilisateur + bucket tenant_assets/<tenant>/backgrounds/ + RLS
  - S-PIM-VISUELS-3 : tables `tenant_visual_preferences` + (optionnel) `tenant_gamme_visual_preferences` + helper `resolveProductBackground`
  - S-PIM-VISUELS-4 : UI `<TenantVisualSettings>` dans DashboardAdminPIM
  - S-PIM-VISUELS-5 : refonte mockup-generator pour composer les couches + cache key étendue
  - S-PIM-VISUELS-6 : upgrade gabarits S4.2 (ou S4.2bis) plus réalistes

## References

- [Source: _bmad-output/planning-artifacts/prd.md] — FR25-27 mockup engine
- [Source: _bmad-output/planning-artifacts/architecture.md#L300-L328] — §4.3 Mockup Engine architecture
- [Source: _bmad-output/implementation-artifacts/story-S4.1b-pipeline-svg-png-flyer.md] — pipeline @resvg/resvg-wasm
- [Source: _bmad-output/implementation-artifacts/story-S4.2-templates-svg-mvp.md] — 5 templates SVG actuels
- [Source: supabase/migrations/20260424_07_pim_image_url_columns.sql] — colonnes `image_url` déjà ajoutées sur `product_gammes` + `product_definitions`
- [Source: supabase/functions/mockup-generator/index.ts] — edge function à étendre
- [Source: docs/project-context.md#L51] — pivot resvg-wasm
