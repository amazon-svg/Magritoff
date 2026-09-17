---
id: AF21.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF20.2]
---
# AF21.1 — Encapsuler le fournisseur d'authentification

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
