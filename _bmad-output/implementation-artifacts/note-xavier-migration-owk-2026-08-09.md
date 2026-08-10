# Note à Xavier — branche `migration_owk` rebasée

> 2026-08-09 — à envoyer à Xavier Péchoultres avant tout push force de `migration_owk`.
>
> ---
>
> ⛔ **DOCUMENT PÉRIMÉ — conservé pour l'historique. Ne pas envoyer, ne pas citer.**
>
> **Le §1 est FAUX**, réfuté par Xavier Péchoultres et vérifié le 2026-08-10 (`git merge-base --is-ancestor origin/main origin/migration_owk` → vrai). Sa branche part de **`main`** (commit `177edb3`), pas de `beta/v5`. Le commit `672e8a7` cité n'était que la **base commune** avec `beta/v5` — confondue ici avec un **point de fork**. La vraie anomalie était inverse : `main` n'avait pas été alimentée depuis le 27/07 pendant que `beta/v5` accumulait 18 commits. Sa branche est par ailleurs renommée **`feat/kernel-clariprint-data`** et contient désormais du code (noyau + tests de frontières), plus seulement de la documentation.
>
> **Ce qui fait foi désormais** : [docs/CONVENTION_GIT.md](../../docs/CONVENTION_GIT.md) — `main` est la référence partagée, remontée hebdomadaire minimum ; §5 porte la règle « une base commune n'est pas un point de fork ». Remontée `beta/v5` → `main` effectuée le 2026-08-10 (merge `796f9c9`).
>
> ---

Salut Xavier,

J'ai remis `migration_owk` à niveau. Trois choses à savoir.

## 1. La branche était partie d'une base périmée

Tu l'avais forkée de `beta/v5` au commit `672e8a7` (26/07). Depuis, `beta/v5` a beaucoup bougé : refonte UX du dashboard (charte v2 sur 20 écrans, nav en 4 groupes), module Parc machine avec wizard A/B, module Gestion commerciale (règles de prix et marges), règles d'architecture R1-R8 de la session RP#070826. `migration_owk` avait donc **15 commits de retard** sur le code.

## 2. Ce que j'ai fait

Rebase de tes 10 commits de documentation sur `origin/beta/v5` (HEAD `2699c55`). **Aucun conflit** — logique, ta branche ne touche que `prd/` et `docs/`, pas le code applicatif.

Nouveau HEAD : `ffd864c`. La branche est maintenant 10 commits devant `beta/v5`, 0 derrière.

J'ai écarté au passage `93c4384` (`chore(b1)`, bascule `claude-3-haiku-20240307` → `claude-haiku-4-5-20251001`) : il était devenu obsolète, la chaîne n'existe plus sur `beta/v5` et le fichier qu'il modifiait y est supprimé.

**Attention : le rebase réécrit les SHA.** Si tu as la branche en local, ne fais pas un `git pull` classique — repars du remote une fois qu'on l'aura poussée (`git fetch && git reset --hard origin/migration_owk`), ou dis-moi et on cale ça ensemble. Le push force n'est pas encore fait, j'attends ton feu vert. L'ancien historique est conservé sous `migration_owk_avant_rebase` en cas de besoin.

## 3. Le point qui demande ton avis

`prd/global-prd.md` annonce en tête : *périmètre observé, branche `main`, jusqu'au commit `177edb3`*. Ça veut dire que le PRD global décrit le produit **sans** l'Epic 7 (gabarit boutique v2, checkout) ni les modules livrés depuis sur `beta/v5` (Parc machine, Gestion commerciale, refonte UX).

Deux options :

- tu recales le périmètre sur `beta/v5` avant la relecture PO ;
- ou on assume le décalage et on le note explicitement comme une limite du document.

Dis-moi ce que tu préfères, et si le format reste bien conforme au contrat d'intake OWK Factory après recalage.

Arnaud
