---
story_id: S2.32
sprint_cible: Epic 2 — extension boutique (mode PIM catalogue complet)
created_at: 2026-07-16 (Amelia / Dev)
livrable: Cahiers de tests copy-paste pour la DB Notion 🧪 Cahiers de tests fonctionnels Magrit
notion_db_url: https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
precondition_deploiement: migration 20260715000200_s2_32_shop_pim_catalog_mode.sql appliquée en prod
---

# TF Notion — S2.32 (Mode « PIM Catalogue complet » au niveau boutique) — 5 cas

> Un TF = une page de la DB Notion 🧪 Cahiers de tests fonctionnels Magrit.
> Chaque champ est prêt à copier dans la propriété Notion correspondante.
> **Précondition globale** : la migration S2.32 doit être déployée (colonnes
> `shops.pim_catalog_mode` / `shops.pim_gamme_slugs` + policy RLS étendue).

---

## TF-S2.32-01 — Radio « PIM — Catalogue complet » verse tout le catalogue dans la boutique

**Titre** : Activer le radio PIM expose l'ensemble du catalogue du tenant dans la boutique publique

**Parcours** : P09 (Boutique portail B2B) / BO éditeur boutique

**Persona** : Imprimeur Pro / admin tenant (magrit_full)

**Précondition** :
- Tenant avec ≥ 2 gammes recensées (`/dashboard/gammes`) et ≥ 1 produit par gamme dans `product_library`
- Une boutique active (ex : slug ERAM `xyfjjo-q6kekm`)

**Étapes** :
1. Ouvrir le BO de la boutique (`/t/<slug>/dashboard/shops/<id>`)
2. Dans « Bibliothèques associées », repérer l'entrée « PIM — Catalogue complet »
3. Cliquer sur le bouton radio devant « PIM — Catalogue complet »
4. Cliquer « Enregistrer les modifications »
5. Ouvrir la boutique publique `/shop/<slug>` en navigation privée (acheteur anonyme)

**Résultat attendu** :
- Au clic du radio, la liste « Produits dans cette boutique » se remplit avec tous les produits du catalogue (toutes gammes recensées)
- Après enregistrement, la boutique publique affiche ces mêmes produits (acheteur anonyme les voit)
- Le nombre de produits en boutique = nombre de produits du catalogue des gammes recensées

**Hints DOM** :
- `data-testid="shop-editor-pim-toggle"` : radio maître PIM
- `data-testid="shop-product-grid"` : grille produits boutique publique
- `data-testid="product-card"` : cartes produit

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome · SQL DB (`select pim_catalog_mode, pim_gamme_slugs from shops where slug='...'`)

**Données de test** :
- Login : compte admin tenant (à demander à Arnaud)
- Shop slug : ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer

---

## TF-S2.32-02 — Déplier le PIM et décocher une gamme la retire de la boutique (#3)

**Titre** : Le dépliage liste les gammes recensées ; décocher une gamme masque ses produits en boutique

**Parcours** : P09 / BO éditeur boutique

**Persona** : Imprimeur Pro / admin tenant

**Précondition** :
- Boutique en mode PIM activé (TF-01 joué), ≥ 2 gammes recensées avec produits

**Étapes** :
1. Dans le BO boutique, mode PIM actif, cliquer « Déplier les gammes »
2. Vérifier que **seules les gammes recensées** du tenant sont listées (pas les 22+ gammes du PIM global)
3. Décocher une gamme (ex : « Brochures »)
4. Enregistrer
5. Ouvrir `/shop/<slug>` et vérifier le catalogue

**Résultat attendu** :
- Le dépliage n'affiche que les gammes recensées (libellés en français, ex « Cartes de visite », « Brochures »)
- Après décochage + enregistrement, les produits de la gamme décochée **n'apparaissent plus** en boutique
- Les produits des autres gammes (toujours cochées) restent visibles

