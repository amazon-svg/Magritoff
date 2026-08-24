# PRD — Entités juridiques de facturation des clients boutique

**Statut :** Draft à valider  
**Date :** 17 août 2026  
**Périmètre :** Portail client des boutiques B2B et commandes boutique  
**Priorité proposée :** Haute  

## 1. Résumé

Permettre à un client authentifié sur une boutique B2B de créer et gérer une ou plusieurs entités juridiques de facturation, comprenant notamment sa raison sociale, son SIREN et son numéro de TVA intracommunautaire.

Lorsqu'au moins une entité active est définie pour le compte client, le client peut — et doit — choisir l'entité à facturer avant de confirmer une commande. Les informations sélectionnées sont copiées sur la commande au moment de sa création afin de préserver l'historique de facturation, même si l'entité est modifiée ultérieurement.

## 2. Contexte et problème

Le portail boutique permet aujourd'hui à un client B2B authentifié de passer et de consulter des commandes. La commande est rattachée à son identité cliente, mais elle ne porte pas d'identité juridique de facturation explicite.

Cette limite pose plusieurs problèmes :

- un même utilisateur peut acheter pour plusieurs sociétés, filiales ou établissements ;
- l'équipe qui traite la commande ne sait pas toujours quelle société facturer ;
- le SIREN et le numéro de TVA peuvent être transmis hors outil, avec un risque d'erreur ou d'oubli ;
- une modification ultérieure du profil ne doit pas réécrire les informations historiques d'une commande déjà passée.

## 3. Objectifs produit

1. Centraliser les informations juridiques nécessaires à la facturation d'un client boutique.
2. Permettre à un compte client de gérer plusieurs entités juridiques.
3. Rendre le choix de l'entité explicite lors de la commande dès qu'une entité existe.
4. Garantir la traçabilité des données de facturation utilisées à la date de la commande.
5. Préparer l'exploitation des données par l'administration, la facturation et de futurs exports ou connecteurs de gestion.

## 4. Non-objectifs de la V1

La V1 ne couvre pas :

- la génération d'une facture comptable ou d'un avoir ;
- la vérification automatique du SIREN auprès de l'INSEE/Sirene ;
- la validation automatique du numéro de TVA via VIES ;
- la gestion de moyens ou de délais de paiement ;
- la gestion d'adresses de livraison multiples ;
- la synchronisation avec un ERP ou un logiciel comptable ;
- la définition de règles de prix propres à une entité juridique ;
- la modification de l'entité de facturation après confirmation de la commande par le client.

## 5. Utilisateurs concernés

### Client boutique

Il crée, consulte et modifie les entités de facturation rattachées à son compte dans la boutique. Il choisit l'entité à facturer au checkout.

### Utilisateur Magrit en délégation

Lorsqu'il agit au nom d'un client boutique, il voit et sélectionne les mêmes entités que ce client. Son identité Magrit reste tracée séparément comme acteur de l'action.

### Administrateur ou gestionnaire de la boutique

Il consulte l'entité retenue sur une commande. La création ou la modification d'une entité au nom du client est hors périmètre V1, sauf arbitrage contraire.

## 6. Principes fonctionnels

### 6.1 Propriété et cloisonnement

- Une entité juridique appartient à un compte client dans une boutique précise.
- Elle n'est pas automatiquement partagée avec les autres comptes, même si leur adresse email ou leur SIREN est identique.
- Un client ne peut jamais lire ou modifier les entités d'un autre compte.
- Une entité utilisée sur une commande ne peut pas être supprimée physiquement ; elle peut seulement être archivée.

### 6.2 Données d'une entité

Champs proposés pour la V1 :

| Champ | Obligatoire | Règle |
|---|---:|---|
| Raison sociale | Oui | 2 à 200 caractères |
| Nom d'affichage | Non | 1 à 100 caractères ; utile pour distinguer plusieurs entités |
| SIREN | Oui pour une société française | Exactement 9 chiffres après suppression des espaces |
| Numéro de TVA intracommunautaire | Conditionnel | Obligatoire si l'entité est assujettie et dispose d'un numéro ; format pays + caractères autorisés |
| Pays | Oui | Code pays ISO 3166-1 alpha-2 ; `FR` par défaut |
| Adresse de facturation — ligne 1 | Oui | 1 à 200 caractères |
| Adresse de facturation — ligne 2 | Non | 200 caractères maximum |
| Code postal | Oui | 20 caractères maximum, validation adaptée au pays |
| Ville | Oui | 1 à 120 caractères |
| Email de facturation | Non | Email valide ; utilisé ultérieurement pour l'envoi de factures |
| Entité par défaut | Non | Une seule entité par défaut par compte et par boutique |
| Statut | Oui | Active ou archivée |

