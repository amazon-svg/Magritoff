---
id: PD-2026-10-07-TVA-LIGNE
title: TVA par ligne, ventes B2B et B2C et lieu de livraison
date: 2026-10-07
documentStatus: approved
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E10.23.md
  - project/decisions/open-questions.md
---

# TVA par ligne, ventes B2B et B2C et lieu de livraison

## Contexte

`E10.23` constate que Magrit applique un taux de TVA unique en pied de devis.
Les spécifications de la facturation électronique qualifient la TVA ligne par
ligne. La question `OQ-TVA-LIGNE` demandait la source du taux, le traitement
des remises et des arrondis, et le périmètre du premier lot.

## Décision

Arbitrage rendu par Arnaud Mazon et Xavier Péchoultres au WM du 7 octobre 2026.

1. **Le modèle de données prévoit dès maintenant une TVA par ligne** de devis,
   de commande et de facture. Le pied de document récapitule la TVA par taux.
2. **Premier lot** : le modèle et les documents sont rendus prêts ; aucune
   facture électronique n'est encore émise.
3. **Source du taux — formulation du WM, précisée ci-dessous le 8 octobre** :
   le taux applicable à un client est déterminé par **son pays**, à partir d'une table des taux par pays tenue à jour. Saisir un
   client italien applique 22 % à chaque ligne de ses devis.
4. **Exception par produit** : un produit dont le taux est spécifique peut porter
   son propre taux, renseigné à sa création.
5. **Sanctuarisation** : le taux effectivement appliqué est enregistré sur
   chaque ligne de commande et de facture ; il n'est jamais recalculé après
   coup.

## Complément de Xavier Péchoultres du 8 octobre 2026

Source : échange dans le chat de travail du dépôt le 8 octobre 2026. Xavier
précise que les deux cas **B2B et B2C doivent être couverts, notamment dans les
boutiques**, et demande de vérifier l'incidence du lieu de livraison, avec
l'exemple d'une société belge faisant imprimer et livrer en France.
Ce complément est distinct de l'arbitrage du WM du 7 octobre ; sa rédaction
est approuvée par Xavier Péchoultres le 8 octobre 2026.

La règle « pays du client » ne suffit pas à qualifier la TVA. Le modèle doit
distinguer le vendeur et son régime fiscal, la nature de l'opération (bien ou
service), le statut fiscal de l'acheteur, son pays de facturation et son numéro
de TVA, ainsi que les pays de départ et de destination effective des biens.
Le statut « entreprise » et une adresse étrangère ne valent pas exonération.

### Arbitrages complémentaires du 8 octobre 2026

Xavier Péchoultres complète la décision dans le même échange :

1. **Configuration des taux par pays** : prévoir un référentiel configurable
   des taux de TVA par pays, permettant les différents taux applicables aux
   produits. La sélection du taux intervient après la qualification fiscale
   de l'opération et la détermination du pays d'imposition.
2. **Clients Magrit et clients des boutiques** : porter explicitement la notion
   de B2B/B2C sur les deux populations de clients, avec les données fiscales
   nécessaires à l'application des règles. Le statut B2B seul ne donne pas
   droit à une exonération.
3. **Application des règles de taxe** : appliquer les règles documentées aux
   devis, commandes et parcours boutiques à partir des données du vendeur,
   du client, du produit et de la livraison.
4. **Référence UBL** : utiliser UBL comme référence pour les catégories et
   codes fiscaux lorsqu'un profil de codes est nécessaire, ainsi que pour la
   préparation des données de facture structurée. La version et le profil de
   conformité précis restent à définir ; le premier lot n'émet toujours pas
   de facture électronique.
5. **Livraisons dans plusieurs pays** : une même commande peut avoir plusieurs
   destinations. La qualification fiscale doit pouvoir distinguer les parts
   d'une ligne livrées dans des pays différents et leurs bases taxables ; un
   pays de livraison unique au niveau de la commande ne suffit pas.

### TODO — informations de livraison fournies par Clariprint

Xavier précise que **le calcul de la livraison est effectué par Clariprint**.
Prévoir que Clariprint remonte les informations nécessaires à la qualification
fiscale de chaque destination. Le contrat d'échange reste à définir et à
vérifier avec Clariprint : aucune disponibilité de ces informations dans
l'interface actuelle n'est présumée.

Données à prévoir dans ce contrat : pays de départ et de destination, lien avec
les lignes et quantités concernées, et ventilation des montants de livraison
calculés entre les destinations. Le traitement fiscal de ces frais et la
répartition des bases produit doivent être précisés. Ce TODO conditionne
l'application des règles aux livraisons dans plusieurs pays ; il ne transfère
pas à Clariprint la responsabilité de la qualification fiscale dans Magrit.

## Vérification fiscale du 8 octobre 2026

