/**
 * Fuseau de reference du produit (E10.18a, docs/api/CONVENTIONS.md §8.24
 * point 5 regle 8, reserve (b) levee par Arnaud le 2026-09-12).
 *
 * PREMIERE occurrence d un fuseau non-UTC de tout le depot (verifie par
 * l architecte, `grep` sur `src/`, `supabase/`, `docs/` : zero avant ce lot).
 * `created_at` (et tout `timestamptz`) reste stocke en UTC ; SEULE la lecture
 * d une borne de date CIVILE (`created_from`/`created_to` de
 * `listCommercialOrders`, et plus tard les dates du classeur XLSX, E10.18d)
 * est entendue dans ce fuseau. Une commande passee le 1er septembre a 00h30
 * a Paris vaut `2026-08-31T22:30:00Z` : bornee en UTC plutot qu en
 * `Europe/Paris`, elle tomberait dans le mois comptable precedent — un ecart
 * de cloture silencieux, du genre qui se decouvre en rapprochement bancaire.
 *
 * CONSTANTE UNIQUE, jamais recopiee : toute portion de code qui a besoin du
 * fuseau de reference importe `PRODUCT_REFERENCE_TIME_ZONE` (ou l un des
 * helpers ci-dessous) depuis CE fichier, jamais une chaine `'Europe/Paris'`
 * litterale. Domicile choisi ici (`src/kernel/clock`, a cote de `Clock`) :
 * c est une notion de TEMPS pure, sans dependance a Supabase ni a un module
 * metier, au meme titre que `Clock`/`fixedClock`.
 *
 * Aucun reglage par espace (`CommercialSettings`) ne gouverne ce fuseau, et
 * aucun n est prevu : Arnaud a tranche la simplicite EN CONNAISSANT la
 * singularite (un seul fuseau, non parametrable). La question se ROUVRIRA
 * le jour ou un imprimeur hors metropole entrera dans le produit — ecrit ici
 * pour que ce jour-la le choix soit relu comme une decision DATEE, pas subi
 * comme une contrainte dont plus personne ne connait l origine. Le chemin
 * resterait additif : un champ de reglage optionnel, defaut inchange.
 */

/** IANA. Seule constante a connaitre pour tout code qui doit entendre une date civile "comme un imprimeur en France metropolitaine la lirait". */
export const PRODUCT_REFERENCE_TIME_ZONE = 'Europe/Paris' as const;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CivilTime = Readonly<{ hour: number; minute: number; second: number; millisecond: number }>;

const START_OF_DAY: CivilTime = Object.freeze({ hour: 0, minute: 0, second: 0, millisecond: 0 });
/** 23:59:59.999 — dernier instant de la journee civile, jamais 00:00:00 du lendemain (une borne haute exclusive serait un piege, voir le contrat `created_to`). */
const END_OF_DAY: CivilTime = Object.freeze({ hour: 23, minute: 59, second: 59, millisecond: 999 });

/**
 * Decale de zero DST connu a l heure locale : formate l instant UTC candidat
 * dans le fuseau cible et lit les composantes civiles qui en resultent, pour
 * en deduire le decalage (minutes) reellement applique par ce fuseau A CET
 * INSTANT (ete/hiver). Meme technique que les bibliotheques de fuseaux
 * usuelles (`date-fns-tz` et consorts) : aucune table de decalage recopiee a
 * la main, seule `Intl.DateTimeFormat` (deja disponible en Edge Runtime et
 * dans tout navigateur moderne, AUCUNE dependance neuve) fait autorite.
 */
function offsetMillisecondsAt(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - instantMs;
}

/**
 * Convertit une date CIVILE (`YYYY-MM-DD`) et une heure civile dans
 * `timeZone` en instant UTC exact. AUCUNE ambiguite pour les heures visees
 * par ce fichier (00:00:00.000 et 23:59:59.999) : les transitions DST
 * d `Europe/Paris` se produisent a 02h00/03h00 locale, jamais a minuit ni en
 * fin de journee.
 */
function civilDateToUtc(dateOnly: string, time: CivilTime, timeZone: string): Date {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    throw new TypeError(`Date civile invalide : "${dateOnly}" (attendu YYYY-MM-DD).`);
  }
  const [year, month, day] = dateOnly.split('-').map(Number) as [number, number, number];
  const naiveUtc = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second, time.millisecond);
  // Controle ALLER-RETOUR sur le CALENDRIER, pas seulement la FORME : le
  // pattern ci-dessus accepte "2026-06-31" (le 31 juin n existe pas) ou
  // "2026-99-99", et `Date.UTC` ne rejette JAMAIS des composantes hors
  // bornes — il les REPORTE en silence sur le mois/l annee suivants
  // (`2026-06-31` devient le 1er juillet, `2026-00-10` glisse dans l annee
  // PRECEDENTE). Un appelant qui construit sa borne haute par
  // `${annee}-${mois}-31` (reflexe le plus banal des lors qu on sort d un
  // `<input type="date">`) recevrait alors 200 OK et une periode fausse d un
  // jour, sans aucune erreur : exactement l ecart de cloture silencieux que
  // ce fichier existe pour empecher (qa-review E10.18a round 1, B1). On relit
  // les composantes CIVILES de l instant construit et on exige qu elles
  // egalent EXACTEMENT celles fournies en entree ; toute normalisation
  // silencieuse de `Date.UTC` est ainsi transformee en rejet explicite.
  const roundTrip = new Date(naiveUtc);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new TypeError(`Date civile invalide : "${dateOnly}" (jour inexistant dans le calendrier).`);
  }
  // Decalage calcule sur l instant ARRONDI A LA SECONDE (millisecondes a
  // zero) : `Intl.DateTimeFormat` ne restitue pas de fraction de seconde
  // (aucune `fractionalSecondDigits` demandee), et la lui fournir aurait
  // introduit jusqu a 999 ms d erreur sur le decalage lui-meme (mesure :
  // `endOfDayInReferenceTimeZone` derivait de pres d une seconde sans cette
  // precaution). Le decalage d `Europe/Paris` ne change jamais a l interieur
  // d une meme seconde, la troncature est donc sans consequence ICI.
  const naiveUtcWholeSeconds = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second, 0);
  const offset = offsetMillisecondsAt(naiveUtcWholeSeconds, timeZone);
  return new Date(naiveUtc - offset);
}

/**
 * Premier instant (INCLUS) de la journee civile `dateOnly` dans le fuseau de
 * reference du produit. Sert `created_from` (E10.18a) : "premier jour de la
 * periode, INCLUS" (contrat `listCommercialOrders.created_from`).
 */
export function startOfDayInReferenceTimeZone(dateOnly: string): Date {
  return civilDateToUtc(dateOnly, START_OF_DAY, PRODUCT_REFERENCE_TIME_ZONE);
}

/**
 * Dernier instant (INCLUS, 23:59:59.999) de la journee civile `dateOnly`
 * dans le fuseau de reference du produit. Sert `created_to` (E10.18a) :
 * "dernier jour de la periode, INCLUS — la journee ENTIERE" (contrat), meme
 * parti que `PriceRule.ends_on`. JAMAIS une borne haute exclusive (minuit du
 * lendemain) : voir l avertissement du contrat sur ce piege precis.
 */
export function endOfDayInReferenceTimeZone(dateOnly: string): Date {
  return civilDateToUtc(dateOnly, END_OF_DAY, PRODUCT_REFERENCE_TIME_ZONE);
}
