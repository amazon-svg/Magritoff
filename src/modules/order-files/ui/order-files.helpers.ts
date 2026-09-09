/**
 * Helpers PURS du panneau de fichiers de commande (E10.17b).
 *
 * Aucune dependance React, aucun appel reseau : formatage d affichage et
 * validation CLIENT (confort UX immediat, JAMAIS la seule barriere — le
 * serveur, deja livre par E10.17a, reste la seule verite sur le plafond de
 * poids, les formats acceptes et le plafond de fichiers par commande,
 * `.claude/rules/frontend.md`).
 *
 * Microcopie FR reprise MOT POUR MOT du wireframe valide par Arnaud le
 * 09/09/2026 (`.design-handoff/wireframes/E10.17b-panneau-fichiers-
 * commande.md`, §4) — ne pas reformuler.
 */
import { ApiClientError } from '@/platform/api';
import {
  resolveOrderFileContentType,
  UnsupportedOrderFileExtensionError,
} from '../api/content-type-map';

/** Contrat §8.19 §3 : 50 Mo = plafond du PROJET (`supabase/config.toml`), meme valeur que le bucket Storage (52428800 = 50 * 1024 * 1024). */
export const ORDER_FILE_MAX_BYTE_SIZE = 50 * 1024 * 1024;

/** Reserve (b) du contrat, position posee par Arnaud : 30 fichiers vivants par commande. */
export const ORDER_FILE_MAX_COUNT = 30;

/** Microcopie FR complete du wireframe §4 — source UNIQUE, aucun texte litteral ailleurs dans le panneau. */
export const ORDER_FILES_COPY = {
  title: 'Fichiers',
  counter: (count: number) => `${count} / ${ORDER_FILE_MAX_COUNT}`,
  dropzoneTitle: 'Déposez un fichier ici',
  dropzoneBrowse: 'Parcourir',
  dropzoneFormats: 'PDF, JPEG, PNG, WebP, TIFF, ZIP',
  dropzoneLimits: '50 Mo maximum par fichier · 30 fichiers maximum par commande',
  emptyState: 'Aucun fichier déposé sur cette commande.',
  // qa-review N4 (round 1) — plus de litteral "Chargement…" hors de cet objet.
  loading: 'Chargement…',
  uploading: 'Envoi en cours…',
  retry: 'Réessayer',
  // qa-review N3 (round 1) — fermer une carte d envoi en erreur (jamais
  // proposee par le wireframe, necessaire pour ne pas consommer une place du
  // plafond client indefiniment avec une carte qu on ne peut plus rejouer).
  dismissUpload: 'Fermer',
  visibilityInternal: 'Visible en interne uniquement',
  visibilityCustomer: 'Visible aussi par le client',
  visibilityWarning:
    "Cette option n'a pas d'effet pour le moment : aucun espace client n'affiche encore les fichiers d'une commande.",
  downloadTooltip: 'Télécharger',
  deleteTooltip: 'Supprimer',
  deleteDialogTitle: 'Supprimer ce fichier ?',
  deleteDialogBody: (filename: string) =>
    `${filename} sera définitivement supprimé. Cette action est irréversible.`,
  deleteDialogCancel: 'Annuler',
  deleteDialogConfirm: 'Supprimer',
  // §4.3 — messages d erreur, MOT POUR MOT.
  errorTooLarge: 'Ce fichier dépasse 50 Mo. Réduisez-le ou déposez-le par un autre moyen.',
  errorUnsupportedFormat: 'Format non accepté. Formats acceptés : PDF, JPEG, PNG, WebP, TIFF, ZIP.',
  errorLimitReached:
    "Cette commande a atteint son maximum de 30 fichiers. Supprimez-en un avant d'en déposer un nouveau.",
  errorUploadNetwork: 'Le dépôt a échoué. Vérifiez votre connexion et réessayez.',
  errorConfirmFailed: "Le fichier a été transmis mais n'a pas pu être enregistré. Réessayez le dépôt.",
  errorDeleteFailed: 'La suppression a échoué. Réessayez.',
  errorListFailed: 'Impossible de charger les fichiers de cette commande.',
  // §4.4 — objet de stockage disparu (dette de menage assumee au contrat).
  // qa-review B1 (round 1) : ce libelle et cette icone restent INFORMATIFS,
  // jamais une preuve — un echec de telechargement generique (reseau, jeton
  // expire, 500 transitoire) les affiche aussi, sans jamais bloquer un
  // nouvel essai (voir `errorDownloadFailed` ci-dessous et le composant).
  missingObjectTooltip: 'Fichier introuvable — contactez le support si besoin',
  // Hors wireframe (pas de texte dedie au §4.3) : repli pour la bascule de
  // visibilite, seul geste d ecriture de ce panneau non couvert par la liste
  // des erreurs — a faire confirmer par Sally si un texte dedie est souhaite.
  errorVisibilityFailed: 'Le changement de visibilité a échoué. Réessayez.',
  // qa-review B1 (round 1) — echec de telechargement, distinct du message
  // "objet introuvable" : cause reelle indeterminable cote client (reseau,
  // jeton expire, 500 transitoire, objet reellement disparu). Hors wireframe.
  errorDownloadFailed: 'Le téléchargement a échoué. Réessayez.',
} as const;