Le SIREN est spécifique à la France. Pour une entité étrangère, un champ `identifiant légal` pourra remplacer le SIREN. En V1, l'interface masque ou rend facultatif le SIREN lorsque le pays n'est pas `FR`.

### 6.3 Création et gestion

Depuis **Mon compte > Mon profil**, le client dispose d'un bloc « Entités de facturation » lui permettant de :

- voir ses entités actives ;
- ajouter une entité ;
- modifier une entité ;
- définir une entité par défaut ;
- archiver une entité qui ne doit plus être proposée au checkout.

La première entité créée devient l'entité par défaut. Définir une nouvelle entité par défaut retire automatiquement ce statut à l'ancienne.

### 6.4 Choix au checkout

- Si aucune entité n'est définie, le comportement actuel est conservé : le client peut commander sans entité de facturation en V1.
- Si une seule entité active existe, elle est présélectionnée et ses informations essentielles sont affichées.
- Si plusieurs entités actives existent, l'entité par défaut est présélectionnée ; à défaut, aucune ne l'est.
- Dès qu'au moins une entité active existe, une entité doit être sélectionnée pour activer le bouton « Commander ».
- Le client peut ouvrir la création d'une nouvelle entité depuis le checkout sans perdre son panier.
- Une entité archivée n'est plus proposée pour une nouvelle commande.

### 6.5 Conservation sur la commande

Au moment de la confirmation, la commande conserve :

- l'identifiant de l'entité choisie ;
- une copie figée de toutes ses informations juridiques et de son adresse de facturation ;
- la date de la copie.

La copie figée est la référence pour la facturation de cette commande. Une modification ultérieure de l'entité n'altère jamais les commandes existantes.

En cas d'archivage de l'entité, les commandes historiques restent lisibles avec leur copie figée.

## 7. Parcours utilisateur

### Parcours A — Création depuis Mon profil

1. Le client ouvre **Mon compte > Mon profil**.
2. Il choisit « Ajouter une entité de facturation ».
3. Il renseigne les informations obligatoires.
4. Les erreurs de format sont affichées au niveau des champs.
5. Il enregistre.
6. L'entité apparaît dans la liste et devient l'entité par défaut si elle est la première.

### Parcours B — Commande avec une entité existante

1. Le client ouvre le checkout avec un panier non vide.
2. Le bloc « Facturer à » affiche les entités actives.
3. L'entité par défaut est présélectionnée lorsqu'elle existe.
4. Le client vérifie ou change son choix.
5. Il confirme la commande.
6. La commande est créée avec l'identifiant et la copie figée de l'entité choisie.
7. La page de confirmation rappelle la raison sociale facturée.

### Parcours C — Création depuis le checkout

1. Le client choisit « Ajouter une entité » dans le bloc « Facturer à ».
2. Il complète le formulaire sans quitter le checkout.
3. Après enregistrement, la nouvelle entité est automatiquement sélectionnée.
4. Le panier, les quantités et le calcul des totaux sont conservés.

### Parcours D — Commande en délégation

1. Un utilisateur Magrit ouvre une session déléguée pour un compte client.
2. Il voit uniquement les entités de ce compte client.
3. Il sélectionne l'entité et confirme la commande.
4. La commande trace à la fois le compte client, l'entité facturée et l'utilisateur Magrit ayant agi.

## 8. Règles de validation

### SIREN

- normaliser en supprimant espaces, points et tirets ;
- stocker uniquement 9 chiffres ;
- refuser toute autre longueur pour une entité française ;
- appliquer le contrôle de cohérence Luhn ;
- ne pas promettre que ce contrôle confirme l'existence juridique de l'entreprise.

### Numéro de TVA

- normaliser en majuscules et supprimer les espaces ;
- accepter un préfixe pays de deux lettres suivi de 2 à 13 caractères alphanumériques ;
- appliquer une validation française plus stricte lorsque le pays est `FR` ;
- indiquer clairement qu'il s'agit d'un contrôle de format en l'absence de vérification VIES.

