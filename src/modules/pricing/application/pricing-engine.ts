/**
 * Interface `PricingEngine` (E10.21) — contrat STABLE et seul point d entree
 * du calcul de prix pour tout le reste du code de la Gestion commerciale.
 *
 * ── Pourquoi cette story existe ─────────────────────────────────────────────
 * E10.8 (moteur de calcul complet, decomposition impression / faconnage /
 * conditionnement / livraison avec marges distinctes par poste) est GELEE :
 * Xavier Pechoultres doit d abord arbitrer cote Clariprint la maniere dont le
 * prix remonte. E10.9/E10.12/E10.16/E10.19 ont neanmoins besoin d un prix de
 * ligne des maintenant. Cette interface pose donc la FORME definitive de
 * l entree et de la sortie ; `SingleCostPricingEngine` en est la seule
 * implementation aujourd hui, une implementation qui traite le cout comme un
 * poste unique. Le jour ou E10.8 est degelee, une nouvelle implementation
 * (`DecomposedCostPricingEngine` ou equivalent) remplace celle-ci derriere le
 * meme contrat, cf. `pricing-engine-provider.ts` — AUCUN appelant ne change.
 *
 * ── Red flag de la story (a ne jamais regresser) ────────────────────────────
 * `PricedLine.breakdown` est un TABLEAU NON VIDE, jamais un champ optionnel
 * ou absent, meme dans l implementation provisoire (au moins l element
 * `total`). Le jour ou `quote_lines` (E10.3) ou toute autre ressource stocke
 * un `PricedLine`, elle stocke deja un `breakdown[]` : l arrivee de la
 * decomposition Clariprint sera alors un simple enrichissement du tableau,
 * jamais une migration de schema ni une reprise de l API.
 *
 * ── A NE PAS FAIRE quand E10.8 sera livree ──────────────────────────────────
 * Ne JAMAIS ajouter de champ a `CostInput`/`PricedLine`, ni retirer
 * `breakdown`, ni le rendre optionnel : la signature de cette interface ne
 * bouge pas. Une decomposition plus riche se traduit par PLUS d elements dans
 * `breakdown[]`, jamais par une forme differente.
 */

/**
 * Poste de cout. `total` est le poste unique utilise quand l appelant ne
 * fournit pas de decomposition (CA2) — c est aussi le seul poste produit par
 * `SingleCostPricingEngine`, meme quand l entree porte une decomposition
 * (CA7 : une decomposition est acceptee sans erreur, agregee en silence tant
 * qu E10.8 n est pas livree).
 */
export type CostPost = 'printing' | 'finishing' | 'packaging' | 'shipping' | 'total';

/** Un poste de cout et son montant (Money, `_shared/api/contracts.ts`, toujours >= 0). */
export interface CostInputPost {
  readonly post: CostPost;
  readonly amount: string;
}

/**
 * Entree du calcul (CA2). `posts` porte au moins un element : l absence de
 * decomposition se code par UN SEUL poste `total`, jamais par un tableau
 * vide ni par un champ `amount` racine — cela evite deux formes d entree
 * pour le meme cas.
 */
export interface CostInput {
  readonly currency: 'EUR';
  readonly posts: readonly CostInputPost[];
}

/** Detail du calcul pour un poste (CA3). Reduit a un seul element `total` dans l implementation provisoire. */
export interface PricedLineBreakdownItem {
  readonly post: CostPost;
  readonly cost: string;
  readonly margin_rate: string;
  readonly price: string;
}

/**
 * Sortie du calcul (CA3), miroir d execution du schema `QuoteLine` de
 * `openapi/magrit-core.v1.yaml` (colonnes de prix) une fois qu un appelant
 * cablera ce moteur sur une ressource reelle — cette story ne cable rien
 * (hors perimetre, voir le rapport de fin de story).
 */
export interface PricedLine {
  readonly production_price: string;
  readonly public_price: string;
  readonly customer_price: string;
  readonly applied_margin_rate: string;
  readonly applied_rule_id: string | null;
  /** JAMAIS vide, meme implementation provisoire (red flag ci-dessus). */
  readonly breakdown: readonly PricedLineBreakdownItem[];
}

/**
 * Regle de prix DEJA resolue par `PriceRulesService.resolve()` (E10.6/E10.7).
 * Le moteur ne resout rien lui-meme (CA5) : il ne connait ni `scope`, ni
 * `customer_id`, ni `product_range_id`, ni la logique d arbitrage — juste le
 * resultat.
 */
export interface ResolvedPricingRule {
  readonly id: string;
  readonly value_type: 'margin_rate' | 'discount_rate';
  /** Rate (4 decimales), toujours positif ou nul (`nonNegativeRateSchema`). */
  readonly value: string;
}

/**
 * Contexte necessaire a `SingleCostPricingEngine` pour appliquer une regle
 * DEJA resolue (CA5) — n est pas detaille par la story, choix documente ici :
 *
 * - `rule` : le resultat de `resolvePriceRule` (E10.7), ou `null` si aucune
 *   regle active ne couvre le contexte a la date consideree (reponse NORMALE,
 *   pas une erreur — meme convention que `PriceRuleResolveResultDto.rule`).
 * - `defaultMarginRate` : la marge publique standard de la gamme (E10.6,
 *   `getProductRangeDefaultMargin`), utilisee comme base de calcul du
 *   `public_price` quand aucune regle `margin_rate` ne s applique — que ce
 *   soit parce qu aucune regle n est active (`rule: null`) ou parce que la
 *   regle active est une remise (`discount_rate`, qui s applique EN PLUS du
 *   `public_price`, jamais a sa place, voir plus bas). `null` quand le tenant
 *   n a jamais defini de marge sur cette gamme, traite comme `0.0000`
 *   (aucune marge, `public_price === production_price`) plutot que de faire
 *   echouer un calcul de prix pour un defaut jamais pose.
 *
 * Ni l un ni l autre n est resolu ICI : l appelant a deja appele
 * `PriceRulesService.resolve()` et `getDefaultMargin()` en amont (CA5, "recoit
 * un cout et un jeu de regles deja resolues" — le moteur n interroge jamais
 * la base).
 */
export interface PricingContext {
  readonly rule: ResolvedPricingRule | null;
  readonly defaultMarginRate: string | null;
}

/**
 * Point d entree UNIQUE du calcul de prix (CA1). `price()` est une fonction
 * PURE (CA5) : memes arguments -> meme resultat, aucun acces reseau ni base.
 */
export interface PricingEngine {
  price(cost: CostInput, ctx: PricingContext): PricedLine;
}

/** `cost.posts` est vide — l appelant doit fournir au moins le poste `total`. */
export class EmptyCostInputError extends Error {
  constructor(message = 'Le cout doit porter au moins un poste.') {
    super(message);
    this.name = 'EmptyCostInputError';
  }
}
