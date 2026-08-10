# Note d'arbitrage — le noyau applicatif Magrit

> **À l'attention de Xavier Péchoultres** (Expert Solutions) — de Arnaud Mazon (AGE Développement).
> 2026-08-10, après la remontée `beta/v5` → `main` (merge `796f9c9`) et l'accord sur [CONVENTION_GIT.md](CONVENTION_GIT.md).
> Objet : ce qui doit être tranché **avant** l'audit écran par écran du Parc machine.

---

## 0. Le constat qui change l'ordre du jour

Nous avions anticipé un risque de **noyaux concurrents**. Vérification faite dans le dépôt, **ce risque n'existe pas** :

| Fait vérifié | Conséquence |
|---|---|
| `main` ne contient **aucun** `src/kernel/` — l'arborescence est `src/app`, `src/server`, `src/schemas`, `src/styles`, `src/types` | Ton noyau atterrit dans un répertoire vierge |
| Ton `src/kernel/` porte des **primitives techniques sans métier** — `money`, `result`, `errors`, `ids`, `clock`, `events`, `units`, `pagination`, `actor` | Conforme à **R4** (noyau minimal, aucune logique métier) : rien à arbitrer sur le principe |
| Un seul fichier est modifié des deux côtés : **`CLAUDE.md`** | Conflit unique, textuel, trivial |
| Tes tests de frontières interdisent mécaniquement `react`, `@supabase`, `@/app`, `@/server`, `@/schemas`, `@/types` dans le noyau | Le garde-fou est automatisé, pas déclaratif — nous le prenons tel quel |

**Il n'y a donc pas de « quel noyau gagne ».** Ton noyau ne remplace rien : il ajoute une couche qui nous manquait. Nous l'adoptons sans réserve de principe.

Le vrai sujet d'arbitrage est ailleurs, et il est plus exigeant : **jusqu'où et à quelle vitesse le code existant migre sur ces primitives.** Quatre questions, par ordre décroissant d'impact.

---

## 1. Le type monétaire — la question structurante

C'est le point de rencontre le plus profond entre ton noyau et notre code.

**Ton `Money`** : `{ minorUnits: bigint, currency: Currency }`, création par `Result`, erreurs typées `currency_mismatch` et `invalid_currency`. Modèle correct — et **directement aligné sur la décision RP#070826 §6.1** : « chaque imprimeur dispose de sa devise et de son système d'unités de saisie ».

**Notre code, aujourd'hui** : les prix sont des `number` en euros, partout.
- `resolvePrice()` → `priceHT: number` ([src/app/utils/priceResolver.ts](../src/app/utils/priceResolver.ts))
- hiérarchie `clariprint > library_cached > prix_marche > zero`
- règles de Gestion commerciale : `margin_pct` / `discount_pct` / `fixed_price` avec `value: number`, appliquées en arithmétique flottante (`basePrice * (1 + value / 100)`)
- coûts du Parc machine : taux horaires, coûts plaque, coût au clic, encre au m² — tous en `number`

**Ce qu'il faut trancher :**

1. **Périmètre de bascule.** Tout le chemin de prix d'un coup, ou par tranche verticale en commençant par Clariprint Data (coûts de production) et en laissant GesCom sur `number` jusqu'à sa refonte ? Notre préférence : **par tranche verticale**, avec une frontière de conversion explicite et testée, pour ne pas geler le produit.
2. **Où vit la conversion.** Nous proposons qu'aucun `number` monétaire ne franchisse la frontière d'un module : conversion en `Money` à l'entrée du service applicatif, jamais dans les écrans.
3. **Les pourcentages.** Marge et remise ne sont pas des montants. Restent-ils des `number` (ratio), avec `Money` uniquement pour les montants résultants ? À confirmer de ton côté — c'est une décision de modèle, pas de goût.
4. **L'arrondi.** Le passage en unités mineures impose une règle d'arrondi unique et documentée (par ligne ? sur le total ?). Sujet à conséquence commerciale directe : deux règles d'arrondi produisent deux prix, et donc deux devis.

## 2. La portée des tests de frontières

Tes tests policent aujourd'hui `src/kernel` seul, et c'est sain. La question est ce qu'on en fait ensuite.

**État des lieux honnête, déclaré dans le message de fusion `796f9c9`** — cinq dérogations R5 en vigueur :

