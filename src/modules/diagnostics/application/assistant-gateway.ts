export type AssistantConnection = Readonly<{ endpoint: string; authorizationToken: string }>;
export interface AssistantGateway {
  connection(accessToken: string, streaming: boolean): AssistantConnection;
}
