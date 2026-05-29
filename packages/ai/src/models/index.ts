import {
  addToolInputExamplesMiddleware,
  createGateway,
  createProviderRegistry,
  customProvider,
  defaultEmbeddingSettingsMiddleware,
  defaultSettingsMiddleware,
  extractJsonMiddleware,
  extractReasoningMiddleware,
  gateway,
  wrapEmbeddingModel,
  wrapImageModel,
  wrapLanguageModel,
  wrapProvider,
  type EmbeddingModel,
  type ImageModel,
  type LanguageModel,
  type LanguageModelMiddleware,
  type Provider,
  type ProviderRegistryProvider,
  type RerankingModel,
} from "ai";
import { z } from "zod";

export {
  addToolInputExamplesMiddleware,
  createGateway,
  createProviderRegistry,
  customProvider,
  defaultEmbeddingSettingsMiddleware,
  defaultSettingsMiddleware,
  extractJsonMiddleware,
  extractReasoningMiddleware,
  gateway,
  wrapEmbeddingModel,
  wrapImageModel,
  wrapLanguageModel,
  wrapProvider,
  type EmbeddingModel,
  type ImageModel,
  type LanguageModel,
  type LanguageModelMiddleware,
  type Provider,
  type ProviderRegistryProvider,
  type RerankingModel,
};

const nonEmptyStringListSchema = z.array(z.string().min(1));

export const modelBackendSchema = z.enum(["gateway", "openrouter", "direct"]);

export const modelTypeSchema = z.enum([
  "language",
  "embedding",
  "rerank",
  "image",
  "transcription",
  "speech",
  "video",
]);

export const modelCapabilitySchema = z.enum([
  "reasoning",
  "tool-use",
  "vision",
  "file-input",
  "web-search",
  "json-output",
  "image-generation",
  "video-generation",
  "transcription",
  "speech-generation",
  "code",
  "research",
  "writing",
  "verification",
]);

export const modelCostTierSchema = z.enum(["free", "low", "standard", "high", "premium"]);

export const modelLatencyTierSchema = z.enum(["interactive", "standard", "batch"]);

export const modelDataPolicySchema = z.enum([
  "standard",
  "zero_data_retention",
  "byok_preferred",
  "byok_required",
  "restricted",
]);

export const gatewayProviderRoutingSchema = z
  .object({
    order: nonEmptyStringListSchema.optional(),
    only: nonEmptyStringListSchema.optional(),
    models: nonEmptyStringListSchema.optional(),
    zeroDataRetention: z.boolean().optional(),
    tags: nonEmptyStringListSchema.optional(),
  })
  .refine((value) => !(value.order && value.only), {
    message: "Use either provider order or provider allow-list, not both.",
  });

export const modelPolicySchema = z.object({
  alias: z.string().min(1),
  backend: modelBackendSchema.default("gateway"),
  modelId: z.string().min(1),
  type: modelTypeSchema,
  capabilities: z.array(modelCapabilitySchema).default([]),
  fallbackModelIds: z.array(z.string().min(1)).default([]),
  costTier: modelCostTierSchema,
  latencyTier: modelLatencyTierSchema,
  contextWindowTokens: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  providerRouting: gatewayProviderRoutingSchema.optional(),
  dataPolicy: modelDataPolicySchema.default("standard"),
  notes: z.string().optional(),
});

export const resolvedModelPolicySchema = modelPolicySchema.extend({
  resolvedAt: z.string().datetime(),
  source: z.enum(["static", "gateway-live", "openrouter-live", "direct"]),
  provider: z.string().min(1).optional(),
  warnings: z.array(z.string().min(1)).default([]),
});

export type ModelBackend = z.infer<typeof modelBackendSchema>;
export type ModelType = z.infer<typeof modelTypeSchema>;
export type ModelCapability = z.infer<typeof modelCapabilitySchema>;
export type ModelCostTier = z.infer<typeof modelCostTierSchema>;
export type ModelLatencyTier = z.infer<typeof modelLatencyTierSchema>;
export type ModelDataPolicy = z.infer<typeof modelDataPolicySchema>;
export type GatewayProviderRouting = z.infer<typeof gatewayProviderRoutingSchema>;
export type ModelPolicy = z.infer<typeof modelPolicySchema>;
export type ResolvedModelPolicy = z.infer<typeof resolvedModelPolicySchema>;
export type ModelPolicyRegistry = ReadonlyMap<string, ModelPolicy>;

