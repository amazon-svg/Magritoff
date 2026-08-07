# Capacité `pricing-schedules`

**Statut :** draft

## Responsabilité

Définir, versionner, tester et importer les barèmes conditionnels associés à une machine ou un poste, sans réimplémenter le solveur officiel.

## Concepts

- `PricingSchedule` ;
- `ApplicabilityCondition` ;
- `PerformanceTerms` ;
- `EconomicTerms` ;
- `WasteTerms` ;
- `ScheduleTestCase` ;
- `ScheduleTestResult`.

## Conditions candidates

- prestation réalisable ;
- un ou plusieurs supports alternatifs acceptés ;
- grammage et épaisseur ;
- dimensions d'entrée et du produit fini ;
- surface unitaire ou totale ;
- pages et nombre de postes à assembler ;
- nombre de passes ou tours ;
- quantité d'exemplaires.

La liste définitive dépend du contrat solveur. Chaque condition utilise une unité typée et une sémantique explicite pour les bornes absentes.

## Termes candidats

- coût fixe ou calage ;
- coût au millier ;
- taux horaire ;
- coût surfacique ;
- cadence ou limitation de cadence ;
- suppléments fixes ou proportionnels ;
- gâche fixe et proportionnelle.

Performance, économie et gâche restent trois sous-structures distinctes, même si elles sont éditées dans un même formulaire.

## Cas d'usage

- créer ou dupliquer un barème ;
- modifier plusieurs barèmes puis confirmer la sauvegarde ;
- filtrer par prestation et support ;
- importer/exporter avec prévisualisation ;
- détecter contradictions et recouvrements ;
- exécuter un cas de test via un validateur contractuel ;
- expliquer les barèmes applicables et la décomposition du résultat.

## Invariants

- une prestation appartient aux prestations réalisables du poste ;
- un support appartient aux supports acceptés ;
- bornes min/max cohérentes ;
- coûts monétaires sans float binaire ;
- cadence et coût ne sont pas interchangeables ;
- aucune mise à jour productive à chaque frappe ;
- un résultat officiel référence publication, solveur, contrat et entrées ;
- les recouvrements ambigus sont signalés avant publication.
- plusieurs barèmes applicables sont arbitrés par une règle métier explicite ; l'ordre physique ou l'ordre de retour de la base n'a aucun effet.

## Port de test

```ts
interface PricingScheduleValidator {
  evaluate(command: EvaluateScheduleCase): Promise<Result<ScheduleTestResult, ScheduleValidationError>>;
}
```

L'implémentation officielle appelle le solveur ou un validateur partagé. Une évaluation locale éventuelle est identifiée comme preview non contractuelle.

## Validation

- [ ] Seules les prestations et supports de la machine sont sélectionnables.
- [ ] Surface, grammage, épaisseur et quantité influencent l'applicabilité selon le contrat.
- [ ] Tous les postes de performance et coût non nuls sont visibles dans le résumé.
- [ ] Un changement en lot n'est persisté qu'après confirmation.
- [ ] Le test explique chaque règle et rubrique appliquée.
- [ ] Un recouvrement ambigu est détecté sur le corpus pilote.
- [ ] Importer deux fois le même fichier ne duplique pas les barèmes.

## Décisions ouvertes

1. Schéma officiel et stratégie d'arbitrage : priorité, spécificité ou rejet du chevauchement.
2. Sémantique de « toute prestation ».
3. Cumul ou exclusivité de plusieurs barèmes applicables.
4. Moteur officiel du test unitaire.
