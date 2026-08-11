/**
 * Chargement des referentiels du Parc machine (2026-08-11).
 *
 * Avant la bascule en base, la bibliotheque de machines et les listes de
 * fournisseurs etaient des tableaux figes dans le code : les ecrans les
 * lisaient sans y penser, au rendu. Elles viennent maintenant du serveur, donc
 * elles ARRIVENT — il y a un instant ou elles ne sont pas la. Ce hook rend cet
 * instant explicite plutot que de le laisser se manifester par une liste vide
 * sans explication.
 *
 * Les trois listes de fournisseurs sortent d UN SEUL appel : le referentiel
 * BK-07 est unifie, les separer en trois requetes irait contre son principe.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadMachineLibrary, loadSuppliers,
  type LibraryMachine, type SupplierRef,
} from './machinePark.helpers';

export interface MachineReferentials {
  /** Referentiel de machines, trie par type / famille / rang de popularite. */
  library: LibraryMachine[];
  /** Noms des fournisseurs papier (BK-18). */
  paperSuppliers: string[];
  /** Noms des fournisseurs transport (BK-18). */
  transportSuppliers: string[];
  /** Noms de sous-traitants, pour l autocompletion (BK-10). */
  subcontractors: string[];
  loading: boolean;
  /** Message affichable, ou `null`. */
  error: string | null;
  reload: () => void;
}

const namesOf = (suppliers: SupplierRef[], kind: SupplierRef['kind']): string[] =>
  suppliers.filter((s) => s.kind === kind).map((s) => s.name);

export function useMachineReferentials(tenantId: string): MachineReferentials {
  const [library, setLibrary] = useState<LibraryMachine[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    // Le tenant peut changer (bascule d espace) pendant qu une reponse est en
    // vol : sans ce drapeau, la reponse de l ancien espace ecraserait celle du
    // nouveau selon l ordre d arrivee.
    let current = true;
    setLoading(true);
    setError(null);

    Promise.all([loadMachineLibrary(), loadSuppliers(tenantId)])
      .then(([libraryData, supplierData]) => {
        if (!current) return;
        setLibrary(libraryData);
        setSuppliers(supplierData);
      })
      .catch((e: unknown) => {
        if (!current) return;
        setError(
          e instanceof Error
            ? e.message
            : 'Impossible de charger la bibliothèque de machines et les fournisseurs.',
        );
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [tenantId, attempt]);

  return useMemo(
    () => ({
      library,
      paperSuppliers: namesOf(suppliers, 'paper'),
      transportSuppliers: namesOf(suppliers, 'transport'),
      subcontractors: namesOf(suppliers, 'subcontractor'),
      loading,
      error,
      reload,
    }),
    [library, suppliers, loading, error, reload],
  );
}
