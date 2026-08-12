import { z } from 'zod';
export const librarySchema = z.object({ id: z.string(), tenant_id: z.string().optional(), user_id: z.string().optional(), name: z.string(), description: z.string(), created_at: z.string().optional() });
export const librariesSchema = z.array(librarySchema);
export const createLibrarySchema = z.object({ name: z.string().min(1).max(200), description: z.string().max(2000).default('') }).strict();
export const updateLibrarySchema = z.object({ name: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional() }).strict();
export const libraryRemovedSchema = z.object({ removed: z.literal(true) });
export type LibraryDto = z.infer<typeof librarySchema>;
export type CreateLibrary = z.infer<typeof createLibrarySchema>;
export type UpdateLibrary = z.infer<typeof updateLibrarySchema>;
