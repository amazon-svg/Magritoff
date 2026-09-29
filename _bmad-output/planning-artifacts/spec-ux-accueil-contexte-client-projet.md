# Spécification UX — Contexte client et projet de l’accueil Magrit

## Statut

Proposition à valider.

Date de cadrage : 10 septembre 2026.

Documents liés :

- [`story-hopstudio-pim-dual-workspace.md`](../implementation-artifacts/story-hopstudio-pim-dual-workspace.md) ;
- [`story-accueil-contexte-client-projet.md`](../implementation-artifacts/story-accueil-contexte-client-projet.md) ;
- contrat Gestion commerciale dans `openapi/magrit-core.v1.yaml`.

## Problème à résoudre

L’accueil permet aujourd’hui de décrire un besoin d’impression avant d’ouvrir
le workspace partagé HopeStudio/PIM. Cette demande n’est rattachée ni à un
client ni, éventuellement, à un projet.

Ce contexte ne peut pourtant pas rester implicite : le client détermine les
règles commerciales applicables, notamment les marges et les prix. Le projet
regroupe ensuite les recherches, configurations, devis et travaux relatifs à
une demande commerciale.

L’utilisateur doit donc toujours savoir :

1. pour quel client il travaille ;
2. dans quel projet il travaille, lorsqu’un projet est sélectionné ;
3. comment changer rapidement l’un ou l’autre sans perdre son travail.

## Décisions proposées

| Réf. | Décision |
|---|---|
| D1 | Un client courant valide est obligatoire avant toute demande envoyée à HopeStudio, tout calcul de prix ou toute création de projet. |
| D2 | Le projet courant est facultatif sur l’accueil. Certaines opérations aval, notamment la création d’un devis commercial, peuvent continuer à l’exiger. |
| D3 | Un projet appartient exactement à un client. Choisir un projet sélectionne automatiquement son client. |
| D4 | Changer de client retire le projet courant si celui-ci appartient à un autre client. Aucun contexte incohérent n’est toléré. |
| D5 | Le tenant peut désigner un client actif comme « client comptoir ». Ce choix est une configuration explicite, jamais un client créé ou deviné silencieusement par l’interface. |
| D6 | Au démarrage, Magrit tente dans l’ordre : dernier contexte valide de l’utilisateur, client comptoir du tenant, puis sélection obligatoire. |
| D7 | Un contexte restauré ou automatique reste toujours visible. Le client comptoir porte un libellé explicite « sélection automatique ». |
| D8 | Les dix projets actifs les plus récemment modifiés constituent le raccourci principal du sélecteur. |
| D9 | La recherche est exécutée côté serveur et paginée. Le navigateur ne charge jamais toute la base clients/projets. |
| D10 | Changer de contexte ne doit jamais réutiliser silencieusement une conversation HopeStudio appartenant au contexte précédent. |

### Arbitrage produit restant

La proposition D5/D6 combine les deux options envisagées : utiliser le client
comptoir quand le tenant en a explicitement choisi un, sinon forcer la
sélection. Si le produit décide finalement de toujours forcer le choix, D5 est
supprimée sans remettre en cause le reste de cette spécification.

## Modèle mental

Le contexte commercial comporte deux niveaux hiérarchiques :

```text
Tenant courant
└── Client courant                         obligatoire
    └── Projet courant                     facultatif
        └── Conversation / configuration   contexte de travail
```

Le client n’est pas un filtre d’affichage. Il fait partie de l’identité métier
de la demande. Le projet est un conteneur de travail situé sous ce client.

## Barre de contexte permanente

La barre est affichée sur l’accueil puis dans les modes `split`, `studio` et
`pim`. Elle reste visible lorsque les panneaux défilent.

### Desktop

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Client  Imprimerie Dupont ▾   Projet  Campagne été 2027 ▾  + Nouveau    │
└───────────────────────────────────────────────────────────────────────────┘
```

### Sans projet

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Client  Client comptoir · automatique ▾   Projet  Aucun projet ▾  + Nouveau│
└───────────────────────────────────────────────────────────────────────────┘
```

### Mobile

La barre utilise deux lignes et ne tronque jamais les deux valeurs au point de
les rendre indistinguables :

```text
Client   Imprimerie Dupont                              ▾
Projet   Campagne été 2027                         ▾   [+]
```

### Contenu et actions

