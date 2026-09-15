/**
 * OrderExportPanel — bouton d export, modale et REGISTRE des demandes
 * d export comptable (E10.18e-2, docs/api/CONVENTIONS.md §8.24, consigne
 * E10.18e-2, points 1, 2, 5, 6, 7, 9, 11 ; DURCI en qa-review round 1,
 * 2026-09-15).
 *
 * SEUL POINT D APPEL de `OrderExportDialog` — visibilite du bouton ET du
 * panneau gardee par `hasCapability(CAN_EXPORT_ORDERS)`
 * (`.claude/rules/frontend.md` : l API reste la seule barriere reelle,
 * cette garde est de l UX). `can_export_orders` est une VRAIE cle de role
 * (contrairement a `commercial-orders.read`, qui ne gouverne aujourd hui que
 * l entree de menu de la grille) — voir `docs/api/CONVENTIONS.md` §8.24
 * point 6. `CAN_EXPORT_ORDERS` est IMPORTEE d`order-export.helpers.ts`
 * (qa-review round 1, V02) : une chaine locale a ce fichier n etait couverte
 * par AUCUN test, et une faute de frappe y aurait masque le bouton a tout
 * le monde sans qu aucune gate ne le voie.
 *
 * COQUILLE GENERIQUE (condition (b1)/(11), DURCIE en qa-review round 1,
 * B2) : l etat du registre (`orderExportRegistryReducer`), le calendrier de
 * suivi (`startOrderExportPolling`/`nextOrderExportPollDelayMs`) et le
 * descripteur de ligne UNIQUE (`describeOrderExportRow` — statut, format,
 * granularite ET telechargement, tous lus depuis les memes sources que la
 * modale) sont PURS et TESTES dans `order-export.helpers.ts`. Le JSX ne
 * garde qu UNE SEULE branche generique pour le telechargement (un bouton si
 * `download.downloadable`, du texte sinon) — plus aucun libelle de statut,
 * de format, de granularite ou de cas de telechargement ecrit a la main ici
 * (avant ce correctif : les libelles « Expiré »/« Demandé par un autre
 * membre » et le ternaire de granularite l etaient, tous les deux
 * permutables sans qu aucun test ne le remarque — B2, D04/D05).
 *
 * ── MOYEN M2, qa-review round 1 : AUCUNE URL signee dans le DOM ──────────
 * Le lien de telechargement est un `<button>`, JAMAIS un `<a href>` : rien
 * dans ce que rend ce composant ne porte l URL signee (potentiellement
 * PERIMEE de plusieurs minutes), donc rien qu un clic milieu, un menu
 * contextuel ou un copier-coller de lien ne puisse contourner. Au clic,
 * `refreshOrderExportDownloadUrl()` relit l export (`GET .../{id}`, URL
 * fraiche de 300 s) puis `triggerBrowserDownload()` declenche le
 * telechargement — voir cette fonction pour le choix technique retenu et
 * son motif (le story doc le reprend).
 *
 * Suivi (point 5) : un `startOrderExportPolling()` par demande NON
 * TERMINALE du registre — demarre des qu une demande apparait `pending`/
 * `running`, s arrete de lui-meme sur un etat terminal (ou reprend apres un
 * echec transitoire, qa-review round 1 M1 — voir `order-export.helpers.ts`),
 * et TOUS les pollers actifs sont arretes au demontage de ce composant.
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { useAccessProfile } from '@/modules/roles/ui/runtime';
import { OrderExportsApiClient, type OrderExportDto } from '@/modules/order-exports';
import {
  CAN_EXPORT_ORDERS,
  describeOrderExportRow,
  INITIAL_ORDER_EXPORT_REGISTRY_STATE,
  nonTerminalOrderExportIds,
  ORDER_EXPORT_REGISTRY_PAGE_SIZE,
  orderExportRegistryReducer,
  refreshOrderExportDownloadUrl,
  resolveOrderExportDownloadRefreshErrorMessage,
  resolveOrderExportListLoadErrorMessage,
  startOrderExportPolling,
  type OrderExportPollingHandle,
} from './order-export.helpers';
import { OrderExportDialog } from './OrderExportDialog';
import type { OrdersListFilters, ProductionStepCatalog } from '../workspace/orders-list.helpers';

const T = TEST_IDS.orderExport;

export interface OrderExportPanelProps {
  /** Filtres ACTIFS de la grille, transmis tels quels a la modale (point 3). */
  filters: OrdersListFilters;
  selectedCustomerLabel: string;
  stepCatalog: ProductionStepCatalog;
}

