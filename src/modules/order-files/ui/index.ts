/**
 * Entree publique UI du module Fichiers de commande (E10.17b).
 *
 * Seul point d import autorise depuis un AUTRE module (`OrderDetailPage.tsx`,
 * `commercial-orders`) — regle des frontieres UX modulaires (MUX,
 * `tests/architecture/modular-ui-boundaries.test.ts`).
 */
export { OrderFilesBlock, type OrderFilesBlockProps } from './OrderFilesBlock';
