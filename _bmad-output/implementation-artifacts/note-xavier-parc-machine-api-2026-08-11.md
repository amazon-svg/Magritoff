# Note à Xavier — le Parc machine passe en API-first

> 2026-08-11 · branche `feat/parc-machine-api` poussée sur `origin`, **non fusionnée**.
> Fait suite à ta réserve du 2026-08-10 : « la fusion ne vaut pas validation architecturale ».

---

Salut Xavier,

Tu avais posé, en acceptant la remontée `beta/v5` → `main`, que l'audit du Parc
machine contre tes frontières restait un chantier distinct. On l'a fait. Le
module ne parle plus à la base : il passe par un contrat d'API documenté.

Voilà ce qu'il y a à savoir, et les trois points sur lesquels j'attends ton avis.

## 1. Ce qui a changé

Le module livré le 08/08 était une maquette assumée : bibliothèque de machines
figée dans le code du navigateur, parcs enregistrés en `localStorage`. C'était
l'une des cinq dérogations R5 déclarées dans le message de fusion. Elle est
refermée.

| Avant | Maintenant |
|---|---|
| Bibliothèque de 70 modèles dans un tableau TypeScript | Table `machine_library`, référentiel partagé, servi par `GET /machine-library` |
| Listes papier / transport / sous-traitants en dur | Table `supplier_directory` — **référentiel Fournisseur unifié, BK-07** |
| Parcs en `localStorage`, par tenant | Tables `machine_parks` + `machine_park_machines`, RLS tenant-scopée |
| Le navigateur lisait tout | **Le navigateur ne touche plus aucune de ces tables** |

Le contrat : **[`docs/API_PARC_MACHINE.md`](../../docs/API_PARC_MACHINE.md)** v1.0.
7 routes, objets du domaine, table des erreurs, et un §6 qui donne le motif de
chaque décision de conception plutôt que la seule décision.

## 2. Les choix qui te concernent directement

**Le contrat est un fichier unique, partagé entre le front et le serveur.**
`src/server/park/contract.ts` est importé par le navigateur (Vite) *et* par
l'edge function (Deno), `zod` étant résolu des deux côtés via un import map.
Conséquence : il n'y a pas deux définitions du parc à tenir d'accord, et la règle
BK-17 n'a qu'une implémentation. Le bundler Deno embarque bien le fichier malgré
son chemin hors du dossier des fonctions — vérifié au déploiement.

**L'edge function n'utilise pas la clé de service.** Elle repasse le JWT de
l'appelant à la base, donc la RLS s'applique à chacune de ses requêtes. C'est
délibéré : une erreur de logique dans la couche serveur ne peut pas faire fuiter
le parc d'un imprimeur vers un autre, parce que c'est la base qui refuse. Le prix
assumé est que l'API ne peut rien faire que l'utilisateur ne puisse faire — aucun
besoin d'élévation n'existe dans ce domaine.

**Un trigger en plus de la RLS.** La RLS seule ne couvre pas le cas d'un membre
de *deux* espaces qui rattacherait une machine au parc de l'autre : il passerait
les deux clauses avec un `tenant_id` incohérent avec `park_id`. `mpm_tenant_guard`
l'interdit, et un test le prouve en `service_role`, donc hors RLS.

**Le remplacement d'un parc est intégral, jamais partiel.** Le wizard et l'écran
de détail manipulent le parc comme un tout ; un enregistrement partiel ouvrirait
la porte à un parc dont les machines appartiennent à deux versions.

**Les caractéristiques de machine sont recopiées dans le parc, pas référencées.**
Ce n'est pas un oubli de normalisation : le parc décrit un atelier réel à une
date donnée. Si le référentiel corrige la laize d'un modèle dans deux ans, le
parc de l'imprimeur ne doit pas se mettre à décrire une autre machine que la
sienne. `library_id` garde le lien pour les valeurs de prix par défaut, et passe
à `null` sans dommage si l'entrée disparaît.

## 3. BK-17 est couverte, pour la première fois

La règle « pas de massicot, pas de prix » bloquait la validation du parc depuis
le 08/08 sans qu'aucun test ne la tienne. Elle en a maintenant 26, plus 13
d'isolation RLS et 17 de recette contre le service déployé.

Trois cas méritent d'être signalés, parce qu'ils n'allaient de soi pour personne :

- **Un massicot *inactif* ne rend pas le parc calculable.** Une machine
  désactivée est exclue des calculs servis (BK-27) ; l'ignorer ferait promettre
  à l'écran un prix que le moteur refuserait.
- **`active` absent ou `null` vaut actif.** La base rend `null`, le wizard rend
  `undefined` : les deux devaient donner le même verdict.
- **`calculable` envoyé par un client est ignoré.** C'est une conclusion du
  serveur, pas une donnée. L'accepter reviendrait à laisser déclarer calculable
  un parc sans massicot.

