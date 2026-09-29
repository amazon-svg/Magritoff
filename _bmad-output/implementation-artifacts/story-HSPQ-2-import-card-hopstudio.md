---
id: HSPQ-2
epic: Integration HopeStudio
status: done
branch: feat/hopstudio-project-quote-callback
depends_on: [HSPQ-1]
blocks: [HSPQ-3]
---
# HSPQ-2 — Ajouter une card HopeStudio au projet

<!-- notion-functional:begin — aucune story Notion rattachée ; section maintenue dans le dépôt (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel

> Cette story est née dans le dépôt pendant l’intégration HopeStudio. Aucune
> page Notion ni aucun cas de test Notion ne lui est rattaché au 29/09/2026.

**En tant que** commercial, **je veux** ajouter le chiffrage sélectionné dans
HopeStudio au projet courant, **afin de** préparer un devis sans ressaisie.

### Critères d’acceptation

1. `window.HChat.callbackAddToBasket(card, rankSelected)` ajoute une ligne au
   projet courant et utilise le prix du processus sélectionné.
2. Le libellé et le détail de la ligne proviennent de la card ; le détail clair
   est obtenu avec `getCardClearResume(card)` puis sécurisé avant stockage.
3. Le payload complet de la card est conservé dans
   `project_items.quote_payload.hopstudio.card`.
4. Le PDF fournisseur est demandé par l’API HopeStudio prévue à cet effet et
   joint à la ligne avec le type `supplier_quote`.
5. Les gabarits sont demandés avec `getCardSvgs(card, callback)` ; les formats
   `response` récent et `reponses` historique sont acceptés.
6. Chaque SVG est transformé par HopeStudio en version PAO `customer` et en
   version production `internal`, sans nettoyage SVG réimplémenté par Magrit.
7. Une réponse de gabarits absente ou invalide produit un avertissement mais ne
   bloque pas l’ajout de la ligne.
8. L’utilisateur reçoit un retour visible après l’ajout et le compteur
   d’éléments du projet est actualisé.
9. Une même clé d’import rejouée ne crée pas une seconde ligne.

### Cas de test rattachés

Voir `CT-HSPQ-008` à `CT-HSPQ-016` dans le
[carnet de tests de la PR](./carnet-tests-hopstudio-project-quote-callback.md).

---

_Fin du périmètre fonctionnel. La suite décrit l’implémentation._
<!-- notion-functional:end -->

## Implémentation livrée

- Le callback navigateur ne fait pas d’appel direct à `CallAI`.
- La commande d’import contient la card, le résumé sécurisé, le prix retenu et
  les fichiers réellement obtenus.
- Le PDF fournisseur et les SVG filtrés sont stockés dans le bucket privé puis
  associés au `project_item` créé.
- Si un fichier transmis ne peut pas être stocké, la ligne nouvellement créée
  est retirée afin d’éviter un chiffrage partiel trompeur.
- L’accueil et le Studio exposent le bouton `Éléments du projet` avec un badge
  actualisé après chaque ajout.

## Compatibilité HopeStudio

Le parseur accepte :

- le contrat courant `{ response: [{ sources: string[], svg: string }] }` ;
- le contrat historique `{ reponses: [{ sources: string, svg: string }] }`.

Les fonctions `getDesignerSVG` et `getPrinterSVG` restent obligatoires pour
produire les fichiers : Magrit ne doit pas exposer le SVG brut au client.

## Preuves et fichiers principaux

- `src/modules/hopstudio/ui/HopeStudioWorkspace.tsx`
- `src/modules/projects/api/contracts.ts`
- `src/modules/projects/application/projects-service.ts`
- `src/adapters/supabase/projects-repository.ts`
- `src/modules/catalog/ui/workspace/DualToolWorkspace.tsx`
- `src/modules/catalog/ui/workspace/MagritConfiguratorHome.tsx`
- `tests/modules/hopstudio/workflow-transport.test.ts`
- `tests/contract/projects.contract.test.ts`

## Dette et vigilance

- Le timeout de récupération des gabarits garantit que l’ajout reste possible,
  mais un gabarit arrivé après ce délai n’est pas rattaché automatiquement.
- Le runtime HopeStudio est versionné dans le dépôt ; une mise à jour de son
  contrat doit conserver les tests des deux formes de réponse tant que les
  caches clients historiques ne sont pas expirés.

