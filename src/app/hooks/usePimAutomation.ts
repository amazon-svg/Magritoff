import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GeneratePimDefinitionCommand,
  PimIngestReport,
} from '../../modules/catalog';
import { useCatalogApi } from '../contexts/ModuleClientsContext';

export function pimAutomationError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

type UsePimAutomationOptions = Readonly<{
  enabled: boolean;
  onLiveIngest: () => void | Promise<void>;
}>;

export function usePimAutomation({ enabled, onLiveIngest }: UsePimAutomationOptions) {
  const catalogApi = useCatalogApi();
  const requestVersion = useRef(0);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [ingestRunning, setIngestRunning] = useState<false | 'dry' | 'live'>(false);
  const [ingestReport, setIngestReport] = useState<PimIngestReport | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const count = await catalogApi.pimPendingCandidates();
      if (version === requestVersion.current) setPendingCount(count);
    } catch (cause) {
      if (version === requestVersion.current) {
        setIngestError(pimAutomationError(cause, 'Lecture de la file PIM impossible.'));
      }
    }
  }, [catalogApi]);

  useEffect(() => {
    if (enabled) void refreshPendingCount();
    return () => {
      requestVersion.current += 1;
    };
  }, [enabled, refreshPendingCount]);

  const runIngest = useCallback(async (dryRun: boolean) => {
    const version = ++requestVersion.current;
    setIngestRunning(dryRun ? 'dry' : 'live');
    setIngestError(null);
    setIngestReport(null);
    try {
      const report = await catalogApi.runPimIngest(dryRun);
      if (version !== requestVersion.current) return;
      setIngestReport(report);
      if (!dryRun) {
        await onLiveIngest();
        if (version !== requestVersion.current) return;
        const count = await catalogApi.pimPendingCandidates();
        if (version === requestVersion.current) setPendingCount(count);
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setIngestError(pimAutomationError(cause, 'Ingestion de la file PIM impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setIngestRunning(false);
    }
  }, [catalogApi, onLiveIngest]);

  const generateDefinition = useCallback(
    (command: GeneratePimDefinitionCommand) => catalogApi.generatePimDefinition(command),
    [catalogApi],
  );

  return {
    pendingCount,
    ingestRunning,
    ingestReport,
    ingestError,
    refreshPendingCount,
    runIngest,
    generateDefinition,
  } as const;
}
