export type AssistantConnection = Readonly<{ endpoint: string; authorizationToken: string }>;
export type CategoryEditorialInput = Readonly<{ familyName: string; subcategories: string[]; sampleProducts: string[] }>;
export interface AssistantGateway {
  connection(streaming: boolean): AssistantConnection;
  categoryEditorial(input: CategoryEditorialInput): Promise<Record<string, unknown>>;
}
