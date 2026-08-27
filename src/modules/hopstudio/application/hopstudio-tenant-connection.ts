export type HopeStudioTenantConnection = Readonly<{
  tenantId: string;
  hopeStudioUrl: string;
  apiToken?: string | null;
  clariprint?: Readonly<{
    user: string;
    password: string;
    url?: string | null;
  }>;
}>;

/**
 * Port serveur vers le coffre de configuration. L implémentation doit restituer
 * des secrets déchiffrés uniquement au moment de l appel sortant.
 */
export interface HopeStudioTenantConnectionResolver {
  resolve(tenantId: string): Promise<HopeStudioTenantConnection | null>;
}
