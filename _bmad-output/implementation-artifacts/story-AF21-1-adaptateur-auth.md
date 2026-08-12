---
id: AF21.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF20.2]
---
# AF21.1 — Encapsuler le fournisseur d'authentification

## Résultat livré

- port `AuthenticationGateway` dans le module Account ;
- adaptateur navigateur Supabase Auth dédié ;
- `AuthContext` orchestre uniquement l'état React et le port d'authentification ;
- la vérification d'une session persistée et sa purge locale après reset sont
  conservées ;
- connexion, inscription, récupération, profil et mot de passe gardent leurs
  signatures publiques historiques.

Supabase Auth reste volontairement le fournisseur d'identité du navigateur :
ce flux protocolaire n'est pas une commande métier `/api/v1`. Le SDK est toutefois
confiné à l'adaptateur et pourra être remplacé sans modifier le contexte React.

## Mesures

- `AuthContext` : **1 → 0** référence Supabase ;
- baseline globale : **8 → 7** références ;
- fichiers importeurs : **5 → 4**.

## Validation UX attendue

Connexion, déconnexion, inscription autorisée, récupération du mot de passe,
modification du mot de passe et du nom de profil. Après un reset Supabase local,
une ancienne session doit être purgée au lieu de bloquer le chargement.
