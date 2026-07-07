---
story_id: S2.16
sprint_cible: Epic 2 — extension boutique e-commerce (Sprint E2 Home utile)
created_at: 2026-07-07 (Amelia / Dev)
livrable: Cahiers de tests copy-paste pour la DB Notion 🧪 Cahiers de tests fonctionnels Magrit
notion_db_url: https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
---

# TF Notion — S2.16 (Home : devis en cours + reprise, option C) — 4 cas

> Un TF = une page de la DB Notion 🧪 Cahiers de tests fonctionnels Magrit.
> Chaque champ est prêt à copier dans la propriété Notion correspondante.
> Option C : « panier / reprise » sur la home boutique · « devis en attente »
> sur la home dashboard (là où QuotesContext est disponible).

---

## TF-S2.16-01 — Sous-menu « Devis en attente » : liste + bouton Reprendre

**Titre** : Le sous-menu « Devis en attente » liste les devis en cours et Reprendre ouvre l'éditeur

**Parcours** : P08 (Affichage devis) / dashboard

**Persona** : Imprimeur Pro / deviseur (membre tenant, magrit_full)

**Précondition** :
- User connecté membre d'un tenant (ex : `imprimerie-ipa`)
- Au moins 1 devis au statut « en cours » (draft/sent/pending) dans `quotes` pour cet user
  (en créer un via la boutique → panier → « Créer un devis » si besoin)

**Étapes** :
1. Se connecter et ouvrir le tableau de bord (`/t/<slug>/dashboard`)
2. Dans la sidebar, sous « Devis », cliquer sur le sous-menu « Devis en attente »
3. Observer la liste (route `/t/<slug>/dashboard/quotes/pending`)
4. Cliquer sur « Reprendre » sur la première ligne

**Résultat attendu** :
- Le sous-menu « Devis en attente » est présent dans la sidebar, juste sous « Devis » (au-dessus de « Gabarits de devis »)
- La page liste les devis « en cours » avec, par ligne : nom client (ou « Client non renseigné »), référence, badge d'état « En cours », date, montant TTC
- Les devis les plus récents sont en premier
- Le clic sur « Reprendre » navigue vers `/t/<slug>/dashboard/quotes/<id>/edit` (éditeur de devis)
- Le lien « Tous les devis » mène à `/t/<slug>/dashboard/quotes`

**Hints DOM** :
- `data-testid="dashboard-pending-quotes"` : conteneur de la liste
- `data-testid="dashboard-pending-quote-row"` : une ligne devis
- `data-testid="dashboard-pending-quote-resume-btn"` : bouton Reprendre
- `data-testid="quote-editor-page"` : page éditeur (cible de la navigation)

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome

**Données de test** :
- Login : compte membre tenant (à demander à Arnaud)
- Tenant : `imprimerie-ipa`

**Statut** : à jouer

---

## TF-S2.16-02 — Sous-menu « Devis en attente » : état vide si aucun devis en cours (AC3)

**Titre** : Aucun devis en cours → la page affiche un état vide explicite (pas de ligne)

**Parcours** : P08 / dashboard

**Persona** : Imprimeur Pro / deviseur

**Précondition** :
- User connecté dont TOUS les devis sont au statut « validé » ou « rejeté » (aucun en cours),
  ou user sans aucun devis

**Étapes** :
1. Se connecter et ouvrir le sous-menu « Devis en attente » (`/t/<slug>/dashboard/quotes/pending`)
2. Observer le contenu

**Résultat attendu** :
- Le conteneur `dashboard-pending-quotes` est présent mais **ne contient aucune ligne** (`dashboard-pending-quote-row` absent)
- Un message « Aucun devis en attente. » est affiché avec un lien « Voir la bibliothèque de devis »

**Hints DOM** :
- `data-testid="dashboard-pending-quotes"` : présent (conteneur), sans ligne
- `data-testid="dashboard-pending-quote-row"` : **absent** du DOM

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome · SQL DB (vérifier `select status from quotes where user_id=...`)

**Données de test** :
- Login : compte membre tenant sans devis en cours

**Statut** : à jouer

---

## TF-S2.16-03 — Home boutique : bloc « Votre panier en cours » avec reprise

**Titre** : Un panier non vide affiche le bloc reprise sur la home boutique et bascule sur la vue panier

**Parcours** : P09 (Boutique portail B2B)

**Persona** : Acheteur B2B

**Précondition** :
- Boutique publique accessible (ex : slug ERAM)
- Au moins 1 produit ajouté au panier depuis le catalogue (panier non finalisé)

**Étapes** :
1. Ouvrir `/shop/<slug>` (home boutique)
2. Depuis le catalogue, ajouter 1 ou 2 produits au panier
3. Revenir sur la home (bouton accueil / logo)
4. Repérer le bloc « Votre panier en cours »
5. Cliquer « Reprendre mon panier »

**Résultat attendu** :
- Le bloc « Votre panier en cours » affiche le nombre d'articles (somme des quantités) et le total TTC
- Le clic sur « Reprendre mon panier » ouvre la vue panier (drawer / vue cart)

**Hints DOM** :
- `data-testid="shop-home-cart-resume"` : conteneur du bloc
- `data-testid="shop-home-cart-resume-btn"` : bouton Reprendre mon panier
- `data-testid="shop-cart-drawer"` : panier (cible)

**URL de départ** : `http://localhost:5177/shop/<slug>`

**Type d'exécution** : Manuel humain · IA Chrome

**Données de test** :
- Shop slug : ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer

---

## TF-S2.16-04 — Home boutique : le bloc panier se replie si le panier est vide (AC3)

**Titre** : Panier vide → le bloc « Votre panier en cours » est absent du DOM

**Parcours** : P09

**Persona** : Acheteur B2B

**Précondition** :
- Boutique publique accessible, panier vide (aucun produit ajouté)

**Étapes** :
1. Ouvrir `/shop/<slug>` sans rien ajouter au panier
2. Observer la home entre les raccourcis et le bloc Nouveautés

**Résultat attendu** :
- Aucun bloc « Votre panier en cours » (`shop-home-cart-resume` absent du DOM)
- Le reste de la home (hero, raccourcis, Nouveautés, Commandes récentes) s'affiche normalement

**Hints DOM** :
- `data-testid="shop-home-cart-resume"` : **absent** du DOM
- `data-testid="shop-home-new-products"` : bloc Nouveautés (présent si produits récents)

**URL de départ** : `http://localhost:5177/shop/<slug>`

**Type d'exécution** : Manuel humain · IA Chrome

**Données de test** :
- Shop slug : ERAM (`xyfjjo-q6kekm`)

**Statut** : à jouer
