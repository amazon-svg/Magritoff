import type { AiProviderDiagnostic } from '../api/contracts.ts';

export interface AiDiagnosticsGateway {
  testConnection(): Promise<AiProviderDiagnostic>;
}
