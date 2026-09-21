---
id: E10.17
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c81e5af3edc789883b165
---
# E10.17 — Magasin de fichiers unifié par commande et par item (public / privé)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.17 — Magasin de fichiers unifié par commande et par item (public / privé)](https://app.notion.com/p/3cad0131973c81e5af3edc789883b165) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | L | Pas commencé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 17 |

### Description fonctionnelle (Notion)

**En tant qu'**opérateur, client ou module tiers, **je veux** un magasin de fichiers unifié rattaché à la commande et à chacun de ses items, avec un statut public ou privé par fichier, **afin de** savoir quel document correspond à quel produit et qui a le droit de le voir.

##### Statut

Draft — prêt pour agent dev. **Réécriture complète. La partie « lien public de dépôt » est extraite vers E10.20.**

##### Contexte produit

Décision WM du 01/09/2026. Deux corrections de la spécification du 28/08 :

- **Granularité.** Xavier Péchoultres : « il faut une gestion de fichiers par commande, et elle n'est pas que par commande, elle est par item de commande. Si tu as plusieurs produits dans la commande, il faut pouvoir savoir à quelle ligne les fichiers correspondent. »
- **Visibilité.** Le concept est unifié par un simple drapeau public / privé porté par le fichier. Par défaut : privé lorsqu'il est déposé depuis le back-office (c'est une sécurité), public lorsqu'il vient du client. Les modules tiers fixent eux-mêmes le drapeau à l'envoi — côté Clariprint / Studio, la gamme de fabrication et le gabarit de découpe sont privés, le gabarit PAO est public. Xavier : « sur Clariprint il n'y a pas de story à générer, c'est côté Studio que c'est géré. »

##### Critères d'acceptation

1. Un fichier est rattaché à une commande **et**, optionnellement, à un item de cette commande. Un fichier sans item est un document de niveau commande (ex. bon de commande).
2. Chaque fichier porte : nom d'origine, type MIME, taille, empreinte, `visibility` (`private` \| `public`), `uploaded_by` (`operator` \| `customer` \| `module`), source (identifiant du module le cas échéant), `file_type` métier (`artwork`, `manufacturing_range`, `die_template`, `prepress_template`, `purchase_order`, `other`), auteur et horodatage.
3. **Valeur par défaut de `visibility` : `private`.** Un fichier déposé par un opérateur depuis le back-office est privé ; un fichier déposé par le client (E10.20) est créé en `public` ; un module tiers fixe explicitement la valeur à l'envoi.
4. Depuis la fiche commande, chaque item expose le dépôt d'un ou plusieurs fichiers, la liste des fichiers rattachés, et pour chacun : téléchargement, bascule public / privé, suppression.
5. Un fichier privé n'est **jamais** exposé aux surfaces client — ni la page de dépôt (E10.20), ni l'espace commande de la boutique, ni un lien signé transmis au client.
6. La bascule public / privé et la suppression sont journalisées (auteur, horodatage, état avant et après).
7. Le stockage est un objet distant ; le service ne renvoie jamais d'URL permanente mais une **URL signée à durée limitée**, générée à la demande et soumise au contrôle de visibilité.
8. Contrôle serveur de la taille et de la liste blanche d'extensions, paramétrable au niveau du tenant.
9. Aucune écriture de fichier ne modifie le statut de la commande : le changement d'étape relève de E10.20 (validation client) ou de E10.14 (action opérateur).
10. L'API de dépôt est utilisable par un module tiers avec une clé de service, sans passer par l'interface.

##### Contrat API

| Méthode | Route | Objet |
| --- | --- | --- |
| GET | `/api/v1/orders/{orderId}/files` | Liste les fichiers de la commande ; `?item_id=`, `?visibility=`, `?file_type=` |
| POST | `/api/v1/orders/{orderId}/files` | Enregistre un fichier ; corps : `{ item_id?, file_type, visibility?, filename, mime_type, size }` ; renvoie une URL de dépôt signée ; `Idempotency-Key` honoré |
| GET | `/api/v1/orders/{orderId}/files/{fileId}/download` | 302 vers une URL signée à durée limitée, après contrôle de visibilité |
| PATCH | `/api/v1/orders/{orderId}/files/{fileId}` | Change `visibility` (`If-Match`) |
| DELETE | `/api/v1/orders/{orderId}/files/{fileId}` | Supprime |

