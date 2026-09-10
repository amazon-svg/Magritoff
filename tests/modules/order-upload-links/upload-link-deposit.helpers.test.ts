/**
 * Tests unitaires des helpers PURS de la page publique de depot (E10.20b).
 * Aucune dependance React, aucun appel reseau — meme discipline que
 * `order-files.helpers.test.ts` (E10.17b).
 */
import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/platform/api';
import {
  describeUploadLinkDepositFailure,
  isUploadLinkInvalidFailure,
  isUploadMissingFailure,
  UPLOAD_LINK_DEPOSIT_COPY,
  UPLOAD_LINK_MAX_BYTE_SIZE,
  validateUploadLinkDeposit,
} from '@/modules/order-upload-links/ui/upload-link-deposit.helpers';

function problemError(code: string): ApiClientError {
  return new ApiClientError({
    type: 'about:blank',
    title: 'Erreur',
    status: 409,
    code,
    requestId: 'req-test',
  });
}

describe('validateUploadLinkDeposit — confort UX, ordre (format, taille, plafond)', () => {
  it('accepte un fichier valide sous le plafond', () => {
    expect(validateUploadLinkDeposit({ name: 'bat.pdf', size: 1024 }, 0, 10)).toEqual({ ok: true });
  });

  it('refuse un format non accepte AVANT toute autre verification', () => {
    const result = validateUploadLinkDeposit({ name: 'document.docx', size: 10 }, 0, 10);
    expect(result).toEqual({ ok: false, error: UPLOAD_LINK_DEPOSIT_COPY.errorUnsupportedFormat });
  });

  it('refuse un fichier de plus de 50 Mo', () => {
    const result = validateUploadLinkDeposit({ name: 'bat.pdf', size: UPLOAD_LINK_MAX_BYTE_SIZE + 1 }, 0, 10);
    expect(result).toEqual({ ok: false, error: UPLOAD_LINK_DEPOSIT_COPY.errorTooLarge });
  });

  it('accepte un fichier pile a 50 Mo (limite inclusive)', () => {
    expect(validateUploadLinkDeposit({ name: 'bat.pdf', size: UPLOAD_LINK_MAX_BYTE_SIZE }, 0, 10)).toEqual({
      ok: true,
    });
  });

  it('refuse au plafond PROPRE au lien (deposited_count >= max_files)', () => {
    const result = validateUploadLinkDeposit({ name: 'bat.pdf', size: 10 }, 10, 10);
    expect(result).toEqual({ ok: false, error: UPLOAD_LINK_DEPOSIT_COPY.errorLimitReached });
  });

  it('accepte pile en dessous du plafond (9 sur 10)', () => {
    expect(validateUploadLinkDeposit({ name: 'bat.pdf', size: 10 }, 9, 10)).toEqual({ ok: true });
  });
});

describe('describeUploadLinkDepositFailure — discrimination par code, jamais par message texte', () => {
  it('upload_link.file_limit_reached -> message de plafond, PAS rejouable', () => {
    const result = describeUploadLinkDepositFailure(problemError('upload_link.file_limit_reached'), 'repli');
    expect(result).toEqual({ message: UPLOAD_LINK_DEPOSIT_COPY.errorLimitReached, retryable: false });
  });

  it('order_file.rejected -> message de format, rejouable (un autre fichier peut convenir)', () => {
    const result = describeUploadLinkDepositFailure(problemError('order_file.rejected'), 'repli');
    expect(result).toEqual({ message: UPLOAD_LINK_DEPOSIT_COPY.errorUnsupportedFormat, retryable: true });
  });

  it('erreur non discriminee -> message de repli, rejouable', () => {
    const result = describeUploadLinkDepositFailure(new Error('reseau'), 'repli reseau');
    expect(result).toEqual({ message: 'repli reseau', retryable: true });
  });

  it('code vraiment inconnu -> message de repli, rejouable', () => {
    const result = describeUploadLinkDepositFailure(problemError('order_file.already_confirmed'), 'repli');
    expect(result).toEqual({ message: 'repli', retryable: true });
  });

  // qa-review round 1 (B2, BLOQUANT FONCTIONNEL) — `order_file.upload_missing`
  // ne doit JAMAIS produire le message `errorConfirmFailed` ("le fichier a
  // ete transmis...") : le serveur dit precisement l inverse. Message DEDIE,
  // rejouable (un envoi COMPLET peut aboutir).
  it('order_file.upload_missing -> message DEDIE, jamais "le fichier a ete transmis", rejouable', () => {
    const result = describeUploadLinkDepositFailure(problemError('order_file.upload_missing'), 'repli');
    expect(result).toEqual({ message: UPLOAD_LINK_DEPOSIT_COPY.errorUploadMissing, retryable: true });
    expect(result.message).not.toBe(UPLOAD_LINK_DEPOSIT_COPY.errorConfirmFailed);
  });
});

describe('isUploadLinkInvalidFailure', () => {
  it('vrai pour upload_link.invalid', () => {
    expect(isUploadLinkInvalidFailure(problemError('upload_link.invalid'))).toBe(true);
  });

  it('faux pour tout autre code ou toute autre forme d erreur', () => {
    expect(isUploadLinkInvalidFailure(problemError('upload_link.file_limit_reached'))).toBe(false);
    expect(isUploadLinkInvalidFailure(new Error('autre'))).toBe(false);
  });
});

describe('isUploadMissingFailure (qa-review round 1, B2)', () => {
  it('vrai pour order_file.upload_missing', () => {
    expect(isUploadMissingFailure(problemError('order_file.upload_missing'))).toBe(true);
  });

  it('faux pour tout autre code ou toute autre forme d erreur', () => {
    expect(isUploadMissingFailure(problemError('order_file.rejected'))).toBe(false);
    expect(isUploadMissingFailure(new Error('autre'))).toBe(false);
  });
});
