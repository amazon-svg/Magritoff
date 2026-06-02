---
story_id: S-PIM-VISUELS (overview / index)
epic: 4 — Mockup Engine paramétrique (extension visuels enrichis)
title: Gabarits visuels produits réalistes + fond personnalisable shop-scoped — overview + index 6 sous-stories
status: scindée 2026-05-22 — voir sous-stories -1 à -6
created_at: 2026-05-11
updated_at: 2026-05-22 (post Phase 0.5 cadrage qualité — pivot shop-scoped formalisé + ordre + dépendances explicites)
target_branch: beta/v5
agent: TBD (Sprint 7)
size: L cumul (10-12j) — scindée en 6 sous-stories S-M
prd_ref: _bmad-output/planning-artifacts/prd.md (FR25-27 mockup engine)
predecessors: [S4.1a/b/c bucket+renderer+edge livré, S4.2 5 templates SVG MVP, S4.3 MockupImage livré]
successors: [S-PRODUCT-VIEWS-MULTI éventuel post Pitch court 0.7]
sprint_cible: Sprint 7 (roadmap qualité-first)
sub_stories: [S-PIM-VISUELS-1, S-PIM-VISUELS-2, S-PIM-VISUELS-3, S-PIM-VISUELS-4, S-PIM-VISUELS-5, S-PIM-VISUELS-6]
adr_a_formaliser: §4.13 "Composition 3 layers shop-scoped pour mockup engine"
---

# Story S-PIM-VISUELS (overview) — Gabarits visuels réalistes + fond personnalisable

## ⚠️ Cette story a été scindée le 2026-05-22

Conformément au **principe DoD #7 qualité-first** (`docs/project-context.md` §5.2) — *"Story scindée si effort estimé > 3 jours"* — la story originale S-PIM-VISUELS (effort cumulé estimé 10-12 jours) a été scindée en **6 sous-stories indépendantes mais séquencées** :

| Sous-story | Périmètre | Effort | Position | Fichier |
|---|---|---|---|---|
| **S-PIM-VISUELS-3** | Tables `shop_visual_preferences` + helper `resolveProductBackground` + RLS shop-scoped | 1j | 🟢 1ère | (à créer Sprint 7 démarrage) |
| **S-PIM-VISUELS-1** | Bibliothèque Magrit 10 fonds pré-conçus + bucket `public_backgrounds` | 1.5j | 🟢 2ème (// avec -3) | (à créer Sprint 7 démarrage) |
| **S-PIM-VISUELS-2** | Upload utilisateur + bucket `shop_backgrounds/<shop_id>/` + RLS + validation MIME/poids | 2j | 🟡 3ème (dépend -3) | (à créer Sprint 7 démarrage) |
| **S-PIM-VISUELS-5** | Refonte `mockup-generator` (composition 3 layers + cache key étendue) | 2j | 🟡 4ème (dépend -1, -2, -3) | (à créer Sprint 7 démarrage) |
| **S-PIM-VISUELS-4** | UI admin boutique `<ShopVisualSettings>` (sélecteur biblio + upload + override par gamme) | 2j | 🔴 5ème (dépend -1, -2, -3, -5) | (à créer Sprint 7 démarrage) |
| **S-PIM-VISUELS-6** | Upgrade 5 gabarits S4.2 → plus photo-réalistes (ombres, perspective, finition) | 2.5j | ⚪ 6ème (indépendant, à faire en dernier pour cohérence visuelle) | (à créer Sprint 7 démarrage) |

**Note d'organisation** : les 6 fichiers sous-stories `story-S-PIM-VISUELS-{1..6}-*.md` seront créés en **Phase 0.5-bis au démarrage du Sprint 7** (cadrage léger juste-à-temps), pas maintenant. Phase 0.5 cadrage qualité (cette refonte d'index) fixe uniquement l'**ordre**, les **dépendances**, et les **questions Q1-Q8 tranchées** ci-dessous.

---

## Pivot Arnaud 2026-05-21 (formalisé Phase 0.5 — 2026-05-22)

La spec initiale du 2026-05-11 modélisait la personnalisation visuelle **côté PIM admin** (table `tenant_visual_preferences`, UI dans `DashboardAdminPIM`). **Arnaud a pivoté le 2026-05-21** :

> *"L'association entre les visuels clients et les produits doit se faire dans les boutiques afin qu'elles puissent-être aux couleurs des clients de la société qui opère Magrit. Les produits personnalisés doivent l'être la première fois qu'ils sont affichés dans une boutique. Ils seront conservés en base de données, pour celle relative à la boutique concernée."*

**Conséquences architecturales** :

