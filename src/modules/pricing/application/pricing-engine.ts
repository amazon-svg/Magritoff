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
 * La FORME centrale de `PricedLine` (`production_price`/`public_price`/
 * `customer_price`/`applied_margin_rate`/`applied_rule_id`/`breakdown`) est
 * STABLE : ne jamais la retirer, ne jamais rendre `breakdown` optionnel ou
 * vide. Une decomposition plus riche se traduit par PLUS d elements dans
 * `breakdown[]`, jamais par une forme differente. Ceci n est PAS une
 * interdiction absolue d etendre `CostInputPost`/`PricedLineBreakdownItem` par
 * un champ optionnel additif quand un besoin reel et documente existe (voir
 * `source`, resolution de la derogation p7, `docs/api/CONVENTIONS.md` §8.9) —
 * seule la forme centrale ci-dessus ne bouge pas.
 */

/**
 * Poste de cout. `total` est le poste unique utilise quand l appelant ne
 * fournit pas de decomposition (CA2) — c est aussi le seul poste produit par
 * `SingleCostPricingEngine`, meme quand l entree porte une decomposition
 * (CA7 : une decomposition est acceptee sans erreur, agregee en silence tant
 * qu E10.8 n est pas livree).
 */
export type CostPost = 'printing' | 'finishing' | 'packaging' | 'shipping' | 'total';

/**
 * Provenance d un cout (resolution de la derogation p7, `docs/api/
 * CONVENTIONS.md` §8.6/§8.9) : `'clariprint'` pour un vrai chiffrage
 * Clariprint, `'prix_marche'` pour une estimation heuristique
 * (`estimateMarketPriceHT()`, `priceResolver.ts`). Sous-ensemble volontaire de
 * `PriceSource` (`priceResolver.ts`, qui porte aussi `'library_cached'` et
 * `'zero'`) : seules les deux valeurs pertinentes pour un COUT de production
 * deja arrete ont un sens ici — un cout n est jamais "en cache bibliotheque"
 * ni "zero par securite", ces deux notions concernent la resolution du prix
 * affiche, pas le cout d entree du moteur.
 */
export type CostSource = 'clariprint' | 'prix_marche';

/** Un poste de cout et son montant (Money, `_shared/api/contracts.ts`, toujours >= 0). */
export interface CostInputPost {
  readonly post: CostPost;
  readonly amount: string;
  /**
   * Provenance de ce cout, optionnelle (CA2 : un appelant historique qui ne la
   * fournit pas n est pas casse). Absente == `'clariprint'` par defaut,
   * coherent avec l hypothese implicite du moteur avant cette resolution de
   * p7 (tout cout d entree etait deja suppose etre un chiffrage reel).
   */
  readonly source?: CostSource;
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

/**
 * Detail du calcul pour un poste (CA3). Reduit a un seul element `total` dans
 * l implementation provisoire.
 *
 * ── Semantique de `price` (qa-review B3, a ne pas re-deriver soi-meme) ──────
 * `price` est le montant FINAL du (au sens "restant a payer") pour ce poste,
 * remise client DEJA incluse
 * — c est a dire le `customer_price` reparti sur ce poste, jamais le prix
 * public (avant remise) ni le cout de production. Invariant a preserver par
 * toute implementation future (y compris une decomposition reelle a
 * plusieurs elements) :
 *
 *     sum(breakdown[].price) === customer_price
 *
 * (a une eventuelle repartition de reste de centime pres entre plusieurs
 * postes, si une future implementation decompose `customer_price` sur
 * plusieurs elements). `margin_rate` est le taux de l etape
 * production -> public UNIQUEMENT (voir `applied_margin_rate` sur
 * `PricedLine`) : il ne permet PAS de retrouver `price` par un simple calcul
 * `cost * (1 + margin_rate)` des qu une remise client s applique — `price`
 * porte en plus l effet de la remise, que ce champ ne represente pas.
 * `source` (resolution p7, voir `CostSource`) est la provenance du cout de ce
 * poste, propagee depuis `CostInputPost.source` (defaut `'clariprint'` si
 * l entree ne la precise pas).
 */
export interface PricedLineBreakdownItem {
  readonly post: CostPost;
  readonly cost: string;
  readonly margin_rate: string;
  readonly price: string;
  readonly source: CostSource;
}

/**
 * Sortie du calcul (CA3), miroir d execution du schema `QuoteLine` de
 * `openapi/magrit-core.v1.yaml` (colonnes de prix) une fois qu un appelant
 * cablera ce moteur sur une ressource reelle — cette story ne cable rien
 * (hors perimetre, voir `docs/api/CONVENTIONS.md` §8.9, qui remplace le
 * renvoi vers un "rapport de fin de story" qui n existe pas en tant que
 * fichier verse au depot).
 */
export interface PricedLine {
  readonly production_price: string;
  readonly public_price: string;
  readonly customer_price: string;
  readonly applied_margin_rate: string;
  readonly applied_rule_id: string | null;
  /**
   * JAMAIS vide, meme implementation provisoire (red flag ci-dessus) — type e
   * en tuple non-vide (qa-review B2) pour que ce soit verifie par le
   * compilateur, pas seulement par convention documentaire.
   */
  readonly breakdown: readonly [PricedLineBreakdownItem, ...PricedLineBreakdownItem[]];
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
