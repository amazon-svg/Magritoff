---
id: AF23.2b
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF23.2a]
---
# AF23.2b — Placer le chat SSE derrière l’API Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- endpoint navigateur stable `POST /api/v1/assistant/chat`, en JSON ou SSE selon
  l’en-tête `Accept` ;
- remplacement de la passerelle navigateur Supabase par une passerelle HTTP
  neutre ;
- utilisation obligatoire du jeton de session, sans clé anonyme codée dans le
  module assistant ;
- validation du contexte (25 messages maximum) et contrôle d’appartenance au
  tenant avant le relais ;
- identité utilisateur imposée par le serveur afin d’éviter l’usurpation dans
  le suivi de consommation ;
- conservation intégrale du contrat `delta` / `done` et du moteur métier
  historique pendant cette étape de découplage.

## Limite volontaire

Le moteur du chat et son prompt expert restent pour l’instant dans l’Edge
Function Anthropic historique. Cette façade supprime ce détail du navigateur et
permettra de remplacer le moteur derrière le même contrat lors d’un lot suivant,
sans nouvelle migration React. L’éditorial de catégorie est déjà réellement
multi-provider depuis AF23.2a.

## Validation attendue

- un appel anonyme reçoit 401 ;
- un tenant extérieur reçoit 403 avant tout relais ;
- le corps SSE traverse la façade sans transformation ;
- le mode non-streaming continue d’utiliser le même contrat JSON.
