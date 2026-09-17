---
id: E10.15
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c81ff895ac6e40cbfba5f
---
# E10.15 — Objet Notification multicanal : email et SMS, architecture extensible

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.15 — Objet Notification multicanal : email et SMS, architecture extensible](https://app.notion.com/p/3cad0131973c81ff895ac6e40cbfba5f) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Pas commencé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 20 |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur d'espace, **je veux** déclarer des notifications par événement, par canal et par modèle personnalisable avec des balises dynamiques, **afin d'**informer mes clients sans jamais rédiger un message à la main.

##### Statut

Draft — prêt pour agent dev. **Enrichie au WM du 01/09/2026 : modèle d'événement abstrait et templates à balises.**

##### Contexte produit

La version du 28/08 posait le canal et la file d'envoi mais ne disait rien du **contenu**. Xavier Péchoultres au WM du 01/09/2026 : « je n'ai pas vu d'information concernant le contenu de la notification, il faut prévoir que ce soit personnalisable » et « il y a forcément des balises qui vont être remplacées, une liste de balises remplaçables — le client, le numéro de commande… il faut se rapprocher des usages standard ».

Deuxième apport : le déclencheur ne se limite pas au changement d'étape de production. Il faut « déclarer une classe d'événements — des modifications de statut de commande, mais aussi des choses comme nouveau client ». Le modèle doit donc être abstrait dès le départ.

##### Critères d'acceptation

1. Un **catalogue d'événements** est déclaré côté serveur, chacun avec son jeu de balises disponibles. Événements de la V1 : `order.step_changed`, `order.created`, `order.files_submitted`, `quote.sent`, `quote.converted`, `customer.created`.
2. Pour `order.step_changed`, l'abonnement se fait **étape par étape** : l'administrateur choisit sur quelles étapes de production (E10.13) la notification part.
3. Un modèle de notification porte : événement, filtre d'étape le cas échéant, canal (`email` \| `sms`), destinataire, objet (email seulement), corps, état actif.
4. Le corps accepte des **balises** de la forme `{{ balise }}`, remplacées à l'envoi. Jeu standard V1 : `{{ customer.name }}`, `{{ contact.first_name }}`, `{{ contact.last_name }}`, `{{ order.number }}`, `{{ order.total_ht }}`, `{{ order.step_label }}`, `{{ order.previous_step_label }}`, `{{ order.date }}`, `{{ order.upload_link }}`, `{{ tenant.name }}`, `{{ tenant.phone }}`, `{{ tenant.email }}`.
5. L'éditeur affiche la liste des balises disponibles **pour l'événement sélectionné** et les insère au clic ; une balise inconnue est refusée à l'enregistrement, pas à l'envoi.
6. Un aperçu rend le message avec un jeu de données d'exemple avant enregistrement.
7. Le canal `sms` n'accepte que du texte brut, avec compteur de caractères et avertissement au-delà de 160 ; le canal `email` accepte un corps HTML avec repli texte généré.
8. Le destinataire par défaut est le contact principal du client (E10.4) ; il est surchargeable par modèle (adresse fixe, ou rôle interne pour les notifications d'exploitation).
9. Le contrat d'adaptateur de canal est isolé : ajouter Slack ou WhatsApp ne modifie ni le moteur, ni les modèles, ni le catalogue d'événements.
10. Chaque envoi est journalisé : modèle, événement, canal, destinataire, horodatage, statut (`queued`, `sent`, `failed`), message d'erreur, et **corps rendu** conservé selon la durée de rétention paramétrée.
11. Un échec d'envoi ne bloque jamais la transaction métier qui a produit l'événement.
12. La file de sortie garantit au moins une tentative de reprise et déduplique sur l'identifiant d'événement.

##### Contrat API

| Méthode | Route | Objet |
| --- | --- | --- |
| GET | `/api/v1/notification-events` | Catalogue des événements et de leurs balises disponibles |
| GET | `/api/v1/notification-templates` | Liste ; `?event=`, `?channel=`, `?is_active=` |
| POST | `/api/v1/notification-templates` | Crée un modèle ; valide les balises contre le catalogue |
| PATCH | `/api/v1/notification-templates/{id}` | Modifie (`If-Match`) |
| POST | `/api/v1/notification-templates/{id}/preview` | Rend le modèle avec un jeu d'exemple, sans envoi |
| GET | `/api/v1/notification-logs` | Journal ; `?status=`, `?order_id=`, `?since=` |

Les événements sortants définis en E10.0 alimentent ce moteur : la notification est un **consommateur** du bus, pas un appel direct depuis le code métier.

##### Tâches / Sous-tâches

- [ ] Catalogue d'événements et de balises en dur côté serveur, exposé par API (CA : 1, 4, 5)
- [ ] Migration `notification_templates` et `notification_logs` (CA : 3, 10)
- [ ] Module `src/modules/notifications/` : moteur, moteur de rendu de balises, adaptateurs `emailAdapter` et `smsAdapter` (CA : 4, 7, 9)
- [ ] Consommateur du bus `outbox_events` → résolution des modèles actifs → file d'envoi (CA : 11, 12)
- [ ] Réutiliser le fournisseur email de E9.5 ; sélectionner un fournisseur SMS (CA : 7)
- [ ] Écran de configuration : liste, éditeur, insertion de balises, aperçu, compteur SMS (CA : 2, 5, 6, 7)
- [ ] Paramètre de rétention des journaux au niveau du tenant (CA : 10)

##### Dev Notes

###### Architecture

```javascript
Transaction métier ─▶ outbox_events ─▶ consommateur notifications
                                        ├─ résout les modèles actifs (événement, étape, canal)
                                        ├─ rend le corps (balises)
                                        ├─ met en file
                                        └─ adaptateur de canal ─▶ journal
```

Un canal est un module exposant `send(payload): Promise<Result>`. Aucune logique métier dans l'adaptateur.

###### Choix de moteur de balises

Ne pas écrire un remplacement par expression régulière artisanale. Utiliser un moteur à liste blanche de variables (Handlebars en mode strict, ou équivalent) : une balise inconnue doit produire une erreur de validation à l'enregistrement, jamais un trou silencieux dans un message envoyé au client.

###### Point à trancher avec Arnaud

La durée de rétention du **corps rendu** dans `notification_logs` porte des données personnelles de contact. Proposition à valider : 12 mois glissants, purge automatique, paramétrable par tenant. Point RGPD à arbitrer avant mise en production.

###### data-testid

`notifications-config-page`, `notification-template-row` (+ `data-template-id`, `data-channel`, `data-event`), `notification-template-create-btn`, `notification-event-select`, `notification-step-filter-select`, `notification-channel-select`, `notification-subject-input`, `notification-body-input`, `notification-tag-list`, `notification-tag-insert-btn` (+ `data-tag`), `notification-preview-btn`, `notification-preview-panel`, `notification-sms-char-counter`, `notification-template-save-btn`, `notification-log-row` (+ `data-log-id`, `data-status`)

###### Dépendances

- Bloquée par : E10.0, E10.13, E10.14
- Réutilise : E9.5 (fournisseur email)
- Consomme : `order.files_submitted` (E10.20), `order.step_changed` (E10.14)

##### Tests

Parcours P13 — modèle email sur l'étape « Livré » avec trois balises, transition de commande, contrôle du rendu et du journal. Cas limite : fournisseur indisponible, la commande change tout de même d'étape et l'échec est journalisé.

##### Change Log

- 2026-08-28 — v1 — Création (objet de notification multicanal) — Arnaud Mazon / Claude
- 2026-09-01 — v2 — Ajout du catalogue d'événements, des modèles à balises, de l'aperçu et du journal détaillé, suite au WM du 01/09/2026 — Arnaud Mazon / Claude

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
| [TF-183](https://app.notion.com/3cad0131973c81ceb41efc9665c0fb5d) | GC — Modèle de notification à balises, aperçu et envoi sur transition d'étape | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.15, E10.14, E10.4 |
| [TF-191](https://app.notion.com/3ced0131973c81048821c83ee8308abf) | GC — Rattacher une notification à une étape depuis l'écran des étapes de production | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.13, E10.15 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Lots développés sous leur propre story document

- [E10.15a](story-E10.15a.md)
- [E10.15b](story-E10.15b.md)
- [E10.15c](story-E10.15c.md)
- [E10.15d-1](story-E10.15d-1.md)
- [E10.15d-2](story-E10.15d-2.md)

### Fichiers du dépôt qui citent E10.15

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-E10-13-etapes-production.md`
- `_bmad-output/implementation-artifacts/story-E10-14-modale-statut-historique.md`
- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10.15a.md`
- `_bmad-output/implementation-artifacts/story-E10.15b.md`
- `_bmad-output/implementation-artifacts/story-E10.20b.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/STORY_DOCUMENT_STANDARD.md`
- `openapi/magrit-core.v1.yaml`
- `src/platform/api/generated/magrit-core.v1.ts`