| Avant pivot (spec 2026-05-11) | Après pivot (spec 2026-05-22) |
|---|---|
| Table `tenant_visual_preferences(tenant_id, ...)` | Table **`shop_visual_preferences(shop_id, ...)`** |
| Table `tenant_gamme_visual_preferences(tenant_id, gamme_slug, ...)` | Table **`shop_gamme_visual_preferences(shop_id, gamme_slug, ...)`** (override par gamme **dans la boutique**) |
| Bucket `tenant_assets/<tenant_id>/backgrounds/` | Bucket **`shop_backgrounds/<shop_id>/`** |
| Helper `resolveProductBackground(tenant_id, gamme_slug)` | Helper **`resolveProductBackground(shop_id, gamme_slug)`** |
| UI admin dans `DashboardAdminPIM` | UI admin dans **page admin boutique** (route `/t/:slug/admin/shops/:shopId/visuals`) |
| Cascade : gamme → tenant → default Magrit | Cascade : **gamme (shop) → shop → default Magrit** |
| Cache key mockup : `(tenant_id, gamme_slug, product_name)` | Cache key mockup : **`(shop_id, gamme_slug, product_name)`** |

**Pourquoi ce pivot est correct** : la boutique est la **vraie unité d'identité visuelle B2B** dans Magrit. Un tenant imprimeur a typiquement N boutiques chacune brandée pour un client différent (B2B portal, franchise, espace ERAM, etc.). Stocker les visuels au niveau tenant aurait imposé à toutes les boutiques de partager le même fond — incohérent avec le modèle commercial.

**Implication corollaire pour S-SUBTENANT-SCOPE** : l'Usage B "espace client B2B" élagué par Arnaud le 2026-05-21 est **effectivement couvert par shops + `access_scope='shop_only'` existant** + cette personnalisation visuelle shop-scoped. Cohérent avec la décision Arnaud.

---

## Arbitrages Q1-Q8 — décisions finales Phase 0.5

