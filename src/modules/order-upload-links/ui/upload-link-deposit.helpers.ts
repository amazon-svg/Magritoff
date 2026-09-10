/**
 * Helpers PURS de la page publique de depot (E10.20b). Aucune dependance
 * React, aucun appel reseau : formatage d affichage et validation CLIENT
 * (confort UX immediat, JAMAIS la seule barriere — le serveur reste la
 * seule verite, `.claude/rules/frontend.md`).
 *
 * Vue par un NON-UTILISATEUR, souvent sur mobile, sans repere Magrit : la
 * microcopie est volontairement plus explicative que celle d `order-files`
 * (atelier), qui peut supposer un minimum de familiarite avec l outil.
 */
import { ApiClientError } from '@/platform/api';
import { resolveOrderFileContentType, UnsupportedOrderFileExtensionError } from '../../order-files';

/** Meme plafond que le canal de depot d E10.17a (contrat, arbitrage (A) : inchange). */
export const UPLOAD_LINK_MAX_BYTE_SIZE = 50 * 1024 * 1024;

export const UPLOAD_LINK_DEPOSIT_COPY = {
  loadingContext: 'Chargement…',
  invalidLinkTitle: 'Ce lien n est plus valable',
  invalidLinkBody:
    'Il est peut-etre expire ou a ete revoque. Contactez l imprimeur pour obtenir un nouveau lien.',
  dropzoneTitle: 'Deposez votre fichier ici',
  dropzoneBrowse: 'ou choisissez-le sur votre appareil',
  dropzoneLimits: (maxFiles: number) => `50 Mo maximum par fichier · jusqu a ${maxFiles} fichiers`,
  uploading: 'Envoi en cours…',
  confirming: 'Enregistrement…',
  depositedCount: (count: number, maxFiles: number) => `${count} sur ${maxFiles} fichier(s) envoye(s)`,
  depositSuccessTitle: 'Fichier bien recu',
  depositSuccessBody: (filename: string) => `${filename} a ete transmis a l imprimeur.`,
  // qa-review round 1 (N1) — pas de bouton dedie "Envoyer un autre fichier" :
  // la dropzone REAPPARAIT automatiquement des qu un depot reussit et que le
  // plafond n est pas atteint (`!atCapacity && !pending`), aucun second
  // geste n est necessaire. Chaine retiree avec le testid correspondant.
  retry: 'Reessayer',
  errorTooLarge: 'Ce fichier depasse 50 Mo. Reduisez-le ou contactez l imprimeur.',
  errorUnsupportedFormat: 'Format non accepte. Formats acceptes : PDF, JPEG, PNG, WebP, TIFF, ZIP.',
  errorLimitReached: 'Le nombre maximum de fichiers pour ce lien est atteint.',
  errorUploadNetwork: 'L envoi a echoue. Verifiez votre connexion et reessayez.',
  errorConfirmFailed: 'Le fichier a ete transmis mais n a pas pu etre enregistre. Reessayez.',
  // qa-review round 1 (B2, BLOQUANT FONCTIONNEL) — DISTINCT d`errorConfirmFailed` :
  // ce message ne doit JAMAIS affirmer qu un transfert a reussi quand le
  // serveur signale l inverse (`order_file.upload_missing`). Le "Réessayer"
  // associe a ce message DOIT relancer un envoi COMPLET (nouveau billet,
  // nouveau PUT), jamais rejouer seulement la confirmation — voir
  // `UploadLinkDepositPage.runDeposit`.
  errorUploadMissing: "L envoi n a pas abouti. Reessayez l envoi complet du fichier.",
} as const;

export type UploadLinkDepositValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validation CLIENT immediate (extension reconnue, taille <= 50 Mo, compteur
 * sous `maxFiles`) — DANS CET ORDRE, meme discipline que
 * `validateOrderFileForUpload` (E10.17b). Confort UX seulement : le serveur
 * (E10.20b) revalide integralement.
 */
export function validateUploadLinkDeposit(
  file: Readonly<{ name: string; size: number }>,
  depositedCount: number,
  maxFiles: number,
): UploadLinkDepositValidationResult {
  try {
    resolveOrderFileContentType(file.name);
  } catch (cause) {
    if (cause instanceof UnsupportedOrderFileExtensionError) {
      return { ok: false, error: UPLOAD_LINK_DEPOSIT_COPY.errorUnsupportedFormat };
    }
    throw cause;
  }

  if (file.size > UPLOAD_LINK_MAX_BYTE_SIZE) {
    return { ok: false, error: UPLOAD_LINK_DEPOSIT_COPY.errorTooLarge };
  }

  if (depositedCount >= maxFiles) {
    return { ok: false, error: UPLOAD_LINK_DEPOSIT_COPY.errorLimitReached };
  }

  return { ok: true };
}

export interface UploadLinkDepositFailure {
  message: string;
  /** `false` uniquement pour un echec qui ne peut PAS aboutir en rejouant l action a l identique. */
  retryable: boolean;
}

/**
 * Discrimine un echec de depot/confirmation, meme discipline que
 * `describeOrderFileUploadFailure` (E10.17b) : `error instanceof
 * ApiClientError` puis `problem.code`, jamais une inspection de message
 * texte.
 */
export function describeUploadLinkDepositFailure(
  cause: unknown,
  fallbackMessage: string,
): UploadLinkDepositFailure {
  if (cause instanceof ApiClientError) {
    if (cause.problem.code === 'upload_link.file_limit_reached') {
      return { message: UPLOAD_LINK_DEPOSIT_COPY.errorLimitReached, retryable: false };
    }
    if (cause.problem.code === 'order_file.rejected') {
      return { message: UPLOAD_LINK_DEPOSIT_COPY.errorUnsupportedFormat, retryable: true };
    }
    // qa-review round 1 (B2) — la confirmation dit que l objet est absent
    // au chemin attendu : NE JAMAIS annoncer un transfert reussi. Retryable
    // (un nouvel envoi COMPLET peut aboutir), mais le message ne doit pas
    // etre confondu avec `errorConfirmFailed`, qui pretend a tort que
    // l envoi a eu lieu.
    if (cause.problem.code === 'order_file.upload_missing') {
      return { message: UPLOAD_LINK_DEPOSIT_COPY.errorUploadMissing, retryable: true };
    }
  }
  return { message: fallbackMessage, retryable: true };
}

/** Vrai si l echec vient d un lien devenu invalide (expire/revoque ENTRE le contexte et le depot) : plus rien a proposer que revenir a l accueil du lien. */
export function isUploadLinkInvalidFailure(cause: unknown): boolean {
  return cause instanceof ApiClientError && cause.problem.code === 'upload_link.invalid';
}

/**
 * Vrai si le serveur signale qu AUCUN octet n a ete recu au chemin attendu
 * (qa-review round 1, B2) : le "Réessayer" associe a ce cas DOIT relancer un
 * envoi COMPLET (nouveau billet, nouveau `PUT`), jamais rejouer seulement la
 * confirmation avec le billet precedent — l objet qu il designait n existe
 * pas cote serveur, rejouer la confirmation echouerait a l identique.
 */
export function isUploadMissingFailure(cause: unknown): boolean {
  return cause instanceof ApiClientError && cause.problem.code === 'order_file.upload_missing';
}
