---
id: AF26.13
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.12]
---
# AF26.13 — Déclarer la sortie workspace de Mockups

## Résultat livré

- nouveau manifeste métier `mockups` pour la galerie de références Magrit ;
- feature et capability de gouvernance visuelle globale ;
- route lazy et navigation « Visuels Magrit » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

La galerie reste temporairement montée dans le `workspace` afin de préserver
l'URL et les contrôles d'accès actuels. Sa capability `mockups.govern` rend
explicite sa vocation backoffice ; une future tranche pourra la déplacer vers
ce composition root lorsque le backoffice Magrit disposera de son routeur réel.
Les visuels personnalisés d'une boutique restent, eux, dans le module `shops`.
