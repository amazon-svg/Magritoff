---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/modules/**/ui/**"
  - "src/app/**"
---

# Conventions frontend — Sprint 5 Gestion commerciale

- **Interdit absolu, sans exception** : aucun composant React n'interroge Supabase directement (pas d'import `@supabase/*`, pas d'appel `supabase.*`, pas d'URL `functions/v1` en dur). Tout passe par le client API du module (`src/modules/<domaine>/api/client.ts`), lui-même appelant `/api/v1/...`. Gardé par `tests/architecture/modular-ui-boundaries.test.ts` et `api-first-boundaries.test.ts` — ces tests doivent couvrir tout nouveau module E10, pas seulement les modules existants.
- **Aucun contrôle métier posé uniquement côté navigateur** : seuils, quotas, extensions de fichier autorisées, numérotation de documents, totaux de devis/commande. Un contrôle React est de l'UX (retour immédiat), jamais la seule barrière — la vérité vient toujours de l'API/de la base. Point de vigilance connu du Sprint 5 : `applyCommercialRules()` (`src/modules/commercial/ui/workspace/commercial.helpers.ts`) calcule déjà des prix côté UI — ne pas reproduire ce pattern dans le nouveau code E10 tant que la migration serveur n'est pas explicitement tranchée.
- `data-testid` selon la convention documentée en tête de `src/shared/presentation/testIds.ts` : `<scope>-<element>[-<modifier>]`, jamais l'ID métier dans le testid. Pour une liste, combiner un testid de conteneur avec un attribut `data-<entity>-id` sur chaque ligne (ex. `data-testid="project-row" data-project-id="..."`). Les testid posés doivent correspondre aux « Hints DOM » du cas de test Notion concerné (parcours P13 pour Sprint 5).
- Déclarer tout nouveau testid dans `src/shared/presentation/testIds.ts` — jamais de chaîne littérale improvisée dans un composant.
- Une page/un composant métier de module vit sous `src/modules/<module>/ui/`, jamais sous `src/app/components` (baseline figée à zéro par les tests d'architecture MUX).
