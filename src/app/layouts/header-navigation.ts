export function workspaceHomePath(tenantSlug: string): string {
  return `/t/${encodeURIComponent(tenantSlug)}`;
}
