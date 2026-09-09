/**
 * Formatage FRANCAIS des valeurs imprimees sur un document PDF de devis
 * (E10.10b-4c). Fonctions PURES, aucune dependance a une horloge (toute date
 * est recue deja resolue) ni a `Intl` sur une date SANS fuseau (meme piege
 * documente par `quote-sent-notification-consumer.ts:formatFrenchDate`,
 * repris ici pour la MEME raison : `valid_until` est un `date` Postgres sans
 * heure ni fuseau, un passage par `Date` risquerait un decalage de jour selon
 * le fuseau d execution).
 *
 * Aucune de ces conventions de forme n est ecrite au contrat (`DocumentFieldId`
 * ne dit rien du FORMAT d une valeur, seulement de sa PRESENCE) : ce fichier
 * fixe un parti pris de redaction commerciale, signale comme tel au rapport
 * de fin de story plutot que presente comme une exigence du contrat.
 */

/** `YYYY-MM-DD` (date seule) -> `JJ/MM/AAAA`. Parsing MANUEL, jamais par `Date`. */
export function formatShortFrenchDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  return `${day}/${month}/${year}`;
}

/**
 * Instant ISO (`Timestamp`, avec heure et fuseau UTC) -> `JJ/MM/AAAA`. Les
 * trois premiers segments d un `Timestamp` UTC (`YYYY-MM-DDTHH:mm:ss(.sss)Z`)
 * partagent la meme forme que `formatShortFrenchDate` : reutilise directement,
 * la partie horaire n etant jamais lue.
 */
export function formatShortFrenchDateFromTimestamp(isoTimestamp: string): string {
  return formatShortFrenchDate(isoTimestamp);
}

/**
 * Chaine Money (`"1234.50"`, `Money`/`MoneyNonNegative` du contrat) -> forme
 * commerciale francaise (`"1 234,50 €"`, espace insecable comme separateur de
 * milliers, virgule decimale). Le signe est conserve tel quel (une remise
 * globale peut etre negative, contrat E10.10a).
 */
export function formatMoneyFrench(amount: string): string {
  const negative = amount.trim().startsWith('-');
  const unsigned = negative ? amount.trim().slice(1) : amount.trim();
  const [integerPart, decimalPart = '00'] = unsigned.split('.');
  const grouped = groupThousands(integerPart ?? '0');
  const sign = negative ? '-' : '';
  return `${sign}${grouped},${decimalPart.padEnd(2, '0').slice(0, 2)} €`;
}

/**
 * Chaine Rate (`"0.2000"`, 4 decimales signees) -> pourcentage francais
 * (`"20 %"`, `"7,7 %"`). Les zeros decimaux superflus sont retires (jusqu a
 * 2 decimales conservees au maximum) pour eviter `"20,00 %"` sur un taux
 * rond, tout en gardant `"7,7 %"` lisible sur un taux qui ne l est pas.
 */
export function formatRatePercentFrench(rate: string): string {
  const value = Number(rate) * 100;
  if (!Number.isFinite(value)) return `${rate} %`;
  // Deux decimales au plus, zeros de fin retires (mais pas la virgule elle-meme).
  const rounded = Math.round(value * 100) / 100;
  const [integerPart, decimalPart] = rounded.toFixed(2).split('.');
  const trimmedDecimal = (decimalPart ?? '').replace(/0+$/, '');
  const label = trimmedDecimal.length > 0 ? `${integerPart},${trimmedDecimal}` : (integerPart ?? '0');
  return `${label} %`;
}

function groupThousands(digits: string): string {
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
