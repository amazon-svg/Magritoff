import { z } from 'zod';

export const gammeSubscriptionSchema = z.object({
  gammeSlug: z.string().trim().min(1).max(160),
  active: z.boolean(),
  displayOrder: z.number().int(),
});
export const gammeSubscriptionsSchema = z.array(gammeSubscriptionSchema);
export const setGammeSubscriptionSchema = gammeSubscriptionSchema.pick({ gammeSlug: true, active: true });
export const setGammeSubscriptionsCommandSchema = z.object({
  subscriptions: z.array(setGammeSubscriptionSchema).min(1).max(200),
}).refine(({ subscriptions }) => new Set(subscriptions.map((item) => item.gammeSlug)).size === subscriptions.length, {
  message: 'Une gamme ne peut apparaître qu’une fois.', path: ['subscriptions'],
});

export type GammeSubscription = z.infer<typeof gammeSubscriptionSchema>;
export type SetGammeSubscriptionsCommand = z.infer<typeof setGammeSubscriptionsCommandSchema>;