### Doublons

- avertir si une autre entité active du même compte possède le même pays et le même identifiant légal ;
- empêcher le doublon exact dans un même compte boutique ;
- autoriser le même SIREN pour des comptes clients distincts, car ils peuvent représenter plusieurs acheteurs de la même société.

## 9. Exigences UX et accessibilité

- Le bloc de facturation est visible dans le récapitulatif avant le bouton « Commander ».
- Une sélection ne repose pas uniquement sur la couleur : radio, coche et libellé explicite sont nécessaires.
- Les erreurs sont liées aux champs avec un message actionnable.
- Le formulaire est utilisable au clavier et compatible lecteur d'écran.
- Le statut obligatoire du choix est annoncé lorsque le bouton est désactivé.
- Sur mobile, le formulaire et le sélecteur restent dans un parcours sur une seule colonne.
- Aucune donnée juridique sensible ne doit être écrite dans les logs applicatifs ou les messages d'erreur techniques.

## 10. Modèle de données cible

### Entité juridique de facturation

Relation logique :

`boutique → compte client boutique → entités de facturation`

Attributs structurants :

- identifiant technique ;
- compte client boutique propriétaire ;
- boutique, pour renforcer le cloisonnement et les contraintes d'intégrité ;
- données juridiques et adresse ;
- indicateur par défaut ;
- dates de création et modification ;
- date d'archivage nullable.

### Commande

Attributs ajoutés :

- identifiant d'entité de facturation nullable ;
- snapshot JSON ou colonnes de snapshot dédiées, non nulles lorsque l'identifiant est présent ;
- date de capture.

Le serveur doit vérifier dans la même transaction que l'entité choisie :

1. appartient au compte client résolu par la session storefront ;
2. appartient à la boutique de la commande ;
3. est active ;
4. est copiée sur la commande avant validation de la transaction.

Le client ne transmet jamais directement le snapshot : il transmet seulement l'identifiant. Le serveur relit et copie les données de référence pour éviter toute falsification.

## 11. API fonctionnelle attendue

Les opérations suivantes doivent être disponibles pour l'identité storefront courante :

- lister les entités actives et, dans Mon profil, les entités archivées ;
- créer une entité ;
- modifier une entité active ;
- définir l'entité par défaut ;
- archiver une entité ;
- inclure l'identifiant sélectionné dans la création de commande.

Toutes les opérations sont autorisées à partir de la session storefront, y compris en délégation, et ne prennent jamais un identifiant de compte client fourni librement par le navigateur.

## 12. Critères d'acceptation

### AC1 — Création

**Étant donné** un client boutique authentifié  
**Quand** il enregistre une entité avec des informations valides  
**Alors** l'entité est rattachée à son compte et apparaît dans Mon profil.

### AC2 — Validation française

**Étant donné** une entité dont le pays est la France  
**Quand** le SIREN ne contient pas 9 chiffres ou échoue au contrôle Luhn  
**Alors** l'enregistrement est refusé avec une erreur explicite sur le champ SIREN.

### AC3 — Isolation

**Étant donné** deux comptes clients de la même boutique  
**Quand** le premier consulte ou modifie ses entités  
**Alors** aucune entité du second compte n'est visible ni modifiable.

### AC4 — Première entité par défaut

**Étant donné** un compte sans entité  
**Quand** il crée sa première entité  
**Alors** celle-ci devient automatiquement l'entité par défaut.

### AC5 — Sélection obligatoire conditionnelle

**Étant donné** un compte possédant au moins une entité active  
**Quand** aucune entité n'est sélectionnée au checkout  
**Alors** la commande ne peut pas être confirmée et un message explique l'action attendue.

### AC6 — Présélection

**Étant donné** un compte possédant une entité par défaut active  
**Quand** il ouvre le checkout  
**Alors** cette entité est présélectionnée.

### AC7 — Snapshot immuable

**Étant donné** une commande passée avec une entité  
**Quand** cette entité est ensuite modifiée ou archivée  
**Alors** les informations de facturation visibles sur la commande restent celles capturées lors de sa création.

### AC8 — Contrôle serveur

**Étant donné** un identifiant d'entité appartenant à un autre compte ou à une autre boutique  
**Quand** il est envoyé avec une création de commande  
**Alors** le serveur refuse la commande sans révéler les données de l'entité.

