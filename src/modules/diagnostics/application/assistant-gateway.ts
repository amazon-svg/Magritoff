export type AssistantConnection = Readonly<{ endpoint: string; authorizationToken: string }>;
export interface AssistantGateway {
  connection(streaming: boolean): AssistantConnection;
}
