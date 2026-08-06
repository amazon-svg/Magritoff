# Capacité `sandboxes`

**Statut :** draft

## Responsabilité

Permettre une expérimentation isolée dérivée d'une publication, comparable et promouvable vers un brouillon sans effet direct sur la production.

## Concepts

- `Sandbox` ;
- publication source ;
- environnement et destination autorisée ;
- `SandboxDiff` ;
- promotion.

## Cas d'usage

- créer depuis une publication ;
- modifier les données isolées ;
- contrôler et comparer ;
- générer un export de test ;
- promouvoir vers un nouveau brouillon ;
- archiver.

## Invariants

- publication source obligatoire et immuable ;
- aucune écriture vers le dataset de production ;
- environnement marqué dans toute sortie ;
- destination de production interdite côté serveur ;
- promotion créant un brouillon, jamais une publication ;
- archivage sans effet sur la source.

## Ports

`SandboxRepository` charge et sauvegarde l'état isolé avec contrôle de version. La protection de destination appartient également à l'adaptateur solveur, pour une défense en profondeur.

## Validation

- [ ] Modifier un sandbox ne change ni la publication source ni le brouillon courant.
- [ ] Le JSON de test est non ambigu.
- [ ] La destination de production refuse tout dataset sandbox.
- [ ] La promotion crée une nouvelle identité de brouillon.
- [ ] Le diff couvre ajouts, retraits et modifications.
- [ ] Les actions de promotion et archivage sont auditées.

## Décisions ouvertes

- calcul de test distant ou téléchargement uniquement ;
- durée de conservation ;
- nombre maximal de sandboxes ;
- stratégie de stockage par copie ou delta.