Les cas suivants concernent des **livraisons de biens par un vendeur établi en
France et assujetti redevable de la TVA**, hors régime particulier. Le lieu de
fabrication ne suffit pas : il faut connaître le mouvement réel des biens.

| Cas | Qualification à couvrir |
|---|---|
| Entreprise belge, imprimés expédiés de France et livrés en France | TVA française au taux applicable au produit ; le numéro de TVA belge ne suffit pas à exonérer. |
| Entreprise belge assujettie, imprimés expédiés de France vers la Belgique | Livraison intracommunautaire exonérée chez le vendeur si toutes les conditions sont réunies ; acquisition autoliquidée par l'acheteur. |
| Particulier, imprimés expédiés de France et livrés en France | TVA française au taux applicable au produit. |
| Particulier, vente à distance de France vers un autre État membre | TVA du pays d'arrivée des biens en principe ; dérogation des petits opérateurs sous conditions, sauf option pour la taxation à destination. |
| Imprimés expédiés hors du territoire TVA de l'UE | Exonération d'exportation sous conditions et avec preuve de sortie ; le pays de facturation seul ne suffit pas. |

Pour la livraison intracommunautaire B2B, vérifier notamment le numéro de TVA
communiqué et valide dans un autre État membre, le statut de l'acquéreur, les
preuves du transport hors de France et les obligations déclaratives du vendeur.
Une catégorie d'exonération et son motif doivent être conservés sur la ligne ;
il ne s'agit pas d'un taux belge nul.

Pour la vente à distance B2C, le seuil de 10 000 € HT est global au vendeur,
non par boutique, client ou pays. Il s'apprécie sur l'année en cours et la
précédente, inclut les opérations éligibles et suppose les conditions du régime
des petits opérateurs. L'option pour la taxation à destination doit également
être prise en compte. Le pays d'arrivée peut différer du pays de facturation.

La qualification **bien ou service** doit être validée pour les offres
d'imprimerie : la simple reproduction sur supports est une livraison de biens,
mais des services complémentaires prédominants peuvent modifier cette
qualification. La matrice ci-dessus ne doit pas être appliquée automatiquement
à une prestation de services.

Sources officielles consultées le 8 octobre 2026 :

- [DGFiP — achat et vente de biens](https://www.impots.gouv.fr/professionnel/achatvente-de-biens).
- [BOFiP — conditions d'exonération des livraisons intracommunautaires](https://bofip.impots.gouv.fr/bofip/697-PGP.html/identifiant=BOI-TVA-CHAMP-30-20-10-20260701).
- [BOFiP — territorialité des ventes à distance](https://bofip.impots.gouv.fr/bofip/13159-PGP.html/identifiant=BOI-TVA-CHAMP-20-20-30-20240724).
- [BOFiP — qualification des opérations, notamment reprographie](https://bofip.impots.gouv.fr/bofip/1084-PGP.html/identifiant=BOI-TVA-CHAMP-10-10-40-20210813).

## Repères de taux consignés le 7 octobre 2026

Taux normaux vérifiés le 7 octobre sur le
[portail de la Commission européenne](https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_fr.htm) :
France 20 %, Allemagne 19 %, Espagne 21 %, Italie 22 %, **Luxembourg 17 %**
(et non 19 %). Des taux réduits existent aussi pour certains imprimés en France
(livres notamment). Ces repères ne remplacent ni la qualification de
l'opération ni la table de taux tenue à jour.

## Conséquences

- `E10.23` porte les cas B2B/B2C, y compris en boutique, et les points encore ouverts.
- Le pays du client ne peut plus servir de règle fiscale unique ; la qualification
  précède la sélection du taux produit applicable dans le pays d’imposition.
- `OQ-TVA-LIGNE` reste ouverte sur le périmètre non tranché.

## Questions restantes

- Traduction de la matrice en catégories et motifs fiscaux ; preuves et
  obligations déclaratives, contrôle du numéro de TVA, gestion des données
  manquantes et des entreprises relevant de régimes dérogatoires.
- Qualification bien/service des offres, régimes du vendeur, ventes en chaîne
  et modalités de ventilation fiscale des livraisons dans plusieurs pays.
- TODO Clariprint : contrat de remontée des destinations, lignes/quantités et
  montants de livraison, puis vérification de leur disponibilité.
- Paramétrage du régime B2C : seuil global, option pour la destination et suivi
  au niveau du vendeur ; comportement lors d’un changement de livraison.
- Répartition d'une remise globale entre plusieurs taux et convention
  d'arrondi.
- Personnes habilitées à corriger la qualification fiscale d'une ligne.
- Version UBL et profil de conformité précis ; correspondance des catégories
  et motifs fiscaux avec les codes de référence.
- Source, responsable et mode de mise à jour du référentiel configurable
  des taux de TVA par pays.
- Le responsable fiscal ou comptable consulté sur ces points n'est pas nommé.
