---
id: PD-2026-10-07-TVA-LIGNE
title: TVA portée par chaque ligne, taux déterminé par le pays du client
date: 2026-10-07
documentStatus: draft
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

# TVA portée par chaque ligne, taux déterminé par le pays du client

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
3. **Source du taux** : le taux applicable à un client est déterminé par **son
   pays**, à partir d'une table des taux par pays tenue à jour. Saisir un
   client italien applique 22 % à chaque ligne de ses devis.
4. **Exception par produit** : un produit dont le taux est spécifique peut porter
   son propre taux, renseigné à sa création.
5. **Sanctuarisation** : le taux effectivement appliqué est enregistré sur
   chaque ligne de commande et de facture ; il n'est jamais recalculé après
   coup.

## Précision technique

Vérifiée le 7 octobre 2026 sur le portail de la Commission européenne
(<https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_fr.htm>).
La règle « taux du pays du client » est exacte pour une **vente à distance à un
consommateur** d'un autre État membre au-delà du seuil de 10 000 € de ventes
annuelles. Elle ne couvre pas deux cas courants dans le métier :

- **Vente à une entreprise d'un autre État membre** : le vendeur ne facture pas
  de TVA ; l'acheteur l'autoliquide dans son pays. La ligne porte une
  catégorie d'exonération, pas le taux du pays du client.
- **Vente hors Union européenne** : exportation exonérée de TVA, sous réserve de
  la preuve de sortie.

Taux normaux vérifiés à la même source : France 20 %, Allemagne 19 %, Espagne
21 %, Italie 22 %, **Luxembourg 17 %** (et non 19 %). Des taux réduits existent
aussi pour certains imprimés en France (livres notamment) : l'exception par
produit les couvre.

## Conséquences

- `E10.23` porte la règle et la liste des points encore ouverts.
- `OQ-TVA-LIGNE` reste ouverte sur le périmètre non tranché.

## Questions restantes

- Qualification d'une ligne vendue à une entreprise d'un autre État membre ou
  hors Union européenne (catégorie et motif d'exonération).
- Répartition d'une remise globale entre plusieurs taux et convention
  d'arrondi.
- Personnes habilitées à corriger la qualification fiscale d'une ligne.
- Profil structuré cible : UBL, CII ou Factur-X.
- Source et mode de mise à jour de la table des taux par pays.
- Le responsable fiscal ou comptable consulté sur ces points n'est pas nommé.
