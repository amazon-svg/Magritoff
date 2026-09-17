---
id: E10.19
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3ced0131973c813a8329d92b4eb8c3dd
---
# E10.19 — Génération du PDF Bon de commande

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.19 — Génération du PDF Bon de commande](https://app.notion.com/p/3ced0131973c813a8329d92b4eb8c3dd) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Pas commencé | Claude code | Pro+ | WM 01/09/2026 | 18 |

### Description fonctionnelle (Notion)

**En tant que** gestionnaire de commandes, **je veux** générer un PDF de bon de commande depuis n'importe quelle commande, **afin de** répondre à une demande que les clients formuleront dès la mise en service.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision WM du 01/09/2026. Xavier Péchoultres : « il faut pouvoir générer un PDF bon de commande sur la commande quoi qu'il arrive, ils vont le demander direct ». Le sujet était absent de E10.16 ; il en est extrait pour être traité comme une brique documentaire autonome, réutilisable ensuite pour le devis et la facture.

##### Critères d'acceptation

1. Un bouton « Bon de commande (PDF) » est disponible sur la fiche commande et sur la ligne de la grille des commandes.
2. Le PDF porte : logo et coordonnées du tenant, numéro et date de commande, client et interlocuteur, adresses de facturation et de livraison, lignes (libellé, configuration produit résumée, quantité, prix unitaire HT, montant HT), totaux HT / TVA / TTC, mentions légales et conditions paramétrées au niveau du tenant.
3. Les remises n'apparaissent que si l'interrupteur du devis d'origine (E10.10) le prévoit.
4. La génération est **déterministe** : deux appels sur une commande inchangée produisent le même document.
5. Le PDF généré est attaché à la commande dans le magasin de fichiers (E10.17) avec le type `purchase_order` et la visibilité **publique** — le client doit pouvoir le télécharger.
6. Une regénération remplace la version précédente et incrémente un numéro de révision visible en pied de page.
7. Le gabarit est un modèle éditable au niveau du tenant (en-tête, pied, mentions), pas une mise en page codée en dur.
8. L'endpoint est accessible aux modules tiers via clé de service (Studio peut récupérer le bon de commande).

##### Contrat API

| Méthode | Route | Objet |
|---|---|---|
| POST | `/api/v1/orders/{orderId}/documents/purchase-order` | Génère (ou regénère) le bon de commande ; `Idempotency-Key` honoré ; renvoie `{ data: { file_id, revision, url } }` |
| GET | `/api/v1/orders/{orderId}/documents/purchase-order` | Renvoie la dernière révision (302 vers une URL signée à durée limitée) |
| GET | `/api/v1/tenants/current/document-templates/purchase-order` | Lit le gabarit du tenant |
| PUT | `/api/v1/tenants/current/document-templates/purchase-order` | Met à jour le gabarit (`If-Match`) |

Événement émis : `order.document_generated` (`{ order_id, document_type, revision, file_id }`).

##### Tâches / Sous-tâches

- [ ] Décrire les quatre routes dans `openapi/magrit-core.v1.yaml` (CA : 8)
- [ ] Module `src/modules/documents/` — service de rendu + gabarit (CA : 2, 4, 7)
- [ ] Rendu HTML → PDF côté serveur, polices embarquées, sortie A4 (CA : 2, 4)
- [ ] Table `document_templates` (tenant_id, type, header, footer, legal_mentions, updated_at) (CA : 7)
- [ ] Rattachement au magasin de fichiers avec `file_type='purchase_order'`, `visibility='public'` (CA : 5)
- [ ] Compteur de révision et pied de page (CA : 6)
- [ ] Boutons fiche et grille (CA : 1)

##### Dev Notes

###### Contraintes techniques

- Le rendu se fait **côté serveur** : un PDF généré dans le navigateur dépend de la machine du poste et casse le CA 4.
- Les montants sont repris du snapshot de la commande (E10.12), jamais recalculés à la génération : un bon de commande réédité six mois plus tard doit afficher les mêmes chiffres.
- Prévoir dès maintenant `document_type` en énumération (`purchase_order`, `quote`, `invoice`) : le devis et la facture réutiliseront le même moteur.

###### data-testid

`order-purchase-order-btn`, `order-purchase-order-download-link`, `document-template-editor`, `document-template-save-btn`

###### Dépendances

- Bloquée par : E10.0, E10.12, E10.16, E10.17

##### Tests

Parcours P13 — génération depuis une commande à deux lignes, contrôle du contenu, de la visibilité publique du fichier et de l'incrément de révision à la regénération.

##### Change Log

- 2026-09-01 — v1 — Création suite au WM du 01/09/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

*à compléter par l'agent dev*

###### Debug Log References

*à compléter*

###### Completion Notes

*à compléter*

###### File List

*à compléter*

##### QA Results

*à compléter*

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-190](https://app.notion.com/3ced0131973c8190a49cd5856b374556) | GC — Génération du PDF Bon de commande et révision | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.19, E10.16, E10.17 |
| [TF-218](https://app.notion.com/3d7d0131973c81f3bf6bd86e4820ee84) | TF-001 — Creation d'un gabarit de type Bon de commande (chemin nominal) | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.19a |
| [TF-219](https://app.notion.com/3d7d0131973c819ab522d508c0002a9d) | TF-002 — show_discounts recopie fidelement du devis a la commande | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.19a |
| [TF-220](https://app.notion.com/3d7d0131973c8170861cc5263c20087f) | TF-003 — Garde 422 : un champ de devis refuse sur un gabarit de commande | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.19a |
| [TF-221](https://app.notion.com/3d7d0131973c81f4919acc8e75d9355a) | TF-004 — Immuabilite des colonnes gelees apres conversion | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.19a |
| [TF-222](https://app.notion.com/3d7d0131973c81aba8edd4a6edacbe28) | TF-005 — show_discounts et customer_reference jamais publiees sur la fiche commande | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.19a |
| [TF-223](https://app.notion.com/3d7d0131973c811e87f3cffaf030bc25) | TF-001 — Production nominale du bon de commande et telechargement | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.19b |
| [TF-224](https://app.notion.com/3d7d0131973c8181beeffaae90a13aee) | TF-002 — Nouvelle tentative de production sur une commande deja documentee | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.19b |
| [TF-225](https://app.notion.com/3d7d0131973c8167bf3bc7845c39035f) | TF-003 — Absence de gabarit order actif : production refusee | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.19b |
| [TF-226](https://app.notion.com/3d7d0131973c81ecb864d0c44935e0a2) | TF-004 — Remises imprimees ou masquees selon show_discounts de la commande | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.19b |
| [TF-227](https://app.notion.com/3d7d0131973c81289e1bd11aea673169) | TF-005 — Isolation tenant sur le document de commande | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.19b |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Lots développés sous leur propre story document

- [E10.19a](story-E10.19a.md)
- [E10.19b](story-E10.19b.md)

### Fichiers du dépôt qui citent E10.19

- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10.15c.md`
- `_bmad-output/implementation-artifacts/story-E10.20b.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx`
- `src/modules/pricing/application/pricing-engine.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/migrations/20260910000100_gescom_e10_19a_order_document_template.sql`
- `supabase/migrations/20260910000200_gescom_e10_19b_order_documents.sql`
- `tests/contract/commercial-order-documents.contract.test.ts`
