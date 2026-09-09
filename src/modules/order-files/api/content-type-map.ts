/**
 * Correspondance FERMEE extension -> type MIME (story E10.17a, contrat
 * docs/api/CONVENTIONS.md §8.19, decision #6 et reserve (c)).
 *
 * CONSIGNE OPPOSABLE A L INTERFACE (17b) : ne JAMAIS se fier a `File.type`
 * pour poser le `Content-Type` du `PUT` sur l URL signee — le type qu un
 * navigateur pose sur un fichier depend du SYSTEME D EXPLOITATION du
 * deposant, pas du navigateur. Le cas le plus net est `.zip`
 * (`application/zip` d un cote, `application/x-zip-compressed` de l autre,
 * parfois rien du tout). Poser le `Content-Type` depuis l EXTENSION, via
 * cette correspondance FERMEE, est la seule facon de rendre le depot
 * deterministe independamment du poste du deposant.
 *
 * FERMEE et non un repli generique : une extension absente doit etre un
 * refus EXPLICITE avant meme le `PUT`, jamais un `application/octet-stream`
 * qui contournerait la liste fermee du bucket (REFUSE par le contrat).
 * `.zip` resout sur `application/zip` (un seul des deux types acceptes par le
 * bucket) : c est le type que NOTRE PROPRE client pose, l acceptation des
 * DEUX types par le bucket sert les clients hors navigateur qui enverraient
 * l autre valeur.
 */

const ORDER_FILE_EXTENSION_CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  zip: 'application/zip',
});

/** Extension absente de la correspondance fermee (§8.19 decision #6). */
export class UnsupportedOrderFileExtensionError extends Error {
  readonly extension: string;

  constructor(extension: string) {
    super(
      extension.length > 0
        ? `Extension de fichier non prise en charge pour un depot de commande : .${extension}`
        : 'Fichier sans extension : impossible de determiner un type MIME pour le depot.',
    );
    this.name = 'UnsupportedOrderFileExtensionError';
    this.extension = extension;
  }
}

/**
 * Resout le `Content-Type` a POSER sur le `PUT` du depot, depuis le NOM DE
 * FICHIER uniquement. Leve `UnsupportedOrderFileExtensionError` si
 * l extension n est pas dans la correspondance fermee.
 */
export function resolveOrderFileContentType(filename: string): string {
  const extension = extractExtension(filename);
  const contentType = ORDER_FILE_EXTENSION_CONTENT_TYPES[extension];
  if (contentType === undefined) throw new UnsupportedOrderFileExtensionError(extension);
  return contentType;
}

/** Liste des extensions couvertes par la correspondance fermee (pour filtrer un selecteur de fichiers). */
export function supportedOrderFileExtensions(): readonly string[] {
  return Object.keys(ORDER_FILE_EXTENSION_CONTENT_TYPES);
}

function extractExtension(filename: string): string {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot === -1 || lastDot === trimmed.length - 1) return '';
  return trimmed.slice(lastDot + 1).toLowerCase();
}
