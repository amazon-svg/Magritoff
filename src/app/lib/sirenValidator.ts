/**
 * sirenValidator — E6.1
 * ─────────────────────
 * Verifie un numero SIREN FR (9 chiffres + algo Luhn) puis appelle l'API
 * INSEE Sirene V3 pour recuperer raison sociale, code NAF, etat actif.
 *
 * STATUT : BOUCHON (mock). L'integration INSEE reelle attend que le compte
 * INSEE soit cree. En attendant, ce module :
 *   - valide le format (9 chiffres + Luhn)
 *   - mock une reponse INSEE "credible" basee sur les chiffres saisis
 *   - simule une latence reseau pour que l'UX du wizard soit realiste
 *
 * Quand l'API INSEE sera branchee, il suffira de remplacer le bloc mock par
 * un fetch reel vers https://api.insee.fr/entreprises/sirene/V3/siren/{siren}
 * en gardant la meme signature.
 */

export interface SirenInfo {
  siren: string;
  raisonSociale: string;
  codeNaf: string;
  actif: boolean;
  /** true si le bouchon est utilise (a retirer en prod). */
  mocked?: boolean;
}

export interface SirenValidationResult {
  ok: boolean;
  info?: SirenInfo;
  error?: string;
}

/** Algorithme de Luhn applique sur 9 chiffres (specificite SIREN). */
function isValidSirenChecksum(siren: string): boolean {
  if (!/^\d{9}$/.test(siren)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(siren[i], 10);
    // Position paire (depuis la droite) → digit * 2 (sommer chiffres si > 9)
    const weighted = i % 2 === 1 ? digit * 2 : digit;
    sum += weighted > 9 ? weighted - 9 : weighted;
  }
  return sum % 10 === 0;
}

/** Mock : derive une "raison sociale" et un code NAF a partir du SIREN. */
function mockInseeLookup(siren: string): SirenInfo {
  const naf = ['1812Z', '5829C', '6201Z', '7022Z', '4778C'];
  const suffixes = ['SARL', 'SAS', 'SA', 'EURL', 'SCOP'];
  const seed = parseInt(siren.slice(-2), 10);
  return {
    siren,
    raisonSociale: `Entreprise Mock ${siren.slice(0, 3)} ${suffixes[seed % suffixes.length]}`,
    codeNaf: naf[seed % naf.length],
    actif: true,
    mocked: true,
  };
}

/**
 * Valide un SIREN et recupere les infos INSEE.
 *
 * @param siren numero brut (espaces et tirets toleres et nettoyes).
 * @returns { ok, info?, error? }
 */
export async function validateSiren(siren: string): Promise<SirenValidationResult> {
  const cleaned = siren.replace(/[\s-]/g, '');

  if (!/^\d{9}$/.test(cleaned)) {
    return { ok: false, error: 'Le SIREN doit comporter 9 chiffres.' };
  }

  if (!isValidSirenChecksum(cleaned)) {
    return { ok: false, error: 'Numero SIREN invalide (echec checksum Luhn).' };
  }

  // Simule la latence de l'appel INSEE pour que l'UX reste realiste.
  await new Promise((r) => setTimeout(r, 350));

  // BOUCHON — a remplacer par l'appel INSEE reel quand le compte sera cree.
  // const res = await fetch(`https://api.insee.fr/entreprises/sirene/V3/siren/${cleaned}`, {
  //   headers: { Authorization: `Bearer ${INSEE_TOKEN}` },
  // });
  // if (!res.ok) return { ok: false, error: 'SIREN inconnu de l\'INSEE.' };
  // const data = await res.json();
  // return { ok: true, info: { siren: cleaned, raisonSociale: data.uniteLegale.denominationUniteLegale, ... } };

  return { ok: true, info: mockInseeLookup(cleaned) };
}
