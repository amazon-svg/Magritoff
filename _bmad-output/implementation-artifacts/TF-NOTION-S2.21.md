---
story_id: S2.21
sprint_cible: Epic 2 — Sprint E3 Navigation
created_at: 2026-07-08 (Amelia / Dev)
livrable: Cahiers de tests copy-paste pour la DB Notion 🧪 Cahiers de tests fonctionnels Magrit
notion_db_url: https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
---

# TF Notion — S2.21 (Recherche + autocomplétion + fallback Magrit) — 3 cas

> L'autocomplétion suggère produits + familles dès 2 caractères. Aucune
> correspondance → « Demander à Magrit » (réutilise l'IA conversationnelle).

---

## TF-S2.21-01 — Autocomplétion : suggestions produits + familles

**Titre** : Taper ≥ 2 caractères affiche des suggestions instantanées produits et familles

**Parcours** : P09 (Boutique portail B2B)
**Persona** : Acheteur B2B
**Précondition** : Boutique publique avec produits de plusieurs familles (affiches, carterie…)

**Étapes** :
1. Ouvrir `/shop/<slug>` puis la vue Catalogue
2. Cliquer dans la barre de recherche
3. Taper « affiche »

**Résultat attendu** :
- Un menu s'ouvre sous la barre dès le 2ᵉ caractère
- La ou les **familles** correspondantes apparaissent en tête (tag « Famille » + compteur « N produits »)
- Les **produits** correspondants suivent (nom + gamme en sous-libellé)
- Aucune suggestion sous 2 caractères

**Hints DOM** :
- `data-testid="shop-catalog-search-menu"`
- `data-testid="shop-catalog-search-option"` (une par suggestion)
- `role="combobox"` sur l'input, `aria-expanded="true"` quand le menu est ouvert

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer

---

## TF-S2.21-02 — Clic suggestion : produit ouvre la fiche, famille filtre le catalogue

**Titre** : Un clic sur une suggestion mène au produit ou filtre la famille

**Parcours** : P09
**Persona** : Acheteur B2B

**Étapes** :
1. Vue Catalogue, taper « affiche »
2. Cliquer une suggestion **produit** → observer
3. Revenir au catalogue, taper « affiche », cliquer la suggestion **famille**

**Résultat attendu** :
- Clic **produit** → la fiche produit s'ouvre
- Clic **famille** → le catalogue se filtre sur cette famille (même mécanisme que le méga-menu) et le fil d'Ariane affiche la famille
- Le menu se ferme après le clic

**Hints DOM** : `data-testid="shop-catalog-search-option"` · fil d'Ariane `shop-catalog-breadcrumb`

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer

---

## TF-S2.21-03 — Fallback Magrit quand rien ne matche

**Titre** : Une requête sans correspondance propose « Demander à Magrit » pré-rempli

**Parcours** : P09
**Persona** : Acheteur B2B

**Étapes** :
1. Vue Catalogue
2. Taper une requête sans correspondance locale (ex. « zzzq »)
3. Observer le menu
4. Cliquer l'entrée « Demander à Magrit »
5. Appuyer sur Échap pour fermer le menu dans un autre essai

**Résultat attendu** :
- Le menu affiche une entrée « Aucun résultat — demander à Magrit « <requête> » »
- Le clic déclenche la recherche IA Magrit avec la requête déjà saisie (section « Suggéré par Magrit »)
- Échap ferme le menu sans lancer de recherche

**Hints DOM** :
- `data-testid="shop-catalog-search-ask-magrit"`
- `role="listbox"` sur le menu

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer
