/**
 * Entree publique UI du module Liens de depot publics (E10.20a).
 *
 * Seul point d import autorise depuis un AUTRE module (`OrderDetailPage.tsx`,
 * `commercial-orders`) — regle des frontieres UX modulaires (MUX,
 * `tests/architecture/modular-ui-boundaries.test.ts`).
 */
export { OrderUploadLinksPanel, type OrderUploadLinksPanelProps } from './OrderUploadLinksPanel';
