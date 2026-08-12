import { describe, expect, it, vi } from 'vitest';
import { HttpClariprintDiagnosticsGateway } from '../../../src/adapters/clariprint/clariprint-diagnostics-gateway';

describe('HttpClariprintDiagnosticsGateway', () => {
  it('ne contacte pas Clariprint lorsque les identifiants sont absents', async () => {
    const fetchMock = vi.fn();
    const result = await new HttpClariprintDiagnosticsGateway(
      'https://clariprint.test', null, null, fetchMock as unknown as typeof fetch,
    ).testConnection();
    expect(result).toMatchObject({ configured: false, reachable: null, authenticated: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exécute CheckAuth sans renvoyer les identifiants', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toContain('action=CheckAuth');
      return new Response(JSON.stringify({ success: true, session: 'opaque' }), { status: 200 });
    });
    const result = await new HttpClariprintDiagnosticsGateway(
      'https://clariprint.test/', 'login-secret', 'password-secret', fetchMock as unknown as typeof fetch,
    ).testConnection();
    expect(result).toMatchObject({ configured: true, reachable: true, authenticated: true, httpStatus: 200 });
    expect(JSON.stringify(result)).not.toContain('login-secret');
    expect(JSON.stringify(result)).not.toContain('password-secret');
    expect(JSON.stringify(result)).not.toContain('opaque');
  });

  it('normalise un refus CheckAuth', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'Identifiants invalides' }), { status: 200 }));
    const result = await new HttpClariprintDiagnosticsGateway(
      'https://clariprint.test', 'login', 'password', fetchMock as unknown as typeof fetch,
    ).testConnection();
    expect(result).toMatchObject({ reachable: true, authenticated: false });
    expect(result.checks[0]).toMatchObject({ status: 'error', details: 'Identifiants invalides' });
  });
});
