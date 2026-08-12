import type { UserId } from '../../../kernel/ids/index.ts';
import type { CommercialRepository } from './commercial-repository.ts';
export class CommercialService { constructor(private readonly repository: CommercialRepository) {} overview(actor: UserId, tenantId: string) { return this.repository.overview(actor, tenantId); } }
