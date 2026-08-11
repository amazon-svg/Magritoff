# Sprint AM0 — Contrats, composition et garde-fous

**Statut :** à préparer  
**Effort indicatif :** 2–3 jours

## Objectif

Rendre la frontière du module exécutable avant toute nouvelle UI ou route durable.

## Stories

### AM0.1 — Valider les décisions structurantes

- valider la séparation `platform/access` / `modules/access-management` ;
- choisir la façade `/api/v1` et son routage vers l'hébergement serveur ;
- valider le catalogue de capabilities et la séparation `platform_only` ;
- trancher l'archivage d'un rôle affecté et la récupération du dernier administrateur ;
- passer la spécification de `candidate` à `accepted` après arbitrage.

### AM0.2 — Créer le squelette modulaire

- créer `domain`, `application`, `api`, `infrastructure`, `ui` et `testing` ;
- définir les ports et types métier sans types DB ;
- définir la façade applicative et les commandes/queries ;
- déclarer les capabilities propres au module.

### AM0.3 — Contractualiser les entrées

- valider automatiquement l'OpenAPI ;
- générer ou vérifier les types de client et serveur ;
- définir le format commun d'erreur et la propagation de `requestId` ;
- définir `If-Match` et `Idempotency-Key` pour les mutations.

### AM0.4 — Installer les contrôles mécaniques

- interdire Supabase dans `domain`, `application`, `api` et `ui` ;
- interdire les imports depuis les composants/contexts historiques ;
- interdire aux autres modules d'importer `infrastructure` ;
- ajouter ces contrôles au job CI Architecture requis.

## Critères d'acceptation

- [ ] Le module compile sans React ni Supabase dans son domaine et son application.
- [ ] Le contrat OpenAPI est valide et possède des `operationId` uniques.
- [ ] Les types publics ne contiennent aucune ligne SQL ou réponse PostgREST.
- [ ] Une architecture test échoue sur un import Supabase ajouté à l'UI du module.
- [ ] La composition root est le seul emplacement qui relie client HTTP et surface.
- [ ] Les décisions ouvertes bloquantes sont consignées avec leur responsable.

## Preuves

- validation OpenAPI ;
- typecheck modulaire ;
- tests d'architecture positifs et négatifs ;
- diagramme de dépendances actualisé.

## Hors scope

- accès réel à la base ;
- route déployée ;
- écran de gestion.

