---
id: E10.10a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.3, E10.6, E10.9, E10.11]
blocks: [E10.10b]
---
# E10.10a — Envoi/renvoi d'un devis, duplication, remise globale, TVA

Première moitié du périmètre E10.10 (« Remises au-delà de la ligne — première
story à faire porter un statut de devis autre que `draft` »). L'architecte a
scindé E10.10 en deux : E10.10a (ce document, dashboard atelier) et E10.10b
(mise à disposition du devis dans la boutique du client — acteur et surface
différents, non cadrée, non démarrée).

Cadrage fonctionnel obtenu directement d'Arnaud (4 questions) :

1. Un commercial déclenche explicitement l'envoi d'un devis — impression et
   mise à disposition boutique client sont des effets prévus mais hors
   périmètre de ce lot (1b/1c → impression = branchement UI pur, pas de
   nouvel endpoint ; 1c = E10.10b).
2. `show_discounts` est un choix explicite du commercial, jamais une
   conséquence automatique de l'envoi.
3. Un devis `sent` ne se modifie jamais directement — il se **duplique**.
4. Une remise complémentaire, sur l'ensemble du devis, s'ajoute aux remises
   par ligne déjà livrées par E10.9.

Corrections apportées par Arnaud sur la première proposition de contrat :
remise globale en miroir exact d'E10.9 (taux OU prix final visé, jamais un
montant de remise saisi directement) ; majoration (taux négatif) autorisée,
comme au niveau ligne ; renvoi d'un devis déjà envoyé permis ; réglage de
validité par défaut (tenant) avec override par devis ; TVA affichée en bas
du devis.

## Ce qui est livré

| Élément | Détail |
|---|---|
| `sendQuote` | `POST /quotes/{quoteId}/transmissions` — premier envoi (`draft→sent`) ET renvoi (`sent→sent`) dans une seule opération. `sent_at` figé au premier envoi, `last_sent_at` avance à chaque envoi/renvoi. `show_discounts` figé sur renvoi (422 `quote.resend_immutable` si divergent). `Idempotency-Key` structurant. 409 `quote.send_forbidden_status` hors `draft`/`sent`. 422 `quote.send_requires_lines` si aucune ligne. |
| `duplicateQuote` | `POST /quotes/{quoteId}/duplicates` — nouveau devis `draft`, lignes recopiées sans recalcul de prix, `source_quote_id` (traçabilité, colonne `uuid` nue sans FK depuis le round 3), `valid_until` remis à `null`. Entrée d'audit `duplicated` sur l'original. Disponible depuis n'importe quel statut. |
| Garde de statut `updateQuote` | 409 `quote.update_requires_draft` si `status != draft` — soldait la dette p4 (`docs/api/CONVENTIONS.md` §8.6). |
| Remise globale | `global_discount_rate` XOR `target_net_total`, miroir exact d'E10.9. Remise toujours DÉDUITE (`global_discount`, `effective_discount_rate`). Taux borné à `1.0000` en haut, aucune borne basse (majoration légitime). |
| `/commercial-settings` | Ressource singleton nouvelle. `GET` ouvert à tout membre, `PATCH` gardé par `can_manage_pricing`. Porte `default_validity_days`, appliqué à l'envoi si `valid_until` encore `null`, jamais recalculé après coup. |
| TVA | Réutilise `tenants.tax_regime` existant (aucun second réglage fiscal). Table régime→taux portée côté serveur (dupliquée consciemment depuis `src/modules/orders/ui/helpers/tax.ts`, pas importée). `QuoteTotals` gagne `vat_rate`/`vat_amount`/`total_incl_tax`/`vat_regime`. Surcharge possible par devis. |
| Alerte `validity_expired` | Informative dans `warnings`, aucun blocage. |
| `listQuoteHeaderAuditEntries` | `GET /quotes/{quoteId}/header-audit-entries`, gardé par `can_manage_pricing`, distinct du journal des lignes (E10.9/E10.11). |
| Action d'audit `status_forced` | Couvre le cas résiduel où le trigger de prévention serait contourné (bypass RLS/privilège élevé) — arbitrage architecte, `QuoteAuditField` reste fermée à 5 champs. |
| UI | Écran devis (`QuoteEditorPage`) : boutons Envoyer/Renvoyer/Dupliquer, remise globale (mêmes deux champs mutuellement exclusifs que le niveau ligne), encart totaux serveur, TVA + mention légale, lecture seule hors `draft`, onglet journal d'entête gardé par `can_manage_pricing`. Réglage `default_validity_days` dans `PricingRulesPage` (E10.6). |

## Ce qui n'est PAS dans le périmètre

- **E10.10b** (mise à disposition boutique client) — story séparée, non cadrée.
- **Génération de PDF/document imprimable** — aucun nouvel endpoint. Le rendu HTML navigateur existant (`openQuotePrint()`) n'a pas été branché sur `commercial_quotes` dans ce lot.
- `accepted`/`rejected`/`converted` — aucune logique.
- Régime fiscal par client (E10.4) — la surcharge par devis suffit au besoin exprimé.

## QA-review — cinq tours de correction, dont un par exécution réelle

Historique complet dans `docs/api/CONVENTIONS.md` §8.12/§8.12bis/§8.12ter. Résumé :

