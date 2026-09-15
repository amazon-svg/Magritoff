import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { DiagnosticsApiClient } from '@/modules/diagnostics';
import { useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/platform/api';
import type {
  AiProviderDiagnostic,
  ClariprintDiagnostic,
} from '@/modules/diagnostics';

export type DiagnosticTestResult<T> = Readonly<{
  loading: boolean;
  data: T | null;
  error: string | null;
}>;

export function emptyDiagnosticResult<T>(): DiagnosticTestResult<T> {
  return { loading: false, data: null, error: null };
}

/**
 * BCP-0c (docs/api/CONVENTIONS.md §8.25, point 2.3ter) — le masquage du
 * bouton dans `Header.tsx` n est que de l ergonomie : un acteur qui atteint
 * quand meme la route (jeton perime, course avec le chargement du profil)
 * recoit un vrai 403 `identity.role_required` du serveur. Le message clair
 * remplace alors `String(cause)`, meme discipline que
 * `describeOrderFileUploadFailure` (`order-files.helpers.ts`) :
 * `error instanceof ApiClientError` puis `problem.code`, jamais une
 * inspection de message texte.
 */
export function diagnosticRequestError(cause: unknown): string {
  if (cause instanceof ApiClientError && cause.problem.code === 'identity.role_required') {
    return 'Réservé à l’administrateur de la plateforme.';
  }
  return String(cause);
}

export function usePlatformDiagnostics() {
  const diagnosticsApi = useWorkspaceApi(DiagnosticsApiClient);
  const mounted = useRef(true);
  const [clariprintTest, setClariprintTest] = useState<DiagnosticTestResult<ClariprintDiagnostic>>(
    emptyDiagnosticResult,
  );
  const [aiTest, setAiTest] = useState<DiagnosticTestResult<AiProviderDiagnostic>>(
    emptyDiagnosticResult,
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const testClariprint = async () => {
    setClariprintTest({ loading: true, data: null, error: null });
    try {
      const data = await diagnosticsApi.clariprint();
      if (mounted.current) setClariprintTest({ loading: false, data, error: null });
    } catch (cause) {
      if (mounted.current) {
        setClariprintTest({ loading: false, data: null, error: diagnosticRequestError(cause) });
      }
    }
  };

  const testAiProvider = async () => {
    setAiTest({ loading: true, data: null, error: null });
    try {
      const data = await diagnosticsApi.aiProvider();
      if (mounted.current) setAiTest({ loading: false, data, error: null });
    } catch (cause) {
      if (mounted.current) {
        setAiTest({ loading: false, data: null, error: diagnosticRequestError(cause) });
      }
    }
  };

  return { clariprintTest, aiTest, testClariprint, testAiProvider } as const;
}
