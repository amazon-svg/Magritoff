/**
 * Depot brut d un fichier sur une URL signee de type "billet de depot"
 * (`OrderFileUploadTicket`), EXTRAIT d `OrderFilesApiClient.uploadOrderFile`
 * (E10.17a) pour etre REUTILISE tel quel par E10.20b
 * (`order-upload-links/api/client.ts`, page publique de depot) — meme
 * discipline que `resolveOrderFileContentType`/`content-type-map.ts`, deja
 * partagee entre les deux modules.
 *
 * `PUT` NU, hors `FetchApiClient` (chemin absolu, pas de prefixe `/api/v1`,
 * aucune `Authorization` Magrit) — JAMAIS le SDK Supabase
 * (`uploadToSignedUrl`), dont l import ferait echouer
 * `tests/architecture/modular-ui-boundaries.test.ts`
 * (`tests/architecture/api-first-boundaries.test.ts` couvre aussi
 * `order-upload-links/ui/`, contrat §8.21 §2).
 */
import { resolveOrderFileContentType } from './content-type-map.ts';

/**
 * `onProgress` est FACULTATIF : quand fourni, le depot passe par
 * `XMLHttpRequest` (seule API navigateur qui expose un evenement de
 * progression sur le CORPS envoye, `fetch` n en publie aucun de facon
 * fiable/cross-navigateur pour un `PUT`) au lieu de `fetch`. Aucune des deux
 * voies n importe le SDK Supabase ni ne change le `Content-Type` pose.
 */
export async function uploadFileToSignedUrl(
  uploadUrl: string,
  filename: string,
  file: Blob,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
): Promise<void> {
  const contentType = resolveOrderFileContentType(filename);
  if (!onProgress) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Depot du fichier impossible (HTTP ${response.status}).`);
    }
    return;
  }

  await new Promise<void>((resolvePut, rejectPut) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolvePut();
      } else {
        rejectPut(new Error(`Depot du fichier impossible (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => rejectPut(new Error('Depot du fichier impossible (erreur reseau).'));
    xhr.send(file);
  });
}
