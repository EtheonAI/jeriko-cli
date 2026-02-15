import { createFlag } from "./lib/create-flag";

export const showBetaFeature = createFlag("showBetaFeature");

// Phase 2 Integration Flags
export const enableE2BAdapter = createFlag("enableE2BAdapter");
export const enableComposioAdapter = createFlag("enableComposioAdapter");

// Phase 8 Cutover Flags
export type OrchestratorVersion = "python" | "node" | "shadow";
export const orchestratorVersion = createFlag("orchestratorVersion");
export const nodeOrchestratorRolloutPercentage = createFlag(
  "nodeOrchestratorRolloutPercentage"
);
