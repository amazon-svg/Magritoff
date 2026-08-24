---
id: UM10.28
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.27]
---
# UM10.28 — Distinguer panne storefront, absence de session et boutique inconnue

## Problème

Le chargement de la session transformait toute erreur en visiteur anonyme. Le
probe ou le catalogue transformaient ensuite toute erreur non reconnue en
« Portail introuvable ». Une panne réseau ou un BFF à 503 pouvait donc afficher
un écran de connexion ou un faux 404, particulièrement trompeur sur une
boutique privée.

## Résultat

- le cycle de session boutique est isolé dans `useStorefrontSession` ;
- seul le 401 de la route session signifie « aucune session » ;
- les autres erreurs de session ferment l'accès en affichant une indisponibilité
  temporaire et une action de réessai ;
- le probe réserve « Portail introuvable » au seul 404 ;
- les 401/403 catalogue conduisent à l'authentification, tandis que les pannes
  réseau et 5xx restent des indisponibilités techniques ;
- aucune identité Magrit ni aucun fallback Supabase n'est utilisé.

## Validation

- tests purs de classification session et chargement boutique ;
- test du contenu de l'état de reprise ;
- recette navigateur d'une session boutique active sur son profil ;
- suite Vitest complète, typecheck et build.