| # | Dérogation | Chemin de conformité |
|---|---|---|
| 1 | Le front dialogue directement avec Supabase (motif préexistant, ~117 écrans) | Couche API de ton noyau, migration au fil des interventions |
| 2 | Module Gestion commerciale : accès direct aux tables | Service applicatif + port de persistance |
| 3 | Parc machine : persistance `localStorage`, **aucun accès base** | Reprise directe sur ports/adaptateurs, **sans dette à défaire** |
| 4 | Specs machines et coûts par défaut **indicatifs** | Relecture Expert Solutions / Clariprint |
| 5 | Route de démonstration du wizard, développement uniquement | Suppression après arbitrage BK-15 |

**Ce qu'il faut trancher** : étendre les tests de frontières à `src/app` les ferait échouer immédiatement, sur environ 117 écrans. Deux voies :

- **Cliquet progressif** (notre proposition) : la règle est bloquante sur tout module **nouveau**, et un compteur de violations existantes qui ne peut que décroître — jamais augmenter. Cela rend la dette mesurable sans geler la production.
- **Gate dur** : conformité exigée avant toute nouvelle livraison. Coût immédiat élevé, calendrier bêta à revoir.

Ce choix t'appartient techniquement, mais il a un effet direct sur le calendrier — donc nous devons le poser ensemble.

## 3. Le Parc machine — ce qui est jetable, ce qui ne l'est pas

Nous te rejoignons totalement : **la fusion ne vaut pas validation architecturale**, et le Parc machine doit être audité contre tes frontières. Précision utile pour cadrer l'effort :

- **L'implémentation est jetable.** Elle ne touche pas la base : persistance `localStorage`, données de bibliothèque embarquées. Il n'y a **aucune migration de schéma à défaire** — c'est le cas le plus favorable pour une reprise sur ports et adaptateurs.
- **Le résultat d'arbitrage ne l'est pas.** Les deux parcours du wizard sont instrumentés et mesurés : **19 clics pour le parcours A (déroulé complet), 14 pour le parcours B (types déclarés)**, sur un parc comparable — presse offset, massicot, fournisseurs papier et transport. C'est la donnée que la séance du 7 août demandait pour trancher l'ordre de saisie (BK-15). Les tests utilisateurs (BK-33) restent à mener sur les deux maquettes.
- **La séparation que tu rappelles est déjà respectée** : marges, remises et prix de vente vivent exclusivement dans le module Gestion commerciale ; le Parc machine ne porte que des coûts de production. C'est l'arbitrage du 7 août, implémenté tel quel.
- **La bibliothèque de machines** compte 64 modèles sur les 8 types, classés par sous-familles avec rang de popularité, et un jeu de paramètres de prix par type (calage, gâche, coût plaque, coût au clic, encre au m², coût de forme, cadences, consommables). **Ces valeurs sont indicatives** et ont besoin de ta relecture et de celle de Laurent : c'est le sourcing resté non chiffré depuis WM#040826.

## 4. Le seul conflit de fusion : `CLAUDE.md`

Nous avons modifié le fichier pour **retirer la mention en dur d'une branche de travail** — ta remarque était fondée — et le faire renvoyer à `docs/CONVENTION_GIT.md`. Tu l'as modifié de ton côté (commit `4ca997f`).

Proposition : nous fusionnons les deux versions à ton retour de rebase, en gardant ta section noyau et notre renvoi à la convention. Aucune valeur n'est en jeu, c'est de la mécanique — autant l'anticiper.

---

## Ce que nous demandons de trancher

| # | Question | Décideur | Échéance souhaitée |
|---|---|---|---|
| 1 | Périmètre et rythme de bascule vers `Money` (tranche verticale ou global) | Expert Solutions, avec impact calendaire à valider ensemble | Prochaine session |
| 2 | Statut des pourcentages (marge / remise) : `number` ou type dédié | Expert Solutions | Prochaine session |
| 3 | Règle d'arrondi unique | Les deux — conséquence commerciale | Prochaine session |
| 4 | Portée des tests de frontières : cliquet progressif ou gate dur | Expert Solutions, calendrier arbitré ensemble | Prochaine session |
| 5 | Couche propriétaire du Parc machine après reprise | Expert Solutions | Après rebase |
| 6 | Relecture des caractéristiques machines et coûts par défaut | Expert Solutions + Clariprint | Avant tout usage en calcul réel |

**Notre position d'ensemble** : ton noyau et tes frontières font autorité sur l'architecture, sans discussion. Ce que nous défendons, c'est la **progressivité** — R5 existe précisément pour ça — et la préservation des acquis produit qui ne sont pas des acquis de code : la mesure d'arbitrage du wizard, la charte appliquée, la séparation coûts / prix de vente.
