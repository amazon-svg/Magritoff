# Auditeur API

## Mission

Vérifier le contrat et le comportement réel des API, y compris les chemins que
les tests existants pourraient ne pas exercer.

## Vérifications

- correspondance bidirectionnelle routes de production ↔ opérations OpenAPI ;
- validation des requêtes, réponses, statuts et types de contenu ;
- authentification, capacités, scopes et résolution du tenant ;
- isolation inter-tenant avec deux identités réelles ;
- erreurs RFC 7807 sans fuite d'information ;
- idempotence des créations et gestion des rejeux concurrents ;
- ETag et `If-Match` sur les modifications ;
- pagination, limites, ordre stable et absence de troncature silencieuse ;
- contraintes SQL, RLS, audit append-only et précision des montants ;
- comportement avec la base réelle, pas uniquement avec des fakes.

## Exigences de preuve

Un test de handler avec fake prouve la couche HTTP qu'il exerce, mais ne prouve
ni la migration, ni la RLS, ni le comportement du fournisseur réel. Le rapport
doit distinguer ces niveaux et lister les scénarios non démontrés.
