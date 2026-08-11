# Convention Git — dépôt Magritoff

> **Statut : opposable.** Convention partagée AGE Développement × Expert Solutions, arrêtée le 2026-08-10 (échange Arnaud Mazon / Xavier Péchoultres).
> Complète la règle **R6** de [REGLES_ARCHITECTURE.md](REGLES_ARCHITECTURE.md), qui fixe le principe (une branche par fonctionnalité, versions en tags) sans décrire la ligne d'intégration.
>
> **Motif de son écriture** : l'absence de convention écrite a produit un faux diagnostic de branche et une friction inutile entre les deux parties (2026-08-09/10). Ce document est la source de vérité ; aucun autre fichier ne doit désigner « la » branche de travail.

---

## 1. Rôle des branches

| Branche | Rôle | Qui | Durée de vie |
|---|---|---|---|
| **`main`** | **Référence partagée entre les deux parties.** Seul point de synchronisation inter-organisations. C'est sur elle que se rebasent les branches d'Expert Solutions. | Les deux | Permanente |
| `beta/v5` | **Ligne d'intégration interne AGE Dvt.** Reçoit les branches fonctionnelles AGE avant remontée. Ne concerne pas Expert Solutions. | AGE Dvt. | **Temporaire** — disparaît quand la cadence de remontée rend l'intégration intermédiaire inutile |
| `feat/<périmètre>` | Branche fonctionnelle. Une par fonctionnalité ou évolution (R6). | Chacun sur son périmètre | Jusqu'à la fusion |
| `feat/kernel-clariprint-data` | Noyau technique, tests de frontières architecturales, specs Clariprint Data. | Expert Solutions | Jusqu'à la fusion |

**Interdits** — un développement direct sur `main` ; un développement direct sur la ligne d'intégration ; une branche pour matérialiser une version (voir §3).

## 2. Cadence de remontée vers `main`

**`beta/v5` est remontée dans `main` à chaque jalon fonctionnel, et au minimum une fois par semaine calendaire.**

C'est le point qui a fait défaut : entre le 2026-07-27 et le 2026-08-10, `main` n'a pas été alimentée alors que `beta/v5` accumulait 18 commits. Une branche de référence qui ne bouge pas pendant deux semaines cesse d'être une référence.

Conditions pour remonter :

1. `pnpm build` vert ;
2. suite de tests verte (`pnpm test`) ;
3. `SPRINT_HANDOFF.md` à jour ;
4. les dérogations **R5** introduites sont listées dans le message de fusion.

**Ce qu'une remontée signifie, et ce qu'elle ne signifie pas.** Elle remet les historiques en cohérence et publie du code fonctionnel testé. Elle **ne vaut pas validation architecturale** du contenu remonté : la conformité aux règles R1-R4 est un chantier distinct, tracé par les dérogations R5. Toute mise en conformité modulaire reste identifiée et planifiée séparément.

## 3. Versions

Les versions se matérialisent par des **tags annotés**, jamais par des branches :

```
git tag -a v5.3.0 -m "description" && git push origin v5.3.0
```

Format : `vMAJEUR.MINEUR.CORRECTIF`. Les branches historiques `beta/v3`, `beta/v4`, `design/v2` sont des vestiges de cette mauvaise pratique — elles sont conservées en lecture et ne reçoivent plus de commit.

## 4. Nommage

- `feat/<périmètre-fonctionnel>` — nouvelle fonctionnalité (ex. `feat/kernel-clariprint-data`)
- `fix/<périmètre>` — correction
- `docs/<périmètre>` — documentation seule

Nommage **explicite sur le périmètre fonctionnel**, jamais sur un code interne ni un nom d'outil.

## 5. Hygiène

- Avant tout changement de branche : environnement local propre, aucune modification non commitée.
- `git fetch origin --prune` **avant** toute comparaison de branches. Un `git log` sur une référence non rafraîchie a déjà produit un faux diagnostic (2026-08-09).
- Une **base commune** (`git merge-base`) n'est pas un **point de fork**. Vérifier avec `git merge-base --is-ancestor` avant d'affirmer d'où part une branche.
- Commits atomiques, message en français, format `type(portée): description` sans apostrophe.
- **Confirmation explicite du propriétaire du dépôt avant tout `push`.**

## 6. Séquence de synchronisation inter-organisations

1. AGE Dvt. remonte `beta/v5` → `main`, pousse, et **annonce la remontée**.
2. Expert Solutions rebase sa branche fonctionnelle sur le nouveau `main`.
3. Les conflits sont traités explicitement, en nommant les frontières concernées (noyau, module, spécifications, séparation Clariprint Data / GesCom).
4. La branche fonctionnelle revient dans `main` par fusion, après revue.