- le nom affiché utilise la raison sociale pour une entreprise et
  `civilité + prénom + nom` pour un particulier ;
- le client comptoir reçoit un badge discret « Comptoir » ;
- un projet archivé ne peut pas rester contexte actif ;
- chaque valeur est un bouton ouvrant le même sélecteur, prépositionné sur la
  section correspondante ;
- « Nouveau projet » ouvre une création rapide avec le client courant
  prérempli ;
- aucun identifiant technique n’est présenté à l’utilisateur.

## Résolution du contexte au démarrage

```text
Ouverture de /t/:tenantSlug
        │
        ▼
Dernier contexte utilisateur encore valide ? ── oui ──► restaurer
        │ non
        ▼
Client comptoir actif configuré ? ───────────── oui ──► sélectionner le client
        │ non                                      sans projet
        ▼
Ouvrir le sélecteur bloquant
```

Un contexte est invalide si :

- le client n’existe plus dans le tenant ou est désactivé ;
- le projet n’existe plus, est archivé ou appartient à un autre client ;
- l’utilisateur n’a plus accès au tenant.

Si seul le projet est invalide, le client valide est conservé et l’accueil
continue sans projet. Si le client est invalide, aucune requête métier ne peut
être soumise avant une nouvelle sélection.

Pendant la résolution, l’accueil affiche un squelette compact de la barre et
désactive le composeur. Il ne doit pas montrer brièvement l’ancien chat ou un
client erroné.

## Sélecteur client et projet

