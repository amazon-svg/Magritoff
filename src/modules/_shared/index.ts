/**
 * Socle transverse de l API Gestion commerciale (Epic E10, story E10.0).
 *
 * Ce pseudo-module ne porte AUCUNE regle metier et AUCUNE UX : il n a pas de
 * dossier `ui/`. Il ne contient que ce qui est vrai pour tous les modules
 * E10.x — resolution du tenant, idempotence, concurrence optimiste, erreurs
 * RFC 7807, pagination par curseur, bus d evenements sortants.
 *
 * Il suit la convention de dossiers du depot (`api/` + `application/`),
 * comme les 10 modules deja en place. Les implementations de ses ports vont
 * dans src/adapters/supabase/, le branchement HTTP dans
 * src/server/api/gescom-middleware.ts.
 *
 * Contrat de reference : openapi/magrit-core.v1.yaml
 * Conventions : docs/api/CONVENTIONS.md
 */
export * from './api/index.ts';
export * from './application/index.ts';