/**
 * Declenche le telechargement d une URL signee SANS jamais la poser dans le
 * DOM rendu (voir en-tete, M2). Choix retenu, et pourquoi les deux
 * alternatives usuelles sont ecartees :
 *  - `window.open(url, '_blank')` **peut etre bloque par le navigateur**
 *    lorsqu il est appele apres un `await` (l appel n est alors plus
 *    rattache, du point de vue du navigateur, au geste utilisateur — c est
 *    exactement le piege signale en qa-review) ;
 *  - `window.location.assign(url)` fonctionnerait, mais fait QUITTER l
 *    application (navigation de l onglet courant) si le serveur ne force
 *    pas `Content-Disposition: attachment` sur l objet signe — un risque
 *    qu on ne maitrise pas depuis ce lot (l URL est produite par
 *    `createSignedUrl()` cote E10.18c/d, hors perimetre de cette story).
 * Retenu : une ANCRE DETACHEE (jamais inseree visuellement, jamais
 * atteignable par un clic droit/milieu), avec l attribut `download`, ajoutee
 * au DOM juste le temps d un `click()` synthetique puis retiree. C est le
 * mecanisme standard pour declencher un telechargement sans quitter la page
 * ni dependre d une fenetre ouverte par `window.open` — et il n est, par
 * construction, JAMAIS expose a l utilisateur avant le clic.
 */
function triggerBrowserDownload(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function OrderExportPanel({ filters, selectedCustomerLabel, stepCatalog }: OrderExportPanelProps) {
  const api = useWorkspaceApi(OrderExportsApiClient);
  const { hasCapability } = useAccessProfile();
  const canExport = hasCapability(CAN_EXPORT_ORDERS) === true;

  const [state, dispatch] = useReducer(orderExportRegistryReducer, INITIAL_ORDER_EXPORT_REGISTRY_STATE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadErrorsById, setDownloadErrorsById] = useState<Readonly<Record<string, string>>>({});
  // BLOQUANT M1, qa-review round 2 (2026-09-15) : AVANT ce correctif, `onError`
  // du suivi ne faisait RIEN (voir le commentaire retire ci-dessous) — une
  // demande arretee sur un 401/403/404 (ou sur l echeance de duree, voir
  // `order-export.helpers.ts`) restait affichee « En cours » indefiniment,
  // sans AUCUN moyen pour l utilisateur de s en rendre compte. Cet etat porte
  // le dernier message de suivi PAR DEMANDE, efface des qu un sondage reussit
  // (`clearPollError`, appele avant chaque `onUpdate`).
  const [pollErrorsById, setPollErrorsById] = useState<Readonly<Record<string, string>>>({});
  const pollersRef = useRef<Map<string, OrderExportPollingHandle>>(new Map());

  // Chargement initial du registre — TENANT-LARGE (contrat), une seule fois.
  useEffect(() => {
    if (!canExport) return;
    let cancelled = false;
    void api.list({ pageSize: ORDER_EXPORT_REGISTRY_PAGE_SIZE }).then(
      (page) => {
        if (!cancelled) dispatch({ type: 'listLoaded', items: page.items, hasMore: page.nextCursor !== null });
      },
      (cause) => {
        if (!cancelled) {
          // DEFAUT R3, qa-review round 4 (2026-09-15) : AVANT ce correctif,
          // une panne reseau au chargement affichait litteralement "Failed
          // to fetch" — voir `resolveOrderExportListLoadErrorMessage()`.
          dispatch({ type: 'listLoadFailed', message: resolveOrderExportListLoadErrorMessage(cause) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api, canExport]);

  // Un poller par demande NON TERMINALE (point 5) — demarre des qu une
  // nouvelle demande apparait dans `state.items`, jamais relance pour une
  // demande deja suivie.
  useEffect(() => {
    if (!canExport) return;
    const targetIds = new Set(nonTerminalOrderExportIds(state.items));
    const active = pollersRef.current;

    for (const id of targetIds) {
      if (active.has(id)) continue;
      const handle = startOrderExportPolling(
        id,
        api,
        (updated) => {
          // Un sondage qui reussit efface le dernier message de suivi
          // affiche pour cette demande (round 2 : voir declaration de
          // `pollErrorsById`).
          setPollErrorsById((current) => {
            if (!(id in current)) return current;
            const next = { ...current };
            delete next[id];
            return next;
          });
          dispatch({ type: 'exportUpdated', item: updated });
        },
        (message) => {
          // BLOQUANT M1, qa-review round 2 : le suivi peut desormais s
          // arreter DEFINITIVEMENT pour cette demande (401/403/404, ou
          // l echeance de duree — voir `order-export.helpers.ts`), ou
          // continuer apres un echec transitoire (reseau, 5xx) sans jamais
          // s arreter tout seul. Dans les deux cas, le dernier message recu
          // est affiche sur la ligne : un echec transitoire s efface au
          // prochain succes (ci-dessus), un arret definitif reste affiche
          // puisqu aucun succes ne viendra plus l effacer.
          setPollErrorsById((current) => ({ ...current, [id]: message }));
        },
      );
      active.set(id, handle);
    }
    for (const [id, handle] of active) {
      if (!targetIds.has(id)) {
        handle.stop();
        active.delete(id);
      }
    }
  }, [state.items, api, canExport]);

  // ARRET AU DEMONTAGE (point 5) — tous les pollers actifs, sans exception.
  useEffect(() => {
    const active = pollersRef.current;
    return () => {
      for (const handle of active.values()) handle.stop();
      active.clear();
    };
  }, []);

  if (!canExport) return null;

  // Ne recoit que l identifiant, JAMAIS l objet `item` du registre — ce qui
  // rend structurellement plus difficile de retomber, par inadvertance,
  // sur `item.download_url` en cache au lieu d une lecture fraiche (M2/L01).
  const handleDownloadClick = async (exportId: string) => {
    setDownloadErrorsById((current) => {
      if (!(exportId in current)) return current;
      const next = { ...current };
      delete next[exportId];
      return next;
    });
    try {
      const { item, url } = await refreshOrderExportDownloadUrl(api, exportId);
      dispatch({ type: 'exportUpdated', item });
      if (url) {
        triggerBrowserDownload(url);
      } else {
        setDownloadErrorsById((current) => ({ ...current, [exportId]: "Ce fichier n'est plus disponible au téléchargement." }));
      }
    } catch (cause) {
      // DEFAUT R3, qa-review round 4 (2026-09-15) : AVANT ce correctif, une
      // panne reseau au rafraichissement affichait litteralement "Failed to
      // fetch" — voir `resolveOrderExportDownloadRefreshErrorMessage()`.
      setDownloadErrorsById((current) => ({
        ...current,
        [exportId]: resolveOrderExportDownloadRefreshErrorMessage(cause),
      }));
    }
  };

  return (
    <div className="mt-6" data-testid={T.panel}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide">Exports</h2>
        <button
          type="button"
          data-testid={T.btn}
          onClick={() => setDialogOpen(true)}
          className="px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink"
        >
          Exporter
        </button>
      </div>

      {dialogOpen && (
        <OrderExportDialog
          filters={filters}
          selectedCustomerLabel={selectedCustomerLabel}
          stepCatalog={stepCatalog}
          onClose={() => setDialogOpen(false)}
          onCreated={(item: OrderExportDto) => dispatch({ type: 'exportCreated', item })}
        />
      )}

      {state.status === 'error' && state.error && (
        <p data-testid={T.loadErrorBanner} className="text-sm text-err-fg mb-2">
          {state.error}
        </p>
      )}

      {state.status === 'loading' ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : state.items.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun export demandé pour l’instant.</p>
      ) : (
        <>
          <table className="w-full text-sm bg-paper border border-line rounded-md overflow-hidden" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {state.items.map((item) => {
                const row = describeOrderExportRow(item);
                return (
                  <tr key={item.id} data-testid={T.row} data-export-id={item.id} className="border-b border-line">
                    <td className="px-3 py-2 text-ink-2">
                      {row.formatLabel} · {row.granularityLabel}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{row.requestedByLabel}</td>
                    <td className="px-3 py-2" data-testid={T.status} data-status={item.status}>
                      <span>{row.status.label}</span>
                      {row.status.message && <div className="text-xs text-err-fg mt-0.5">{row.status.message}</div>}
                      {/* BLOQUANT M1, qa-review round 2 : dernier message de
                          SUIVI (pas de l export lui-meme) — voir la
                          declaration de `pollErrorsById` plus haut. */}
                      {pollErrorsById[item.id] && <div className="text-xs text-err-fg mt-0.5">{pollErrorsById[item.id]}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {/* UNE SEULE branche generique (qa-review round 1, B2) : un
                          bouton si le descripteur dit `downloadable`, du texte
                          sinon — plus aucun cas ecrit a la main ici. */}
                      {row.download.downloadable ? (
                        <button
                          type="button"
                          data-testid={T.downloadLink}
                          onClick={() => void handleDownloadClick(item.id)}
                          className="text-brand hover:underline"
                        >
                          {row.download.label}
                        </button>
                      ) : (
                        <span className="text-ink-muted">{row.download.label}</span>
                      )}
                      {downloadErrorsById[item.id] && <div className="text-xs text-err-fg mt-0.5">{downloadErrorsById[item.id]}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {state.hasMore && (
            <p className="mt-2 text-xs text-ink-muted">
              Registre limité aux {ORDER_EXPORT_REGISTRY_PAGE_SIZE} demandes les plus récentes — les demandes plus
              anciennes ne sont pas listées.
            </p>
          )}
        </>
      )}
    </div>
  );
}
