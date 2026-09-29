# Carnet de tests — HSPQ-5 Améliorations UX du workspace

## Référence

- Story : [HSPQ-5](./story-HSPQ-5-ameliorations-ux-workspace.md)
- Branche : `feat/hopstudio-project-quote-callback`
- Démarrage : 29/09/2026
- Statut : évolutif, complété à chaque amélioration UX

## UX-1 — Lien vers l’espace courant

### Préconditions

- utilisateur authentifié membre d’au moins un espace ;
- route tenant ouverte sous `/t/{tenantSlug}` ;
- pour le scénario multi-espace, utilisateur membre de deux espaces aux noms
  distincts.

| ID | Cas | Étapes | Résultat attendu | Preuve | Statut |
|---|---|---|---|---|---|
| CT-HSPQ5-001 | Affichage nominal | Ouvrir l’accueil d’un espace | `Magrit / Nom de l’espace` apparaît dans la barre supérieure | `header-current-space-link.test.ts` | Automatisé |
| CT-HSPQ5-002 | Destination du lien | Cliquer sur le nom depuis une page secondaire | Navigation vers `/t/{tenantSlug}` du même espace | `workspaceHomePath()` + navigateur | À jouer |
| CT-HSPQ5-003 | Conversation indépendante | Cliquer sur le nom pendant une conversation | Retour à l’accueil de l’espace sans appel direct à `startNewConversation()` par ce lien | Revue du composant + navigateur | À jouer |
| CT-HSPQ5-004 | Changement d’espace | Ouvrir successivement deux espaces | Le nom et la destination suivent toujours `currentTenant` | Contexte tenant + navigateur | À jouer |
| CT-HSPQ5-005 | Nom long / mobile | Utiliser un nom long à largeur mobile | Le nom est tronqué ; marque et menu utilisateur restent accessibles | Navigateur responsive | À jouer |
| CT-HSPQ5-006 | Route hors tenant | Ouvrir le sélecteur `/tenants` | Aucun lien d’espace obsolète n’est affiché sans tenant courant | Condition `currentTenant` + navigateur | À jouer |

## UX-2 — Renommage et suppression dans « Éléments du projet »

| ID | Cas | Étapes | Résultat attendu | Preuve | Statut |
|---|---|---|---|---|---|
| CT-HSPQ5-007 | Renommer le projet | Ouvrir le drawer, cliquer sur le crayon du projet, saisir un nom et valider | Le nouveau nom apparaît dans le drawer et dans le contexte actif | Contrat projets + reducer + navigateur | Automatisé partiellement |
| CT-HSPQ5-008 | Annuler le renommage du projet | Modifier le texte puis cliquer sur annuler ou appuyer sur Échap | Le nom initial reste affiché et aucun PATCH n’est envoyé | Navigateur | À jouer |
| CT-HSPQ5-009 | Renommer un élément | Cliquer sur son crayon, saisir un libellé puis valider | Seul le libellé change ; payload, description, fichiers et prix restent identiques | `projects.contract.test.ts` | Automatisé |
| CT-HSPQ5-010 | Libellé vide | Essayer de valider un nom composé uniquement d’espaces | Bouton désactivé côté UX et requête refusée en 422 côté API | Contrat + navigateur | Automatisé partiellement |
| CT-HSPQ5-011 | Annuler le renommage d’un élément | Modifier le texte puis cliquer sur annuler ou appuyer sur Échap | Le libellé initial est conservé | Navigateur | À jouer |
| CT-HSPQ5-012 | Demander la suppression | Cliquer sur la corbeille d’une ligne | Une confirmation locale nomme clairement l’action ; rien n’est supprimé avant validation | Source UI + navigateur | Automatisé partiellement |
| CT-HSPQ5-013 | Confirmer la suppression | Valider la confirmation | La ligne disparaît, sa sélection est retirée et le compteur diminue immédiatement | Contrat existant + navigateur | Automatisé partiellement |
| CT-HSPQ5-014 | Historique dérivé | Renommer ou supprimer un élément déjà repris dans un devis | Le devis et la commande existants gardent leur libellé figé | Revue du contrat et test métier à compléter | À jouer |

## Commandes de vérification

```bash
pnpm vitest run tests/app/header-current-space-link.test.ts
pnpm vitest run tests/contract/projects.contract.test.ts \
  tests/modules/catalog/configurator-workspace.test.ts
pnpm typecheck:all
pnpm gen:api:check
pnpm build
```

## Résultats

| Date | Lot | Vérification | Résultat |
|---|---|---|---|
| 29/09/2026 | UX-1 | Tests ciblés | 1 fichier, 2 tests passés |
| 29/09/2026 | UX-1 | Typecheck complet | Échec sur la dette TypeScript préexistante du dépôt ; aucune erreur ne vise les fichiers UX-1 |
| 29/09/2026 | UX-1 | Build | Réussi ; avertissement Rollup préexistant sur le cycle de réexport `CheckoutPage` |
| 29/09/2026 | UX-1 | Validation des spécifications | Réussie |
| 29/09/2026 | UX-1 | Parcours desktop/mobile | À jouer |
| 29/09/2026 | UX-2 | Tests ciblés | 3 fichiers, 36 tests passés |
| 29/09/2026 | UX-2 | Typecheck modulaire | Réussi |
| 29/09/2026 | UX-2 | OpenAPI et types générés | 212 opérations valides ; types générés alignés |
| 29/09/2026 | UX-2 | Build | Réussi ; avertissement Rollup préexistant sur le cycle de réexport `CheckoutPage` |
| 29/09/2026 | UX-2 | Validation des spécifications | Réussie |
| 29/09/2026 | UX-2 | Parcours drawer | À jouer |

## Anomalies et décisions

- Le bouton `Magrit` conserve son comportement historique. Le lien de l’espace
  est volontairement un élément distinct afin de ne pas mélanger retour global
  et navigation dans l’espace courant.
- Le slug est encodé par `workspaceHomePath()` même si le contrat tenant impose
  normalement déjà un slug compatible URL.
- Le renommage d’une ligne utilise une lecture `GET` avec `ETag`, puis un
  `PATCH` avec `If-Match`. Une édition concurrente est donc signalée au lieu
  d’écraser silencieusement le libellé enregistré par un autre utilisateur.
- Le typecheck global n’est pas une preuve verte utilisable à cette remise : il
  échoue sur de nombreuses erreurs antérieures et indépendantes, notamment dans
  `DashboardLayout`, l’outbox, les notifications et plusieurs anciens tests.
  Le build de production compile bien ce lot.
