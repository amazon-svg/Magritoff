---
id: AF24.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF24.4]
---
# AF24.5 — Verrouiller la dernière dérogation fournisseur de l’UI

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
