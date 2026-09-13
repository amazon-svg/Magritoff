/**
 * Resolution d une borne de date CIVILE (`YYYY-MM-DD`) en instant UTC, avec
 * refus explicite d un jour INEXISTANT dans le calendrier — EXTRAIT
 * d `commercial-orders-routes.ts` (E10.18a) en E10.18c pour que
 * `requestCommercialOrderExport` en herite SANS EN RECOPIER LA LOGIQUE
 * (docs/api/CONVENTIONS.md §8.24 point 5 regle 7 : « RequestOrderExportCommand
 * en heritera... sans une ligne de plus »). Une seule fonction, deux
 * appelants (`listCommercialOrders` et `requestCommercialOrderExport`).
 *
 * La validation de calendrier elle-meme vit dans `civilDateToUtc()`
 * (`src/kernel/clock/timezone.ts`) — ce fichier ne fait que traduire son
 * `TypeError` en 422 `api.validation_failed` sur le CHAMP fautif. Si un cas
 * de bord manque, il se corrige dans le kernel, jamais ici.
 */
import { validationFailed } from './problem.ts';

/**
 * Forme valide (`YYYY-MM-DD`, deja verifiee par l appelant) ne veut pas dire
 * CALENDRIER valide : `resolve` (`startOfDayInReferenceTimeZone`/
 * `endOfDayInReferenceTimeZone`) leve un `TypeError` pour un jour inexistant
 * (`2026-06-31`, `2026-02-30`...), capture ici et traduit en **422**
 * `api.validation_failed` sur le champ fautif — JAMAIS un report silencieux
 * sur le mois/l annee suivants.
 */
export function resolveCalendarBoundOrThrow(
  field: string,
  dateOnly: string,
  resolve: (dateOnly: string) => Date,
): string {
  try {
    return resolve(dateOnly).toISOString();
  } catch (error) {
    if (error instanceof TypeError) {
      throw validationFailed([{ field, message: 'Date inexistante dans le calendrier.' }]);
    }
    throw error;
  }
}
