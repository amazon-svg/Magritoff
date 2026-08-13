import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../utils/supabase/client';
import { parseId, type UserId } from '../../kernel';
import {
  SessionService,
  type SessionBootstrap,
  type SessionUserPreferences,
  type UpdatePreferences,
  type CreateRootTenant,
} from '../../modules/session';
import type { Database } from '../../types/database.types';
import { SupabaseSessionRepository } from './session-repository';

export class DevSessionClient {
  private readonly service = new SessionService(
    new SupabaseSessionRepository(supabase as unknown as SupabaseClient<Database>),
  );
  private readonly userId: UserId;

  constructor(userId: string) {
    const parsed = parseId<'UserId'>(userId);
    if (!parsed.ok) throw new TypeError('Identifiant utilisateur invalide pour le bootstrap DEV.');
    this.userId = parsed.value;
  }

  load(_signal?: AbortSignal): Promise<SessionBootstrap> {
    return this.service.load(this.userId);
  }

  updatePreferences(patch: UpdatePreferences): Promise<SessionUserPreferences> {
    return this.service.updatePreferences(this.userId, patch);
  }

  updateCurrentTenant(tenantId: string): Promise<SessionUserPreferences> {
    return this.service.updateLastTenant(this.userId, tenantId);
  }

  createRootTenant(command: CreateRootTenant): Promise<string> {
    return this.service.createRootTenant(this.userId, command).then(({ tenantId }) => tenantId);
  }

  acceptInvitation(token: string): Promise<string> {
    return this.service.acceptInvitation(this.userId, token).then(({ tenantId }) => tenantId);
  }
}
