---
id: PRD-SCOPE
title: Périmètre produit Magrit
documentStatus: draft
owner: unassigned
source: _bmad-output/planning-artifacts/prd.md
sourceDate: 2026-05-09
consolidatedAt: 2026-10-02
supersedes: []
---

# Périmètre produit Magrit

> Le périmètre ci-dessous consolide les capacités durables du PRD historique et les décisions du 1er octobre 2026. L'état de livraison de chaque capacité est porté par le backlog et les preuves, pas par ce document.

## Domaines couverts

### Catalogue, PIM et recherche

- produits, catégories et attributs utiles au print ;
- recherche unifiée entre catalogue, PIM, Clariprint et conversation ;
- configuration d'un produit et conservation de sa provenance ;
- enrichissement marketing et commercial.

### Gestion commerciale

- clients et interlocuteurs ;
- projets commerciaux ;
- devis, lignes libres, prix, marges et remises ;
- conversion en commandes ;
- consultation, documents et exports.

### Boutiques B2B

- boutiques configurées par espace ;
- catalogue publié, navigation et recherche ;
- panier, devis, commande et renouvellement ;
- compte acheteur et informations de facturation.

### Production et réseau

- capacités et parcs machines ;
- accès contrôlé aux parcs de sous-traitants ;
- règles de prix associées ;
- suivi opérationnel des commandes lorsque spécifié.

### Identités et espaces

- tenants, espaces et sous-espaces ;
- utilisateurs internes, clients boutique et délégation ;
- rôles, permissions, invitations et révocation.

### Studio et contenus

- génération ou enrichissement de contenus produit ;
- intégration éventuelle avec des outils de création externes ;
- production de documents commerciaux.

## Hors périmètre sans décision complémentaire

- remplacement complet d'un ERP, d'un logiciel comptable ou de Clariprint ;
- comptabilité générale et facturation réglementaire complète ;
- création d'un studio graphique généraliste concurrent de Canva ou Affinity ;
- partage implicite des données entre tenants, filiales ou partenaires ;
- activation d'une fonctionnalité seulement parce qu'elle figurait dans un ancien PRD.

## Règle d'évolution

Une nouvelle capacité modifiant un comportement existant doit mettre à jour le domaine, l'epic, les stories et les tests concernés. Les anciennes exigences sont marquées `superseded` ou `deprecated` avec un lien vers leur remplacement.


## Bêta avancée — orientation du WM du 14 octobre à approuver

[PD-2026-10-14-STUDIO-BETA](../decisions/product/PD-2026-10-14-studio-beta.md) propose de prioriser Clariprint Studio jusqu’aux boutiques (chat, formulaires et prix), cible semaine du 19 octobre. La première phase produit les prix et porte la gestion commerciale ; l’interface de description des parcs Clariprint Data vient dans une seconde phase. Cette distinction ne supprime pas les besoins durables des parcs. Clariprint Studio/HopeStudio est distinct du sujet « Studio et contenus » ci-dessus. Les propositions sur les lots et la livraison sont portées par PD-2026-10-14-LOTS-LIVRAISON, sans présumer le verrou d’un pays unique ni lever les arbitrages fiscaux.
