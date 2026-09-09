/**
 * Tests unitaires des helpers PURS du panneau de fichiers de commande
 * (E10.17b). Aucune dependance React, aucun appel reseau — ce que le
 * composant ne peut pas tester sans un framework de test de composant
 * (absent du depot, voir le rapport de fin de story).
 *
 * qa-review N6 (round 1) : les 7 messages d erreur du wireframe §4.3 sont
 * verifies ici contre des CHAINES LITTERALES, jamais contre
 * `ORDER_FILES_COPY.xxx` lui-meme — une comparaison a la constante ne peut
 * jamais detecter une paraphrase future du texte source.
 */
import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/platform/api';
import {
  describeOrderFileUploadFailure,
  formatOrderFileDepositedAt,
  formatOrderFileDepositedByLine,
  formatOrderFileSize,
  ORDER_FILE_MAX_BYTE_SIZE,
  ORDER_FILE_MAX_COUNT,
  resolveOrderFileIconFamily,
  validateOrderFileForUpload,
} from '@/modules/order-files/ui/order-files.helpers';

// Les 7 messages d erreur du wireframe §4.3, repris ICI mot pour mot en
// chaines litterales — source independante de `ORDER_FILES_COPY` (N6).
const WIREFRAME_ERROR_TOO_LARGE = 'Ce fichier dépasse 50 Mo. Réduisez-le ou déposez-le par un autre moyen.';
const WIREFRAME_ERROR_UNSUPPORTED_FORMAT =
  'Format non accepté. Formats acceptés : PDF, JPEG, PNG, WebP, TIFF, ZIP.';
const WIREFRAME_ERROR_LIMIT_REACHED =
  "Cette commande a atteint son maximum de 30 fichiers. Supprimez-en un avant d'en déposer un nouveau.";
const WIREFRAME_ERROR_UPLOAD_NETWORK = 'Le dépôt a échoué. Vérifiez votre connexion et réessayez.';
const WIREFRAME_ERROR_CONFIRM_FAILED =
  "Le fichier a été transmis mais n'a pas pu être enregistré. Réessayez le dépôt.";
const WIREFRAME_ERROR_DELETE_FAILED = 'La suppression a échoué. Réessayez.';
const WIREFRAME_ERROR_LIST_FAILED = 'Impossible de charger les fichiers de cette commande.';

describe('validateOrderFileForUpload — confort UX, ordre du wireframe (format, taille, plafond)', () => {
  it('accepte un fichier valide sous le plafond', () => {
    expect(validateOrderFileForUpload({ name: 'bat.pdf', size: 1024 }, 0)).toEqual({ ok: true });
  });

  it('refuse un format non accepte AVANT toute autre verification, message exact du wireframe §4.3', () => {
    const result = validateOrderFileForUpload({ name: 'document.docx', size: 10 }, 0);
    expect(result).toEqual({ ok: false, error: WIREFRAME_ERROR_UNSUPPORTED_FORMAT });
  });

  it('refuse un fichier sans extension reconnue meme minuscule/majuscule mixte', () => {
    const result = validateOrderFileForUpload({ name: 'archive.RAR', size: 10 }, 0);
    expect(result.ok).toBe(false);
  });

  it('refuse un fichier de plus de 50 Mo, message exact du wireframe §4.3', () => {
    const result = validateOrderFileForUpload({ name: 'bat.pdf', size: ORDER_FILE_MAX_BYTE_SIZE + 1 }, 0);
    expect(result).toEqual({ ok: false, error: WIREFRAME_ERROR_TOO_LARGE });
  });

  it('accepte un fichier pile a 50 Mo (limite inclusive)', () => {
    expect(validateOrderFileForUpload({ name: 'bat.pdf', size: ORDER_FILE_MAX_BYTE_SIZE }, 0)).toEqual({
      ok: true,
    });
  });

  it('refuse quand le compteur a deja atteint 30, message exact du wireframe §4.3', () => {
    const result = validateOrderFileForUpload({ name: 'bat.pdf', size: 10 }, ORDER_FILE_MAX_COUNT);
    expect(result).toEqual({ ok: false, error: WIREFRAME_ERROR_LIMIT_REACHED });
  });

  it('accepte encore a 29 fichiers deja deposes (le 30e est le dernier autorise)', () => {
    expect(validateOrderFileForUpload({ name: 'bat.pdf', size: 10 }, ORDER_FILE_MAX_COUNT - 1)).toEqual({
      ok: true,
    });
  });

  it('priorise le format sur la taille quand les deux sont en cause', () => {
    const result = validateOrderFileForUpload(
      { name: 'video.docx', size: ORDER_FILE_MAX_BYTE_SIZE + 1 },
      0,
    );
    expect(result).toEqual({ ok: false, error: WIREFRAME_ERROR_UNSUPPORTED_FORMAT });
  });
});

describe('resolveOrderFileIconFamily — icone par FAMILLE, pas d apercu miniature', () => {
  it.each([
    ['application/pdf', 'pdf'],
    ['image/jpeg', 'image'],
    ['image/png', 'image'],
    ['image/webp', 'image'],
    ['image/tiff', 'image'],
    ['application/zip', 'archive'],
    ['application/x-zip-compressed', 'archive'],
    ['application/octet-stream', 'unknown'],
  ])('%s -> %s', (contentType, expected) => {
    expect(resolveOrderFileIconFamily(contentType)).toBe(expected);
  });
});

