---
id: E10.20
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3ced0131973c8110b87cd8e8aee2f6e8
---
# E10.20 — Lien public de dépôt de fichiers et validation explicite par le client

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.20 — Lien public de dépôt de fichiers et validation explicite par le client](https://app.notion.com/p/3ced0131973c8110b87cd8e8aee2f6e8) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Pas commencé | Claude code | Pro+ | WM 01/09/2026 | 19 |

### Description fonctionnelle (Notion)

**En tant que** client ou prestataire mandaté par lui, **je veux** ouvrir un lien unique, déposer mes fichiers item par item sur plusieurs sessions, puis déclarer que j'ai terminé, **afin de** transmettre les fichiers de production sans compte et sans risque d'envoyer la commande en production trop tôt.

##### Statut

Draft — prêt pour agent dev. **Remplace la moitié « lien public » de l'ancienne E10.17 ; la spécification du 28/08 sur ce point est abrogée.**

##### Contexte produit

WM du 01/09/2026. Deux corrections majeures sur la spécification du 28/08 :

- **Un seul lien par commande**, pas un par item. Xavier Péchoultres : « s'il y a trois items dans la commande, on ne va pas avoir trois liens, c'est pénible ». La page ouverte par ce lien liste les items et permet de déposer sur chacun.
- **Le statut ne bascule pas au premier fichier déposé.** Le déposant revient souvent en plusieurs fois — il récupère un gabarit, travaille, revient déposer. C'est un bouton explicite « J'ai fini de déposer mes fichiers » qui notifie le système et déclenche le changement de statut. Xavier : « les clients le font plutôt bien, ça les rassure ».

##### Critères d'acceptation

1. Un lien unique par commande est généré à la demande depuis le back-office et depuis l'espace commande côté boutique ; jeton aléatoire d'au moins 128 bits, **haché en base**.
2. Le lien est transmissible à un tiers (service PAO, agence) : aucune authentification n'est requise pour l'ouvrir.
3. La page publique affiche le numéro de commande et **la liste des items**, sans aucune donnée tarifaire ni information commerciale.
4. Pour chaque item : dépôt d'un ou plusieurs fichiers (glisser-déposer), liste des fichiers déjà déposés, suppression de ceux déposés depuis ce lien en cas d'erreur.
5. Les fichiers **publics** attachés à la commande ou à l'item (typiquement le gabarit PAO fourni par Clariprint) sont visibles et téléchargeables depuis cette page ; les fichiers privés n'y apparaissent jamais.
6. Un fichier déposé depuis ce lien est créé avec `visibility='public'` et `uploaded_by='customer'`.
7. Un bouton « J'ai fini de déposer mes fichiers », distinct et explicite, valide le dépôt : il émet `order.files_submitted` et fait passer la commande à l'étape « Fichier reçu ». **Aucun dépôt isolé ne change le statut.**
8. Le lien reste valide tant que le dépôt n'est pas validé et que sa date d'expiration n'est pas atteinte ; l'expiration par défaut est paramétrable au niveau du tenant (valeur initiale : 30 jours).
9. Après validation du dépôt, le lien passe en lecture seule : les fichiers publics restent téléchargeables, aucun nouveau dépôt n'est accepté.
10. Un lien peut être révoqué puis regénéré depuis le back-office ; l'ancien reste définitivement invalide.
11. Une tentative sur un lien expiré, révoqué ou inexistant affiche le **même message générique**, sans divulguer l'existence de la commande.
12. Contrôle serveur de la taille et des extensions autorisées, paramétrables au niveau du tenant.

##### Contrat API

| Méthode | Route | Objet |
|---|---|---|
| POST | `/api/v1/orders/{orderId}/upload-links` | Crée un lien (auth requise) ; renvoie l'URL en clair **une seule fois** |
| DELETE | `/api/v1/orders/{orderId}/upload-links/{linkId}` | Révoque |
| GET | `/api/v1/public/upload-sessions/{token}` | Page publique : commande, items, fichiers publics, état du lien |
| POST | `/api/v1/public/upload-sessions/{token}/items/{itemId}/files` | Dépose un fichier (URL signée vers le stockage objet) |
| DELETE | `/api/v1/public/upload-sessions/{token}/files/{fileId}` | Supprime un fichier déposé depuis cette session |
| POST | `/api/v1/public/upload-sessions/{token}/submit` | Valide le dépôt ; `Idempotency-Key` honoré |

Les routes `/public/` sont décrites dans l'OpenAPI avec `security: []` et un quota de débit par jeton.

##### Tâches / Sous-tâches

- [ ] Migration `order_upload_links` : id, order_id, token_hash, expires_at, revoked_at, submitted_at, created_by (CA : 1, 8, 9, 10)
- [ ] Routes publiques non authentifiées + limitation de débit par jeton (CA : 2, 11)
- [ ] Page `src/pages/public/upload/[token].tsx` — items, dépôt, liste, suppression, téléchargement des publics (CA : 3, 4, 5)
- [ ] Dépôt direct vers le stockage objet par URL signée (CA : 4, 12)
- [ ] Bouton de validation + émission de `order.files_submitted` + bascule d'étape (CA : 7)
- [ ] Bascule en lecture seule après validation (CA : 9)
- [ ] Message générique unique pour tous les cas d'échec (CA : 11)

##### Dev Notes

###### Sécurité

- Stocker le **hash** du jeton, jamais le jeton en clair : une fuite de base ne doit pas ouvrir tous les liens actifs.
- Le contrôle d'extension et de taille est **serveur** ; un contrôle navigateur seul se contourne.
- Un lien donne accès à une commande et à rien d'autre : jamais de liste des commandes du client, jamais de prix.

###### Contraintes techniques

- La bascule d'étape passe par le même service que E10.14 : la transition est journalisée dans `order_status_history` avec un auteur `system:upload_link`.
- La validation est idempotente : un double clic ne produit qu'une transition.

###### data-testid

`order-upload-link-generate-btn`, `order-upload-link-display`, `order-upload-link-copy-btn`, `order-upload-link-revoke-btn`, `upload-page`, `upload-item-block` (+ `data-item-id`), `upload-dropzone`, `upload-file-row` (+ `data-file-id`), `upload-file-delete-btn`, `upload-public-file-download-link`, `upload-submit-btn`, `upload-readonly-banner`, `upload-generic-error`

###### Dépendances

- Bloquée par : E10.0, E10.13, E10.14, E10.17

##### Tests

Parcours P13 — dépôt en deux sessions puis validation ; contrôle que le statut ne bouge qu'à la validation. Cas limite : lien révoqué puis regénéré, ancien lien refusé avec message générique.

##### Change Log

- 2026-09-01 — v1 — Création suite au WM du 01/09/2026 ; abroge la partie « lien de dépôt » de la E10.17 du 28/08 — Arnaud Mazon / Claude

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
| [TF-186](https://app.notion.com/3cad0131973c8132a47fd048f7c30cf1) | GC — Limite : lien de dépôt révoqué puis regénéré, et message générique | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.20 |
| [TF-189](https://app.notion.com/3ced0131973c81e6a99cf0914d9647d7) | GC — Fichiers par item : visibilité privée par défaut au back-office, bascule publique | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.17, E10.20 |
| [TF-228](https://app.notion.com/3d7d0131973c81c9bcb7de296907db99) | TF-001 — Creation d'un lien de depot depuis le panneau (chemin nominal) | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.20a |
| [TF-229](https://app.notion.com/3d7d0131973c8122af77ca489e4d9e85) | TF-002 — Revocation d'un lien, effet immediat | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.20a |
| [TF-230](https://app.notion.com/3d7d0131973c819f914acfdbcabdb1af) | TF-003 — Plafond de 10 liens vivants atteint | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.20a |
| [TF-231](https://app.notion.com/3d7d0131973c81f89c28c309590d093d) | TF-004 — Isolation tenant : revocation et lecture d'un lien d'un autre tenant refusees | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.20a |
| [TF-232](https://app.notion.com/3d7d0131973c8184970ff004785ba36f) | TF-005 — L'en-tete de lien hors de son mode n'evince jamais un cookie de session boutique | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.20a |
| [TF-233](https://app.notion.com/3d7d0131973c81c4ab3fc59d1cbb01d2) | TF-001 — Depot nominal via le lien public, badge visible cote atelier | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.20b |
| [TF-234](https://app.notion.com/3d7d0131973c814285d7f2ee0822bf3f) | TF-002 — Lien invalide, expire ou revoque : message unique et indistinct | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.20b |
| [TF-235](https://app.notion.com/3d7d0131973c81e68286edc481d8f77f) | TF-003 — Non-regression securite critique : confirmation par lien fermee a la cle anon | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.20b |
| [TF-236](https://app.notion.com/3d7d0131973c81a38d68e611a1e6805c) | TF-004 — Plafond max_files du lien atteint : depot refuse | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.20b |
| [TF-237](https://app.notion.com/3d7d0131973c81db93e0d0de523ae560) | TF-005 — Reprise apres perte reseau : Reessayer relance un envoi complet | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.20b |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Lots développés sous leur propre story document

- [E10.20a](story-E10.20a.md)
- [E10.20b](story-E10.20b.md)

### Fichiers du dépôt qui citent E10.20

- `_bmad-output/implementation-artifacts/story-E10-14-modale-statut-historique.md`
- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10.17a.md`
- `_bmad-output/implementation-artifacts/story-E10.20b.md`
- `docs/api/CONVENTIONS.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/order-files-repository.ts`
- `src/modules/_shared/api/contracts.ts`
- `src/modules/_shared/application/problem.ts`
- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/order-files/api/contracts.ts`
- `src/modules/order-upload-links/ui/order-upload-links.helpers.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/gescom-middleware.ts`
- `src/server/api/order-upload-links-routes.ts`
- `supabase/migrations/20260909000000_gescom_e10_14_order_step_changes.sql`
- `supabase/migrations/20260909060000_gescom_e10_17a_order_files.sql`
- `supabase/migrations/20260910000400_gescom_e10_20b_order_upload_link_deposit.sql`
- `tests/contract/_fakes/order-upload-links-repository.fake.ts`
- `tests/contract/_lint.ts`