export class UnknownModelAliasError extends Error {
  readonly alias: string;

  constructor(alias: string) {
    super(`Unknown model alias: ${alias}`);
    this.name = "UnknownModelAliasError";
    this.alias = alias;
  }
}

export class ModelCapabilityMismatchError extends Error {
  readonly alias: string;
  readonly missingCapabilities: ModelCapability[];

  constructor(alias: string, missingCapabilities: ModelCapability[]) {
    super(
      `Model alias ${alias} is missing required capabilities: ${missingCapabilities.join(", ")}`
    );
    this.name = "ModelCapabilityMismatchError";
    this.alias = alias;
    this.missingCapabilities = missingCapabilities;
  }
}

export const defaultModelPolicies = [
  {
    alias: "flow.architect.strong",
    backend: "gateway",
    modelId: "anthropic/claude-opus-4.7",
    type: "language",
    capabilities: ["reasoning", "tool-use", "file-input", "vision", "web-search", "json-output"],
    fallbackModelIds: ["anthropic/claude-opus-4.6", "openai/gpt-5.4-pro"],
    costTier: "high",
    latencyTier: "standard",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    providerRouting: {
      models: ["anthropic/claude-opus-4.7", "anthropic/claude-opus-4.6"],
      tags: ["role:flow-architect", "tier:strong"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
    notes:
      "Primary orchestrator and .flow authoring model. Validate through Gateway discovery before use.",
  },
  {
    alias: "flow.architect.fast",
    backend: "gateway",
    modelId: "anthropic/claude-sonnet-4.6",
    type: "language",
    capabilities: ["reasoning", "tool-use", "file-input", "vision", "web-search", "json-output"],
    fallbackModelIds: ["anthropic/claude-haiku-4.5", "openai/gpt-5.4-mini"],
    costTier: "standard",
    latencyTier: "interactive",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 64_000,
    providerRouting: {
      tags: ["role:flow-architect", "tier:fast"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
  {
    alias: "flow.repair",
    backend: "gateway",
    modelId: "anthropic/claude-sonnet-4.6",
    type: "language",
    capabilities: ["reasoning", "tool-use", "json-output", "code"],
    fallbackModelIds: ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"],
    costTier: "standard",
    latencyTier: "interactive",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 64_000,
    providerRouting: {
      tags: ["role:flow-repair"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
  {
    alias: "worker.research",
    backend: "gateway",
    modelId: "anthropic/claude-sonnet-4.6",
    type: "language",
    capabilities: ["research", "reasoning", "tool-use", "web-search", "file-input"],
    fallbackModelIds: ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"],
    costTier: "standard",
    latencyTier: "standard",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 64_000,
    providerRouting: {
      tags: ["role:worker", "worker:research"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
  {
    alias: "worker.writer",
    backend: "gateway",
    modelId: "anthropic/claude-sonnet-4.6",
    type: "language",
    capabilities: ["writing", "reasoning", "tool-use", "json-output"],
    fallbackModelIds: ["anthropic/claude-haiku-4.5", "openai/gpt-5.4-mini"],
    costTier: "standard",
    latencyTier: "interactive",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 64_000,
    providerRouting: {
      tags: ["role:worker", "worker:writer"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
  {
    alias: "worker.code",
    backend: "gateway",
    modelId: "openai/gpt-5.4-pro",
    type: "language",
    capabilities: ["code", "reasoning", "tool-use", "file-input", "json-output"],
    fallbackModelIds: ["anthropic/claude-opus-4.7", "anthropic/claude-sonnet-4.6"],
    costTier: "high",
    latencyTier: "standard",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    providerRouting: {
      tags: ["role:worker", "worker:code"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
  {
    alias: "worker.image",
    backend: "gateway",
    modelId: "google/gemini-3.1-flash-image-preview",
    type: "image",
    capabilities: ["image-generation", "vision"],
    fallbackModelIds: ["openai/gpt-image-1"],
    costTier: "standard",
    latencyTier: "batch",
    providerRouting: {
      tags: ["role:worker", "worker:image"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
  {
    alias: "worker.voice.transcribe",
    backend: "direct",
    modelId: "openai/gpt-4o-transcribe",
    type: "transcription",
    capabilities: ["transcription"],
    fallbackModelIds: ["openai/gpt-4o-mini-transcribe", "openai/whisper-1"],
    costTier: "standard",
    latencyTier: "batch",
    dataPolicy: "restricted",
    notes:
      "AI SDK transcription is provider-specific today; do not route through Gateway until live model discovery supports transcription models.",
  },
  {
    alias: "worker.voice.speech",
    backend: "direct",
    modelId: "openai/gpt-4o-mini-tts",
    type: "speech",
    capabilities: ["speech-generation"],
    fallbackModelIds: ["openai/tts-1", "openai/tts-1-hd"],
    costTier: "standard",
    latencyTier: "batch",
    dataPolicy: "restricted",
    notes:
      "AI SDK speech is provider-specific today; keep behind package adapter and artifact storage.",
  },
  {
    alias: "worker.video",
    backend: "gateway",
    modelId: "alibaba/wan-v2.6-t2v",
    type: "video",
    capabilities: ["video-generation"],
    fallbackModelIds: ["alibaba/wan-v2.5-t2v-preview"],
    costTier: "premium",
    latencyTier: "batch",
    providerRouting: {
      tags: ["role:worker", "worker:video"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
  {
    alias: "worker.verifier",
    backend: "gateway",
    modelId: "anthropic/claude-sonnet-4.6",
    type: "language",
    capabilities: ["verification", "reasoning", "tool-use", "json-output", "file-input"],
    fallbackModelIds: ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"],
    costTier: "standard",
    latencyTier: "interactive",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 64_000,
    providerRouting: {
      tags: ["role:worker", "worker:verifier"],
      zeroDataRetention: true,
    },
    dataPolicy: "zero_data_retention",
  },
] satisfies ModelPolicy[];

export const defaultModelPolicyRegistry = createModelPolicyRegistry(defaultModelPolicies);

export function createModelPolicyRegistry(policies: readonly ModelPolicy[]): ModelPolicyRegistry {
  const registry = new Map<string, ModelPolicy>();

  for (const rawPolicy of policies) {
    const policy = modelPolicySchema.parse(rawPolicy);
    const existing = registry.get(policy.alias);

    if (existing) {
      throw new Error(`Duplicate model alias: ${existing.alias}`);
    }

    registry.set(policy.alias, policy);
  }

  return registry;
}

export function getModelPolicy(
  alias: string,
  registry: ModelPolicyRegistry = defaultModelPolicyRegistry
): ModelPolicy {
  const policy = registry.get(alias);

  if (!policy) {
    throw new UnknownModelAliasError(alias);
  }

  return policy;
}

export function listModelPolicies(
  registry: ModelPolicyRegistry = defaultModelPolicyRegistry
): ModelPolicy[] {
  return [...registry.values()];
}

export function modelPolicySupportsCapabilities(
  policy: ModelPolicy,
  requiredCapabilities: readonly ModelCapability[]
): boolean {
  return getMissingModelCapabilities(policy, requiredCapabilities).length === 0;
}

export function getMissingModelCapabilities(
  policy: ModelPolicy,
  requiredCapabilities: readonly ModelCapability[]
): ModelCapability[] {
  const availableCapabilities = new Set(policy.capabilities);

  return requiredCapabilities.filter((capability) => !availableCapabilities.has(capability));
}

export function assertModelPolicySupportsCapabilities(
  policy: ModelPolicy,
  requiredCapabilities: readonly ModelCapability[]
): void {
  const missingCapabilities = getMissingModelCapabilities(policy, requiredCapabilities);

  if (missingCapabilities.length > 0) {
    throw new ModelCapabilityMismatchError(policy.alias, missingCapabilities);
  }
}

export function resolveStaticModelPolicy(input: {
  alias: string;
  requiredCapabilities?: readonly ModelCapability[];
  registry?: ModelPolicyRegistry;
  now?: Date;
}): ResolvedModelPolicy {
  const policy = getModelPolicy(input.alias, input.registry);
  const requiredCapabilities = input.requiredCapabilities ?? [];

  assertModelPolicySupportsCapabilities(policy, requiredCapabilities);

  return resolvedModelPolicySchema.parse({
    ...policy,
    resolvedAt: (input.now ?? new Date()).toISOString(),
    source: policy.backend === "gateway" ? "static" : policy.backend,
    warnings:
      policy.backend === "direct"
        ? ["Direct provider policy requires a package-owned provider adapter before runtime use."]
        : [],
  });
}
