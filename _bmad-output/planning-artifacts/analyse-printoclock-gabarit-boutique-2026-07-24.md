# Analyse Printoclock — référence gabarit boutique Magrit v2

> **Date** : 2026-07-24 · **Source** : printoclock.com (snapshot Wayback 2026-06-26 pour la home, 2025-04-13 pour la page produit Flyers — site protégé anti-bot, archive = seule voie d'accès programmatique)
> **Objet** : base factuelle pour l'itération « ergonomie boutique alignée standards e-commerce » demandée par Arnaud (2026-07-24). Gabarit de base structure Printoclock + alimentation PIM Magrit + personnalisation BO (logo, couleurs).

## Résumé exécutif (10 lignes)

- Printoclock = e-commerce web-to-print classique : **méga-menu par familles → page catégorie = fiche produit AVEC configurateur** (pas de fiche séparée), prix + délai livraison calculés live, contenu éditorial SEO massif sous le configurateur.
- **Le configurateur (7 champs : Format, Papier, Recto/Verso, Finitions, Vérification fichier, Quantité, Délais) mappe presque 1:1 notre `ProductOverlay` existant** — les 2 nouveautés : choix de délai (impact prix) et vérification de fichier.
- La home est un **portail catalogue** (grille « Top Produits », 12 tuiles) + réassurance (livraison gratuite, express J+3, Trustpilot) + éditorial.
- Notre S2.32/S2.33 fournit déjà le carburant (produits par gamme depuis le PIM + contenu SEO `product_definitions`) : l'itération est avant tout **structurelle/ergonomique**, pas données.
- Plan proposé : UX spec (Sally) → epics/stories → implémentation par écrans (Header/Nav, Home, Page gamme+configurateur, Panier).

## 1. Header (constaté)

| Élément | Détail |
|---|---|
| Logo | gauche |
| Recherche | barre centrale |
| Aide | « Besoin d'aide ? » |
| Wishlist | oui |
| Compte | « Mon compte » |
| Panier | à droite |
| Réassurance | widget **Trustpilot** visible ; « Livraison gratuite en France (continentale) » ; « LIVRAISON EXPRESS J+3 » |

## 2. Navigation principale (constatée, exhaustive au niveau 1-2)

**Top-level (onglets/labels)** : Imprimerie · Signalétique (Publicité extérieure) · PLV & Stands · Objets & Textiles Personnalisés · Studio lab · PROMOS · Nos services

**Méga-menu « Imprimerie » (familles → sous-catégories)** :
- **Flyers** · **Dépliant** · **Brochure** · **Affiche** · **Autocollant/stickers** · **Plaquette commerciale**
- **Carterie** : Carte de visite, Carte de vœux, Cartes postales, Marque-pages, Cartes de correspondance, Carte d'invitation, Faire-part, Bon cadeau, Carte de fidélité, Carte PVC, Carte de visite luxe
- **Packaging** : Étiquette, Sac kraft, Boîte d'expédition, Ruban adhésif kraft, Papier cadeau, Doypack, Packaging bouteille
- **Papeterie** : Chemises à rabats, Calendrier, Agenda, Enveloppes, Têtes de lettre, Blocs-notes, Tampon, Carnets autocopiants, Sous-main, Calendrier de l'avent
- **Resto-Hôtels** : Menus, Sets de table, Sous-bocks, Tickets bar, Accroche-portes, Chevalets de table
- **Impression livre** : Livre, Livre photo, BD, Manga
- **Supports souples** : Bâche, Tissu imprimé, Affiche sur mesure, Drapeaux…

→ **Correspondance Magrit** : nos 81 `product_gammes` (hiérarchie `parent_slug`) couvrent ce modèle. Le méga-menu S2.18 existe déjà (2 niveaux illustrés) — l'écart est le **top-level par univers** (Imprimerie / Signalétique / PLV / Objets).

## 3. Home (sections dans l'ordre constaté)

1. **Grille « Top Produits »** — 12 tuiles produit (Flyers, Brochure, Bâche, Affiches, Dépliants, Carte de visite, Roll up, Adhésif vinyle, Beach flag, Akylux, Étiquettes rouleaux, Panneau PVC). Chaque tuile = image + nom (+ « à partir de »).
2. **H1 SEO** « Imprimerie en ligne rapide et devis immédiat » + bloc éditorial.
3. **Conseils d'imprimeur** (éditorial).
4. **Bloc blog** (PrintOblog, 3 articles).
5. Footer riche : 4 colonnes (PRINTOCLOCK, NOS SERVICES, CORPORATE, CONTACT) + villes SEO + légal.

## 4. Page catégorie/produit = LE cœur du modèle

Une seule page fait catégorie + fiche + configurateur (ex. `/flyers-c-12.html`) :

1. **H1** « Impression Flyers » + bénéfices (« en profitant de : … »)
2. **Configurateur immédiat** (form Sylius) — champs constatés :
   - `format` (+ Largeur/Hauteur cm si sur-mesure)
   - `material` (Papier)
   - `print_side` (Recto Verso)
   - `finishing` (Finitions)
   - `check_service` (Vérification de fichier)
   - `quantity` (Quantité, avec palier + « Quantité totale »)
   - `delay` (Délais — impacte prix, « Livraison prévue le {date} »)
   - CTA **« Ajouter au panier »**
3. **« Top format »** — tuiles raccourcis (Flyer A6, Carré, A5, A4)
4. **« Top services »** (vernis sélectif, pas cher, express, prospectus)
5. **Éditorial SEO long** : conseils, « comment faire », spécifications techniques, consignes fichiers, **FAQ** (7+ questions)

→ **Correspondance Magrit** : configurateur ≈ `ProductOverlay` (format/papier/finitions/recto-verso/quantité + prix Clariprint live). Manquent : **délai→prix**, **vérification fichier**, la **page produit dédiée** (aujourd'hui overlay modal), l'**éditorial PIM sous le configurateur** (nos `product_definitions` ont déjà description/FAQ/usage_examples !).

## 5. Écarts boutique Magrit actuelle → gabarit Printoclock

| Dimension | Magrit aujourd'hui | Cible Printoclock-like |
|---|---|---|
| Home | Portail B2B (raccourcis, commandes récentes, nouveautés) | Grille catalogue « Top Produits » + réassurance + éditorial |
| Nav | Méga-menu 2 niveaux (S2.18) + pilules gammes | Top-level par univers + méga-menu familles complet |
| Page produit | Carte + overlay modal | **Page dédiée par gamme** : configurateur en haut + éditorial PIM (description, FAQ, specs) en dessous |
| Prix | Carte : prix fixé ou « Configurez pour le prix » | « À partir de X € » sur tuiles + prix live dans configurateur |
| Délai | Non exposé | Choix de délai impactant le prix + date de livraison prévue |
| Réassurance | Faible | Bandeau livraison/avis/qualité systématique |
| Thème | Theming par boutique (couleurs/fonts/logo — A4.2) ✅ conservé | Idem — le gabarit reste personnalisable BO |

## 6. Atouts déjà en place (à réutiliser, pas réinventer)

- `product_gammes` (81, hiérarchie parent) + `product_definitions` (SEO/FAQ/usage) → alimentent nav + éditorial des pages gammes.
- S2.32 (mode PIM) + S2.33 (génération produits) → catalogue complet par boutique.
- `ProductOverlay` + Clariprint (prix live) → cœur du configurateur.
- Méga-menu S2.18, landing catégorie S2.20, recherche S2.21, breadcrumb+facettes S2.19.
- Theming boutique A4.1/A4.2 (logo, couleurs, fonts, hero) → la personnalisation BO demandée.

## 7. Découpage proposé (à valider — epics/stories BMAD)

1. **UX spec gabarit v2** (Sally) — wireframes Home / Page gamme / Nav, mobile inclus.
2. **S-TPL-1 Nav & header e-commerce** : top-level univers + méga-menu complet PIM + réassurance header.
3. **S-TPL-2 Home catalogue** : grille Top Produits (tuiles gammes PIM, « à partir de »), réassurance, éditorial tenant.
4. **S-TPL-3 Page gamme dédiée** : route `/shop/:slug/g/:gamme`, configurateur inline (réutilise ProductOverlay), éditorial PIM (description/FAQ/specs depuis product_definitions).
5. **S-TPL-4 Délais & réassurance panier** (option V2 : délai→prix nécessite données Clariprint).
6. Theming BO : conservé tel quel (aucun chantier, vérif non-régression).
