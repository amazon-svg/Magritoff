// Enrichissement produit : merge Clariprint tech data + PIM (gamme + definition)

export interface Gamme {
  id: string;
  slug: string;
  name: string;
  parent_slug: string | null;
  matching_rules: MatchingRules;
  display_order: number;
  /** Image par défaut pour toutes les variations de cette gamme (PIM). */
  image_url?: string | null;
}

export interface ProductDefinition {
  id: string;
  gamme_slug: string;
  variation_filter: Record<string, any>;
  locale: string;
  name: string | null;
  keywords: string[] | null;
  title_template: string | null;
  short_description_template: string | null;
  description_template: string | null;
  h1_template: string | null;
  seo_title: string | null;
  seo_description: string | null;
  schema_org_type: string | null;
  usage_examples: Array<{ title: string; description: string }>;
  faq: Array<{ question: string; answer: string }>;
  quality_score: number | null;
  generated_by: 'llm' | 'human' | 'hybrid' | null;
  validated_by: 'llm' | 'human' | 'pending' | null;
  /** Image spécifique à cette variation (override du niveau gamme). */
  image_url?: string | null;
}

export interface MatchingRules {
  kind?: string | string[];
  size_near?: { width: number; height: number; tol?: number };
  size_range?: { min_dim?: number; max_dim?: number };
  binding_in?: string[];
  folds?: string;
  pages_range?: { min?: number; max?: number };
}

// ─── Matching gamme depuis une config Clariprint ─────────────────────────────

export function resolveGamme(
  config: any,
  gammes: Gamme[],
  productName?: string,
): Gamme | null {
  if (!config) return null;
  let matches = gammes.filter((g) => matchesRules(config, g.matching_rules));
  if (matches.length === 0) return null;

  // S-FIX-BADGES-11/05 (bug #4 Arnaud) : disambiguation par `name` quand
  // plusieurs gammes matchent les regles dimensionnelles. Les products
  // peuvent etre stockes avec des unites mixtes (mm pour cartes, cm pour
  // grands formats), ce qui fait fuiter des kakemonos dans "Flyers" ou
  // des affiches dans "Carterie". On filtre par mot-cle nom si possible.
  if (matches.length > 1 && productName) {
    const refined = filterMatchesByProductName(matches, productName);
    if (refined.length > 0) matches = refined;
  }

  // Tri par spécificité décroissante (plus de règles = plus précis),
  // puis par display_order.
  matches.sort((a, b) => {
    const diff = ruleSpecificity(b.matching_rules) - ruleSpecificity(a.matching_rules);
    if (diff !== 0) return diff;
    return a.display_order - b.display_order;
  });
  return matches[0];
}

/**
 * Heuristique simple : pour chaque gamme matchee, on regarde si le nom du
 * produit contient un mot-cle revelateur. Si oui, on garde seulement les
 * gammes qui matchent ce mot-cle.
 *
 * Exemples :
 *  - "Kakemono 150×50 cm" → ne garder QUE les gammes "kakemono" / "roll-up"
 *  - "Affiche vitrine A2" → ne garder que les gammes "affiche*"
 *  - "Carte de visite premium" → ne garder que les gammes "carte*"
 *  - "Banderole d'ouverture" → ne garder que les gammes contenant "banderole"
 *
 * Si aucun mot-cle ne matche, on retourne `matches` inchange (resolution
 * standard par specificity prend le relais).
 */
