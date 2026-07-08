---
story_id: S2.18
sprint_cible: Epic 2 — Sprint E3 Navigation
created_at: 2026-07-07 (Amelia / Dev)
livrable: Cahiers de tests copy-paste pour la DB Notion 🧪 Cahiers de tests fonctionnels Magrit
notion_db_url: https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
---

# TF Notion — S2.18 (Méga-menu 2 niveaux illustré) — 3 cas

> Un TF = une page de la DB Notion. Méga-menu boutique auto-illustré depuis les
> données (familles = repère S2.11, sous-catégories = gammes PIM).

---

## TF-S2.18-01 — Méga-menu affiche familles + sous-catégories illustrées

**Titre** : Survoler une famille du méga-menu déploie ses sous-catégories et une vignette

**Parcours** : P09 (Boutique portail B2B)

**Persona** : Acheteur B2B

**Précondition** :
- Boutique publique accessible (ex : ERAM), catalogue avec au moins 1 produit
- Idéalement des gammes PIM souscrites pour voir des sous-catégories

**Étapes** :
1. Ouvrir `/shop/<slug>` (vue Accueil ou Catalogue)
2. Repérer la barre méga-menu (sous le header) : familles avec pastille couleur + picto + compteur
3. Survoler (ou focus clavier + Entrée) une famille ayant des sous-catégories
4. Observer le panneau déployé

**Résultat attendu** :
- La barre méga-menu liste les familles présentes dans le catalogue, chacune avec pastille de couleur, pictogramme et compteur produits
- Au survol/focus d'une famille avec sous-catégories, un panneau s'ouvre : liste des sous-catégories (gammes) + compteurs + une vignette vedette + lien « Voir tout <famille> »
- Le méga-menu s'illustre depuis les données, sans configuration boutique

**Hints DOM** :
- `data-testid="shop-mega-menu"` : barre méga-menu
- `data-testid="shop-mega-menu-family"` : déclencheur d'une famille (attr `data-family`)
- `data-testid="shop-mega-menu-panel"` : panneau déployé
- `data-testid="shop-mega-menu-subcat"` : une sous-catégorie (attr `data-gamme-slug`)

**URL de départ** : `http://localhost:5177/shop/<slug>`

**Type d'exécution** : Manuel humain · IA Chrome

**Données de test** : Shop slug ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer

---

## TF-S2.18-02 — Clic sous-catégorie filtre le catalogue

**Titre** : Cliquer une sous-catégorie bascule sur le catalogue filtré par cette gamme

**Parcours** : P09

**Persona** : Acheteur B2B

**Précondition** : Boutique avec au moins une famille ayant des sous-catégories (gammes)

**Étapes** :
1. Ouvrir le méga-menu, déployer une famille
2. Cliquer sur une sous-catégorie

**Résultat attendu** :
- La vue bascule sur le Catalogue
- Le filtre gamme correspondant est actif (pilule gamme active, grille réduite aux produits de cette gamme)

**Hints DOM** :
- `data-testid="shop-mega-menu-subcat"` : sous-catégorie cliquée
- `data-testid="shop-gamme-pill"` (attr `aria-pressed="true"`) : filtre actif après navigation
- `data-testid="shop-product-grid"` : grille filtrée

**URL de départ** : `http://localhost:5177/shop/<slug>`

**Type d'exécution** : Manuel humain · IA Chrome

**Données de test** : Shop slug ERAM

**Statut** : à jouer

---

## TF-S2.18-03 — Accessibilité clavier du méga-menu (AA)

**Titre** : Le méga-menu est navigable au clavier et se ferme avec Escape

**Parcours** : P09

**Persona** : Acheteur B2B (lecteur d'écran / clavier)

**Précondition** : Boutique avec méga-menu affiché

**Étapes** :
1. Depuis le header, tabuler jusqu'au premier déclencheur de famille
2. Vérifier le focus visible + l'attribut `aria-expanded`
3. Presser Entrée/flèche pour ouvrir, puis Escape

**Résultat attendu** :
- Chaque déclencheur famille porte `aria-haspopup="true"` et `aria-expanded` (false → true à l'ouverture)
- Le panneau a `role="region"` + `aria-label` (« Sous-catégories <famille> ») et `id` lié via `aria-controls`
- Escape ferme le panneau ouvert
- La couleur n'est jamais la seule porteuse d'info (picto + libellé toujours présents)

**Hints DOM** :
- `data-testid="shop-mega-menu-family"` : `aria-haspopup`, `aria-expanded`, `aria-controls`
- `data-testid="shop-mega-menu-panel"` : `role="region"`, `aria-label`

**URL de départ** : `http://localhost:5177/shop/<slug>`

**Type d'exécution** : Manuel humain · IA Chrome (axe-core)

**Données de test** : Shop slug ERAM

**Statut** : à jouer