Scope de clé de service : `files:write` pour les modules (Studio, Clariprint). Événement émis : `order.file_added` (`{ order_id, item_id, file_id, file_type, visibility, uploaded_by }`).

##### Tâches / Sous-tâches

- [ ] Migration `order_files` : id, tenant_id, order_id, order_item_id null, storage_key, filename, mime_type, size_bytes, checksum, file_type, visibility default `'private'`, uploaded_by, source_module, created_by, created_at (CA : 1, 2, 3)
- [ ] Politiques RLS : lecture des privés réservée aux membres internes du tenant (CA : 5)
- [ ] Module `src/modules/files/` : routes, service, adaptateur de stockage objet, URL signées (CA : 7, 10)
- [ ] Contrôle serveur taille et extensions, paramétrable par tenant (CA : 8)
- [ ] Composant `src/components/orders/OrderFilesPanel.tsx` — regroupement par item, actions par fichier (CA : 4)
- [ ] Table `order_files_audit` alimentée par trigger (CA : 6)
- [ ] Décrire les cinq routes dans l'OpenAPI (CA : contrat)

##### Dev Notes

###### Modèle de données

Le rattachement à l'item est **nullable** : c'est ce qui permet à un même magasin de porter les documents de commande (bon de commande) et les fichiers de production par ligne, sans deux tables ni deux écrans.

Ne pas coder de règle métier associant automatiquement un `file_type` à une `visibility` : la séance a explicitement écarté cette voie. La convention Clariprint (gamme privée, gabarit de découpe privé, gabarit PAO public) est appliquée **par le module émetteur**, pas par Magrit.

###### Sécurité

- La visibilité se contrôle au moment de la génération de l'URL signée, jamais côté client. Une liste filtrée en React n'empêche pas un appel direct.
- Durée de vie des URL signées : 15 minutes, non renouvelable sans nouvel appel authentifié.
- La suppression retire l'objet du stockage **et** la ligne, mais laisse la trace dans l'audit.

###### data-testid

`order-files-panel`, `order-files-item-block` (+ `data-item-id`), `order-file-row` (+ `data-file-id`, `data-visibility="private"|"public"`), `order-file-upload-btn`, `order-file-download-btn`, `order-file-visibility-toggle`, `order-file-delete-btn`, `order-file-type-badge`

###### Dépendances

- Bloquée par : E10.0, E10.12, E10.16
- Bloque : E10.19, E10.20

##### Tests

Parcours P13 — dépôt de deux fichiers sur deux items distincts depuis le back-office, contrôle que la valeur par défaut est privée, bascule de l'un en public, contrôle qu'il devient visible côté client et que l'autre ne l'est pas.

##### Change Log

- 2026-08-28 — v1 — Création (lien unique de dépôt expirant) — Arnaud Mazon / Claude
- 2026-09-01 — v2 — **Réécriture complète** suite au WM du 01/09/2026 : magasin de fichiers unifié par commande et par item, drapeau public / privé, extraction du lien public vers E10.20 — Arnaud Mazon / Claude

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
| [TF-185](https://app.notion.com/3cad0131973c81f9ae74ef0b3ddb2092) | GC — Dépôt de fichiers en deux sessions par item, puis validation explicite | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.20, E10.17, E10.14 |
| [TF-189](https://app.notion.com/3ced0131973c81e6a99cf0914d9647d7) | GC — Fichiers par item : visibilité privée par défaut au back-office, bascule publique | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.17, E10.20 |
| [TF-190](https://app.notion.com/3ced0131973c8190a49cd5856b374556) | GC — Génération du PDF Bon de commande et révision | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.19, E10.16, E10.17 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.17

- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10.17b.md`
- `docs/api/CONVENTIONS.md`
- `openapi/magrit-core.v1.yaml`
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx`
- `src/modules/order-files/ui/OrderFilesBlock.tsx`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/migrations/20260910000200_gescom_e10_19b_order_documents.sql`
