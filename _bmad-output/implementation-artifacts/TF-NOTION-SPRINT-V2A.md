# TF Notion — Sprint V2-A (Epic 7 gabarit boutique v2) — copy-paste DB 🧪

> 5 cas à coller dans la DB Notion « Cahiers de tests fonctionnels Magrit »
> (https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c). Format TF-XX
> standard, jouables humain + Claude in Chrome. URL de départ à adapter au
> slug de boutique de test (ex. ERAM `xyfjjo-q6kekm`).

---

## TF-S7.1 — Navigation boutique par URL
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **Précondition** : boutique active avec produits
- **URL de départ** : `/shop/<slug>/catalog`
- **Étapes** :
  1. Ouvrir `/shop/<slug>/catalog` directement → le catalogue s'affiche.
  2. Cliquer un produit → l'URL devient `/shop/<slug>/p/<id>` et la fiche s'affiche.
  3. Bouton Précédent du navigateur → retour catalogue.
  4. Ouvrir `/shop/<slug>/orders?tab=mine` → l'onglet « Mes commandes » est actif.
  5. Ouvrir `/shop/<slug>/nimporte-quoi` → home boutique (URL remplacée).
- **Résultat attendu** : chaque URL rend la vue correspondante, aucun écran blanc, aucune erreur console.
- **Hints DOM** : `shop-portal`, barre d'adresse.
- **Statut** : À jouer

## TF-S7.2 — Configurateur overlay iso-fonctionnel post-extraction
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **URL de départ** : `/shop/<slug>/catalog`
- **Étapes** :
  1. « Configurer et ajouter » sur un produit → l'overlay s'ouvre.
  2. Changer la quantité → indicateur « Recalcul... » puis prix mis à jour.
  3. Devtools réseau offline → changer une option → banner « Erreur réseau — Prix marché estimé » + bouton Réessayer + badge ESTIMATION.
  4. « Ajouter au panier » → la ligne panier porte le prix affiché.
- **Résultat attendu** : mêmes états qu'avant refonte (aucune régression visuelle ni de prix).
- **Hints DOM** : `shop-product-overlay`, `shop-overlay-price-display`, `shop-overlay-error-banner`, `shop-overlay-retry-btn`, `shop-overlay-add-btn`.
- **Statut** : À jouer

## TF-S7.3 — Page gamme : prix immédiat et configuration temps réel
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **Précondition** : gamme `flyer` peuplée dans la boutique
- **URL de départ** : `/shop/<slug>/g/flyer`
- **Étapes** :
  1. Ouvrir la page → H1 « Impression Flyers », un prix s'affiche < 3 s sans interaction, badge source visible.
  2. Cliquer le chip « A4 » → recalcul (skeleton local sur le prix uniquement).
  3. Cliquer le palier « 500 » → recalcul, palier surligné.
  4. « Ajouter au panier » → le drawer panier s'ouvre (1 pack, bon montant), on reste sur la page.
  5. Ouvrir `/shop/<slug>/g/gamme-inexistante` → état vide + « Demander à Magrit », pas de 404.
- **Résultat attendu** : prix toujours accompagné de sa source ; panier = prix forfaitaire du pack.
- **Hints DOM** : `shop-gamme-page`, `shop-gamme-top-format-chip`, `shop-gamme-quantity-tier`, `shop-gamme-sticky-price`, `shop-gamme-price-source-badge`, `shop-gamme-sticky-add-btn`, `shop-gamme-empty-state`.
- **Statut** : À jouer

## TF-S7.4 — Éditorial PIM et produits liés sur la page gamme
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **URL de départ** : `/shop/<slug>/g/flyer`
- **Étapes** :
  1. Sous le configurateur : pitch commercial + description + « Pourquoi choisir ce produit » + FAQ.
  2. Vérifier qu'aucun texte `{{...}}` n'apparaît sur la page.
  3. Déplier une question FAQ → la réponse s'affiche (clavier : Entrée fonctionne).
  4. Section « Produits de la gamme » : cliquer une carte → fiche `/p/<id>`.
  5. Breadcrumb : la famille est cliquable → page gamme famille.
- **Résultat attendu** : sections absentes masquées (pas de bloc vide) ; contenu FR.
- **Hints DOM** : `shop-gamme-editorial`, `shop-gamme-editorial-faq`, `shop-gamme-related`, `product-card`.
- **Statut** : À jouer

## TF-S7.5 — Meta SEO et données structurées de la page gamme
- **Parcours** : P09 · **Persona** : Visiteur SEO · **Type** : IA Chrome
- **URL de départ** : `/shop/<slug>/g/flyer`
- **Étapes** :
  1. L'onglet navigateur affiche un titre parlant (seo_title FR résolu, pas « MAGRIT_OFF »).
  2. Console : `document.querySelector('link[rel=canonical]').href` = URL exacte de la page.
  3. `JSON.parse(document.getElementById('magrit-gamme-jsonld').textContent)` → `@graph` avec Product + BreadcrumbList ; **pas de champ `offers`** si le badge affiché est ⚠️ Prix marché.
  4. Naviguer vers l'accueil boutique → titre restauré « {Boutique} · Portail impression », canonical et JSON-LD retirés.
- **Résultat attendu** : meta par page, jamais d'engagement de prix sur une estimation.
- **Hints DOM** : `head > title`, `link[rel=canonical]`, `script#magrit-gamme-jsonld`.
- **Statut** : À jouer
