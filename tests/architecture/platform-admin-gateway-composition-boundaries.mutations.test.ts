/**
 * Preuves de mutation pour le garde AST de
 * `platform-admin-gateway-composition-boundaries.test.ts` (qa-review,
 * rejet du merge de `266f304e`).
 *
 * Chaque `it` projette UNE mutation dans un mini fichier source autonome
 * (le squelette minimal de la composition reelle : `client`,
 * `storefrontClient`, `documentTemplatesStorageClient`, puis
 * `new DiagnosticsService(ai, clariprint, <passerelle>)`) et verifie que
 * `findPlatformAdminGatewayCompositionViolations` la detecte.
 */
import { describe, expect, it } from 'vitest';
import { findPlatformAdminGatewayCompositionViolations } from './platform-admin-gateway-composition-boundaries.test.ts';

const COMPLIANT_CLIENTS = `
const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: authorization } },
});
const storefrontClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const documentTemplatesStorageClient = createClient(supabaseUrl, serviceRoleKey ?? anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
`;

function violations(body: string): ReturnType<typeof findPlatformAdminGatewayCompositionViolations> {
  return findPlatformAdminGatewayCompositionViolations('mutation.ts', `${COMPLIANT_CLIENTS}\n${body}`);
}

describe('M4a a M4c (rejet garde des mutations de composition, qa-review)', () => {
  it('M4a - injection du client service_role (documentTemplatesStorageClient) au lieu de client', () => {
    const source = `
const diagnosticsService = new DiagnosticsService(aiGateway, clariprintGateway, new SupabasePlatformAdminGateway(documentTemplatesStorageClient));
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('M4b - injection de storefrontClient (anon SANS le JWT de l appelant) au lieu de client', () => {
    const source = `
const diagnosticsService = new DiagnosticsService(aiGateway, clariprintGateway, new SupabasePlatformAdminGateway(storefrontClient));
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('M4c - passerelle factice (objet litteral) au lieu de new SupabasePlatformAdminGateway(...)', () => {
    const source = `
const diagnosticsService = new DiagnosticsService(aiGateway, clariprintGateway, { isPlatformAdmin: async () => true });
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('M4c bis - une autre passerelle nommee (pas SupabasePlatformAdminGateway) au lieu de la vraie', () => {
    const source = `
const diagnosticsService = new DiagnosticsService(aiGateway, clariprintGateway, new AlwaysAllowGateway(client));
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('argument surnumeraire sur SupabasePlatformAdminGateway (pas seulement "client")', () => {
    const source = `
const diagnosticsService = new DiagnosticsService(aiGateway, clariprintGateway, new SupabasePlatformAdminGateway(client, storefrontClient));
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('DiagnosticsService construit avec seulement 2 arguments (3e absent)', () => {
    const source = `
const diagnosticsService = new DiagnosticsService(aiGateway, clariprintGateway);
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });
});

describe('non-regression : composition conforme, zero violation', () => {
  it('new SupabasePlatformAdminGateway(client), avec client authenticated (anonKey + Authorization)', () => {
    const source = `
const diagnosticsService = new DiagnosticsService(aiGateway, clariprintGateway, new SupabasePlatformAdminGateway(client));
`;
    expect(violations(source)).toEqual([]);
  });
});
