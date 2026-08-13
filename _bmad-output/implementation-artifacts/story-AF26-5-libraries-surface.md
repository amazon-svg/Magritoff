---
id: AF26.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.4]
---
# AF26.5 — Déclarer la sortie workspace de Libraries

## Résultat livré

- manifeste propre au module Libraries ;
- features et capabilities séparant consultation et gestion des bibliothèques ;
- routes lazy de liste et de détail fournies par le registre de surfaces ;
- navigation « Bibliothèques » issue de la contribution du module ;
- suppression des déclarations correspondantes dans `routes.tsx`.

Le module est volontairement limité à `workspace`. Les bibliothèques alimentent
le catalogue, mais leur gestion n'est pas exposée comme contribution autonome
dans le storefront, le portail client ou le backoffice fonctionnel actuel.
