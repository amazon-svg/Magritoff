import { z } from 'zod';

export const clariprintQuoteCommandSchema = z.object({
  clariprint: z.record(z.string(), z.unknown()),
}).strict();

// Correctif sécurité BCP-0 (complément 2026-09-15) : ce schéma NE DOIT PAS
// être `.passthrough()`. Cette route est publique (`authentication: 'public'`
// sur `POST /api/v1/clariprint/quote`) ; `.passthrough()` laissait passer
// silencieusement tout champ non déclaré dans `costs` — la sonde qa-review a
// obtenu `printer`/`external_id` (détail interne du compte Clariprint de la
// plateforme) en sortie via ce chemin, alors même que `allResults`/
// `faultyProcess` avaient déjà été retirés du niveau racine. `costs` ne
// documente que six nombres (JsonApi.txt) : `paper`, `print`, `makeready`,
// `packaging`, `delivery`, `total`. Le comportement par défaut de
// `z.object()` (ni `.strict()` ni `.passthrough()`) supprime les champs non
// déclarés au lieu de les laisser passer ou de faire échouer la requête :
// c'est la barrière voulue ici.
export const clariprintCostsSchema = z.object({
  paper: z.number().optional(),
  print: z.number().optional(),
  makeready: z.number().optional(),
  packaging: z.number().optional(),
  delivery: z.number().optional(),
  total: z.number().optional(),
});

// Correctif sécurité 2026-09-15 : ce schéma NE DOIT PAS être `.passthrough()`.
// Cette route est publique (`authentication: 'public'` sur
// `POST /api/v1/clariprint/quote`) ; `.passthrough()` laissait passer
// silencieusement tout champ non déclaré ici — c'est ainsi que
// `allResults`/`faultyProcess` (détail interne du compte Clariprint de la
// plateforme : imprimeurs, identifiants externes, coûts, gammes de
// fabrication) ont fui vers n'importe quel appelant anonyme. Le comportement
// par défaut de `z.object` (ni `.strict()` ni `.passthrough()`) SUPPRIME les
// champs non déclarés au lieu de les laisser passer ou de faire échouer la
// requête : c'est la barrière voulue ici, dernière ligne avant le client
// même si une passerelle construit encore un champ non déclaré.
export const clariprintQuoteResultSchema = z.object({
  success: z.boolean(),
  credentialsMissing: z.boolean().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  priceHT: z.number().optional(),
  costs: clariprintCostsSchema.optional(),
  delais: z.number().optional(),
  weight: z.number().optional(),
  fournisseur: z.string().optional(),
  processDuration: z.number().optional(),
  details: z.string().optional(),
});

export type ClariprintQuoteCommand = z.infer<typeof clariprintQuoteCommandSchema>;
export type ClariprintQuoteResult = z.infer<typeof clariprintQuoteResultSchema>;
