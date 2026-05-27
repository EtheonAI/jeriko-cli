import { z } from "zod";

export const platformToolRiskSchema = z.enum(["read", "write", "external_write", "destructive"]);

export const platformToolApprovalPolicySchema = z.enum(["never", "always", "external_write"]);

export const platformToolPermissionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).optional(),
});

export type PlatformToolRisk = z.infer<typeof platformToolRiskSchema>;
export type PlatformToolApprovalPolicy = z.infer<typeof platformToolApprovalPolicySchema>;
export type PlatformToolPermission = z.infer<typeof platformToolPermissionSchema>;

export type PlatformToolApprovalDecision = {
  approved: boolean;
  approvalId?: string;
  reason?: string;
};

export class PlatformToolApprovalRequiredError extends Error {
  readonly toolId: string;

  constructor(toolId: string) {
    super(`Platform tool requires approval before execution: ${toolId}`);
    this.name = "PlatformToolApprovalRequiredError";
    this.toolId = toolId;
  }
}
