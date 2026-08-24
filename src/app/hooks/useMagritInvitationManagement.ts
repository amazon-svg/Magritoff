import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateInvitationResult } from '../../modules/invitations';
import { useAuth } from '../contexts/AuthContext';
import {
  useWorkspaceInvitationsApi,
  useWorkspaceInvitationsApiFactory,
} from '../contexts/ModuleClientsContext';

export interface InvitationRoleOption {
  id: string;
  name: string;
  description: string;
  systemKey: string | null;
}

export class InvitationSessionExpiredError extends Error {
  constructor() {
    super('Votre session a expiré. Reconnectez-vous puis réessayez.');
    this.name = 'InvitationSessionExpiredError';
  }
}

interface UseMagritInvitationManagementOptions {
  open: boolean;
  tenantId: string;
}

interface CreateMagritInvitationInput {
  email: string;
  baseUrl: string;
  roleDefinitionIds: string[];
  role: 'admin' | 'member';
}

export function useMagritInvitationManagement({
  open,
  tenantId,
}: UseMagritInvitationManagementOptions) {
  const { refreshSession } = useAuth();
  const invitationsApi = useWorkspaceInvitationsApi();
  const invitationsApiForAccessToken = useWorkspaceInvitationsApiFactory();
  const requestVersion = useRef(0);
  const [roles, setRoles] = useState<InvitationRoleOption[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(open);
  const [loadError, setLoadError] = useState<unknown>(null);

  const loadRoles = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoadingRoles(true);
    setLoadError(null);
    try {
      const options = await invitationsApi.options(tenantId);
      if (version === requestVersion.current) setRoles(options.roles);
    } catch (cause) {
      if (version === requestVersion.current) {
        setRoles([]);
        setLoadError(cause);
      }
    } finally {
      if (version === requestVersion.current) setLoadingRoles(false);
    }
  }, [invitationsApi, tenantId]);

  useEffect(() => {
    if (open) void loadRoles();
    return () => { requestVersion.current += 1; };
  }, [open, loadRoles]);

  const createInvitation = async ({
    email,
    baseUrl,
    roleDefinitionIds,
    role,
  }: CreateMagritInvitationInput): Promise<CreateInvitationResult> => {
    const { session, error } = await refreshSession();
    if (error || !session) throw new InvitationSessionExpiredError();

    return invitationsApiForAccessToken(session.access_token).create({
      email,
      tenantId,
      baseUrl,
      roleDefinitionIds,
      role,
    });
  };

  return { roles, loadingRoles, loadError, createInvitation } as const;
}
