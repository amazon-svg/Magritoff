---
id: E10.10
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c81e58dd5e1429fc94e85
---
# E10.10 — Affichage optionnel des remises sur le document de devis

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.10 — Affichage optionnel des remises sur le document de devis](https://app.notion.com/p/3cad0131973c81e58dd5e1429fc94e85) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | S | Pas commencé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 12 |

### Description fonctionnelle (Notion)

**En tant que** commercial, **je veux** choisir d'afficher ou de masquer les remises sur le devis remis au client, **afin de** maîtriser ce que révèle mon offre sans altérer les données enregistrées.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : l'affichage des remises est une option du devis, en particulier pour les remises négatives que l'on ne souhaite pas exposer. Le masquage est **cosmétique** : les données et l'audit restent complets côté administrateur.

##### Critères d'acceptation

1. Un interrupteur « Afficher les remises » est disponible au niveau du devis ; sa valeur par défaut est paramétrable au niveau du tenant.
2. Interrupteur désactivé : le document client n'affiche ni colonne de remise, ni mention du prix client d'origine ; seul le prix de vente apparaît.
3. Le masquage n'altère aucune donnée persistée : `discount_rate` et `margin_variation` restent renseignés.
4. Le back-office affiche toujours les remises, quel que soit l'état de l'interrupteur.
5. Le basculement de l'interrupteur est journalisé dans l'audit du devis (E10.9).
6. Le rendu PDF ou HTML du devis respecte l'état de l'interrupteur au moment de l'édition du document.

##### Tâches / Sous-tâches

- [ ] Colonne `quotes.show_discounts` + paramètre tenant par défaut (CA : 1)
- [ ] Conditionnement du rendu du document client (CA : 2, 6)
- [ ] Entrée d'audit sur basculement (CA : 5)
- [ ] Vérification que le back-office ignore l'interrupteur (CA : 4)

##### Dev Notes

###### Contraintes techniques

- Le filtrage se fait à la **vue**, jamais à la donnée. Une implémentation qui remettrait `discount_rate` à zéro pour masquer casserait l'audit exigé en E10.9.

###### data-testid

`quote-show-discounts-toggle` (+ `data-state="on"|"off"`), `quote-document-discount-col`

###### Dépendances

- Bloquée par : E10.9

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0**. L'interrupteur est un champ du devis, pas un paramètre de rendu :

| Méthode | Route | Objet |
| --- | --- | --- |
| PATCH | `/api/v1/quotes/{id}` | Champ `show_discounts` (`If-Match`) |
| GET | `/api/v1/tenants/current/settings` | Dont `default_show_discounts` |

Le filtrage s'applique **à la vue et au document**, jamais à la donnée : l'API back-office renvoie toujours `discount_rate` et `margin_variation`, quelle que soit la valeur de l'interrupteur. Seuls les rendus destinés au client (document PDF de E10.19, espace boutique) les omettent.

##### Tests

Parcours P13 — devis avec remise négative, interrupteur désactivé : absence de la colonne côté document, présence de la valeur en base et dans le back-office.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

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
| [TF-176](https://app.notion.com/3cad0131973c81d98e46eb8745c4d9f7) | GC — Masquer les remises sur le document client sans perdre la donnée | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.10, E10.9 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Lots développés sous leur propre story document

- [E10.10a](story-E10-10a-envoi-duplication-remise-globale.md)

### Fichiers du dépôt qui citent E10.10

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-E10-10a-envoi-duplication-remise-globale.md`
- `_bmad-output/implementation-artifacts/story-E10-9-remises-granulaires.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `supabase/migrations/20260901000600_gescom_e10_3_commercial_quotes.sql`
