# Story S7.4 — PimEditorial + produits liés + breadcrumb (Epic 7, Sprint V2-A)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **Spec UX** : § Experience Mechanics (zone « Éditorial PIM ») + Custom
> Component n°6 · ADR §4.9 (product_definitions lecture publique).

## Contexte

Sous le configurateur S7.3, la page gamme rend le contenu PIM
(`product_definitions`, enrichies S-PIM-EXAPRINT : pitch commercial, bénéfices,
usage_examples, technical_spec, FAQ) + les produits liés de la gamme
(ShopProductCard existant) + breadcrumb enrichi (famille cliquable). C'est la
matière SEO de la page (S7.5 s'appuiera sur ces mêmes définitions).

## Décisions d'implémentation

1. **Sélection définition** : `pickDefinition(definitions, gammeSlug)` — locale
   `fr` prioritaire (les anciennes définitions EN doublons existent en prod),
   repli famille si la sous-gamme n'a pas de définition.
2. **Placeholders `{{format}}/{{grammage}}/{{finition}}/{{papier}}`** résolus
   depuis la config courante du configurateur (format, grammage=papier,
   finition recto) ; tokens inconnus retirés proprement (jamais de `{{x}}`
   affiché).
3. **Rendu markdown léger** maison (h2/h3, listes, paragraphes) pour
   `description_template` — pas de dépendance markdown supplémentaire.
4. **Sections masquées si absentes** (spec) : pitch, description, bénéfices,
   exemples d'usage, specs (table), FAQ (accordion Radix existant).
5. **Produits liés** : grille `ShopProductCard` (inchangé) des produits de la
   gamme ; clic carte → fiche `/p/:id`, Configurer → fiche, Ajouter → panier.
6. **Breadcrumb enrichi** : la famille devient cliquable → `/g/:famille`.
7. **Type `ProductDefinition`** étendu (champs S-PIM-EXAPRINT optionnels :
   commercial_pitch, benefits, technical_spec) — alignement sur le schéma DB.

## Acceptance Criteria

- **AC1** : `/g/flyer` (ERAM) affiche pitch + description + bénéfices + FAQ
  issus de la définition FR ; aucun `{{placeholder}}` brut visible.
- **AC2** : gamme sans définition → sections masquées, page intacte.
- **AC3** : produits liés cliquables (fiche par URL S7.1) ; ajout panier direct
  fonctionne.
- **AC4** : breadcrumb Accueil › Famille › Gamme avec famille cliquable.
- **AC5** : helpers purs testés ; 0 régression.

## Fichiers

- `src/app/components/shop/gamme/pimEditorial.helpers.ts` + tests
- `src/app/components/shop/gamme/PimEditorial.tsx`
- `src/app/components/shop/gamme/GammePage.tsx` (intégration + shop prop)
- `src/app/components/shop/PublicShop.tsx` (prop shop)
- `src/app/utils/productEnrichment.ts` (type étendu)

## TF Notion (copy-paste)

**TF-S7.4 — Éditorial PIM et produits liés sur la page gamme**
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **Étapes** : (1) Ouvrir `/shop/<slug>/g/flyer` → sous le configurateur :
  section éditoriale (pitch + description + bénéfices) et FAQ dépliable.
  (2) Vérifier qu'aucun texte `{{...}}` n'apparaît. (3) Déplier une question
  FAQ → la réponse s'affiche. (4) Section « Produits de la gamme » : cliquer
  une carte → fiche produit `/p/<id>`. (5) Breadcrumb : cliquer la famille →
  page gamme famille.
- **Hints DOM** : `shop-gamme-editorial`, `shop-gamme-editorial-faq`,
  `shop-gamme-related`, `product-card`.
