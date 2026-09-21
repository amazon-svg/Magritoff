---
id: AF16.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF16.1]
---

# AF16.2 — Isoler la destination post-invitation et la déconnexion

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- après acceptation, rechargement du bootstrap via `SessionApiClient` ;
- résolution de la première boutique visible via `ShopsApiClient` avant la
  redirection de l’invité ;
- remplacement des déconnexions directes de `AcceptInvitation` et
  `AccountHub` par la commande `signOut` de `AuthContext` ;
- retrait complet de Supabase de ces deux composants.

## Invariants

- le token d’invitation reste conservé avant une déconnexion causée par un
  mauvais compte ;
- la membership acceptée est rechargée avant de calculer la destination ;
- une boutique de destination doit être visible par la RLS de l’utilisateur ;
- l’identité reste provisoirement fournie par Supabase Auth, mais seul
  `AuthContext` connaît ce fournisseur ;
- le fallback reste `/tenants` si le tenant accepté ne peut pas être résolu.

## Mesures

- `AcceptInvitation` : **3 → 0** références Supabase ;
- `AccountHub` : **1 → 0** référence Supabase ;
- baseline globale : **64 → 60** références ;
- fichiers UI important Supabase : **17 → 15**.

## Validation UX attendue

Accepter une invitation acheteur `shop_only` et vérifier la redirection vers
la boutique visible. Tester une invitation avec le mauvais compte, cliquer
« Se déconnecter et changer de compte », puis vérifier que le parcours reprend
après connexion correcte. Depuis « Mon profil », la déconnexion doit revenir
à l’accueil sans erreur console.
