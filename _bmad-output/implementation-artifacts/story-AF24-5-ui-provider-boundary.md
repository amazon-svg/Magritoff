---
id: AF24.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF24.4]
---
# AF24.5 — Verrouiller la dernière dérogation fournisseur de l’UI

## Résultat livré

Le test d’architecture inventorie désormais les imports d’adaptateurs Supabase
depuis `src/app`. La seule entrée admise est :

```text
AuthContext -> browser-authentication-gateway
```

Toute réintroduction d’un repository, d’un client Session DEV ou d’une commande
Supabase dans un composant ou contexte fait échouer la CI.

## Dérogation Auth

Cette dérogation n’est pas une cible d’architecture. Sa suppression dépend de
UM2, qui introduira deux contrats de session distincts : utilisateur Magrit et
compte boutique identifié par `(boutique, email normalisé)`. Implémenter un BFF
d’identité global avant UM2 figerait le modèle fonctionnel appelé à disparaître.

La dette restante côté navigateur est donc quantifiée à un fichier fournisseur
et un seul point d’import UI.
