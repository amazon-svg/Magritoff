import type { AiDiagnosticsGateway } from './ai-diagnostics-gateway.ts';

export class DiagnosticsService {
  constructor(private readonly aiGateway: AiDiagnosticsGateway) {}

  aiProvider() {
    return this.aiGateway.testConnection();
  }
}
