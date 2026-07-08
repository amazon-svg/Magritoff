---
story_id: S2.19
sprint_cible: Epic 2 — Sprint E3 Navigation
created_at: 2026-07-07 (Amelia / Dev)
livrable: Cahiers de tests copy-paste pour la DB Notion 🧪 Cahiers de tests fonctionnels Magrit
notion_db_url: https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
---

# TF Notion — S2.19 (Fil d'Ariane + facettes légères) — 3 cas

> Le format est un FILTRE (facette), pas une catégorie (ADR-4.17).

---

## TF-S2.19-01 — Fil d'Ariane du catalogue

**Titre** : Le catalogue affiche un fil d'Ariane cliquable, « Accueil » ramène à la home

**Parcours** : P09 (Boutique portail B2B)
**Persona** : Acheteur B2B
**Précondition** : Boutique publique avec produits

**Étapes** :
1. Ouvrir `/shop/<slug>` puis la vue Catalogue
2. Observer le fil d'Ariane sous le hero
3. Cliquer « Accueil »

**Résultat attendu** :
- Fil d'Ariane « Accueil › Catalogue » (+ « › <Famille> » si une seule famille filtrée active)
- Clic « Accueil » ramène à la home boutique

**Hints DOM** : `data-testid="shop-catalog-breadcrumb"`
**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer

---

## TF-S2.19-02 — Facettes Format + Prix filtrent la grille

**Titre** : Sélectionner un format réduit la grille aux produits de ce format

**Parcours** : P09
**Persona** : Acheteur B2B
**Précondition** : Catalogue avec des produits de formats variés (A5, A2, A4…)

**Étapes** :
1. Vue Catalogue
2. Dans la barre « Format », cliquer un format (ex. A2)
3. Observer la grille + le compteur de résultats
4. Cliquer « Réinitialiser »

**Résultat attendu** :
- Barre Format (pastilles avec compteur) + barre Prix (tranches < 100 € / 100–500 € / > 500 €), dérivées des données
- Clic format → la grille se réduit aux produits de ce format, compteur « N résultats » cohérent (ex. A2 → 3)
- Aucune variante technique fine (papier/finition) dans les facettes
- « Réinitialiser » remet tous les produits

**Hints DOM** :
- `data-testid="shop-catalog-facet-format"` / `shop-catalog-facet-price`
- `data-testid="shop-catalog-reset-facets"`
- `aria-pressed="true"` sur la facette active

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer

---

## TF-S2.19-03 — État vide : réinitialiser ou Demander à Magrit

**Titre** : Une combinaison de filtres sans résultat propose reset + Demander à Magrit

**Parcours** : P09
**Persona** : Acheteur B2B

**Étapes** :
1. Vue Catalogue
2. Combiner un format et une tranche de prix incompatibles (aucun produit)
3. Observer l'état vide

**Résultat attendu** :
- Message « Aucun produit ne correspond à ces filtres. »
- Bouton « Réinitialiser les filtres » + bouton « Demander à Magrit » (déclenche la recherche IA)

**Hints DOM** :
- `data-testid="shop-catalog-empty"`
- `data-testid="shop-catalog-empty-ask-magrit"`

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer
