# Contrat d'API — domaine « Parc machine »

> **Version 1.0** — 2026-08-11. Opposable.
> Règle de rattachement : **R1 (API-first, bloquant)** de [REGLES_ARCHITECTURE.md](REGLES_ARCHITECTURE.md).
> Périmètre fonctionnel : les **moyens de production** d'un imprimeur — machines,
> fournisseurs, modèle de coût. Les **prix de vente** ne sont pas ici : ils
> relèvent de Gestion commerciale (frontière BK-RP070826-24).

---

## 0. Pourquoi ce document existe, et dans cet ordre

R1 dit : « avant d'écrire un écran, écrire et documenter l'API qui l'alimente. »

Ici l'écran existait déjà — livré le 2026-08-08 comme **maquette fonctionnelle**,
avec une bibliothèque de machines figée dans le code et une persistance en
`localStorage`. Le contrat est donc **rétro-documenté** : il part de ce que
l'écran fait réellement, le fige, puis l'implémente. C'est une dérogation R5
assumée sur l'ordre, pas sur le résultat — à la fin de l'opération, le front ne
parle plus à la base, et plus rien de nouveau n'est écrit hors contrat.

Ce contrat est aussi le **point de substitution** : le jour où le stockage
rejoint Clariprint Data côté Expert Solutions, c'est l'implémentation qui change
derrière ces mêmes routes. Le front n'a rien à savoir de ce déménagement.

---

## 1. Transport, authentification, portée

| Élément | Valeur |
|---|---|
| Base | `{SUPABASE_URL}/functions/v1/park-api` |
| Format | JSON, UTF-8 |
| Authentification | `Authorization: Bearer <access_token>` — le JWT de la session Supabase de l'utilisateur |
| Isolation | Le jeton de l'appelant est **repassé à la base**. Les politiques RLS s'appliquent donc telles quelles : l'API ne peut pas voir plus que l'utilisateur. Aucun appel n'utilise la clé de service. |
| Langue des messages d'erreur | français, destinés à l'affichage |

**Conséquence à retenir** : la sécurité ne repose pas sur la bonne foi de la
couche serveur. Même une erreur de code dans l'API ne peut pas faire fuiter le
parc d'un imprimeur vers un autre — c'est la base qui refuse.

`tenantId` est **obligatoire** sur toutes les routes de parc. Il n'est pas
déduit : un utilisateur peut appartenir à plusieurs espaces, et c'est l'écran
qui sait lequel est ouvert. Un `tenantId` auquel l'appelant n'a pas accès
renvoie une collection vide ou `403`, jamais les données d'un autre.

---

## 2. Objets du domaine

### 2.1 `LibraryMachine` — une entrée du référentiel de machines

Référentiel **partagé entre tous les imprimeurs**, en lecture seule.

| Champ | Type | Obligatoire | Sens |
|---|---|---|---|
| `id` | `string` | oui | Identifiant stable du modèle (`off-hd-sm52-4`) |
| `type` | `MachineTypeKey` | oui | `offset` · `numerique` · `grand_format` · `roto` · `decoupe` · `pliage` · `massicot` · `finition` |
| `family` | `string` | oui | Sous-famille de tri du sélecteur (« Demi-format (52×74) ») |
| `rank` | `number` | oui | Rang de popularité **dans sa famille**, 1 = la plus vendue |
| `brand` | `string` | oui | Marque |
| `model` | `string` | oui | Modèle |
| `format` | `string` | oui | Format papier max, ou laize |
| `colors` | `number?` | non | Nombre de groupes |
| `varnish` | `boolean?` | non | Groupe vernis |
| `priceDefaults` | `Record<string, number>?` | non | Valeurs par défaut **du modèle** pour les paramètres de prix |

> **Le référentiel n'a pas de devise.** `priceDefaults` porte des nombres nus.
> Un coût plaque de 8 s'affiche « 8 €/plaque » chez un imprimeur en euros et
> « 8 $/plaque » chez un imprimeur en dollars — c'est l'affichage qui libelle,
> jamais le référentiel. Y écrire un symbole rendrait le référentiel non
> partageable, ce qui est exactement le défaut que la tranche 1 multi-devise a
> supprimé ailleurs.

### 2.2 `SupplierRef` — une entrée du référentiel Fournisseur unifié (BK-07)

| Champ | Type | Obligatoire | Sens |
|---|---|---|---|
| `id` | `string` | oui | uuid |
| `kind` | `'paper' \| 'transport' \| 'subcontractor'` | oui | Nature du fournisseur |
| `name` | `string` | oui | Raison sociale telle qu'affichée |
| `scope` | `'shared' \| 'tenant'` | oui | `shared` = référentiel commun · `tenant` = ajouté par cet imprimeur |

Une seule table pour les trois natures : c'est le sens de « **unifié** » dans
BK-07. Un sous-traitant qui devient fournisseur de papier est la même entité,
pas deux fiches à tenir en cohérence.

### 2.3 `ParkMachine` — une machine installée dans un parc

| Champ | Type | Obligatoire | Sens |
|---|---|---|---|
| `id` | `string` | oui (en lecture) | uuid attribué par le serveur |
| `libraryId` | `string \| null` | oui | Modèle du référentiel dont elle dérive |
| `type` `brand` `model` `format` | `string` | oui | Recopiés à l'ajout — **volontairement figés** (voir §6) |
| `colors` `varnish` | `number?` `boolean?` | non | Idem |
| `location` | `'interne' \| 'externe' \| null` | oui | **`null` est une valeur légitime** (BK-09) |
| `subcontractor` | `string?` | non | Nom libre, alimenté par autocomplétion (BK-10) |
| `transportCost` | `number?` | non | Coût de transport lié à l'externalisation. **Zéro admis** (BK-13) |
| `fixedCost` | `number?` | non | Coûts fixes d'externalisation, distincts du transport (BK-13) |
| `hourlyRate` | `number?` | non | Taux horaire propre. Absent = taux du parc (BK-22) |
| `active` | `boolean?` | non | `false` = exclue des calculs servis (BK-27). Défaut `true` |
| `params` | `Record<string, number>?` | non | Saisies utilisateur des paramètres de prix |

### 2.4 `MachinePark` — un parc

| Champ | Type | Obligatoire | Sens |
|---|---|---|---|
| `id` | `string` | oui (en lecture) | uuid attribué par le serveur |
| `name` | `string` | oui | Nom donné par l'imprimeur |
| `machines` | `ParkMachine[]` | oui | Peut être vide |
| `paperSuppliers` | `string[]` | oui | Noms retenus (BK-18) |
| `transportSuppliers` | `string[]` | oui | Noms retenus (BK-18) |
| `inks` | `{ type: string; costPerKg: number }[]` | oui | BK-19 |
| `laborRate` | `number` | oui | Taux horaire main-d'œuvre (BK-22) |
| `energyRate` | `number` | oui | Coût kWh (BK-22) |
| `wizardVariant` | `'A' \| 'B' \| null` | non | Parcours utilisé — donnée d'arbitrage BK-15 |
| `wizardClicks` | `number \| null` | non | Nombre de clics — critère d'arbitrage BK-15 |
| `completedAt` | `string \| null` | non | ISO 8601 |
| `calculable` | `boolean` | **en lecture seule** | Calculé par le serveur, voir §3 |

**`calculable` n'est jamais accepté en écriture.** C'est une conclusion, pas une
donnée : l'envoyer serait autoriser un client à déclarer calculable un parc qui
ne l'est pas.

Un imprimeur peut avoir **plusieurs parcs** (sites, ateliers, lignes).

---

## 3. La règle métier BK-17, et où elle vit

> **Un parc sans massicot ne peut produire aucun prix.**

Tout ce qui s'imprime se coupe. Sans poste de massicotage déclaré, la chaîne de
production est incomplète et le moteur de prix n'a pas de quoi conclure. La
règle bloque donc la validation du parc dans le wizard, et marque le parc dans
la liste.

Elle est portée par **une seule fonction**, `parkIsCalculable(park)`, définie
dans `src/server/park/contract.ts` et importée **à la fois** par l'API et par le
front. Il n'y a pas deux implémentations à tenir d'accord.

- Le serveur l'évalue et renvoie `calculable` sur chaque parc lu : c'est lui qui
  fait autorité.
- Le front l'évalue aussi, sur le parc **en cours de constitution** dans le
  wizard, avant tout enregistrement — sinon la validation ne pourrait rien dire
  tant que rien n'est enregistré.

Distinction voisine, à ne pas confondre : l'**absence de plieuse** n'est pas
bloquante. Elle est *suspecte* et déclenche une demande de confirmation, parce
qu'il existe un cas parfaitement légitime — une presse numérique avec groupe de
pliage en ligne. C'est une question, pas un refus.

---

## 4. Routes

### 4.1 Référentiels

#### `GET /machine-library`

Paramètres : `type` (facultatif) — restreint à un type de machine.

```json
{ "machines": [ { "id": "off-hd-sm52-4", "type": "offset", "...": "" } ] }
```

#### `GET /suppliers`

Paramètres : `kind` (facultatif) `paper|transport|subcontractor` · `tenantId`
(facultatif — inclut les fournisseurs propres à cet imprimeur en plus du
référentiel commun).

```json
{ "suppliers": [ { "id": "…", "kind": "paper", "name": "Antalis", "scope": "shared" } ] }
```

### 4.2 Parcs

#### `GET /parks?tenantId=<uuid>`

```json
{ "parks": [ { "id": "…", "name": "Parc principal", "calculable": true, "...": "" } ] }
```

Un imprimeur sans parc reçoit `{ "parks": [] }` — **pas une erreur**.

#### `GET /parks/<parkId>?tenantId=<uuid>`

