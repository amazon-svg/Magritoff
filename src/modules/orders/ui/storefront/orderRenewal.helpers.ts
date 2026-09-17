/**
 * Helpers purs pour le renouvellement de commande (Story S3.3 Sprint 5).
 *
 * Cible : reconstruire un panier à partir des items snapshotés d'une commande
 * passée (tenant_order_items) en résolvant chaque item contre le catalogue
 * shop courant (ShopProduct[]).
 *
 * Stratégie de matching :
 *   1. Si item.product_id (UUID) présent et match un produit du catalogue
 *      → ligne ajoutée au cart avec la qty originale
 *   2. Sinon (product_id null OU produit retiré) → warning + skip
 *
 * Décision de conception (S3.3 AC2 / AC3) :
 *   - On NE tente PAS de fuzzy match par product_label (trop fragile, risque
 *     d'ajouter le mauvais produit silencieusement). Préférence pour un
 *     warning explicite que l'acheteur peut traiter manuellement.
 *   - On préserve les options Clariprint snapshotées (clariprint_options jsonb)
 *     en les mergeant dans le `config` du ShopProduct catalogue courant pour
 *     conserver les choix faits à la commande originale (matière, finition,
 *     etc.) tout en bénéficiant de l'image / prix courants du catalogue.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6) — quatrième porte du
 * panier : `rebuildCartFromOrderItems` ne passe pas par `addToCart`, une
 * discipline posée uniquement là-bas l'aurait laissée ouverte. Elle passe
 * donc par le même point unique, `toPackLine` :
 *   - si `clariprint_options.quantity` est un nombre positif, l'item vient
 *     d'un produit CONFIGURÉ (forfait pour N exemplaires) : on reconstruit
 *     via `toPackLine(product, copies(clariprint_options.quantity), packs(qty))`,
 *     où `qty` (nombre de PAQUETS) vient de `item.quantity`, PRÉSERVÉ —
 *     jamais figé à 1. Round 1 de ce lot figeait `qty` à `ONE_PACK`
 *     inconditionnellement (qa-review, défaut 1) : un acheteur qui avait
 *     commandé 2 paquets à 70 € (le tiroir panier permet de cumuler, voir
 *     `cartLine.ts`) retrouvait 1 paquet à 35 € après un renouvellement,
 *     sans avertissement. C'est l'unité qu'il fallait fermer, PAS la valeur
 *     (cadrage §8.25 point 3.6 (b), conséquence 1) ;
 *   - sinon, `item.quantity` (`tenant_order_items.quantity`) est un nombre
 *     de PAQUETS ordinaire (produit non configuré, quantité réellement
 *     multipliable) : il est préservé tel quel, comme avant ce lot.
 *   Ce choix est délibéré et n'est PAS une heuristique sur la magnitude de
 *   `item.quantity` : une commande ancienne fautive où le nombre
 *   d'exemplaires aurait fuité dans `item.quantity` SANS que
 *   `clariprint_options.quantity` ne le confirme n'est pas "réparée" à la
 *   volée — elle est reconstruite telle qu'écrite, quitte à afficher un total
 *   visiblement faux plutôt que de le corriger en silence (voir CONVENTIONS
 *   §8.25 point 3.6 (e), tests T6/T7).
 */

import type { ShopProduct } from '@/modules/shops';
import type { CartLine } from '@/modules/orders/ui/storefront/types';
import { copies, packLine, packs, toPackLine } from '@/modules/orders/ui/storefront/cartLine';

/**
 * Q14-a round 2 (docs/api/CONVENTIONS.md §8.25 point 3.7 (c-bis)) — défaut D1
 * de la qa-review, corrigé par l'architecte.
 *
 * `PortalCart.tsx` titrait TOUT le bandeau de renouvellement « N produit(s)
 * indisponible(s) (non ajouté(s) au panier) », y compris les avertissements
 * de prix non ferme que Q14-a round 1 y avait versés : une ligne
 * effectivement AJOUTÉE au panier s'affichait comme non ajoutée. La faute
 * était au cadrage, qui prescrivait le canal sans lire son titre.
 *
 * Deux catégories, jamais un seul titre pour les deux : cette fonction pure
 * rend les sections non vides, DANS CET ORDRE (non ajoutés, puis prix non
 * ferme), avec leurs textes déjà composés. `PortalCart` ne compose AUCUN
 * texte : il ne fait que parcourir le tableau rendu ici.
 */
export type RenewalBannerSectionKind = 'not-added' | 'price-not-firm';

export interface RenewalBannerSection {
  kind: RenewalBannerSectionKind;
  /** Titre de la section — accordé au singulier/pluriel selon le nombre d'items. */
  title: string;
  /** Phrase secondaire sous le titre — seulement pour 'price-not-firm'. */
  detail?: string;
  items: readonly string[];
}

/**
 * Reprend mot pour mot l'infobulle du badge « Prix marché » (point 4 (e) du
 * cadrage) : la même phrase partout où le prix n'est pas définitif.
 */
const PRICE_NOT_FIRM_DETAIL =
  "Le prix définitif est confirmé par l'imprimeur à la validation de la commande.";

