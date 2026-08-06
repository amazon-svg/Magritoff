# J5 — Contrôle, validation et publication

**Statut initial :** à préparer  
**Dépendance :** J4

## Goal

Produire un instantané complet, cohérent, immuable et versionné du parc accessible d'une organisation.

## Workflow cible

```text
Brouillon -> Contrôlé -> Validé -> Publié -> Archivé
```

## Périmètre

- brouillon de travail ;
- contrôles bloquants et avertissements ;
- validation ;
- publication atomique ;
- snapshot complet ;
- numéro et version de schéma ;
- période d'effet ;
- historique et comparaison ;
- référence d'une publication depuis un calcul.

## Livrables

1. Modèles `DraftDataset`, `ValidationReport` et `Publication`.
2. Moteur déterministe de validation.
3. Transaction de publication côté serveur.
4. Stockage immuable du snapshot et de son empreinte.
5. Écran de bilan avant publication.
6. Historique et diff entre deux publications.
7. Audit des transitions.

## Critères de validation

- [ ] `J5-VAL-01` Une erreur bloquante empêche la publication.
- [ ] `J5-VAL-02` Un avertissement reste visible et suit la règle de confirmation décidée au J0.
- [ ] `J5-VAL-03` Le contrôle est déterministe pour un même snapshot et une même version de règles.
- [ ] `J5-VAL-04` La publication vérifie la capability côté serveur.
- [ ] `J5-VAL-05` La publication est une transaction atomique.
- [ ] `J5-VAL-06` Une publication publiée ne peut être modifiée, même par un administrateur applicatif.
- [ ] `J5-VAL-07` Toute correction produit une nouvelle version.
- [ ] `J5-VAL-08` Chaque publication porte organisation, version, schéma, auteur, date et période d'effet.
- [ ] `J5-VAL-09` Deux publications sont comparables au niveau des objets et champs modifiés.
- [ ] `J5-VAL-10` Une publication historique reste consultable et exportable selon la politique de conservation.
- [ ] `J5-VAL-11` Un calcul ou devis peut conserver l'identifiant exact de la publication utilisée.

## Scénario de démonstration

Faire échouer un contrôle, corriger le brouillon, publier V1, modifier un coût avec une nouvelle date d'effet, publier V2 et démontrer que V1 reste inchangée et comparable à V2.

## Condition de sortie

L'empreinte de V1 est identique avant et après la publication de V2, et toutes les transitions sont retrouvables dans l'audit.