export type OrderFileValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validation CLIENT immediate avant tout aller-retour reseau (wireframe §3
 * point 2) : extension reconnue (correspondance FERMEE d E10.17a), taille
 * <= 50 Mo, compteur < 30 — DANS CET ORDRE, reprenant celui du wireframe.
 * Confort UX seulement : le serveur revalide integralement (decision #6 et
 * fonction `api_confirm_order_file_upload` sous verrou, §8.19).
 */
export function validateOrderFileForUpload(
  file: Readonly<{ name: string; size: number }>,
  currentFileCount: number,
): OrderFileValidationResult {
  try {
    resolveOrderFileContentType(file.name);
  } catch (cause) {
    if (cause instanceof UnsupportedOrderFileExtensionError) {
      return { ok: false, error: ORDER_FILES_COPY.errorUnsupportedFormat };
    }
    throw cause;
  }

  if (file.size > ORDER_FILE_MAX_BYTE_SIZE) {
    return { ok: false, error: ORDER_FILES_COPY.errorTooLarge };
  }

  if (currentFileCount >= ORDER_FILE_MAX_COUNT) {
    return { ok: false, error: ORDER_FILES_COPY.errorLimitReached };
  }

  return { ok: true };
}

export type OrderFileIconFamily = 'pdf' | 'image' | 'archive' | 'unknown';

/** Icone par FAMILLE de type (pas d aperçu miniature, decision UX §5 du wireframe). */
export function resolveOrderFileIconFamily(contentType: string): OrderFileIconFamily {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/zip' || contentType === 'application/x-zip-compressed') return 'archive';
  return 'unknown';
}

/**
 * Formate un poids de fichier en francais — "850 Ko", "2,4 Mo" (exemples du
 * wireframe §2, Ecran B). Base 1000 (Ko/Mo, pas Kio/Mio) pour rester lisible
 * a l atelier, meme convention d affichage que le reste du panneau.
 */
export function formatOrderFileSize(byteSize: number): string {
  if (byteSize < 1000) return `${byteSize} o`;
  if (byteSize < 1_000_000) return `${Math.round(byteSize / 1000)} Ko`;
  const megaOctets = byteSize / 1_000_000;
  return `${megaOctets.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mo`;
}

/** "08/09/2026 à 14h32" — meme convention de rendu que `OrderStatusDialog` (heure locale du navigateur). */
export function formatOrderFileDepositedAt(depositedAtIso: string): string {
  const date = new Date(depositedAtIso);
  const datePart = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${datePart} à ${hours}h${minutes}`;
}

/**
 * "Déposé par vous, le {date} à {heure}" / "Déposé par {nom}, le {date} à
 * {heure}" — microcopie §4.1, ligne complete pour ne pas la reconstruire a
 * deux endroits differents.
 */
export function formatOrderFileDepositedByLine(
  depositedByLabel: string | null,
  isCurrentUser: boolean,
  depositedAtIso: string,
): string {
  // qa-review N5 (round 1) : "tenant" est du jargon interne, absent du
  // wireframe et de l espace utilisateur final — "l espace" est le mot deja
  // employe ailleurs dans le produit pour designer la meme notion.
  const who = isCurrentUser ? 'vous' : (depositedByLabel ?? "un membre de l'espace");
  return `Déposé par ${who}, le ${formatOrderFileDepositedAt(depositedAtIso)}`;
}

export interface OrderFileUploadFailure {
  message: string;
  /** `false` uniquement pour un echec qui ne peut PAS aboutir en rejouant l action a l identique (ex. plafond atteint). */
  retryable: boolean;
}

/**
 * Discrimine un echec de depot/confirmation (qa-review B2, round 1) : avant
 * cette correction, TOUTE erreur serveur a l emission du billet ou a la
 * confirmation etait affichee comme un echec reseau generique avec un bouton
 * "Réessayer" qui ne pouvait jamais aboutir pour un plafond atteint. Meme
 * discipline que `DocumentTemplateFieldsPage.handleSave` (E10.10b-4b) :
 * `error instanceof ApiClientError` puis `problem.code`, jamais une
 * inspection de message texte.
 *
 * `fallbackMessage` distingue l etape (reseau au depot vs echec de
 * confirmation) pour les erreurs NON discriminees (reseau reel, 500) — le
 * seul cas ou ce helper se contente de repeter ce qu il recoit.
 */
export function describeOrderFileUploadFailure(cause: unknown, fallbackMessage: string): OrderFileUploadFailure {
  if (cause instanceof ApiClientError) {
    if (cause.problem.code === 'order_file.limit_reached') {
      // Le plafond de 30 fichiers est un ETAT DE LA COMMANDE, jamais reparable
      // en rejouant le MEME depot : aucun bouton "Réessayer" ne doit le
      // proposer (qa-review B2).
      return { message: ORDER_FILES_COPY.errorLimitReached, retryable: false };
    }
    if (cause.problem.code === 'order_file.rejected') {
      // Defense en profondeur serveur (§8.19 decision #6) : l objet depose ne
      // correspond pas a ce qui a ete declare. Le message de format non
      // accepte est le plus juste cote imprimeur — rejouer PEUT aboutir si le
      // bon fichier est fourni au prochain essai (ex. mauvais fichier
      // selectionne par erreur), retryable reste vrai.
      return { message: ORDER_FILES_COPY.errorUnsupportedFormat, retryable: true };
    }
  }
  return { message: fallbackMessage, retryable: true };
}
