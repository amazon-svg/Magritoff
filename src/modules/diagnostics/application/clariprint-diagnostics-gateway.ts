import type { ClariprintDiagnostic } from '../api/contracts.ts';

export interface ClariprintDiagnosticsGateway {
  testConnection(): Promise<ClariprintDiagnostic>;
}