function filterMatchesByProductName(matches: Gamme[], productName: string): Gamme[] {
  const n = productName.toLowerCase().trim();
  if (!n) return matches;

  // Liste de discriminateurs : si le nom contient `keyword`, on ne garde
  // que les gammes dont le slug ou name matche `gammePattern` (regex).
  const discriminators: Array<{ keyword: RegExp; gammePattern: RegExp }> = [
    { keyword: /\b(carte|carterie)\b/, gammePattern: /^(carterie|carte_)/ },
    { keyword: /\bflyer\b/, gammePattern: /^flyer/ },
    { keyword: /\baffiche|poster\b/, gammePattern: /^affiche/ },
    { keyword: /\bd[ée]pliant\b/, gammePattern: /^depliant/ },
    { keyword: /\bbrochure\b/, gammePattern: /^brochure/ },
    { keyword: /\b(kakemono|roll-?up)\b/, gammePattern: /^(kakemono|roll)/ },
    { keyword: /\b(banderole|banner)\b/, gammePattern: /^(banderole|banner)/ },
    { keyword: /\b[ée]tiquette|sticker\b/, gammePattern: /^(etiquette|sticker)/ },
  ];

  for (const d of discriminators) {
    if (d.keyword.test(n)) {
      const filtered = matches.filter(
        (g) => d.gammePattern.test(g.slug) || d.gammePattern.test(g.name.toLowerCase()),
      );
      // Si le mot-cle matche le nom mais aucune gamme correspondante n est
      // dans les `matches`, on prefere retourner [] (= aucun match approprie,
      // le caller decidera : ici resolveGamme retombera sur NO_GAMME_KEY).
      return filtered;
    }
  }

  return matches;
}

function ruleSpecificity(rules: MatchingRules): number {
  if (!rules) return 0;
  let score = 0;
  if (rules.kind) score += Array.isArray(rules.kind) ? 1 : 2;
  if (rules.size_near) score += 5;
  if (rules.size_range) score += 2;
  if (rules.binding_in) score += 4;
  if (rules.folds) score += 3;
  if (rules.pages_range) score += 2;
  return score;
}

// Fallback entre racine (ProductCard app-level) et clariprintData (nesting
// ClariPrint natif). Permet au resolver de matcher n'importe quelle source.
function field(config: any, key: string): any {
  if (!config) return undefined;
  if (config[key] != null) return config[key];
  if (config.clariprintData?.[key] != null) return config.clariprintData[key];
  return undefined;
}

function matchesRules(config: any, rules: MatchingRules): boolean {
  if (!rules || Object.keys(rules).length === 0) return false;

  if (rules.kind) {
    const kinds = Array.isArray(rules.kind) ? rules.kind : [rules.kind];
    const actual = field(config, 'kind');
    if (!actual || !kinds.includes(actual)) return false;
  }

  const w = parseFloat(field(config, 'width') ?? config.dimensions?.width);
  const h = parseFloat(field(config, 'height') ?? config.dimensions?.height);

  if (rules.size_near && !isNaN(w) && !isNaN(h)) {
    const { width: nw, height: nh, tol = 3 } = rules.size_near;
    const direct = Math.abs(w - nw) <= tol && Math.abs(h - nh) <= tol;
    const swap = Math.abs(w - nh) <= tol && Math.abs(h - nw) <= tol;
    if (!direct && !swap) return false;
  }

  if (rules.size_range && !isNaN(w) && !isNaN(h)) {
    const maxDim = Math.max(w, h);
    if (rules.size_range.min_dim != null && maxDim < rules.size_range.min_dim) return false;
    if (rules.size_range.max_dim != null && maxDim > rules.size_range.max_dim) return false;
  }

  if (rules.binding_in) {
    const binding = field(config, 'binding');
    if (!binding || !rules.binding_in.includes(binding)) return false;
  }

  if (rules.folds) {
    const folds = field(config, 'folds');
    if (!folds || !new RegExp(rules.folds).test(folds)) return false;
  }

  if (rules.pages_range) {
    const pages = parseInt(field(config, 'pages'));
    if (!isNaN(pages)) {
      if (rules.pages_range.min != null && pages < rules.pages_range.min) return false;
      if (rules.pages_range.max != null && pages > rules.pages_range.max) return false;
    }
  }

  return true;
}

// ─── Matching definition (dans une gamme, selon variation_filter) ────────────

export function resolveDefinition(
  gammeSlug: string,
  config: any,
  locale: string,
  definitions: ProductDefinition[]
): ProductDefinition | null {
  const candidates = definitions.filter(
    (d) =>
      d.gamme_slug === gammeSlug &&
      d.locale === locale &&
      matchesVariationFilter(config, d.variation_filter)
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const specA = Object.keys(a.variation_filter || {}).length;
    const specB = Object.keys(b.variation_filter || {}).length;
    return specB - specA;
  });
  return candidates[0];
}

