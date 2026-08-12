import type { ApiProblem } from '../../platform/api/contracts.ts';

export class ApiHttpError extends Error {
  constructor(public readonly problem: Omit<ApiProblem, 'requestId'>) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiHttpError';
  }
}
