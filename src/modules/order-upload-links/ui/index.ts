/**
 * Entree publique UI du module Liens de depot publics
 * (stories E10.20a/E10.20b).
 *
 * Seul point d import autorise depuis un AUTRE module (`OrderDetailPage.tsx`,
 * `commercial-orders`, `src/app/routes.tsx`) — regle des frontieres UX
 * modulaires (MUX, `tests/architecture/modular-ui-boundaries.test.ts`).
 */
export { OrderUploadLinksPanel, type OrderUploadLinksPanelProps } from './OrderUploadLinksPanel';
export { UploadLinkDepositPage } from './UploadLinkDepositPage';
