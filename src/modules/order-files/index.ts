export { OrderFilesApiClient } from './api/client';
export {
  resolveOrderFileContentType,
  supportedOrderFileExtensions,
  UnsupportedOrderFileExtensionError,
} from './api/content-type-map';
// EXPORTEE (E10.20b) : la page publique de depot (`order-upload-links/ui/`)
// REUTILISE ce meme helper de `PUT` sur URL signee, jamais un duplicata —
// entree publique du module, MUX (`tests/architecture/modular-ui-boundaries.test.ts`).
export { uploadFileToSignedUrl } from './api/signed-upload';
export {
  confirmOrderFileUploadCommandSchema,
  orderFileDepositChannelSchema,
  orderFileDetailSchema,
  orderFilesListSchema,
  orderFileSchema,
  orderFileUploadTicketSchema,
  orderFileVisibilitySchema,
  updateOrderFileCommandSchema,
  type ConfirmOrderFileUploadCommand,
  type OrderFileDepositChannel,
  type OrderFileDetailDto,
  type OrderFileDto,
  type OrderFileUploadTicketDto,
  type OrderFileVisibility,
  type UpdateOrderFileCommand,
} from './api/contracts';
export {
  OrderFilesService,
  type OrderFilesServiceDependencies,
} from './application/order-files-service';
export {
  OrderFileAlreadyConfirmedError,
  OrderFileLimitReachedError,
  OrderFileLineNotFoundError,
  OrderFileNotFoundError,
  OrderFileRejectedError,
  OrderFileUploadMissingError,
  OrderNotFoundError,
  type ListOrderFilesResult,
  type OrderFilesRepository,
} from './application/order-files-repository';
