---
id: AF22.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF21.2]
---
# AF22.1 — Encapsuler le protocole assistant legacy

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- port `AssistantGateway` dans Diagnostics ;
- URL, clé publique et chemins Claude confinés à un adaptateur legacy ;
- chat et recherche boutique reçoivent une connexion SSE abstraite ;
- l'éditorial de catégorie passe par la même passerelle et conserve son timeout
  et son fallback déterministe.

Cette étape isole volontairement le legacy sans prétendre l'avoir modernisé :
la prochaine évolution pourra remplacer l'adaptateur par un backend multi-provider
OpenAI/Mistral/Anthropic sans modifier les composants ni le lecteur SSE.

## Mesures

- chat : **1 → 0** référence Supabase ;
- portail : **3 → 1** référence Supabase ;
- baseline globale : **4 → 1** référence ;
- fichiers importeurs : **2 → 1** ;
- URL Edge directes dans l'UI : **2 → 0**.

La dernière référence est la persistance RPC d'un produit IA, prévue dans
AF22.2 via Shops `/api/v1`.

## Validation UX attendue

Conversation IA en streaming et non-streaming, recherche Magrit depuis une
boutique, fallback texte en cas d'indisponibilité et chargement éditorial d'une
catégorie avec repli déterministe.
