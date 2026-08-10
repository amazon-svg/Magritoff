export const clariprintDataFeature = 'clariprint_data.enabled' as const;

export const clariprintDataCapabilities = Object.freeze({
  moduleAccess: 'clariprint_data.module.access',
  supplierRead: 'clariprint_data.supplier.read',
  supplierEdit: 'clariprint_data.supplier.edit',
  technicalRead: 'clariprint_data.technical.read',
  technicalEdit: 'clariprint_data.technical.edit',
  financialRead: 'clariprint_data.financial.read',
  financialEdit: 'clariprint_data.financial.edit',
  publicationPublish: 'clariprint_data.publication.publish',
  auditRead: 'clariprint_data.audit.read',
} as const);

export type ClariprintDataCapability =
  (typeof clariprintDataCapabilities)[keyof typeof clariprintDataCapabilities];