`404` avec `{ "error": { "code": "not_found", … } }` si le parc n'existe pas ou
n'appartient pas à cet espace. **Les deux cas renvoient la même réponse** : une
distinction révélerait l'existence du parc d'un autre imprimeur.

#### `POST /parks`

Crée ou remplace un parc. Corps :

```json
{ "tenantId": "<uuid>", "park": { "id": "<uuid|null>", "name": "…", "machines": [], "...": "" } }
```

- `park.id` absent ou `null` → création, le serveur attribue l'identifiant.
- `park.id` présent → **remplacement complet** du parc et de ses machines.

Le remplacement est intégral et non partiel : le wizard et l'écran de détail
manipulent le parc comme un tout, et un enregistrement partiel ouvrirait la
porte à des états intermédiaires incohérents (un parc dont les machines
appartiennent à deux versions). Les machines absentes du corps sont supprimées.

Réponse `200` : `{ "park": { … } }`, avec les identifiants attribués et
`calculable` recalculé.

#### `PUT /parks`

Remplace **toute la collection** de l'espace. Corps :
`{ "tenantId": "<uuid>", "parks": [ … ] }`. Les parcs absents sont supprimés.

Route de reprise en masse (restauration, import). L'écran ne s'en sert pas au
quotidien : c'est `POST /parks` qui porte l'enregistrement courant.

#### `DELETE /parks/<parkId>?tenantId=<uuid>`

`{ "deleted": true }`. Idempotent : supprimer un parc déjà supprimé renvoie
`200`, pas `404`.

---

## 5. Erreurs

Enveloppe unique :

```json
{ "error": { "code": "…", "message": "Message en français, affichable." } }
```

| HTTP | `code` | Quand |
|---|---|---|
| 400 | `invalid_payload` | Corps non conforme au schéma. `message` nomme le champ fautif |
| 401 | `unauthenticated` | Jeton absent, expiré ou illisible |
| 403 | `forbidden_tenant` | L'appelant n'est pas membre de l'espace demandé |
| 404 | `not_found` | Parc inexistant **ou** hors de la portée de l'appelant |
| 405 | `method_not_allowed` | Route connue, verbe non prévu |
| 500 | `internal` | Défaut serveur. `message` reste générique, le détail va au journal |

---

## 6. Décisions de conception, et leur motif

**Les caractéristiques de la machine sont recopiées dans le parc, pas
référencées.** `brand`, `model`, `format`, `colors` sont dupliqués depuis le
référentiel au moment de l'ajout. Ce n'est pas un oubli de normalisation : le
parc décrit un **atelier réel à une date donnée**. Si le référentiel corrige la
laize d'un modèle deux ans plus tard, le parc de l'imprimeur ne doit pas se
mettre à décrire une autre machine que la sienne. `libraryId` conserve le lien
d'origine pour les valeurs par défaut de prix, et devient `null` sans dommage si
l'entrée du référentiel disparaît.

**Le remplacement est intégral, pas partiel.** Voir `POST /parks`.

**`location = null` est un état de premier rang.** L'arbitrage de séance
(BK-09) a donné la priorité au setup rapide : on déclare son parc en quelques
minutes, on qualifie interne/externe ensuite. Une API qui exigerait la
qualification à l'écriture contredirait l'arbitrage.

**Les montants restent des `number`.** Le passage en `Money` (entier en unités
mineures + code devise) est le périmètre de la **tranche 2** de la refacto
multi-devise, précisément centrée sur les coûts de production. Le contrat
changera à ce moment-là, et c'est voulu : le faire ici mélangerait deux
chantiers. La devise du parc est celle de l'imprimeur (`tenants.currency`) et
n'est donc pas répétée sur chaque montant.

**Pas de pagination.** Un imprimeur a des unités, pas des milliers de parcs, et
un parc a des dizaines de machines. Une pagination ici serait de la complexité
sans emploi. À rouvrir si un jour un compte dépasse la centaine de parcs.

---

## 7. Ce que le contrat ne couvre pas encore

| Sujet | Pourquoi c'est hors périmètre |
|---|---|
| Vocabulaire MCP du module | **R3** — à ne pas anticiper tant que R1 et R2 ne sont pas satisfaites. Les routes sont déjà nommées ressource + action pour que la dérivation soit mécanique le moment venu |
| Écriture dans le référentiel machines | Lecture seule côté imprimeur. L'alimentation relève de Clariprint Data |
| Calcul de prix à partir du parc | Autre domaine. Le parc fournit les moyens de production ; le moteur de prix les consomme |
| Historique et versions d'un parc | Le parc est un état courant. L'historisation n'a pas été demandée |

---

## 8. Journal des versions

| Version | Date | Changement |
|---|---|---|
| 1.0 | 2026-08-11 | Contrat initial, rétro-documenté depuis la maquette du 2026-08-08 puis implémenté (edge function `park-api`, migration `20260811000100`) |
