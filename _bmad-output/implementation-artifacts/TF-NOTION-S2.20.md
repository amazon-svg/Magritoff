---
story_id: S2.20
sprint_cible: Epic 2 — Sprint E3 Navigation
created_at: 2026-07-08 (Amelia / Dev)
livrable: Cahiers de tests copy-paste pour la DB Notion 🧪 Cahiers de tests fonctionnels Magrit
notion_db_url: https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
---

# TF Notion — S2.20 (Landing catégorie éditorialisée) — 3 cas

> Ouvrir une famille rend une page structurée (titre + intro + sous-catégories +
> best-sellers + grille), jamais une page vide. Contenu auto-généré LLM avec
> socle déterministe (ADR §4.15). Enrichissement LLM actif après déploiement edge.

---

## TF-S2.20-01 — La landing rend titre + intro + best-sellers (jamais vide)

**Titre** : Ouvrir une famille affiche une landing structurée, pas une grille brute

**Parcours** : P09 (Boutique portail B2B)
**Persona** : Acheteur B2B
**Précondition** : Boutique publique avec produits ; ouvrir une famille depuis le
méga-menu, la home ou l'autocomplétion (S2.21)

**Étapes** :
1. Ouvrir `/shop/<slug>`
2. Sélectionner une famille (ex. « Affiches ») via le méga-menu
3. Observer le haut du catalogue

**Résultat attendu** :
- En-tête landing : pastille couleur famille + **titre** + **intro** (1–2 phrases)
- Bloc « Les plus demandés » avec 1 à 3 produits mis en avant (vignette + nom)
- La grille produits complète suit en dessous
- **Aucune page vide** même si l'edge LLM n'est pas déployé (socle déterministe)

**Hints DOM** :
- `data-testid="shop-catalog-landing"`
- `data-testid="shop-catalog-landing-bestseller"`

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer

---

## TF-S2.20-02 — Navigation depuis la landing (sous-catégorie + best-seller)

**Titre** : Cliquer une tuile sous-catégorie filtre, cliquer un best-seller ouvre la fiche

**Parcours** : P09
**Persona** : Acheteur B2B
**Précondition** : Famille possédant des sous-catégories avec produits (sinon les
tuiles sont masquées — comportement attendu sur catalogue seedé au niveau racine)

**Étapes** :
1. Landing d'une famille
2. Si des tuiles sous-catégories sont présentes, en cliquer une
3. Cliquer un produit du bloc « Les plus demandés »

**Résultat attendu** :
- Clic **tuile sous-catégorie** → le catalogue filtre sur cette sous-catégorie
  (même mécanisme que le méga-menu)
- Clic **best-seller** → la fiche produit s'ouvre
- Si la famille n'a aucune sous-catégorie avec produits, aucune tuile n'est
  affichée (la landing reste utile : titre + intro + best-sellers)

**Hints DOM** : `data-testid="shop-catalog-landing-subcat"` · `shop-catalog-landing-bestseller`

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer

---

## TF-S2.20-03 — Enrichissement éditorial LLM (après déploiement edge)

**Titre** : Le titre/intro éditoriaux remplacent le socle quand l'edge LLM répond

**Parcours** : P09
**Persona** : Acheteur B2B
**Précondition** : Edge function `category-editorial` déployée + clé API Claude active

**Étapes** :
1. Ouvrir la landing d'une famille (1ʳᵉ visite de la session)
2. Observer l'intro après le retour LLM (< 12 s)
3. Revenir sur la même famille dans la session

**Résultat attendu** :
- L'intro (et éventuellement le titre) devient un texte marketing rédigé par Magrit
  (ton B2B, sans anglicisme), remplaçant l'intro déterministe
- Aucune régression si l'IA ne répond pas / timeout : le socle déterministe reste
- 2ᵉ visite : contenu servi depuis le cache session (pas de nouvel appel LLM)

**Hints DOM** : `data-testid="shop-catalog-landing"` (contenu de l'intro)

**Note** : tant que l'edge n'est pas déployée, ce cas est **bloqué** (attendu) ;
TF-S2.20-01 couvre le socle « jamais de page vide ».

**URL** : `http://localhost:5177/shop/<slug>` · **Type** : Manuel · IA Chrome · **Statut** : à jouer (bloqué tant que edge non déployée)