### AC9 — Idempotence

**Étant donné** une nouvelle tentative avec la même clé d'idempotence  
**Quand** la commande initiale a déjà été créée  
**Alors** aucune seconde commande n'est créée et le résultat retourne la même entité de facturation capturée.

### AC10 — Délégation

**Étant donné** une session Magrit déléguée  
**Quand** une commande est passée avec une entité du compte délégué  
**Alors** la commande trace le compte, l'entité et l'acteur Magrit.

### AC11 — Aucune entité

**Étant donné** un compte ne possédant aucune entité active  
**Quand** il confirme sa commande  
**Alors** le parcours actuel reste disponible et la commande porte une entité de facturation nulle.

### AC12 — Création au checkout

**Étant donné** un panier en cours  
**Quand** le client crée une entité depuis le checkout  
**Alors** le panier est conservé et la nouvelle entité est sélectionnée.

## 13. Indicateurs de succès

À mesurer après mise en production :

- taux de commandes B2B portant une entité de facturation ;
- taux d'échec de création lié à la validation SIREN/TVA ;
- taux de commandes nécessitant une correction manuelle de l'identité facturée ;
- part des comptes possédant plusieurs entités ;
- temps médian entre l'ouverture du checkout et la confirmation ;
- nombre de tickets support liés aux informations de facturation.

Objectif initial proposé : au moins 80 % des commandes de comptes ayant configuré une entité sont confirmées sans correction manuelle de facturation.

## 14. Risques et réponses

| Risque | Réponse proposée |
|---|---|
| Données juridiques erronées malgré un format valide | Afficher « format vérifié » sans revendiquer une validation officielle ; prévoir VIES/Sirene ultérieurement |
| Modification rétroactive d'une société | Snapshot serveur immuable sur chaque commande |
| Accès croisé entre clients | Résolution du compte par session, politiques d'accès DB et tests d'isolation |
| Checkout alourdi | Présélection de l'entité par défaut et création inline concise |
| Entités en doublon | Contrainte d'unicité par compte + avertissement UX |
| Commande déjà engagée avec mauvaise entité | Interdire la modification côté client après confirmation ; prévoir un workflow support séparé |

## 15. Découpage recommandé

### Lot 1 — Fondation et sécurité

- modèle de données des entités ;
- règles d'accès et opérations serveur ;
- validation SIREN/TVA ;
- tests d'isolation et de délégation.

### Lot 2 — Gestion dans Mon profil

- liste, création, modification, défaut et archivage ;
- états vides, erreurs et accessibilité.

### Lot 3 — Intégration commande

- sélection au checkout ;
- contrôle transactionnel et snapshot ;
- restitution dans le récapitulatif, la confirmation et le détail de commande ;
- tests d'idempotence et de non-régression.

## 16. Arbitrages produit à valider

1. **Commande sans entité :** la proposition V1 conserve le parcours actuel si aucune entité n'existe. Faut-il au contraire rendre la création d'une entité obligatoire pour toutes les commandes B2B ?
2. **Gestion par l'administrateur :** un gestionnaire boutique doit-il pouvoir créer ou corriger une entité au nom d'un client ?
3. **Portée de partage :** une entité doit-elle rester propre à un compte, ou être partageable entre plusieurs utilisateurs d'une même société dans la même boutique ?
4. **Adresse :** l'adresse complète de facturation est incluse dans ce PRD car elle sera nécessaire à une facture. Confirmer qu'elle entre bien dans la V1.
5. **Numéro de TVA :** confirmer que « compte TVA » désigne bien le numéro de TVA intracommunautaire.
6. **Validation externe :** souhaite-t-on intégrer VIES et/ou l'API Sirene dès la V1, malgré leur disponibilité et leurs délais variables ?

## 17. Définition de terminé

La fonctionnalité est terminée lorsque :

- tous les critères d'acceptation sont couverts par des tests automatisés adaptés ;
- les parcours direct et délégué sont testés ;
- les contrôles d'accès empêchent toute lecture ou mutation inter-comptes ;
- une commande conserve un snapshot exact et immuable ;
- le checkout reste utilisable sur mobile et au clavier ;
- la documentation utilisateur du portail acheteur est mise à jour ;
- les arbitrages de la section 16 ont été tranchés et reflétés dans les règles finales.
