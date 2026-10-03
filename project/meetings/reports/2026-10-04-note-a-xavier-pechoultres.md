---
id: REPORT-2026-10-04-NOTE-XAVIER
title: Note à Xavier Péchoultres — trois sujets techniques à trancher
date: 2026-10-04
status: draft
source: REPORT-2026-10-03-PASSE-QUALITE
---

# Note à Xavier Péchoultres — trois sujets techniques à trancher

La passe de qualité du backlog, menée dans la nuit du 3 au 4 octobre 2026 après la migration depuis Notion, a relevé trois sujets qui sortent du périmètre produit et relèvent de l'architecture. Arnaud Mazon a arbitré le reste ; ces trois-là te reviennent.

Le détail complet des constats est dans `2026-10-03-rapport-passe-qualite-backlog.md`. Cette note isole ce qui demande ta décision.

---

## 1. Le contrat d'API est une API de lecture — et il publie l'inverse de ce qu'attend Studio

### Le constat

Sur l'ensemble de `openapi/magrit-core.v1.yaml`, **une seule opération exige une portée d'écriture pour une clé de service** : `changeOrderProductionStep`, avec `orders:write`.

Toutes les autres opérations d'écriture — `createQuoteFromProject`, `convertQuote`, `createProject`, `importHopeStudioBasketItem` — sont en `bearerAuth` seul, c'est-à-dire réservées à un jeton d'utilisateur. Un module tiers porteur d'une clé de service peut donc **lire** devis, commandes, clients, projets, tags et règles de prix. Il ne peut **ni créer un devis, ni le convertir en commande, ni importer une carte**.

Trois conséquences s'enchaînent.

**La livraison d'événements vers un abonné tiers n'est pas ouverte.** Le bus publie bien dans `outbox_events`, avec charge utile versionnée et signature HMAC. Mais aucun endpoint d'abonnement n'existe, et le scope `events:subscribe` ne gouverne aucune opération. Les charges utiles sont fermées et opposables ; le transport ne l'est pas. Aucune story du backlog ne porte cette ouverture.

**Aucune émission ni gestion de clé de service n'existe en production.** Le principal `kind: 'service'` n'est construit que dans les tests. Il n'y a ni création, ni rotation, ni révocation, ni journal d'usage par clé, ni plafond par clé.

**Le sens de l'intégration Studio est inversé par rapport à la story.** Le contrat publie **Studio → Magrit** : `POST /projects/{projectId}/hopstudio-items`, qui reçoit `card.DBK`, `prompt`, `configuration` et `clicked_intent.getPrice.response`. Or `US-CONV-02` — « API copilote Studio : brief → product card → prix », priorité P0 — décrit le sens **Magrit → Studio**. Aucune opération du contrat ne prend un brief en entrée. Les deux portes sortantes qui existent réellement (relais de flux et interception de `/assistant/chat`) vivent dans le fichier de contrat **déprécié**, portent l'espace dans le chemin contrairement à l'invariant posé par `E10.0`, rendent un corps nu et n'ont aucun test de contrat.

### Ce qu'il faut trancher

1. **Une clé de service doit-elle pouvoir écrire ?** Tant que ce n'est pas décidé, `E5.1`, `E5.2` et `US-CONV-02` se réduisent toutes les trois à de la lecture, et la promesse « Magrit comme moteur » n'est pas tenue techniquement.
2. **Qui publie l'API de `US-CONV-02` : Magrit ou Studio ?** La source Notion ne le dit pas, et le dépôt contient les deux directions. Rien ne peut se décider ni s'estimer tant que ce point reste ouvert — et c'est précisément ce que tu attends depuis le WM du 1er septembre.
3. **Quand ouvre-t-on l'inscription d'un abonné tiers au bus d'événements ?** C'est un préalable de `E5.1` et de `E5.2`, porté par aucune story.

### Une fenêtre qui se ferme

Le vocabulaire de Studio est gravé dans la v1 du contrat : `card.DBK`, `clicked_intent`, objets ouverts. Le remplacer par une commande neutre est encore possible aujourd'hui, parce qu'aucun intégrateur tiers n'a branché. Après le premier, la règle « v1 additive seulement » posée par `E10.0` impose une `/api/v2`. L'architecte l'avait recommandé ; la décision n'a pas été prise.

---

## 2. Le chantier UM fait autorité sans décision écrite

### Le constat

Le chantier « gestion des utilisateurs » d'août 2026 a remplacé le modèle de droits :

