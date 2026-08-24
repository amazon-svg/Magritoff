import { storefrontSessionSchema, type StorefrontSession } from '../api/contracts.ts';

export interface StorefrontSessionGateway {
  resolve(opaqueToken: string): Promise<StorefrontSession | null>;
  revoke(opaqueToken: string): Promise<boolean>;
}

export class StorefrontSessionService {
  constructor(private readonly gateway: StorefrontSessionGateway) {}
  async current(token: string): Promise<StorefrontSession | null> {
    const session = await this.gateway.resolve(token);
    return session ? storefrontSessionSchema.parse(session) : null;
  }
  async end(token: string): Promise<void> {
    await this.gateway.revoke(token);
  }
}
