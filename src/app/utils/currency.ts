/**
 * Helper devise centralise — Refacto multi-devise, TRANCHE 1.
 *
 * Decision Arnaud Mazon 2026-08-10 (`docs/REFACTO_MULTI_DEVISE.md`) : chaque
 * imprimeur travaille dans SA devise. Sans cela la solution ne peut pas
 * voyager — pas de client en dollars, pas de deploiement hors zone euro.
 *
 * Avant ce module : 103 occurrences d'euro cable en dur dans `src/`, et DEUX
 * helpers de formatage concurrents (`formatPrice()` du priceResolver et
 * `formatEuro()` de ProductOverlay.helpers, ce dernier forcant `EUR`), plus
 * deux copies locales de `formatEuro` dans le portail.
 *
 * Maintenant : un seul endroit, `formatMoney(amount, currency)`, avec la
 * devise en parametre OBLIGATOIRE. Il n'existe plus aucun moyen de formater
 * un montant sans dire dans quelle devise il est libelle.
 *
 * La colonne `tenants.currency` (migration 20260810000200) porte la devise,
 * default `EUR` pour ne rien casser sur les tenants existants.
 *
 * ─── Perimetre de la tranche 1 ───────────────────────────────────────────
 * Les montants restent des `number` flottants a ce stade — c'est assume et
 * documente dans le plan. Le passage au `Money` du noyau Expert Solutions
 * (`{ minorUnits: bigint, currency }`) est l'objet des tranches 2 et 3.
 *
 * Pas de conversion de taux de change (invariant #4 du plan) : un devis est
 * mono-devise. Le multi-devise dans un meme document est hors perimetre.
 */

/** Code devise ISO 4217 alpha-3, en majuscules. */
export type CurrencyCode = string;

/**
 * Devise par defaut quand aucun tenant n'est en scope.
 *
 * Utilisee par les utils non-React (`schemaOrg.ts`, `shopExport.ts`,
 * `quote.ts`) et par les fallbacks defensifs cote composant, exactement comme
 * `DEFAULT_TAX_RATE` dans `tax.ts`.
 *
 * L'euro reste le cas dominant Magrit en 2026 — mais il n'est plus une
 * hypothese cablee, seulement une valeur par defaut deplacable.
 */
export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

/**
 * Devises proposees a la selection dans les parametres de l'espace.
 *
 * Liste volontairement courte : elle couvre les marches ou Magrit peut
 * plausiblement etre deploye a court terme. En ajouter une ne demande qu'une
 * ligne — la contrainte SQL accepte tout code ISO 4217 alpha-3.
 *
 * `decimals` suit ISO 4217 : le yen n'a pas de sous-unite (question ouverte
 * n° 4 avec Expert Solutions — traitee ici cote affichage).
 */
export const SUPPORTED_CURRENCIES: ReadonlyArray<{
  code: CurrencyCode;
  label: string;
  decimals: number;
}> = [
  { code: 'EUR', label: 'Euro (€)', decimals: 2 },
  { code: 'USD', label: 'Dollar americain ($)', decimals: 2 },
  { code: 'GBP', label: 'Livre sterling (£)', decimals: 2 },
  { code: 'CHF', label: 'Franc suisse (CHF)', decimals: 2 },
  { code: 'CAD', label: 'Dollar canadien (CA$)', decimals: 2 },
  { code: 'MAD', label: 'Dirham marocain (MAD)', decimals: 2 },
  { code: 'JPY', label: 'Yen japonais (¥)', decimals: 0 },
];

/**
 * Forme minimale d'un tenant attendue. Compatible avec `Tenant` et
 * `TenantWithMembership` definis dans `TenantContext.tsx`.
 *
 * Accepte `null` / `undefined` pour permettre des call-sites defensifs
 * (composants montes avant que le contexte tenant ne soit hydrate).
 */
export interface CurrencyAwareTenant {
  currency?: string | null;
}

/**
 * Resout la devise du tenant.
 *
 * - `null` / `undefined` / `currency` absent → `DEFAULT_CURRENCY`.
 * - Code mal forme (donnee heritee, cast force) → `DEFAULT_CURRENCY` (defensif :
 *   un code invalide ferait lever `Intl.NumberFormat`, donc ecran blanc).
 *
 * Retourne toujours un code alpha-3 en majuscules.
 */
export function getCurrency(
  tenant: CurrencyAwareTenant | null | undefined,
): CurrencyCode {
  const code = tenant?.currency;
  if (typeof code !== 'string') return DEFAULT_CURRENCY;
  const normalized = code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
}

/** Nombre de decimales ISO 4217 pour une devise. Defaut 2 si inconnue. */
export function getCurrencyDecimals(currency: CurrencyCode): number {
  const known = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  return known ? known.decimals : 2;
}

export interface FormatMoneyOptions {
  locale?: string;
  /** Force le nombre de decimales. Defaut : les decimales ISO de la devise. */
  fractionDigits?: number;
  /** Valeur rendue quand le montant est absent ou non fini. Defaut : "—". */
  fallback?: string;
}

/**
 * Formate un montant dans la devise donnee : "1 234,56 €", "$1,234.56", "¥1 235".
 *
 * La devise est un parametre OBLIGATOIRE — c'est tout l'objet de la tranche 1.
 * Pour l'obtenir : `getCurrency(currentTenant)` cote util, `useCurrency()`
 * cote composant React.
 *
 * Defensif : `null` / `undefined` / `NaN` / `Infinity` retournent `fallback`
 * ("—" par defaut), comportement herite de l'ancien `formatEuro()` sur lequel
 * s'appuient les ecrans du portail.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: CurrencyCode,
  options: FormatMoneyOptions = {},
): string {
  const { locale = 'fr-FR', fractionDigits, fallback = '—' } = options;

  if (amount == null || typeof amount !== 'number' || !Number.isFinite(amount)) {
    return fallback;
  }

  const digits = fractionDigits ?? getCurrencyDecimals(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    // Code devise refuse par Intl (donnee corrompue en base). On degrade en
    // "1 234,56 XXX" plutot que de faire tomber l'ecran.
    return `${amount.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })} ${currency}`;
  }
}

/**
 * Symbole de la devise : "€", "$", "£", "CHF"…
 *
 * Reserve aux libelles d'unite ou le montant n'est pas rendu a cote — labels
 * de saisie ("Prix HT (€)"), adornements d'input, unites composees du parc
 * machine ("€/h", "€/kg", "€/kWh"). Partout ailleurs, `formatMoney()`.
 */
export function getCurrencySymbol(
  currency: CurrencyCode,
  locale = 'fr-FR',
): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Unite composee : "€/h", "$/kg", "CHF/kWh".
 *
 * Centralise le pattern `€/{unite}` qui fleurissait dans le parc machine.
 * Le modele de cout lui-meme passe en `Money` en tranche 2 ; ici on ne traite
 * que l'affichage de l'unite.
 */
export function formatCurrencyPerUnit(
  currency: CurrencyCode,
  unit: string,
  locale = 'fr-FR',
): string {
  return `${getCurrencySymbol(currency, locale)}/${unit}`;
}
