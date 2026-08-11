# TF-AF3 — Registre des surfaces et écran témoin Account

## Preuves automatisées

| ID | Scénario | Résultat | Statut |
|---|---|---|---|
| AF3-01 | Lister les composition roots | storefront, customer-portal, workspace et backoffice présents | OK |
| AF3-02 | Composer Account | Contributions workspace et customer-portal rattachées au même manifeste | OK |
| AF3-03 | Dupliquer module ou route | `ContributionRegistryError` levée | OK |
| AF3-04 | Référencer feature inconnue | Contribution refusée | OK |
| AF3-05 | Contribuer à une surface non déclarée | Contribution refusée | OK |
| AF3-06 | Inspecter manifestes et registre | Aucun import React, React Router ou lucide | OK |
| AF3-07 | Inspecter la route Account | Loader dynamique et `React.lazy` conservés | OK |
| AF3-08 | Inspecter la navigation Account | URL, libellé, icône et testId historiques conservés | OK |
| AF3-09 | Inspecter la vue Account | Aucun context ou fournisseur dans la vue présentative | OK |
| AF3-10 | Exécuter la régression | 787 tests verts et build vert | OK |

## Recette visuelle à jouer

1. Ouvrir `/t/<tenant>/dashboard/account` avec un utilisateur authentifié.
2. Vérifier le groupe Paramètres et le lien « Mon compte » actif.
3. Modifier nom complet, thème, langue, zone et notifications.
4. Vérifier messages, styles, testId et persistance identiques à la version précédente.
5. Recharger directement l URL et vérifier le fallback « Chargement… » puis l écran.

Statut Notion : fiche locale prête, connecteur indisponible dans cette session.