| # | Question | Décision Phase 0.5 (Claude Architect, à valider Arnaud d'un message) |
|---|---|---|
| **Q1** | Bibliothèque Magrit : combien d'environnements pré-conçus MVP ? Qui les conçoit ? | **10 fonds** MVP. Curation Sally UX (sélection / commande / direction artistique). Sources : photos stock libres de droits (Unsplash / Pexels) sélectionnées pour cohérence B2B print (desk wood, marble, kraft paper, hands holding card, blueprint, minimal gradient, etc.). Bibliothèque extensible V2+. |
| **Q2** | Format upload utilisateur | **JPG / PNG / WebP** autorisés. Taille max **5 MB**. Dimensions min `800×800`, max `4096×4096`. Crop automatique au ratio mockup `1024×1024` côté edge function (validation + resize via resvg si nécessaire, ou rejet si crop ferait perdre >30% de l'image). |
| **Q3** | Sécurité upload (virus / NSFW / modération) | MVP : pas de scan virus (uploads provenant d'utilisateurs authentifiés admin tenant — modèle de confiance B2B). Pas de NSFW filter (cas exotique pour print B2B). **Modération a posteriori** : table `shop_backgrounds_audit(shop_id, uploaded_by, status='active'\|'flagged')` + page admin Magrit pour signaler/supprimer (Sprint 8+ si besoin). V2+ : intégration Google Cloud Vision SafeSearch si volume augmente. |
| **Q4** | Granularité MVP : tenant-wide seul ou par-gamme aussi ? | **Shop-wide + override par gamme MVP** (pas de séparation en 2 stories). La table `shop_gamme_visual_preferences` est livrée en S-PIM-VISUELS-3 dès le départ. Justification : qualité-first, on a le temps de tout faire. L'override par gamme est demandé explicitement par Arnaud 2026-05-11. |
| **Q5** | Gabarits S4.2 à upgrader OU créer S4.2bis ? | **Upgrade in-place** des 5 templates SVG existants. Pas de duplication S4.2bis (dette future). Le `--shop-primary` reste utilisé mais en accent / liseré / texte, pas en rectangle de fond plein (sinon écrase l'effet "fond blanc product zone"). Story S-PIM-VISUELS-6. |
| **Q6** | Zone d'impression en blanc : cadre/bordure visible OU totalement transparent ? | **Transparent par défaut** + **liseré gris léger 1px optionnel** activable par template. La zone d'impression doit laisser voir le background à travers pour donner l'effet "produit posé sur le fond". Sally UX à consulter S-PIM-VISUELS-6 pour valider perception. |
| **Q7** | Cache key mockup étendue avec `background_url` ? | **Oui obligatoire**. Sinon changement de fond = mockup pas régénéré côté CDN. Cache key MVP : SHA-256 de `(shop_id, gamme_slug, product_name, primary_color, background_url, template_version)`. Story S-PIM-VISUELS-5. |
| **Q8** | Layer "Imprint" (design client uploadé projeté) MVP ou V2+ ? | **V2+ confirmé**. Chantier conséquent (PDF parsing + projection perspective + sécurité ingestion fichiers client). Hors scope v1.1. |

---

## Architecture cible — Composition 3 layers

```
┌─────────────────────────────────────────────┐
│  Layer 3 (V2+) : Imprint design client      │  ← projeté sur Layer 2 zone blanche
├─────────────────────────────────────────────┤
│  Layer 2 : Product Shape (gabarit SVG)      │  ← upgrade S-PIM-VISUELS-6, fond produit transparent
├─────────────────────────────────────────────┤
│  Layer 1 : Background (PNG/JPG/WebP)        │  ← biblio Magrit OU upload shop OU default neutre
└─────────────────────────────────────────────┘
                  ↓
        Resvg.render() → PNG 1024×1024
                  ↓
       Bucket product_mockups (cache)
                  ↓
              CDN public
```

**ADR §4.13 à formaliser** au Sprint 7 démarrage : "Composition 3 layers shop-scoped pour mockup engine" — couvre les choix de granularité (shop vs tenant), cache key étendue, format layers (PNG dessous, SVG dessus), et out-of-scope V2+ (Imprint layer).

## Dépendances graphique entre sous-stories

```
S-PIM-VISUELS-3 (tables DB + helper)  ──┐
                                        ├──→  S-PIM-VISUELS-2 (upload)  ──┐
S-PIM-VISUELS-1 (biblio + bucket)  ─────┘                                 │
                                                                          ├──→  S-PIM-VISUELS-5 (composition mockup-gen)  ──→  S-PIM-VISUELS-4 (UI admin shop)
                                                                          │
                                          S-PIM-VISUELS-6 (upgrade SVG)  ─┘ (indépendant techniquement, à faire en dernier pour cohérence visuelle)
```

**Ordre recommandé pour Sprint 7** :

1. **Jour 1** : démarrer S-PIM-VISUELS-3 **et** S-PIM-VISUELS-1 en parallèle (l'un DB, l'autre Storage + curation Sally)
2. **Jour 2-3** : S-PIM-VISUELS-2 (upload utilisateur)
3. **Jour 4-5** : S-PIM-VISUELS-5 (composition mockup-generator) — **checkpoint impératif ici** (DoD principe #2)
4. **Jour 6-7** : S-PIM-VISUELS-4 (UI admin shop) + Sally UX wireframes préalables (DoD principe #5)
5. **Jour 8-10** : S-PIM-VISUELS-6 (upgrade gabarits SVG) — **checkpoint impératif final**

Effort cumulé Sprint 7 : ~10-12 jours selon découpage S-PRODUCT-VIEWS-MULTI Pitch court Phase 0.7 (si 2D dans Sprint 7, +2-3j ; si 3D, sort en Sprint 7-bis dédié).

---

## Out of scope explicite (overview + 6 sous-stories)

- Imprint du design client uploadé (V2+, Q8 confirmé)
- Génération d'environnements via Imagen 4 / Flux (V2+, déjà mentionné architecture.md §4.4)
- Marketplace de fonds Canva-like (Vision V3+)
- Personnalisation par produit individuel (Arnaud : pas pertinent, granularité shop ou gamme)
- Modération automatique upload (NSFW / virus) MVP — V2+ si volume augmente
- Migration de la `--shop-primary` legacy ProductMockup vers la composition 3 layers — cohabitation tolérée, refacto opportuniste au moment de S-PIM-VISUELS-6

---

## Cohérence cross-roadmap

Cette story (6 sous-stories) est planifiée **Sprint 7** (roadmap qualité-first). Sprint 7 contient également **S-PRODUCT-VIEWS-MULTI** (si 2D — sinon Sprint 7-bis dédié), pour 6-7 stories au total, ~10-12 jours.

**Découpage des story docs sous-stories** : les 6 fichiers `story-S-PIM-VISUELS-{1..6}-*.md` seront créés en **Phase 0.5-bis au démarrage du Sprint 7** (cadrage juste-à-temps, pas en avance de plusieurs semaines pour éviter staleness). Cette overview suffit pour planifier maintenant.

---

## Tasks Phase 0.5 (cette refonte)

- [x] Lecture spec actuelle + pivot Arnaud 2026-05-21
- [x] Tableau "Avant/Après pivot" formalisé
- [x] Arbitrages Q1-Q8 tranchés avec justifications
- [x] Schéma composition 3 layers
- [x] Ordre + dépendances 6 sous-stories formalisé
- [x] Ordre recommandé Sprint 7 jour par jour
- [x] ADR §4.13 préparée
- [ ] Validation Arnaud sur les 8 arbitrages Q1-Q8 (1 message OK/correction)

---

## References

- [Source: roadmap qualité-first](../planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md) — Sprint 7
- [Source: docs/project-context.md §5.2] — DoD étendue qualité-first
- [Source: _bmad-output/planning-artifacts/prd.md] — FR25-27 mockup engine
- [Source: _bmad-output/planning-artifacts/architecture.md§4.3] — Mockup Engine architecture
- [Source: story-S4.1b-pipeline-svg-png-flyer.md] — pipeline @resvg/resvg-wasm
- [Source: story-S4.2-templates-svg-mvp.md] — 5 templates SVG actuels (à upgrade S-PIM-VISUELS-6)
- [Source: supabase/migrations/20260424_07_pim_image_url_columns.sql] — colonnes `image_url` déjà ajoutées sur `product_gammes` + `product_definitions`
- [Source: supabase/functions/mockup-generator/index.ts] — edge function à étendre S-PIM-VISUELS-5
- [Source: docs/project-context.md#L51] — pivot resvg-wasm
