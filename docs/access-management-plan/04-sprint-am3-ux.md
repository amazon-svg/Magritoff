# Sprint AM3 — UX de gestion et points d'accroche des surfaces

**Statut :** à préparer  
**Effort indicatif :** 4–5 jours  
**Dépend de :** AM2

## Objectif

Livrer une UX cohérente pour les administrateurs de tenant et les opérateurs plateforme, intégrée par des contributions de module plutôt que par du code dispersé.

## Stories

### AM3.1 — Manifest de contribution aux surfaces

Définir un contrat déclaratif minimal :

```ts
type SurfaceContribution = Readonly<{
  surface: 'dashboard' | 'backoffice' | 'shop';
  navigation: readonly NavigationContribution[];
  routes: readonly RouteContribution[];
}>;
```

- le module déclare ses routes, libellés, icônes et test IDs ;
- la composition root de chaque surface collecte les contributions ;
- le manifest ne contient aucune requête ni logique d'autorisation métier ;
- une route serveur continue de protéger chaque opération.

### AM3.2 — Espace administrateur tenant

- liste et détail des rôles ;
- création, modification et archivage ;
- choix des capabilities groupées par module ;
- liste des membres et remplacement de leurs rôles ;
- conflits de version et erreurs explicites ;
- confirmation renforcée pour les opérations sensibles.

### AM3.3 — Espace opérateur plateforme

- recherche/sélection d'un tenant ;
- liste des modules et état de leur entitlement ;
- activation de `clariprint_data.enabled` avec source, période et motif ;
- historique des changements ;
- séparation visuelle et technique avec l'administration tenant.

### AM3.4 — États et accessibilité

- chargement, vide, refus, indisponibilité et conflit ;
- navigation clavier, focus, labels et annonces d'erreur ;
- aucun masquage silencieux d'une erreur fournisseur ;
- tests des trois surfaces même lorsqu'une contribution est vide.

## Politique de navigation initiale

- le menu Clariprint Data est ajouté systématiquement au dashboard ;
- son activation n'est pas décidée par un appel Supabase dans le layout ;
- après navigation, la page utilise `access/me` pour présenter l'état disponible, non activé ou non autorisé ;
- les actions métier restent protégées indépendamment de l'affichage du menu.

## Critères d'acceptation

- [ ] Aucun composant UI n'importe Supabase ou `infrastructure`.
- [ ] Les appels passent par un client API injecté et simulable.
- [ ] Les routes et menus proviennent du manifest du module.
- [ ] Tenant admin et opérateur plateforme voient des parcours distincts.
- [ ] Une activation Clariprint Data est réalisable sans accès direct à la base.
- [ ] Les erreurs et conflits permettent une récupération compréhensible.
- [ ] Les parcours critiques passent les tests d'accessibilité retenus.

## Condition de sortie

Les droits et activations de modules sont administrables de bout en bout dans l'application, sans console Supabase ni modification manuelle de JSON.

