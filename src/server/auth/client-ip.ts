/**
 * En-tete interne renseigne par le transport HTTP apres validation de la
 * chaine de proxies. Toute valeur fournie par le client est ecrasee avant
 * d'atteindre Better Auth.
 */
export const TRUSTED_CLIENT_IP_HEADER = 'x-magrit-trusted-client-ip';