export function renewalBannerSections(
  notAdded: readonly string[],
  priceNotFirm: readonly string[],
): RenewalBannerSection[] {
  const sections: RenewalBannerSection[] = [];

  if (notAdded.length > 0) {
    const n = notAdded.length;
    sections.push({
      kind: 'not-added',
      // Libellé INCHANGÉ (sens d'origine S3.3) : c'est la même phrase que le
      // bandeau à une seule section rendait avant ce lot.
      title: `${n} produit${n > 1 ? 's' : ''} indisponible${n > 1 ? 's' : ''} (non ajouté${n > 1 ? 's' : ''} au panier)`,
      items: notAdded,
    });
  }

  if (priceNotFirm.length > 0) {
    const n = priceNotFirm.length;
    sections.push({
      kind: 'price-not-firm',
      title: `${n} produit${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} au panier avec un prix non définitif`,
      detail: PRICE_NOT_FIRM_DETAIL,
      items: priceNotFirm,
    });
  }

  return sections;
}

/**
 * DTO d'un item de commande tel que renvoyé par la query Supabase
 * SELECT * FROM tenant_order_items WHERE order_id = ?
 */
export interface OrderItemRow {
  product_id: string | null;
  product_label: string | null;
  clariprint_options: Record<string, unknown> | null;
  quantity: number;
  unit_price_ht: number | null;
}

export interface RebuildResult {
  /** Lignes prêtes à injecter via setCart(). */
  lines: CartLine[];
  /**
   * Warnings utilisateur (1 par item non résolu).
   * Format prêt à afficher dans un banner.
   */
  warnings: string[];
  /** Métriques pour debug / observabilité (logs ou banner détaillé). */
  stats: {
    matched: number;
    skipped: number;
    total: number;
  };
}

/**
 * Reconstruit un cart depuis les items d'une commande passée.
 *
 * @param items - items snapshotés tenant_order_items (any order_id)
 * @param currentShopProducts - catalogue shop courant (ShopProduct[])
 * @returns lines (à passer à setCart) + warnings (à afficher en banner)
 */
export function rebuildCartFromOrderItems(
  items: OrderItemRow[],
  currentShopProducts: ShopProduct[],
): RebuildResult {
  const productById = new Map<string, ShopProduct>();
  for (const p of currentShopProducts) productById.set(p.id, p);

  const lines: CartLine[] = [];
  const warnings: string[] = [];
  let matched = 0;
  let skipped = 0;

  for (const item of items) {
    const label = item.product_label?.trim() || 'Produit sans libellé';
    const qty = Math.max(1, Math.floor(item.quantity || 1));

    if (!item.product_id) {
      warnings.push(`Produit indisponible : ${label} (référence catalogue manquante)`);
      skipped++;
      continue;
    }

    const product = productById.get(item.product_id);
    if (!product) {
      warnings.push(`Produit indisponible : ${label} (retiré du catalogue)`);
      skipped++;
      continue;
    }

    // BCP-11 — quatrième porte : un `clariprint_options.quantity` numérique
    // et positif signale un produit CONFIGURÉ (forfait pour N exemplaires) ;
    // on passe alors par le point unique `toPackLine`, qui écrit
    // `config.quantity` et qui reçoit EXPLICITEMENT `packs(qty)` en troisième
    // argument : `qty` (paquets, ligne 95) N'EST PAS figé à 1, il vient de
    // `item.quantity`, exactement comme dans la branche non configurée
    // ci-dessous. Round 1 de ce lot figeait `qty` à `ONE_PACK`
    // inconditionnellement — régression relevée en qa-review (défaut 1) :
    // un acheteur ayant commandé 2 paquets à 70 € retrouvait 1 paquet à 35 €
    // après un renouvellement, sans avertissement. `toPackLine` reste seul
    // responsable de l'écriture de `config.quantity` — le snapshot
    // `clariprint_options` NE le fournit PAS pré-mergé (voir `quantity`
    // exclu ci-dessous), sinon un retrait accidentel de cette écriture dans
    // `toPackLine` resterait invisible (la valeur "correcte" continuerait de
    // fuiter par le merge). Sans le signal `clariprint_options.quantity`,
    // `item.quantity` est un nombre de paquets ordinaire et reste tel quel
    // (voir le commentaire de tête sur le résidu volontairement non
    // "réparé").
    const rawCopyCount = item.clariprint_options?.quantity;
    const isConfigured =
      typeof rawCopyCount === 'number' && Number.isFinite(rawCopyCount) && rawCopyCount > 0;

    // Merge options Clariprint snapshotées avec config produit catalogue.
    // Les snapshots ont priorité (préservent les choix de la commande originale)
    // mais la config courante reste accessible pour les clés non snapshotées
    // (ex: image_url, default prix marché). `quantity` est exclu du snapshot
    // fusionné quand `toPackLine` va de toute façon l'écrire (raison
    // ci-dessus) : la seule source de `config.quantity` doit être ce point
    // unique, jamais une fusion antérieure qui porterait accidentellement la
    // même valeur.
    const { quantity: _snapshotQuantity, ...clariprintOptionsRest } = item.clariprint_options ?? {};
    const mergedConfig: Record<string, unknown> = {
      ...(product.config ?? {}),
      ...(isConfigured ? clariprintOptionsRest : (item.clariprint_options ?? {})),
    };
    const productMerged: ShopProduct = { ...product, config: mergedConfig };

    const line: CartLine = isConfigured
      ? toPackLine(productMerged, copies(rawCopyCount as number), packs(qty))
      : packLine(productMerged, packs(qty));

    lines.push(line);
    matched++;
  }

  return {
    lines,
    warnings,
    stats: { matched, skipped, total: items.length },
  };
}
