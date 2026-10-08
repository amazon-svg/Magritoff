# Rôles et responsabilités

Les rôles d’approbation sont précisés par périmètre ci-dessous. Depuis le WM du 7 octobre 2026 (`PD-2026-10-07-GOUVERNANCE`), Arnaud Mazon et Xavier Péchoultres peuvent chacun approuver tout ce qui peut l’être dans le produit. Une attribution de responsabilité ne vaut pas approbation des artefacts : chaque passage au statut `approved` exige un accord explicite sur le contenu concerné.

| Activité | Responsable | Approbateur | Consulté |
|---|---|---|---|
| PRD, périmètre et règle métier | Rédacteur produit | Arnaud Mazon ou Xavier Péchoultres | Autorité technique si impact |
| Architecture et contrat | Rédacteur technique | Xavier Péchoultres ou Arnaud Mazon | Autorité produit si impact |
| Story et critères d'acceptation | Préparateur humain ou agent | Arnaud Mazon ou Xavier Péchoultres | Développeur et testeur |
| Implémentation et statut de livraison | Développeur | Relecteur distinct | Autorité technique |
| Compte rendu | Rédacteur de séance | Participants ou décideur | Propriétaires des artefacts |
| Propagation d'une décision | Gestionnaire du projet | Approbateur de l'artefact cible | Auteur de la décision |
| HopeStudio / Clariprint Studio : périmètre produit, critères et choix techniques | Xavier Péchoultres | Xavier Péchoultres | Équipe Magrit pour les impacts sur son intégration |

Un agent peut préparer, extraire et vérifier. Il ne s'attribue ni l'approbation produit ni l'approbation technique.


## Précision de Xavier le 5 octobre 2026

Xavier demande que son périmètre inclue la validation de points produit non structurants, en complément du rôle technique proposé. La répartition ne doit donc pas lui réserver exclusivement les décisions techniques.

Cette demande est enregistrée ; les frontières entre points non structurants et changements structurants restent à formaliser avec la répartition des responsabilités. Il ne faut pas déduire de cette précision une approbation générale des règles de droits, de tarification ou de périmètre produit, ni l’accord d’Arnaud sur sa nomination. Les points déjà arbitrés en réunion doivent être retrouvés et propagés avant d’être présentés comme de nouvelles décisions.

## Source de réunion retrouvée pour la supervision Git

Le [WM du 21 septembre 2026](../meetings/2026/CR_WM210926_Magrit_IA.md), §2.2, confie à Xavier la supervision des intégrations en fin de semaine et impose une revue humaine avant fusion. Cette responsabilité technique possède donc une source historique. Elle ne vaut pas, à elle seule, attribution des autorités d’approbation de toutes les spécifications : le WM du 1er octobre conserve ce point ouvert. Le périmètre produit non structurant demandé par Xavier doit être distingué et précisé.

## Périmètre HopeStudio déclaré par Xavier le 5 octobre 2026

Dans le chat de reprise, Xavier indique : « tout ce qui tourne autour de HopStudio est de mon ressort je pense ». Cette précision attribue à Xavier le pilotage et la validation produit et technique du périmètre HopeStudio / Clariprint Studio : bibliothèque JavaScript, contrats exposés, sessions, cartes et prix fournis, fichiers et interactions du widget. Les questions propres à ce périmètre lui sont adressées directement.

Pour les changements de l’intégration dans Magrit (relais, import, persistance et parcours), Xavier porte le cadrage HopeStudio ; les impacts sur les règles communes de Magrit sont examinés avec leur responsable. La politique commerciale du prix, les droits UM et le périmètre général Magrit conservent leur circuit propre. Une revue distincte du code reste requise avant fusion.

Xavier précise ensuite : « je dois pouvoir arbitrer les E1.WM* ». Il est donc l’autorité d’arbitrage et d’approbation produit et technique pour E1.WM1, E1.WM2 et E1.WM3 : périmètre, critères, frontière d’intégration et conditions de démarrage. Les équipes concernées sont consultées sur les impacts ; leur validation conjointe ne constitue plus un préalable à ses arbitrages. La revue distincte du code avant fusion reste applicable. Cette attribution ne vaut pas approbation automatique du contenu des trois stories.


## Décision du WM du 7 octobre 2026

[`PD-2026-10-07-GOUVERNANCE`](../decisions/product/PD-2026-10-07-gouvernance-approbation-depot.md) :

- Xavier Péchoultres dispose de manière permanente du droit d’approuver tout ce qui peut l’être dans le produit — spécifications, stories et fonctionnalités livrées. Arnaud Mazon conserve le même droit. Cette règle remplace la répartition « fonctionnel / technique » du 1er octobre et rend sans effet la frontière entre points structurants et non structurants évoquée le 5 octobre.
- Xavier Péchoultres reçoit les droits d’administration du dépôt GitHub au même titre qu’Arnaud Mazon. Le dépôt appartenant à un compte personnel, ce rôle suppose son transfert dans une organisation GitHub ; d’ici là, Arnaud Mazon active les règles de protection de branche.
- La revue distincte du code avant fusion reste requise. Un agent ne s’attribue toujours aucune approbation.
