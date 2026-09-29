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

## Commandes de vérification

```bash
pnpm vitest run tests/app/header-current-space-link.test.ts
pnpm typecheck:all
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

## Anomalies et décisions

- Le bouton `Magrit` conserve son comportement historique. Le lien de l’espace
  est volontairement un élément distinct afin de ne pas mélanger retour global
  et navigation dans l’espace courant.
- Le slug est encodé par `workspaceHomePath()` même si le contrat tenant impose
  normalement déjà un slug compatible URL.
- Le typecheck global n’est pas une preuve verte utilisable à cette remise : il
  échoue sur de nombreuses erreurs antérieures et indépendantes, notamment dans
  `DashboardLayout`, l’outbox, les notifications et plusieurs anciens tests.
  Le build de production compile bien ce lot.
