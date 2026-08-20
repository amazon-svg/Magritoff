# Story UX31.1 — Harmoniser la liste des commandes du dashboard

**Statut :** done  
**Date :** 2026-08-20

## Constat

Sur un écran large, `/t/:tenantSlug/dashboard/orders` étirait les filtres et les
colonnes sur toute la largeur disponible. Les actions se retrouvaient très loin
des données de la commande et le tableau ne reprenait pas la surface compacte de
la liste des devis.

## Décision

- limiter la largeur de lecture de la page à `1400px`, comme le dashboard Devis ;
- aligner le titre, le sous-titre et la typographie sur cette surface ;
- ajouter à `OrderHistoryTable` une apparence explicite `dashboard` ;
- regrouper filtres et tableau dans une carte bordée, avec en-tête de filtres
  légèrement contrasté ;
- conserver `portal` comme valeur par défaut afin de ne pas modifier le rendu de
  l’historique dans une boutique ;
- préserver toutes les actions et règles de workflow existantes.

## Critères d’acceptation

- [x] La page ne s’étire plus sur un écran très large.
- [x] Les filtres, résultats et actions appartiennent à une même surface visuelle.
- [x] Le tableau reste horizontalement scrollable sous sa largeur utile.
- [x] Le portail boutique conserve son apparence actuelle par défaut.
- [x] La séparation de présentation est couverte par un test d’architecture.

## Recette UX

1. Ouvrir `/t/pressetout/dashboard/orders` sur un écran large.
2. Vérifier que le contenu s’arrête à environ 1400 px et que les actions restent
   proches du statut.
3. Réduire la fenêtre sous 1120 px et vérifier le défilement horizontal interne.
4. Ouvrir l’historique des commandes dans une boutique et vérifier l’absence de
   carte dashboard autour du tableau.