| Ancien modèle | Modèle en vigueur |
|---|---|
| deux portées `magrit_full` / `shop_only` | trois types de compte, documentés dans `docs/SHOP_ACCESS_CONTROL.md` |
| quatre droits `can_*` sur l'appartenance | deux options produit, Boutiques et Commandes |
| délégation possible | règle « admin unique » : le déclencheur `restrict_magrit_assignments_to_options` refuse d'affecter un droit d'administration à un membre ordinaire |

Ce modèle est **appliqué par le code et opposable de fait**. Il ne porte **aucun fichier dans `project/decisions/`**. Il vit dans `docs/SHOP_ACCESS_CONTROL.md` et dans des commentaires de `docs/api/CONVENTIONS.md`.

Au regard de `project/governance/source-of-truth.md`, une décision produit fait foi quand elle est approuvée dans `project/decisions/product`. Celle-ci n'y est pas.

### Pourquoi ça compte maintenant

Sept stories du backlog décrivent encore l'ancien modèle : `E9.1`, `E9.2`, `E9.3`, `E9.9`, `E9.10`, `E9.13` et `E10.11`. `E9.3` est périmée en totalité — elle spécifie les quatre droits `can_*` et les deux portées.

Un agent de développement qui lit `E9.3` et la prend pour une spécification implémenterait un modèle de droits abandonné. C'est exactement le genre de divergence que la gouvernance du 1er octobre cherche à empêcher.

Même situation, de moindre portée, pour **la forme de l'URL de boutique**, tranchée le 19 septembre 2026 : l'arbitrage vit dans `docs/api/CONVENTIONS.md`, sans fichier de décision. `E4.WM2` en dépend.

### Ce qu'il faut

Une décision produit écrite actant le modèle UM — trois types de compte, deux options, admin unique — avec sa date et son périmètre. Puis le passage de `E9.3` en `superseded` avec son successeur renseigné, et la révision des six autres stories.

Je n'ai touché aucun statut : au regard de la gouvernance, un agent ne s'attribue pas une approbation produit, et les rôles d'approbation ne sont pas encore attribués (`OQ-GOV-ROLES`).

---

## 3. Deux points d'hygiène relevés au passage

Ils ne demandent pas d'arbitrage, seulement une décision de ta part sur l'opportunité.

**`pnpm test` n'est exécuté par aucune chaîne d'intégration continue sur une demande de fusion vers `main`.** Quatre workflows existent — `architecture.yml`, `project-governance.yml`, `quality-audit.yml` en consultatif, `a11y.yml`. Seuls les tests d'architecture, les tests de contrat et un répertoire ciblé sont joués. Par ailleurs `a11y.yml` se déclenche encore sur `beta/v5`, pas sur `main`.

**Dix-huit `data-testid` sont écrits en clair dans les composants** sans figurer au registre `src/shared/presentation/testIds.ts`, alors que `CLAUDE.md` l'interdit. Le dépôt n'a aucune configuration ESLint, et le contrôle existant ne vérifie que la présence des identifiants critiques, pas la réciproque. Sans garde-fou automatique, l'écart se reformera. Le brief `SPEC_data-testid_06052026.md` qui définissait le périmètre est par ailleurs introuvable dans le dépôt.

---

## Pour mémoire — ce qui a été traité de notre côté

- **`TF-16`**, au statut KO depuis le 24 août et non rejouable depuis la sortie de Notion : vérification faite, la garde existe aux deux niveaux, et un test de non-régression la fige désormais (`tests/architecture/members-administration-guard.test.ts`).
- **Modèle d'entités d'une franchise** : arbitré par Arnaud Mazon le 4 octobre — la tête de réseau est un tenant, chaque franchisé est un sous-espace. Décision enregistrée sous `PD-2026-10-04-B3-FRANCHISE`, propagée en renvoi dans les douze stories `T-01` et `T-02`.
- **Changement de palier d'offre sans paiement** : constat confirmé, `magrit.update_tenant_settings` protège l'identifiant d'URL mais pas le champ `plan`. Arnaud le traite lors de l'implantation du modèle de monétisation ; consigné en `OQ-MONETISATION-PALIERS`.
- **Quatre entrées retirées du backlog** parce qu'elles ne décrivent aucun comportement produit : `Q-ARBITRAGES`, `E_PIM.audit-classification-ERAM`, `E6.4`, `US-INT-06`. Le backlog compte 201 stories.