- **Round 1** (`3bf2151`, `8e616bc`) — **B1** : `vat_rate` signé sans borne basse rendait le devis ET toute la liste du tenant irrécupérables (500 permanent) dès qu'une valeur négative était écrite. **B2** : la policy d'écriture de `price_rules`/`product_range_default_margins` (E10.11) avait perdu la vérification d'appartenance tenant. **B3** (3 volets, le dernier escaladé à l'architecte) : un devis `sent` restait modifiable par `PATCH` direct, silencieusement (le journal ne traçait pas `status`) — trigger d'immuabilité posé, nouvelle action d'audit `status_forced`.
- **Round 2** (`d250fbd`) — **B4** : dupliquer un devis puis supprimer l'original plantait en 500 (FK sans `on delete`). **B5** : un devis `sent`, avec ses deux journaux d'audit append-only, restait supprimable en un `DELETE` direct — trigger étendu en `before update or delete`, avec la même distinction cascade/direct que le modèle E10.9 (`commercial_quote_lines_require_draft_quote`).
- **Round 3** (`3b4058b`) — **B6** : le correctif B4 (`on delete set null`) déclenchait lui-même le trigger d'immuabilité et replantait en 500 dans un cas précis (copie envoyée puis suppression de l'original). Corrigé en retirant la contrainte de clé étrangère (filiation informative assumée, pas une vraie FK).
- **Round 4** (`15c0201`) — **Approved**. Dette `u4` tracée (absence de garde de cohérence tenant au niveau colonne sur `commercial_quotes`, non exploitable en lecture, famille de dette préexistante à E10.3).
- **Round 5** (`0202c42`) — **B7**, trouvé par la **toute première exécution réelle** du fichier SQL (Colima installé sur le poste de développement pour lever la dette Docker définitivement, plus de 6 rounds de scénarios jamais exécutés jusque-là) : l'échappatoire d'immuabilité `magrit.quote_transition` (GUC posé via `set_config(..., true)`) n'était jamais réinitialisée à la sortie de `api_send_commercial_quote` — le raisonnement théorique des rounds précédents (« la clause `SET search_path` de la fonction restaure tout GUC ») était faux. Corrigé, plus deux occurrences du même motif trouvées et corrigées dans des fonctions d'E10.9 (`api_delete_commercial_quote_line`, `api_reorder_commercial_quote_lines`). **Verdict final : Approved**, vérifié par exécution réelle, contrôle négatif (le test échoue contre le code d'avant) et introspection indépendante de `pg_proc` pour confirmer l'absence d'autres occurrences.

## Vérifications

`pnpm typecheck`, `pnpm gen:api:check`, `pnpm test:contract` (204/204),
`pnpm test:architecture` (143/143), `npx vitest run` (1596 passés, 3 échecs
pré-existants sans rapport — `tests/storage/product_mockups_isolation.test.ts`).

`tests/sql/gescom-e10-10a-quote-send-duplicate.sql` : **exécuté réellement**
(Colima/Docker local, round 5) — `EXIT=0`, 24/24 blocs `do $$`, `ROLLBACK`
final, aucune erreur. Valeur probante démontrée par contrôle négatif contre
le code pré-B7. `tests/sql/gescom-e10-11-can-manage-pricing.sql` confirmé non
affecté, passe également en exécution réelle.

## Dette restante

- **u4** — `commercial_quotes` n'a aucune garde de cohérence de tenant au niveau
  colonne (`customer_id`, `project_id`, `source_quote_id`). Non exploitable en
  lecture (aucune jointure). Famille de dette préexistante à E10.3, pas une
  régression de ce lot. Chemin : trigger de cohérence tenant si une story
  future rend l'une de ces colonnes réellement déréférençable.
- Dette découverte en marge, hors périmètre, non corrigée : `gescom-e10-3-commercial-quotes.sql`
  et `gescom-e10-9-quote-line-discounts.sql` échouent sur `protect_last_tenant_admin`
  (`20260824000200_um1_admin_shop_guards.sql`, chantier UM1, antérieur à E10.9)
  lors de leur phase RLS ; `gescom-e10-6-price-rules.sql` échoue sur une
  assertion d'audit sans rapport. À trier séparément.
- `quote_line.changed` (E10.9) reste un événement jamais émis par aucun code —
  dette préexistante, pas de cette story.
- UI : impression non branchée (hors périmètre assumé), vérification
  navigateur du golden path faite par l'orchestrateur (pas par l'agent
  dev-story, qui n'a pas d'outil navigateur) après déploiement de la
  migration.

## Intégration

Développée directement sur `feat/gescom-e10-4-entite-client`, comme E10.11 et
le reste du chantier E10. Migration `20260906160000_gescom_e10_10a_send_duplicate_global_discount.sql`
(jamais déployée avant ce lot, modification en place légitime).

**Erreur de process détectée après le verdict qa-review round 5, corrigée
avant déploiement** : le correctif GUC d'E10.9 avait d'abord été écrit
directement dans `20260904000100_gescom_e10_9_quote_line_discounts.sql`, sur
la foi d'une vérification par `git ls-tree origin/main` (qui confirmait
« jamais remontée sur `main` ») prise à tort pour une preuve de non-
déploiement. `supabase migration list --linked` a révélé que cette migration
**était déjà appliquée** sur le projet Supabase partagé (poussée depuis cette
branche avant ce round, indépendamment de tout merge Git). Corrigé : le
fichier restauré à son contenu d'origine, le correctif porté par une
migration additive séparée `20260906185313_gescom_e10_9_fix_change_set_id_guc_leak.sql`.
Revérifié par `pnpm db:local:reset` complet + réexécution des deux fichiers
SQL de la story (E10.10a et E10.11), tous deux verts.

**Point de vigilance signalé par qa-review round 5** : la branche `wip/E10.11-handoff`
(créée le 2026-09-04 pour une tentative de reprise en dispatch cloud, jamais
utilisée, jamais mergée) porte encore l'ancienne version de
`20260904000100_gescom_e10_9_quote_line_discounts.sql` sans le correctif GUC
du round 5. Si cette branche est un jour remontée après ce lot, elle
réintroduirait la fuite `change_set_id`. À supprimer ou à ne jamais merger.
