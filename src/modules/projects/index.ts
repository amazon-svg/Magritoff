export { ProjectsApiClient } from './api/client';
export type { ListProjectsQuery, ListProjectsResponse } from './api/client';
export {
  createProjectCommandSchema,
  createProjectItemCommandSchema,
  projectDetailSchema,
  projectItemSchema,
  projectSchema,
  projectStatusSchema,
  projectsListSchema,
  removeProjectItemResultSchema,
  updateProjectCommandSchema,
  type CreateProjectCommand,
  type CreateProjectItemCommand,
  type ProjectDetailDto,
  type ProjectDto,
  type ProjectItemDto,
  type ProjectStatus,
  type RemoveProjectItemResultDto,
  type UpdateProjectCommand,
} from './api/contracts';
export { ProjectsService } from './application/projects-service';
export {
  ProjectCommandRejectedError,
  ProjectNotFoundError,
} from './application/projects-repository';
export type {
  ListProjectsParams,
  ListProjectsResult,
  ProjectsRepository,
} from './application/projects-repository';
export { projectsModuleManifest } from './manifest';
export { projectsWorkspaceContribution } from './surface-contributions';