Le sélecteur est un dialogue large sur desktop et une feuille plein écran sur
mobile.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Choisir le contexte                                            [×] │
│ [ Rechercher un client, un SIRET ou un projet…                  ] │
│                                                                     │
│ Projets récents                                                     │
│ Campagne été 2027       Imprimerie Dupont       modifié hier       │
│ Cartes collaborateurs   Agence Martin           modifié le 04/09   │
│ Brochure mairie         Ville de Lyon           modifié le 02/09   │
│                                                                     │
│ Clients                                                            │
│ Imprimerie Dupont       Entreprise                                  │
│ Agence Martin           Entreprise                                  │
│                                                                     │
│ [ + Nouveau client ]                         [ + Nouveau projet ]  │
└─────────────────────────────────────────────────────────────────────┘
```

### État initial sans recherche

- afficher au maximum dix projets actifs, triés par `updated_at` décroissant ;
- afficher le nom du client sur chaque ligne projet ;
- signaler le projet/client actuellement sélectionné ;
- afficher ensuite quelques clients récemment utilisés si cette donnée est
  disponible ; à défaut, ne pas présenter arbitrairement les derniers clients
  créés comme « récents » ;
- proposer « Travailler sans projet » lorsque le sélecteur a été ouvert depuis
  le champ Projet et qu’un client courant existe.

### État avec recherche

- démarrer la recherche après 250 à 350 ms sans nouvelle frappe ;
- rechercher simultanément les clients et les projets ;
- clients : raison sociale, prénom, nom et SIRET ;
- projets : nom du projet et nom du client ;
- grouper les résultats sous « Projets » et « Clients » ;
- limiter chaque groupe à dix résultats puis proposer « Afficher plus » ;
- annuler la requête précédente et ignorer toute réponse arrivée dans le
  désordre ;
- conserver la saisie en cas d’erreur et permettre « Réessayer ».

### Navigation clavier et accessibilité

- focus initial dans la recherche ;
- flèches haut/bas pour parcourir les résultats ;
- `Entrée` pour sélectionner ;
- `Échap` pour fermer uniquement si un client valide est déjà actif ;
- dialogue bloquant non fermable lorsqu’aucun client n’est sélectionné ;
- groupes et résultats annoncés avec une structure de combobox/listbox ;
- état de chargement et nombre de résultats annoncés dans une zone `aria-live` ;
- libellé accessible complet même lorsque le texte visible est tronqué.

## Création rapide d’un projet

Le formulaire minimal contient :

- nom du projet, obligatoire ;
- client, obligatoire et prérempli avec le client courant ;
- action « Créer et sélectionner ».

Après réussite :

1. le dialogue de création se ferme ;
2. le nouveau projet devient le projet courant ;
3. son client devient ou reste le client courant ;
4. la barre de contexte est mise à jour ;
5. le texte déjà saisi dans le composeur est conservé.

La création d’un client reste accessible, mais réutilise le formulaire complet
du module Clients. Après création, le client devient courant et l’utilisateur
peut immédiatement créer un projet pour lui.

## Changement de contexte et travail en cours

Trois états sont distingués :

| État | Comportement |
|---|---|
| Aucun travail commencé | Changement immédiat. |
| Texte saisi mais non envoyé | Le texte est conservé ; une confirmation légère indique qu’il sera envoyé dans le nouveau contexte. |
| Conversation/configuration déjà commencée | Confirmation obligatoire avant changement. |

Message recommandé :

> Changer de client démarrera un nouvel espace de travail. La conversation et
> les configurations en cours resteront associées à Imprimerie Dupont —
> Campagne été 2027.

Actions : « Annuler » et « Changer de contexte ».

Un changement confirmé :

- arrête ou détache proprement la session HopeStudio courante ;
- réinitialise la machine d’état du configurateur vers `home` ;
- ne réutilise pas `sessionRef`/`sessionDataRef` entre deux contextes ;
- conserve le contexte précédent dans l’historique ;
- mémorise le nouveau contexte comme dernier contexte utilisé.

## Effet sur les prix et marges

La barre rend visible le client dont les règles commerciales seront utilisées.
Le navigateur transmet les identifiants de contexte, mais ne choisit ni ne
recalcule la règle de prix : le backend conserve l’autorité.

Avant d’afficher un prix exploitable, le backend vérifie :

- que le client appartient au tenant courant et est actif ;
- que le projet, lorsqu’il est fourni, appartient au même client et est actif ;
- que les règles de prix/marge sont résolues pour ce client.

Un prix déjà affiché doit être marqué périmé ou retiré après un changement de
client jusqu’à son nouveau calcul.

## États d’erreur et cas limites

| Situation | Réponse UX |
|---|---|
| Aucun client dans le tenant | Sélecteur bloquant avec action principale « Créer le premier client ». |
| Client comptoir désactivé/supprimé | Ignorer ce défaut, ouvrir le sélecteur et prévenir un administrateur dans les réglages. |
| Projet archivé depuis un autre écran | Conserver son client, retirer le projet et afficher une notification. |
| Recherche indisponible | Conserver le contexte courant ; désactiver uniquement le changement et proposer de réessayer. |
| HopeStudio indisponible | Conserver et afficher le contexte ; le panneau PIM reste utilisable. |
| Client désactivé pendant une session | Bloquer tout nouveau calcul/enregistrement et demander un changement de client. |
| Projet d’un autre tenant injecté dans l’URL ou la requête | Rejet backend, aucune information sur la ressource étrangère. |

## Critères d’acceptation UX

1. Le client courant est visible sur tous les états de l’accueil et du
   workspace partagé.
2. Aucun prompt HopeStudio ni calcul de prix ne part sans client valide.
3. Le projet courant est visible lorsqu’il existe et clairement indiqué comme
   facultatif lorsqu’il n’existe pas.
4. Choisir un projet sélectionne son client dans la même interaction.
5. Changer de client retire automatiquement tout projet incompatible.
6. Le démarrage restaure le dernier contexte valide, puis utilise le client
   comptoir configuré, puis force une sélection.
7. Une sélection automatique du client comptoir est explicitement visible.
8. Le sélecteur affiche les dix projets actifs les plus récemment modifiés.
9. La recherche trouve un client par nom ou SIRET et un projet par nom de
   projet ou nom de client.
10. La recherche reste utilisable avec plusieurs milliers d’entrées grâce à la
    pagination serveur.
11. Un projet peut être créé et sélectionné sans quitter l’accueil ni perdre le
    prompt en cours.
12. Un changement de contexte après le début d’une conversation demande une
    confirmation.
13. Une session HopeStudio ne traverse jamais un changement de client/projet.
14. Les écrans clavier, mobile, chargement, vide et erreur sont couverts.
15. Le backend refuse tout couple client/projet incohérent ou hors tenant.

## Hors périmètre

- refonte des règles de prix et de marge elles-mêmes ;
- création automatique d’un devis dès le premier prompt ;
- fusion des entités Client et compte boutique ;
- synchronisation temps réel du même contexte entre plusieurs onglets ;
- recommandation automatique d’un client à partir du texte du prompt ;
- affichage d’un volume illimité de projets récents.

