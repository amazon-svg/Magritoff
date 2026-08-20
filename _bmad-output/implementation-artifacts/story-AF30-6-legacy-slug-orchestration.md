---
id: AF30.6
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.5]
---
# AF30.6 — Isoler la résolution des anciens slugs tenant

## Intention

`LegacySlugRedirect` pilote encore directement `SessionApiClient`, l'annulation
de requête et la reconstruction de l'URL. Cette orchestration doit sortir de la
vue comme les autres parcours workspace AF30.

## Critères d'acceptation

- résolution et cycle réseau portés par un hook dédié ;
- reconstruction du chemin extraite dans une fonction pure ;
- sous-chemin, query string et hash conservés ;
- fallback `/tenants` si le slug est absent, inconnu ou inchangé ;
- réponse tardive ignorée après changement de route ou démontage ;
- composant sans client API ;
- tests, typecheck modulaire et build verts.

## Résultat livré

- `useLegacyTenantSlugResolution` porte la requête, l'annulation logique et le
  fallback ;
- `buildResolvedTenantPath` remplace seulement le segment tenant et conserve
  le reste de l'URL ;
- `LegacySlugRedirect` ne connaît plus `SessionApiClient` ;
- le garde-fou API-first vérifie la nouvelle frontière.

## Validation

- 162 fichiers de tests passés ;
- 1 214 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
