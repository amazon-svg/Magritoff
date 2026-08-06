# J2 — Fournisseurs, établissements et capacités

**Statut initial :** à préparer  
**Dépendance :** J1

## Goal

Permettre de créer et maintenir un fournisseur multi-capacités sans dupliquer son identité.

## Périmètre

- fournisseur ;
- établissement ou site pilote ;
- capacités métier ;
- coordonnées, statut et dates d'effet ;
- provenance ;
- archivage logique ;
- recherche et consultation ;
- historique des changements.

## Livrables

1. Modèle de domaine `Supplier`, `Site` et `SupplierCapability`.
2. Repository et implémentation Supabase.
3. Cas d'usage créer, modifier, archiver, consulter et rechercher.
4. Écrans de liste et de fiche fournisseur.
5. Journalisation des changements sensibles.
6. Tests métier, repository et RLS.

## Critères de validation

- [ ] `J2-VAL-01` Un fournisseur peut cumuler impression, façonnage, papier et transport.
- [ ] `J2-VAL-02` L'ajout d'une capacité ne crée pas un second fournisseur.
- [ ] `J2-VAL-03` Une capacité possède un statut et, si nécessaire, une période de validité.
- [ ] `J2-VAL-04` Un site appartient à une seule organisation et à un fournisseur identifiable.
- [ ] `J2-VAL-05` L'archivage conserve l'historique et les références existantes.
- [ ] `J2-VAL-06` La recherche ne retourne aucune donnée cross-tenant.
- [ ] `J2-VAL-07` Les modifications concurrentes ne provoquent pas d'écrasement silencieux.
- [ ] `J2-VAL-08` Les champs obligatoires et doublons sont contrôlés avant persistance.
- [ ] `J2-VAL-09` L'auteur, la date et la provenance d'une modification sont retrouvables.

## Scénario de démonstration

Créer un fournisseur possédant un site, lui attribuer les capacités impression et fourniture de papier, retirer l'une des capacités à une date future, puis vérifier que son historique reste visible.

## Condition de sortie

Le scénario de démonstration est exécuté par un utilisateur métier autorisé et tous les tests d'isolation passent.

