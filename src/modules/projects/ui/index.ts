export {
  DashboardProjects,
  DashboardProjectDetail,
  ProjectCreateModal,
  customerDisplayName,
  AddToProjectModal,
  type AddToProjectItem,
  type AddToProjectModalProps,
} from './workspace';
export {
  useProjectsManagement,
  projectsManagementError,
  useProjectDetail,
  useProjectTagsCatalog,
} from './hooks';
export {
  buildQuotePayload,
  extractQuotePayloadAmounts,
  toMoneyString,
  type QuotePayloadAmounts,
} from './helpers/serializeQuotePayload';