**Hints DOM** :
- `data-testid="shop-editor-pim-expand-btn"` : bouton Déplier/Replier
- `data-testid="shop-editor-pim-gamme-<slug>"` : case d'une gamme (ex `shop-editor-pim-gamme-brochures`)

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome

**Données de test** :
- Shop slug : ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer

---

## TF-S2.32-03 — Mode PIM ON grise les cases bibliothèques individuelles (décision #1)

**Titre** : En mode PIM, les cases « bibliothèques associées » sont désactivées/grisées

**Parcours** : BO éditeur boutique

**Persona** : Imprimeur Pro / admin tenant

**Précondition** :
- Tenant avec ≥ 1 bibliothèque ; boutique éditable

**Étapes** :
1. Ouvrir le BO boutique, mode PIM **désactivé** : vérifier que les cases bibliothèques sont cochables
2. Activer le radio « PIM — Catalogue complet »
3. Observer les cases bibliothèques individuelles

**Résultat attendu** :
- Mode PIM OFF : cases bibliothèques cliquables (comportement historique intact)
- Mode PIM ON : cases bibliothèques **grisées (opacity réduite) et désactivées** (non cliquables) — le PIM est un superset
- Re-désactiver le PIM réactive les cases

**Hints DOM** :
- `data-testid="shop-editor-pim-toggle"` : radio PIM
- Les `input[type=checkbox]` des bibliothèques ont l'attribut `disabled` quand le mode PIM est actif

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome

**Données de test** :
- Shop slug : ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer

---

## TF-S2.32-04 — Décocher le radio PIM conserve la sélection de gammes (décision #2)

**Titre** : Désactiver puis réactiver le mode PIM restaure la sélection de gammes précédente

**Parcours** : BO éditeur boutique

**Persona** : Imprimeur Pro / admin tenant

**Précondition** :
- Boutique en mode PIM avec une sélection partielle de gammes (ex : 2 gammes cochées sur 4)

**Étapes** :
1. En mode PIM, décocher une partie des gammes (garder ex 2 sur 4), enregistrer
2. Cliquer le radio PIM pour **désactiver** le mode, enregistrer
3. Cliquer à nouveau le radio pour **réactiver** le mode
4. Déplier les gammes

**Résultat attendu** :
- À la réactivation, `pim_gamme_slugs` **n'a pas été vidé** : les 2 gammes précédemment cochées sont toujours cochées (pas un reset à « toutes »)
- SQL : `select pim_gamme_slugs from shops where slug='...'` conserve la liste entre OFF et ON

**Hints DOM** :
- `data-testid="shop-editor-pim-toggle"`
- `data-testid="shop-editor-pim-gamme-<slug>"`

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome · SQL DB

**Données de test** :
- Shop slug : ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer

---

## TF-S2.32-05 — Mode PIM ON + aucune gamme cochée → aucun produit exposé (décision #3)

**Titre** : Mode PIM actif mais zéro gamme sélectionnée : la boutique n'expose aucun produit PIM

**Parcours** : P09 / BO éditeur boutique

**Persona** : Imprimeur Pro / admin tenant + Acheteur B2B

**Précondition** :
- Boutique en mode PIM, aucune bibliothèque liée par ailleurs

**Étapes** :
1. En mode PIM, déplier et **décocher toutes les gammes**
2. Observer l'avertissement dans le BO
3. Enregistrer
4. Ouvrir `/shop/<slug>` (acheteur)

**Résultat attendu** :
- Un message d'avertissement s'affiche dans le BO (« Aucune gamme sélectionnée — la boutique n'exposera aucun produit du PIM »)
- La liste « Produits dans cette boutique » est vide (hors éventuels produits legacy/biblio)
- Côté acheteur, aucun produit PIM n'apparaît (pas de fallback « toutes gammes »)

**Hints DOM** :
- `data-testid="shop-editor-pim-expand-btn"`
- `data-testid="shop-catalog-empty"` : état vide catalogue boutique (si aucune autre source)

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome · SQL DB

**Données de test** :
- Shop slug : ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer
