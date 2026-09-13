/**
 * Composition REELLE de la purge de retention des fichiers d export (story
 * E10.18c, contrat §8.24 point 3(e), qa-review round 2 PUIS round 3,
 * 2026-09-13). Meme raisonnement que `order-file-purge-composition.test.ts`
 * (E10.22b) : verifie que `createOrderExportPurgeApplication()` cable
 * correctement les DEUX etages (reclamation normale PUIS balayage d objets
 * orphelins) — PAS que l Edge Function `magrit-order-file-purge` fonctionne
 * en conditions reelles (hors tsconfig, Deno + Docker absents).
 *
 * Second manquement signale par la qa-review round 3 : « `grep -rn
 * "purgeExpiredFiles|OrderExportPurge" tests/` -> zero ». Toute la
 * correction du round 2 (confirmation UNIQUEMENT apres remove() sans
 * erreur) puis du round 3 (confirmation CIBLEE, jamais en bloc, sur ce que
 * l API Storage rend) reposait sur des commentaires, sans un seul test qui
 * la mette en defaut si on la retire. CE FICHIER FERME CE MANQUEMENT.
 *
 * VERIFIE PAR MUTATION (round 3, avant livraison, non committe) : le test
 * "retrait PARTIEL" ci-dessous a ete rejoue contre une version DELIBEREMENT
 * REGRESSEE de `SupabaseOrderExportPurgeRepository.purgeExpiredFiles` qui
 * confirme TOUS les ids reclames des que `error === null` (le defaut
 * EXACT du round 2, celui que le round 3 corrige) — le test ECHOUE sur ce
 * code (`p_export_ids` recu par le rpc `api_confirm_order_export_files_purged`
 * contient les DEUX ids au lieu d un seul), CONFIRMANT qu il prouve bien la
 * propriete et non un artefact du montage. Le code corrige (ci-dessous)
 * fait passer le meme test.
 */
import { describe, expect, it } from 'vitest';
import { createOrderExportPurgeApplication } from '@/server/api/order-export-purge-composition';

function buildFakeServiceRoleClient(options: {
  claimedRows?: readonly Record<string, unknown>[];
  /** Chemins EFFECTIVEMENT rendus par `remove()` sur le premier appel (etage 1) — `undefined` = tous les chemins demandes. */
  removedPathsStage1?: readonly string[];
  removeErrorStage1?: boolean;
  confirmErrorStage1?: boolean;
  /** Nombre de lignes REELLEMENT mises a jour, rendu par la RPC de confirmation (peut differer du nombre d ids envoyes). */
  confirmedCountStage1?: number;
  orphanRows?: readonly Record<string, unknown>[];
  removedPathsOrphan?: readonly string[];
  removeErrorOrphan?: boolean;
  confirmErrorOrphan?: boolean;
}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const removeCalls: Array<{ bucket: string; paths: readonly string[] }> = [];

  return {
    rpcCalls,
    removeCalls,
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (fn === 'api_claim_order_exports_for_purge') {
        return { data: options.claimedRows ?? [], error: null };
      }
      if (fn === 'api_confirm_order_export_files_purged') {
        // Distingue l appel etage 1 (purge) de l appel etage 2 (orphelins) :
        // le service execute integralement l etage 1 (`purgeExpiredFiles`,
        // qui peut lui-meme appeler cette RPC) AVANT d appeler
        // `api_claim_orphan_order_export_objects` (debut de l etage 2) --
        // si ce dernier a DEJA ete appele, cette confirmation est celle de
        // l etage 2.
        const isOrphanConfirm = rpcCalls.some((c) => c.fn === 'api_claim_orphan_order_export_objects');
        if (isOrphanConfirm) {
          if (options.confirmErrorOrphan) return { data: null, error: { message: 'panne confirmation orphelins' } };
          return { data: (args['p_export_ids'] as unknown[]).length, error: null };
        }
        if (options.confirmErrorStage1) return { data: null, error: { message: 'panne confirmation etage 1' } };
        return { data: options.confirmedCountStage1 ?? (args['p_export_ids'] as unknown[]).length, error: null };
      }
      if (fn === 'api_claim_orphan_order_export_objects') {
        return { data: options.orphanRows ?? [], error: null };
      }
      throw new Error(`rpc inattendu dans ce faux: ${fn}`);
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: readonly string[]) {
            removeCalls.push({ bucket, paths });
            // Meme heuristique que ci-dessus : un retrait survenant APRES
            // le claim des orphelins est celui de l etage 2.
            const isOrphanCall = rpcCalls.some((c) => c.fn === 'api_claim_orphan_order_export_objects');
            if (isOrphanCall) {
              if (options.removeErrorOrphan) return { data: null, error: { message: 'panne storage orphelins' } };
              const removed = options.removedPathsOrphan ?? paths;
              return { data: removed.map((name) => ({ name })), error: null };
            }
            if (options.removeErrorStage1) return { data: null, error: { message: 'panne storage etage 1' } };
            const removed = options.removedPathsStage1 ?? paths;
            return { data: removed.map((name) => ({ name })), error: null };
          },
        };
      },
    },
  };
}

describe('createOrderExportPurgeApplication — composition réelle (E10.18c, qa-review round 2/3)', () => {
  it("rend un rapport vide et n'appelle ni remove() ni confirmation quand rien n'est échu", async () => {
    const client = buildFakeServiceRoleClient({ claimedRows: [] });
    const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

    const report = await app.runOnce();

    expect(report).toEqual({ filesMarkedExpired: 0, objectsRemoved: 0, orphanObjectsRemoved: 0 });
    expect(client.removeCalls).toEqual([]);
    expect(client.rpcCalls.some((c) => c.fn === 'api_confirm_order_export_files_purged')).toBe(false);
  });

  it("remove() en ERREUR : AUCUNE confirmation n'est appelée, objectsRemoved = 0 (round 2)", async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [{ purged_export_id: 'exp-1', purged_tenant_id: 't1', purged_storage_path: 't1/exp-1.csv' }],
      removeErrorStage1: true,
      orphanRows: [],
    });
    const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

    const report = await app.runOnce();

    expect(report.filesMarkedExpired).toBe(1);
    expect(report.objectsRemoved).toBe(0);
    expect(client.rpcCalls.some((c) => c.fn === 'api_confirm_order_export_files_purged')).toBe(false);
  });

  it('confirmation EN ERREUR : objectsRemoved = 0, la ligne reste re-réclamable (round 2)', async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [{ purged_export_id: 'exp-1', purged_tenant_id: 't1', purged_storage_path: 't1/exp-1.csv' }],
      confirmErrorStage1: true,
      orphanRows: [],
    });
    const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

    const report = await app.runOnce();

    expect(report.objectsRemoved).toBe(0);
    expect(client.rpcCalls.filter((c) => c.fn === 'api_confirm_order_export_files_purged')).toHaveLength(1);
  });

  it(
    'RETRAIT PARTIEL (BLOQUANT round 3) : remove() rend error:null mais data ne porte QU UN SEUL des DEUX chemins ' +
      "-> SEUL l'id correspondant est confirmé, l'autre reste re-réclamable (le défaut exact du round 2)",
    async () => {
      const rowA = { purged_export_id: 'exp-a', purged_tenant_id: 't1', purged_storage_path: 't1/exp-a.csv' };
      const rowB = { purged_export_id: 'exp-b', purged_tenant_id: 't1', purged_storage_path: 't1/exp-b.csv' };
      const client = buildFakeServiceRoleClient({
        claimedRows: [rowA, rowB],
        // Storage ne rend QUE le chemin de A : B a echoue "par cle", SANS
        // erreur de lot (le cas que le round 2 ne fermait pas).
        removedPathsStage1: ['t1/exp-a.csv'],
        confirmedCountStage1: 1,
        orphanRows: [],
      });
      const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

      const report = await app.runOnce();

      expect(report.filesMarkedExpired).toBe(2);
      expect(report.objectsRemoved).toBe(1);

      const confirmCall = client.rpcCalls.find((c) => c.fn === 'api_confirm_order_export_files_purged');
      expect(confirmCall).toBeDefined();
      // LA PROPRIETE QUI FERME LE BLOQUANT : SEUL exp-a est confirme, JAMAIS
      // exp-b (dont le chemin n apparaissait pas dans `data`).
      expect(confirmCall!.args['p_export_ids']).toEqual(['exp-a']);
    },
  );

  it("retrait TOTAL réussi : objectsRemoved dérivé du RETOUR de la RPC de confirmation, pas de rows.length ni de data.length", async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [
        { purged_export_id: 'exp-a', purged_tenant_id: 't1', purged_storage_path: 't1/exp-a.csv' },
        { purged_export_id: 'exp-b', purged_tenant_id: 't1', purged_storage_path: 't1/exp-b.csv' },
      ],
      // `data` porte les DEUX chemins (les deux sont donc CANDIDATS a la
      // confirmation), mais la RPC ne confirme REELLEMENT qu UNE ligne
      // (ex. l autre a change d etat entre-temps) -- objectsRemoved DOIT
      // suivre la RPC, pas le nombre de candidats.
      confirmedCountStage1: 1,
      orphanRows: [],
    });
    const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

    const report = await app.runOnce();

    expect(report.objectsRemoved).toBe(1);
    const confirmCall = client.rpcCalls.find((c) => c.fn === 'api_confirm_order_export_files_purged');
    expect(confirmCall!.args['p_export_ids']).toEqual(['exp-a', 'exp-b']);
  });

  it('(E10.18c round 3) le balayage d objets orphelins tourne APRES la reclamation normale, et confirme les objets à `matched_export_id`', async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [],
      orphanRows: [
        { orphan_object_id: 'obj-1', orphan_object_path: 't1/never-referenced.csv', matched_export_id: null },
        { orphan_object_id: 'obj-2', orphan_object_path: 't1/exhausted.csv', matched_export_id: 'exp-exhausted' },
      ],
    });
    const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

    const report = await app.runOnce();

    expect(report.orphanObjectsRemoved).toBe(2);
    expect(client.rpcCalls.map((c) => c.fn)).toEqual([
      'api_claim_order_exports_for_purge',
      'api_claim_orphan_order_export_objects',
      'api_confirm_order_export_files_purged',
    ]);
    const confirmCall = client.rpcCalls.find((c) => c.fn === 'api_confirm_order_export_files_purged');
    // SEUL l objet a matched_export_id non nul (categorie « purge_attempts
    // epuise ») declenche une confirmation -- l objet jamais reference
    // (categorie a) n a AUCUNE ligne a confirmer.
    expect(confirmCall!.args['p_export_ids']).toEqual(['exp-exhausted']);
  });

  it("un échec de retrait des objets orphelins ne rend PAS un compte de retraits réussis", async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [],
      orphanRows: [{ orphan_object_id: 'obj-1', orphan_object_path: 't1/orphan.csv', matched_export_id: null }],
      removeErrorOrphan: true,
    });
    const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

    const report = await app.runOnce();

    expect(report.orphanObjectsRemoved).toBe(0);
  });

  it('appelle api_claim_order_exports_for_purge et api_claim_orphan_order_export_objects avec les réglages par défaut', async () => {
    const client = buildFakeServiceRoleClient({ claimedRows: [], orphanRows: [] });
    const app = createOrderExportPurgeApplication({ serviceRoleClient: client as any });

    await app.runOnce();

    expect(client.rpcCalls).toEqual([
      { fn: 'api_claim_order_exports_for_purge', args: { p_limit: 500 } },
      { fn: 'api_claim_orphan_order_export_objects', args: { p_older_than: '24 hours', p_limit: 200 } },
    ]);
  });
});
