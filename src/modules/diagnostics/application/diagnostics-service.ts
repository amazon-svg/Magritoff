import type { AiDiagnosticsGateway } from './ai-diagnostics-gateway.ts';
import type { ClariprintDiagnosticsGateway } from './clariprint-diagnostics-gateway.ts';

export class DiagnosticsService {
  constructor(
    private readonly aiGateway: AiDiagnosticsGateway,
    private readonly clariprintGateway: ClariprintDiagnosticsGateway,
  ) {}

  aiProvider() {
    return this.aiGateway.testConnection();
  }

  clariprint() {
    return this.clariprintGateway.testConnection();
  }
}