describe('formatOrderFileSize — exemples du wireframe §2 Ecran B', () => {
  it('rend "850 Ko" pour 850000 octets (exemple exact du wireframe)', () => {
    expect(formatOrderFileSize(850_000)).toBe('850 Ko');
  });

  it('rend "2,4 Mo" pour 2400000 octets (exemple exact du wireframe, virgule francaise)', () => {
    expect(formatOrderFileSize(2_400_000)).toBe('2,4 Mo');
  });

  it('rend une valeur en octets sous 1000 octets', () => {
    expect(formatOrderFileSize(512)).toBe('512 o');
  });

  it('bascule vers Ko a partir de 1000 octets', () => {
    expect(formatOrderFileSize(1_000)).toBe('1 Ko');
  });

  it('bascule vers Mo a partir de 1000000 octets', () => {
    expect(formatOrderFileSize(1_000_000)).toBe('1,0 Mo');
  });
});

describe('formatOrderFileDepositedAt / formatOrderFileDepositedByLine — microcopie §4.1', () => {
  it('formate la date et l heure au format jj/mm/aaaa a HHhMM', () => {
    const iso = new Date(2026, 8, 8, 14, 32).toISOString(); // mois 0-index : 8 = septembre
    expect(formatOrderFileDepositedAt(iso)).toBe('08/09/2026 à 14h32');
  });

  it('pad les minutes a deux chiffres', () => {
    const iso = new Date(2026, 8, 8, 9, 5).toISOString();
    expect(formatOrderFileDepositedAt(iso)).toBe('08/09/2026 à 09h05');
  });

  it('"Déposé par vous, ..." quand l auteur est l utilisateur courant', () => {
    const iso = new Date(2026, 8, 8, 11, 5).toISOString();
    expect(formatOrderFileDepositedByLine('Camille Renard', true, iso)).toBe(
      'Déposé par vous, le 08/09/2026 à 11h05',
    );
  });

  it('"Déposé par {nom}, ..." quand l auteur est un autre membre', () => {
    const iso = new Date(2026, 8, 8, 14, 32).toISOString();
    expect(formatOrderFileDepositedByLine('Camille Renard', false, iso)).toBe(
      'Déposé par Camille Renard, le 08/09/2026 à 14h32',
    );
  });

  it('replie sur "un membre de l espace" si le libelle figé est absent — qa-review N5 (round 1), jamais "tenant" (jargon interne)', () => {
    const iso = new Date(2026, 8, 8, 14, 32).toISOString();
    expect(formatOrderFileDepositedByLine(null, false, iso)).toBe(
      "Déposé par un membre de l'espace, le 08/09/2026 à 14h32",
    );
  });
});

describe('describeOrderFileUploadFailure — qa-review B2 (round 1), discrimination par ApiClientError.problem.code', () => {
  function problemError(code: string, status: number): ApiClientError {
    return new ApiClientError({
      type: 'about:blank',
      title: 'Erreur',
      status,
      code,
      requestId: 'req-1',
    });
  }

  it('order_file.limit_reached -> message exact du plafond, NON rejouable', () => {
    const failure = describeOrderFileUploadFailure(problemError('order_file.limit_reached', 409), 'repli');
    expect(failure).toEqual({ message: WIREFRAME_ERROR_LIMIT_REACHED, retryable: false });
  });

  it('order_file.rejected -> message de format non accepte, rejouable', () => {
    const failure = describeOrderFileUploadFailure(problemError('order_file.rejected', 422), 'repli');
    expect(failure).toEqual({ message: WIREFRAME_ERROR_UNSUPPORTED_FORMAT, retryable: true });
  });

  it('un autre code ApiClientError (ex. 500 generique) retombe sur le message de repli fourni par l appelant, rejouable', () => {
    const failure = describeOrderFileUploadFailure(
      problemError('api.internal_error', 500),
      WIREFRAME_ERROR_UPLOAD_NETWORK,
    );
    expect(failure).toEqual({ message: WIREFRAME_ERROR_UPLOAD_NETWORK, retryable: true });
  });

  it('une erreur qui n est PAS un ApiClientError (reseau reel) retombe sur le message de repli fourni par l appelant, rejouable', () => {
    const failure = describeOrderFileUploadFailure(new TypeError('Failed to fetch'), WIREFRAME_ERROR_CONFIRM_FAILED);
    expect(failure).toEqual({ message: WIREFRAME_ERROR_CONFIRM_FAILED, retryable: true });
  });

  it('le message de repli distingue l etape (reseau au depot vs echec de confirmation), les deux textes exacts du wireframe restent utilisables tels quels', () => {
    expect(describeOrderFileUploadFailure(new Error('boom'), WIREFRAME_ERROR_UPLOAD_NETWORK).message).toBe(
      WIREFRAME_ERROR_UPLOAD_NETWORK,
    );
    expect(describeOrderFileUploadFailure(new Error('boom'), WIREFRAME_ERROR_CONFIRM_FAILED).message).toBe(
      WIREFRAME_ERROR_CONFIRM_FAILED,
    );
  });
});

// Sanity : les deux derniers messages du wireframe §4.3 (suppression, chargement
// de la liste) ne sont pas produits par un helper dedie (ils sont poses
// directement dans `OrderFilesBlock.tsx` au catch de `remove()`/`list()`) —
// les constantes ci-dessus documentent neanmoins le texte exact attendu pour
// qu un futur test de composant puisse les reprendre sans les redecouvrir.
void WIREFRAME_ERROR_DELETE_FAILED;
void WIREFRAME_ERROR_LIST_FAILED;
