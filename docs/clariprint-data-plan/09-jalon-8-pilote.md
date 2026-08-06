# J8 — Sécurisation, exploitation et validation pilote

**Statut initial :** à préparer  
**Dépendances :** J0 à J7

## Goal

Démontrer que le MVP est sûr, exploitable et utilisable par un métier sur un parc réel sans intervention directe en base.

## Périmètre

- tests de sécurité et d'isolation ;
- tests du workflow complet ;
- observabilité ;
- performance sur la volumétrie pilote ;
- accessibilité des parcours critiques ;
- documentation utilisateur et support ;
- recette métier ;
- décision de lancement ou de correction.

## Livrables

1. Plan et rapport de recette.
2. Matrice exigences PRD vers preuves.
3. Tableau de bord des erreurs, validations, publications et livraisons.
4. Procédure de diagnostic d'une impossibilité de calcul.
5. Guides utilisateur technique, financier et publieur.
6. Rapport sécurité/RLS.
7. Mesures de performance du corpus pilote.
8. Liste des écarts acceptés, correctifs requis et fonctionnalités reportées.

## Critères de validation fonctionnels

- [ ] `J8-VAL-01` Un utilisateur crée le parc de référence sans accès direct à la base.
- [ ] `J8-VAL-02` Le flux pilote complet est représenté et validé.
- [ ] `J8-VAL-03` Les incohérences majeures sont présentées avant publication.
- [ ] `J8-VAL-04` Une version immuable est publiée et exportée.
- [ ] `J8-VAL-05` Le solveur de test accepte l'export.
- [ ] `J8-VAL-06` Une modification datée n'altère pas les publications antérieures.
- [ ] `J8-VAL-07` Une machine désactivée reste visible dans les historiques concernés.
- [ ] `J8-VAL-08` Deux publications sont comparables.
- [ ] `J8-VAL-09` Un sandbox ne modifie jamais la production.
- [ ] `J8-VAL-10` Le fournisseur multi-capacités et le contrat de sous-traitance pilote fonctionnent sans exposition excessive.

## Critères de validation sécurité

- [ ] `J8-SEC-01` Aucun scénario cross-tenant testé ne réussit.
- [ ] `J8-SEC-02` Un profil technique ne peut ni lire ni modifier les coûts protégés.
- [ ] `J8-SEC-03` Seul un publieur autorisé peut publier.
- [ ] `J8-SEC-04` Une publication ne peut être modifiée par aucun endpoint applicatif.
- [ ] `J8-SEC-05` Un sandbox ne peut viser la destination de production.
- [ ] `J8-SEC-06` Recherche, audit, import et export respectent les mêmes frontières tenant.

## Critères de validation exploitation

- [ ] `J8-OPS-01` Une erreur est corrélable de l'interface à l'adaptateur concerné.
- [ ] `J8-OPS-02` Le support retrouve en moins de cinq minutes la publication liée à un calcul de test.
- [ ] `J8-OPS-03` Les échecs de livraison peuvent être relancés sans duplication.
- [ ] `J8-OPS-04` La volumétrie pilote respecte les seuils définis au J0.
- [ ] `J8-OPS-05` Les parcours critiques sont utilisables au clavier et sans dépendre uniquement de la couleur.
- [ ] `J8-OPS-06` Build, migrations, tests unitaires, intégration, RLS et parcours critique sont verts.

## Recette pilote

Le pilote exécute sans assistance technique directe :

1. création d'un fournisseur et d'un site ;
2. ajout d'une machine et de ses aptitudes ;
3. ajout de matières, transport et coûts ;
4. contractualisation d'un sous-traitant ;
5. résolution des erreurs de complétude ;
6. validation et publication ;
7. création et comparaison d'un sandbox ;
8. import d'une mise à jour ;
9. export et acceptation par le solveur ;
10. recherche de la publication et de son audit.

## Condition de sortie MVP

Le MVP est validé lorsque tous les critères bloquants sont verts, que les écarts non bloquants ont un propriétaire et une échéance, et qu'un représentant métier ainsi qu'un responsable technique signent la recette.

