import type { UserId } from '../../../kernel/ids/index.ts';
import type { CommercialOverview } from '../api/contracts.ts';
export interface CommercialRepository { overview(actor: UserId, tenantId: string): Promise<CommercialOverview>; }
