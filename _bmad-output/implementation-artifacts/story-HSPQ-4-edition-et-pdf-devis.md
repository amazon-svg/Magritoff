---
id: HSPQ-4
epic: Gestion commerciale
status: done
branch: feat/hopstudio-project-quote-callback
depends_on: [HSPQ-3]
blocks: []
---
# HSPQ-4 — Exploiter les lignes projet dans le devis

<!-- notion-functional:begin — aucune story Notion rattachée ; section maintenue dans le dépôt (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel

> Cette story est née dans le dépôt pendant la réalisation de la PR. Aucune
> page Notion ni aucun cas de test Notion ne lui est rattaché au 29/09/2026.

**En tant que** commercial, **je veux** sélectionner les éléments d’un projet,
enrichir leur détail et prévisualiser le devis, **afin de** produire un document
client lisible avant son envoi.

### Critères d’acceptation

1. Le bouton `Éléments du projet` liste les lignes du projet courant, affiche
   leur nombre et permet une sélection multiple.
2. La création du devis ne reprend que les lignes sélectionnées et ouvre le
   devis créé dans l’éditeur.
3. La description détaillée d’une ligne est du HTML limité et sécurisé,
   distinct du libellé court et du payload technique.
4. La description peut être modifiée dans un petit éditeur visuel tant que le
   devis est en brouillon ; le tableau affiche directement le rendu, pas le
   code HTML.
5. La description est conservée lors d’une duplication et propagée à la ligne
   de commande lors de la conversion.
6. Le PDF d’aperçu est généré à la demande depuis les données courantes du
   brouillon et porte un filigrane diagonal `DRAFT` sur chaque page.
7. L’aperçu temporaire remplace le précédent ; il ne devient pas le document
   définitif envoyé au client.
8. Le document définitif déjà généré peut être téléchargé depuis l’éditeur.
9. Les fichiers associés aux lignes restent accessibles depuis le devis et la
   commande.

### Cas de test rattachés

Voir `CT-HSPQ-025` à `CT-HSPQ-033` dans le
[carnet de tests de la PR](./carnet-tests-hopstudio-project-quote-callback.md).

---

_Fin du périmètre fonctionnel. La suite décrit l’implémentation._
<!-- notion-functional:end -->

## Implémentation livrée

- `ActiveProjectItemsDrawer` orchestre sélection et création du devis.
- `description_html` est propagé du projet au devis puis à la commande.
- Le sous-ensemble HTML accepté est `p`, `br`, `strong`, `em`, `ul`, `ol` et
  `li`, sans attribut, avec une limite de 20 000 caractères.
- `QuoteLineDescriptionDialog` fournit l’éditeur visuel et
  `SafeDescriptionHtml` rend le contenu nettoyé.
- `POST /quotes/{quoteId}/document-previews` produit l’aperçu filigrané ; les
  routes de lecture existantes servent le document définitif lorsqu’il existe.
- L’éditeur de devis expose les actions d’aperçu et de téléchargement.

## Hors périmètre

- édition de la description après sortie de l’état `draft` ;
- remplacement du moteur de gabarits de devis ;
- assimilation de l’aperçu DRAFT au document envoyé ;
- rendu arbitraire de HTML ou d’attributs fournis par HopeStudio.

## Preuves et fichiers principaux

- `supabase/migrations/20260928000100_commercial_line_description_html.sql`
- `src/modules/commercial-quotes/ui/components/QuoteLineDescriptionDialog.tsx`
- `src/modules/commercial-quotes/ui/workspace/QuoteEditorPage.tsx`
- `src/shared/validation/safe-description-html.ts`
- `src/shared/presentation/SafeDescriptionHtml.tsx`
- `src/modules/quote-documents/application/quote-document-renderer.ts`
- `src/modules/quote-documents/application/quote-documents-service.ts`
- `tests/modules/commercial-quotes/safe-description-html.test.ts`
- `tests/modules/quote-documents/quote-document-renderer.test.ts`
- `tests/contract/quote-documents.contract.test.ts`

## Dette et vigilance

- Les tests automatisés couvrent le contrat, le nettoyage et le rendu PDF ; le
  comportement de la fenêtre d’édition et du lecteur PDF doit encore être joué
  manuellement dans un navigateur authentifié.
- Un devis sans gabarit PDF éligible doit afficher l’erreur métier prévue et ne
  pas produire un document vide ou un faux succès.

