/**
 * ParkApiAdapter — interface unique d'acces au domaine « Parc machine ».
 *
 * Meme intention que `ClariprintAdapter` : un seul point de passage entre les
 * ecrans et le serveur, des erreurs typees, et une implementation
 * substituable en test sans toucher aux composants.
 *
 * ─── Ce que cet adaptateur garantit (R1) ────────────────────────────────────
 *
 * Aucun ecran du Parc machine ne construit de requete vers la base. Ils
 * appellent ces methodes, qui appellent l edge function `park-api`, qui seule
 * atteint les tables. Le jour ou le stockage rejoint Clariprint Data cote
 * Expert Solutions, c est l implementation derriere ces memes signatures qui
 * change — les ecrans ne bougent pas.
 *
 * Contrat de reference : `docs/API_PARC_MACHINE.md` (v1.0).
 */

import { supabase } from '/utils/supabase/client';
import {
  ParkApiRequestError,
  type LibraryMachine,
  type MachinePark,
  type MachineParkInput,
  type MachineTypeKey,
  type ParkErrorCode,
  type SupplierKind,
  type SupplierRef,
} from './contract';

const FUNCTION_NAME = 'park-api';

export interface ParkApiAdapter {
  /** Referentiel de machines, partage entre imprimeurs (lecture seule). */
  listMachineLibrary(type?: MachineTypeKey): Promise<LibraryMachine[]>;
  /** Referentiel Fournisseur unifie — BK-07. */
  listSuppliers(tenantId: string, kind?: SupplierKind): Promise<SupplierRef[]>;
  listParks(tenantId: string): Promise<MachinePark[]>;
  getPark(tenantId: string, parkId: string): Promise<MachinePark | null>;
  /** Cree si `park.id` est absent, remplace integralement sinon. */
  upsertPark(tenantId: string, park: MachineParkInput): Promise<MachinePark>;
  /** Remplace TOUTE la collection de l espace (reprise en masse). */
  replaceParks(tenantId: string, parks: MachineParkInput[]): Promise<MachinePark[]>;
  deletePark(tenantId: string, parkId: string): Promise<void>;
}

/** Reponse d erreur du contrat : `{ error: { code, message } }`. */
function readContractError(payload: unknown): { code: ParkErrorCode; message: string } | null {
  if (!payload || typeof payload !== 'object') return null;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return { code: code as ParkErrorCode, message };
}

/**
 * `functions.invoke` place le corps d erreur dans `error.context` et non dans
 * `data` : sans cette lecture, un 403 parfaitement explicite du contrat
 * arriverait a l ecran sous la forme « Edge Function returned a non-2xx status
 * code », qui ne dit rien a personne.
 */
async function readInvokeError(error: unknown): Promise<ParkApiRequestError> {
  const context = (error as { context?: unknown } | null)?.context;

  if (context instanceof Response) {
    const payload = await context.json().catch(() => null);
    const contractError = readContractError(payload);
    if (contractError) {
      return new ParkApiRequestError(contractError.code, contractError.message, context.status);
    }
    return new ParkApiRequestError(
      'internal',
      'Le service du parc machine a répondu une erreur inattendue.',
      context.status,
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ParkApiRequestError('network', `Service du parc machine injoignable : ${message}`);
}

async function call<T>(path: string, init: { method: string; body?: unknown } = { method: 'GET' }): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(`${FUNCTION_NAME}/${path}`, {
    method: init.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
    ...(init.body !== undefined ? { body: init.body } : {}),
  });

  if (error) throw await readInvokeError(error);

  // Un 2xx portant l enveloppe d erreur du contrat ne doit pas passer pour un
  // succes silencieux.
  const contractError = readContractError(data);
  if (contractError) {
    throw new ParkApiRequestError(contractError.code, contractError.message, null);
  }

  if (data == null) {
    throw new ParkApiRequestError('internal', 'Réponse vide du service du parc machine.');
  }
  return data;
}

export const httpParkApi: ParkApiAdapter = {
  async listMachineLibrary(type) {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    const { machines } = await call<{ machines: LibraryMachine[] }>(`machine-library${query}`);
    return machines ?? [];
  },

  async listSuppliers(tenantId, kind) {
    const params = new URLSearchParams({ tenantId });
    if (kind) params.set('kind', kind);
    const { suppliers } = await call<{ suppliers: SupplierRef[] }>(`suppliers?${params}`);
    return suppliers ?? [];
  },

  async listParks(tenantId) {
    const { parks } = await call<{ parks: MachinePark[] }>(
      `parks?tenantId=${encodeURIComponent(tenantId)}`,
    );
    return parks ?? [];
  },

  async getPark(tenantId, parkId) {
    try {
      const { park } = await call<{ park: MachinePark }>(
        `parks/${encodeURIComponent(parkId)}?tenantId=${encodeURIComponent(tenantId)}`,
      );
      return park;
    } catch (e) {
      // « Introuvable » est une reponse, pas une panne : l ecran de detail
      // affiche « Parc introuvable » plutot qu une erreur technique.
      if (e instanceof ParkApiRequestError && e.code === 'not_found') return null;
      throw e;
    }
  },

  async upsertPark(tenantId, park) {
    const { park: saved } = await call<{ park: MachinePark }>('parks', {
      method: 'POST',
      body: { tenantId, park },
    });
    return saved;
  },

  async replaceParks(tenantId, parks) {
    const { parks: saved } = await call<{ parks: MachinePark[] }>('parks', {
      method: 'PUT',
      body: { tenantId, parks },
    });
    return saved ?? [];
  },

  async deletePark(tenantId, parkId) {
    await call<{ deleted: boolean }>(
      `parks/${encodeURIComponent(parkId)}?tenantId=${encodeURIComponent(tenantId)}`,
      { method: 'DELETE' },
    );
  },
};
