export { CustomersApiClient } from './api/client';
export {
  addressSchema,
  createCustomerCommandSchema,
  createCustomerContactCommandSchema,
  customerContactSchema,
  customerDetailSchema,
  customerSchema,
  customerTypeSchema,
  customersListSchema,
  siretSchema,
  siretVerificationResultSchema,
  updateCustomerCommandSchema,
  updateCustomerContactCommandSchema,
  type Address,
  type CreateCustomerCommand,
  type CreateCustomerContactCommand,
  type CustomerContactDto,
  type CustomerDetailDto,
  type CustomerDto,
  type CustomerType,
  type SiretVerificationResultDto,
  type UpdateCustomerCommand,
  type UpdateCustomerContactCommand,
} from './api/contracts';
export { CustomersService } from './application/customers-service';
export {
  CustomerCommandRejectedError,
  CustomerNotFoundError,
} from './application/customers-repository';
export type {
  CustomersRepository,
  ListCustomersParams,
  ListCustomersResult,
} from './application/customers-repository';
export {
  checkSiretFormat,
  computeLuhnChecksum,
  lookupSiretAtInsee,
  normalizeSiret,
} from './application/siret-verification';
export { customersModuleManifest } from './manifest';
export { customersWorkspaceContribution } from './surface-contributions';
