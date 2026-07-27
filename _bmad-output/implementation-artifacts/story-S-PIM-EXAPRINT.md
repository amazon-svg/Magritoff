# Story S-PIM-EXAPRINT — PIM complet aligné catalogue Exaprint

**Date** : 2026-07-10
**Demande Arnaud** : « nourrir le PIM des gammes de produits et des produits que l'on trouve sur exaprint.fr, avec l'ensemble des informations pour que notre PIM soit complet ».
**Cadrage validé** : périmètre **cœur imprimeur** (imprimés papier + grand format/PLV + signalétique + packaging + étiquettes + papeterie commerciale ; textile et objets pub exclus) · granularité **1 définition complète par gamme**.

## Méthode

1. **Recherche** : 4 agents parallèles ont cartographié exaprint.fr (imprimés papier · papeterie commerciale · grand format/PLV/signalétique · packaging/étiquettes) — formats, matières/grammages, finitions, quantités, délais, vocabulaire SEO.
2. **Rédaction** : les mêmes agents (contexte de recherche intact) ont rédigé le contenu PIM en JSON structuré — 100 % original en français, aucune copie ni mention Exaprint/marques propres, aucun prix (les prix restent à Clariprint via `resolvePrice`).
3. **Compilation** : script central `compile_pim.py` (arbre, `display_order`, `matching_rules`) → 2 migrations SQL. Sources JSON archivées dans [_bmad-output/planning-artifacts/pim-exaprint/](../planning-artifacts/pim-exaprint/).

## Livré (déployé prod B5 2026-07-10, vérifié)

| Objet | Avant | Après |
|---|---|---|
| Gammes | 28 (9 racines) | **81 (16 racines)** |
| Définitions | 24 (SEO de base seulement) | **82 complètes** |
| Champs enrichissement (`commercial_pitch`, `benefits`, `use_cases`, `seo_keywords`, `technical_spec`) | 0 rempli | **81/82** (l'exception = doublon anglais préexistant) |

### Nouvelles familles racines (7)
`drapeau` (beach flags, mâts) · `panneau` (Akylux, Dibond, Forex, plexi) · `adhesif` (vitrophanie, sol) · `plv` (présentoirs, totems, stop-trottoirs, stands) · `papeterie` (tête de lettre, enveloppes, chemises, blocs, autocopiants, marque-pages, sous-mains) · `calendrier` (souple, spirale, bancaire) · `restauration` (menus, sets de table).

### Familles enrichies
carterie (+carte postale, carton d'invitation) · flyer (+A7, carré) · depliant (+2 volets, accordéon) · affiche (+40×60, abribus, dos bleu) · kakemono (+100×200, 120×200, X-banner) · banderole → « Banderoles / Bâches » (+bâche PVC, micro-perforée, textile) · etiquette (+planche, rouleau, sticker forme) · packaging (+boîte pliante, expédition, coffret premium, sac papier).

### Contenu de chaque définition (~30 champs)
Templates (`title/h1/short/description` avec placeholders) · SEO (`seo_title` ≤60c, `seo_description` ≤155c, `seo_keywords`, `schema_org_type`) · marketing (`commercial_pitch`, `benefits` ×5-6, `use_cases` ×4-5, `usage_examples` ×4, `faq` ×5) · technique (`technical_spec` : formats mm/cm, supports+grammages, finitions, impression, quantités, délais génériques, options machine — mandrins, laizes, classement feu M1, contact alimentaire…). `generated_by='hybrid'`, `validated_by='pending'` → **curation Arnaud à suivre** (DashboardAdminPIM).

## Décisions techniques

- **ADR-4.17 respecté** : le `gamme_slug` explicite prime. Les nouvelles gammes ambiguës (carte_postale ≈ flyer_a6, x_banner ≈ roll_up_80x200…) reçoivent `matching_rules = {}` → **jamais matchées par résolution dimensionnelle**, atteignables uniquement par slug explicite. Zéro faux positif sur les produits historiques.
- **Renumérotation `display_order`** en plages de centaines (carterie 100, flyer 120, … packaging 400) pour insérer les familles proprement.
- Enrichissement des 24 définitions existantes en `coalesce(champ, nouvelle_valeur)` — ne touche jamais un champ déjà rempli.

## Fichiers

- `supabase/migrations/20260710000100_exaprint_gammes.sql` (259 lignes)
- `supabase/migrations/20260710000200_exaprint_definitions.sql` (1764 lignes)
- `_bmad-output/planning-artifacts/pim-exaprint/pole{1-4}_*.json` + `compile_pim.py` (sources)

## Vérifications

- Prod : 81 gammes / 16 racines / 82 définitions / 81 avec pitch+spec ✓
- Spot-check contenu (etiquette_rouleau : mandrins Ø40/76, sens déroulement ; flyer_a5 enrichi) ✓
- Boutique Manitou live : méga-menu OK, renommage « Banderoles / Bâches » visible, zéro régression ✓

## Reste / suivi

- **Curation** : 58 nouvelles définitions `validated_by='pending'` à relire dans l'admin PIM (priorisable par `order_count`).
- **Visuels** : les nouvelles gammes n'ont pas d'`image_url` — brancher sur le backlog mockups (mémoire `project_visuels_mockups_p15_livres`).
- **Souscriptions tenants** : `tenant_gamme_subscriptions` à étendre si un tenant doit voir les nouvelles familles dans ses pilules.
- Familles sans produit = invisibles boutique (dégradé gracieux) ; elles émergent dès le premier produit calculé/ajouté (S-SHOP-AI-PERSIST aidant).