function matchesVariationFilter(config: any, filter: Record<string, any>): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, expected] of Object.entries(filter)) {
    const actual = config[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) return false;
      // Intersection : toutes les valeurs attendues doivent être présentes
      if (!expected.every((v) => actual.includes(v))) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

// ─── Résolution de templates : {{format}}, {{grammage}}, etc. ────────────────

const FIELD_RESOLVERS: Record<string, (c: any) => any> = {
  format: (c) => {
    const w = field(c, 'width') ?? c.dimensions?.width;
    const h = field(c, 'height') ?? c.dimensions?.height;
    if (w && h) return `${w}×${h} mm`;
    return c.format ?? null;
  },
  grammage: (c) =>
    field(c, 'papers')?.custom?.weight ?? field(c, 'weight') ?? c.weight ?? null,
  papier: (c) =>
    field(c, 'papers')?.custom?.quality ?? field(c, 'material') ?? c.material ?? null,
  quantite: (c) => field(c, 'quantity') ?? c.quantity ?? null,
  quantity: (c) => field(c, 'quantity') ?? c.quantity ?? null,
  finition_recto: (c) => field(c, 'finishing_front') ?? c.finishRecto ?? c.finish ?? null,
  finition_verso: (c) => field(c, 'finishing_back') ?? c.finishVerso ?? null,
  finition: (c) => field(c, 'finishing_front') ?? c.finishRecto ?? c.finish ?? null,
  impression_recto: (c) =>
    formatColors(field(c, 'front_colors')) ?? c.printing?.recto ?? null,
  impression_verso: (c) =>
    formatColors(field(c, 'back_colors')) ?? c.printing?.verso ?? null,
  pages: (c) => field(c, 'pages') ?? c.pages ?? null,
  binding: (c) => field(c, 'binding') ?? null,
};

function formatColors(colors: any): string | null {
  if (!Array.isArray(colors) || colors.length === 0) return null;
  const hasFull = colors.some((c: string) => /4-?color|quadri/i.test(c));
  return hasFull ? 'Quadrichromie (CMJN)' : colors.join(', ');
}

export function resolveTemplate(tpl: string | null | undefined, config: any): string {
  if (!tpl) return '';
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const resolver = FIELD_RESOLVERS[key];
    const val = resolver ? resolver(config) : config[key];
    return val != null && val !== '' ? String(val) : '';
  });
}

// ─── Output complet : config enrichi ─────────────────────────────────────────

export interface EnrichedProduct {
  gamme: Gamme | null;
  definition: ProductDefinition | null;
  resolved: {
    title: string;
    short_description: string;
    description: string;
    h1: string;
    seo_title: string;
    seo_description: string;
    usage_examples: Array<{ title: string; description: string }>;
    faq: Array<{ question: string; answer: string }>;
    keywords: string[];
  };
}

export function enrichProduct(
  config: any,
  gammes: Gamme[],
  definitions: ProductDefinition[],
  locale = 'fr'
): EnrichedProduct {
  // S-FIX-BADGES-11/05 (bug #4) : on tente d extraire un nom depuis le config
  // pour beneficier de la disambiguation par nom dans resolveGamme.
  const inferredName = typeof config?.name === 'string' ? config.name : undefined;
  const gamme = resolveGamme(config, gammes, inferredName);
  const definition = gamme ? resolveDefinition(gamme.slug, config, locale, definitions) : null;

  const r = (tpl: string | null | undefined) => resolveTemplate(tpl, config);

  return {
    gamme,
    definition,
    resolved: {
      title: r(definition?.title_template) || r(gamme?.name) || config.name || '',
      short_description: r(definition?.short_description_template),
      description: r(definition?.description_template),
      h1: r(definition?.h1_template),
      seo_title: r(definition?.seo_title),
      seo_description: r(definition?.seo_description),
      usage_examples: definition?.usage_examples ?? [],
      faq: definition?.faq ?? [],
      keywords: definition?.keywords ?? [],
    },
  };
}
