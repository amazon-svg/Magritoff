/**
 * Verification SIRET — story E10.4 (CA3).
 * ─────────────────────────────────────────
 * Un SIRET = un SIREN (9 chiffres) + un NIC (5 chiffres) = 14 chiffres, avec
 * sa PROPRE cle de Luhn calculee sur les 14 chiffres. Ce n est PAS le meme
 * calcul que le validateur SIREN de src/modules/tenants/ui/helpers/sirenValidator.ts :
 * celui-ci double les chiffres de position impaire EN PARTANT DE LA GAUCHE, ce
 * qui ne fonctionne que parce que 9 (longueur du SIREN) est impair — pour une
 * longueur paire (14, le SIRET), la parite gauche et la parite droite ne
 * coincident plus. L algorithme de Luhn se definit toujours par rapport a la
 * droite : on double un chiffre sur deux EN PARTANT DE LA DROITE, quelle que
 * soit la longueur. C est ce que `computeLuhnChecksum` fait ici.
 *
 * STATUT INSEE : BOUCHON (mock), meme principe que E6.1. Le compte INSEE reel
 * n existe pas encore. En attendant :
 *   - le format est reellement verifie (14 chiffres + Luhn) ;
 *   - la reponse INSEE est simulee de facon credible, `mocked: true` ;
 *   - une latence reseau est simulee pour que l UX reste realiste.
 * Quand l API INSEE sera branchee, seul `lookupSiretAtInsee` change de corps ;
 * sa signature reste la meme.
 */

export type SiretFormatError = 'siret_shape' | 'siret_checksum';

export type SiretFormatCheck =
  | Readonly<{ ok: true; siret: string }>
  | Readonly<{ ok: false; error: SiretFormatError }>;

export type SiretLookupResult = Readonly<{
  siret: string;
  verified: boolean;
  companyName: string | null;
  nafCode: string | null;
  active: boolean;
  mocked: boolean;
  checkedAt: string;
}>;

/** Retire espaces et tirets de saisie. */
export function normalizeSiret(raw: string): string {
  return raw.replace(/[\s.-]/g, '');
}

/**
 * Cle de Luhn generique : double un chiffre sur deux EN PARTANT DE LA DROITE.
 * Valable pour n importe quelle longueur (SIREN 9, SIRET 14).
 */
export function computeLuhnChecksum(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let indexFromRight = 0; indexFromRight < digits.length; indexFromRight += 1) {
    const digit = Number(digits[digits.length - 1 - indexFromRight]);
    const doubled = indexFromRight % 2 === 1;
    const value = doubled ? digit * 2 : digit;
    sum += value > 9 ? value - 9 : value;
  }
  return sum % 10 === 0;
}

/** Verifie la FORME d un SIRET : 14 chiffres + cle de Luhn sur les 14 chiffres. */
export function checkSiretFormat(raw: string): SiretFormatCheck {
  const siret = normalizeSiret(raw);
  if (!/^\d{14}$/.test(siret)) return { ok: false, error: 'siret_shape' };
  if (!computeLuhnChecksum(siret)) return { ok: false, error: 'siret_checksum' };
  return { ok: true, siret };
}

/** Mock : derive un nom d entreprise et un code NAF credibles a partir du SIRET. */
function mockInseeLookup(siret: string): Readonly<{ companyName: string; nafCode: string }> {
  const naf = ['1812Z', '5829C', '6201Z', '7022Z', '4778C'];
  const suffixes = ['SARL', 'SAS', 'SA', 'EURL', 'SCOP'];
  const seed = Number(siret.slice(-2));
  return {
    companyName: `Entreprise Mock ${siret.slice(0, 3)} ${suffixes[seed % suffixes.length]}`,
    nafCode: naf[seed % naf.length]!,
  };
}

export type Clock = () => Date;
export type Delay = (milliseconds: number) => Promise<void>;

const defaultDelay: Delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verifie un SIRET deja valide en forme aupres de l INSEE (bouchon).
 *
 * @param siret SIRET normalise (14 chiffres, deja controle par `checkSiretFormat`).
 */
export async function lookupSiretAtInsee(
  siret: string,
  dependencies: Readonly<{ now?: Clock; delay?: Delay }> = {},
): Promise<SiretLookupResult> {
  const now = dependencies.now ?? (() => new Date());
  const delay = dependencies.delay ?? defaultDelay;

  // Simule la latence de l appel INSEE pour que l UX reste realiste.
  await delay(350);

  // BOUCHON — a remplacer par l appel INSEE reel quand le compte sera cree :
  // const res = await fetch(`https://api.insee.fr/entreprises/sirene/V3/siret/${siret}`, {
  //   headers: { Authorization: `Bearer ${INSEE_TOKEN}` },
  // });
  // if (!res.ok) return { siret, verified: false, companyName: null, nafCode: null, active: false, mocked: false, checkedAt: now().toISOString() };
  // const data = await res.json();
  const mock = mockInseeLookup(siret);
  return Object.freeze({
    siret,
    verified: true,
    companyName: mock.companyName,
    nafCode: mock.nafCode,
    active: true,
    mocked: true,
    checkedAt: now().toISOString(),
  });
}
