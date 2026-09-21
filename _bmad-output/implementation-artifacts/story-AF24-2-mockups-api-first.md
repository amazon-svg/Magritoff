---
id: AF24.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF24.1]
---
# AF24.2 — Masquer Storage et le générateur de mockups

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- le navigateur utilise uniquement `/api/v1/mockups/public/*` et
  `/api/v1/mockups/render` ;
- suppression de la passerelle navigateur Supabase et de la clé anonyme dans le
  chemin des mockups ;
- relais binaire côté adaptateur serveur vers Storage et `mockup-generator` ;
- redirections du générateur suivies côté serveur afin de ne pas exposer l’URL
  fournisseur au composant ;
- validation des chemins, dimensions, couleur et liste fermée de paramètres
  avant tout appel fournisseur ;
- comportement cache-first, génération à la demande et fallback SVG conservés.

L’Edge Function `mockup-generator` reste le moteur de rendu transitoire. Elle
peut être remplacée derrière ces routes sans modifier l’UX.
