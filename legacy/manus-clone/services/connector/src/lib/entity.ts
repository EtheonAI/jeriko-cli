/**
 * Composio entity ID routing.
 * User-level connectors use the userId as entity.
 * Project-level connectors use "project_{projectId}" — zero-conflict
 * because CUID user IDs never start with "project_".
 */
export function getComposioEntityId(userId: string, projectId?: string | null): string {
  return projectId ? `project_${projectId}` : userId;
}
