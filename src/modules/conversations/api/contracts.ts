import { z } from 'zod';

export const conversationMessageSchema = z.object({ role: z.string(), content: z.string() });
export const conversationSchema = z.object({
  id: z.string().min(1).max(200),
  timestamp: z.number().int().nonnegative(),
  title: z.string().max(500),
  messages: z.array(conversationMessageSchema),
  products: z.array(z.unknown()),
});
export const conversationsSchema = z.array(conversationSchema);
export const saveConversationSchema = conversationSchema.omit({ id: true });
export const conversationMutationResultSchema = z.object({ saved: z.literal(true) });
export const conversationRemovalResultSchema = z.object({ removed: z.literal(true) });

export type ConversationDto = z.infer<typeof conversationSchema>;
export type SaveConversation = z.infer<typeof saveConversationSchema>;
