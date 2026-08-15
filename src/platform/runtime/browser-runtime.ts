import { browserAuthenticationGateway } from '../../adapters/supabase/browser-authentication-gateway.ts';
import type { AuthenticationGateway } from '../../modules/account/index.ts';

export type BrowserRuntime = Readonly<{
  authentication: AuthenticationGateway;
}>;

export const browserRuntime: BrowserRuntime = Object.freeze({
  authentication: browserAuthenticationGateway,
});