À noter, parce que c'est souvent confondu : l'absence de **plieuse** n'est pas
bloquante. Elle déclenche une demande de confirmation, à cause du cas légitime de
la presse numérique avec groupe de pliage en ligne. C'est une question, pas un
refus.

## 4. Un constat qui dépasse ce module, et que je te dois

**Le dépôt n'avait aucune vérification de types.** Il est écrit intégralement en
`.ts` / `.tsx`, sans TypeScript installé ni `tsconfig.json` : `vite build`
transpile via esbuild, qui efface les types sans jamais les vérifier.

Ça s'est vu de la pire façon. Le Parc machine référençait une variable définie
dans un *autre* composant : build vert, 866 tests verts, et une `ReferenceError`
dès qu'on ouvrait l'écran. La première passe de typage a trouvé **cinq symboles
introuvables**, tous des pannes réelles à l'usage — Parc machine, Gestion
commerciale (création de règle de prix), compte acheteur (onglet Devis), et
l'enregistrement du visuel d'une gamme au PIM. Trois d'entre eux venaient de la
même intervention.

`typescript` est maintenant en dépendance de développement, avec un `tsconfig.json`
volontairement permissif (R5 — on ne reprend pas des dizaines de milliers de
lignes écrites sans filet) et un script `pnpm typecheck`. **Compteur : 79 → 32**,
zéro symbole introuvable. Les 32 restantes sont de la dette héritée sans effet au
runtime. Le script se lit donc aujourd'hui comme un compteur à faire baisser, pas
comme une barrière ; il deviendra bloquant en CI quand il atteindra zéro.

Je te le signale parce que c'est exactement le genre de garde-fou qui relève des
standards de code dont tu portes le chantier avec Laurent.

## 5. Ce sur quoi j'attends ton avis

**a) Le contrat v1.0 est-il validé ?** C'est le point de substitution : le jour
où le stockage rejoint Clariprint Data, c'est l'implémentation derrière ces
routes qui change, et le front ne bouge pas. Autant que la forme du contrat te
convienne maintenant plutôt qu'après. Les routes sont déjà nommées ressource +
action pour que la dérivation MCP (R3) soit mécanique le moment venu — sans rien
en implémenter, conformément à la règle.

**b) Quand et comment Clariprint Data reprend-il ce stockage ?** Le référentiel
machines et le référentiel Fournisseur unifié BK-07 sont, dans notre lecture, de
ton côté de la frontière. Ils sont aujourd'hui chez nous, seedés et servis. Dis-
nous si tu veux les récupérer tels quels, ou si ton modèle diffère — mieux vaut
le savoir avant que des imprimeurs y aient saisi leurs données.

**c) Le `Money` du noyau.** Les montants du parc restent des `number` flottants.
C'est délibéré : la bascule vers `{ minorUnits: bigint, currency }` est le
périmètre de la **tranche 2** de la refacto multi-devise, qui porte précisément
sur les coûts de production. La faire ici aurait mélangé deux chantiers. Reste à
caler avec toi le rythme d'adoption — notre proposition est tranche par tranche,
pas de bascule globale.

Et pour mémoire, **la règle d'arrondi reste ouverte** (par ligne ou sur le
total). Elle ne bloque pas cette tranche, mais elle bloque la tranche 3, et deux
règles produisent deux prix pour le même devis : c'est une décision commerciale
avant d'être technique.

## 6. Une limite déclarée

PostgREST n'ouvre pas de transaction sur plusieurs requêtes. Entre la suppression
et la réinsertion des machines d'un parc, il existe une fenêtre où le parc est vu
sans ses machines. Sur un écran de paramétrage utilisé par une poignée de
personnes, la conséquence est nulle. **Si le moteur de prix vient lire ces tables
en continu, il faudra une fonction SQL transactionnelle** — le contrat, lui, ne
changera pas. C'est tracé comme dérogation R5 avec son chemin de mise en
conformité.

## 7. Où regarder

| Quoi | Où |
|---|---|
| Contrat | `docs/API_PARC_MACHINE.md` |
| Schémas partagés + règle BK-17 | `src/server/park/contract.ts` |
| Couche serveur | `supabase/functions/park-api/index.ts` |
| Schéma et RLS | `supabase/migrations/20260811000100_machine_park_api.sql` |
| Rapport de tâche complet (R8) | `_bmad-output/implementation-artifacts/story-PARC-MACHINE-API-2026-08-11.md` |

La branche `feat/parc-machine-api` est poussée, **non fusionnée**. Migrations et
edge function sont en revanche **appliquées** sur `ightkxebexuzfjdbpsdg`, avec
recette jouée : build vert, 922 tests verts, les trois écrans vérifiés en
conditions réelles, zéro erreur console.

Dis-moi ce que tu en penses, en particulier sur les points 5.a et 5.b.

Arnaud
