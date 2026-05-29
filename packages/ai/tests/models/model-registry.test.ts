import { describe, expect, it } from "vitest";

import {
  ModelCapabilityMismatchError,
  UnknownModelAliasError,
  createModelPolicyRegistry,
  defaultModelPolicies,
  getModelPolicy,
  listModelPolicies,
  modelPolicySupportsCapabilities,
  resolveStaticModelPolicy,
} from "../../src/models/index.js";

describe("@repo/ai/models model registry", () => {
  it("defines the required flow and worker aliases", () => {
    const aliases = new Set(listModelPolicies().map((policy) => policy.alias));

    expect(aliases).toEqual(
      new Set([
        "flow.architect.strong",
        "flow.architect.fast",
        "flow.repair",
        "worker.research",
        "worker.writer",
        "worker.code",
        "worker.image",
        "worker.voice.transcribe",
        "worker.voice.speech",
        "worker.video",
        "worker.verifier",
      ])
    );
  });

  it("uses Vercel AI Gateway for language, image, and video model aliases", () => {
    const gatewayAliases = [
      "flow.architect.strong",
      "flow.architect.fast",
      "flow.repair",
      "worker.research",
      "worker.writer",
      "worker.code",
      "worker.image",
      "worker.video",
      "worker.verifier",
    ];

    for (const alias of gatewayAliases) {
      const policy = getModelPolicy(alias);

      expect(policy.backend).toBe("gateway");
      expect(policy.providerRouting?.zeroDataRetention).toBe(true);
    }
  });

  it("keeps experimental speech and transcription behind direct provider policies", () => {
    expect(getModelPolicy("worker.voice.transcribe")).toMatchObject({
      backend: "direct",
      type: "transcription",
      dataPolicy: "restricted",
    });
    expect(getModelPolicy("worker.voice.speech")).toMatchObject({
      backend: "direct",
      type: "speech",
      dataPolicy: "restricted",
    });
  });

  it("rejects unknown aliases", () => {
    expect(() => getModelPolicy("worker.unknown")).toThrow(UnknownModelAliasError);
  });

  it("rejects duplicate aliases when building a custom registry", () => {
    const firstAlias = defaultModelPolicies[0]?.alias;

    if (!firstAlias) {
      throw new Error("Expected at least one default model policy.");
    }

    const firstPolicy = getModelPolicy(firstAlias);

    expect(() => createModelPolicyRegistry([firstPolicy, firstPolicy])).toThrow(
      "Duplicate model alias"
    );
  });

  it("checks required capabilities before resolving a static policy", () => {
    const policy = getModelPolicy("worker.research");

    expect(modelPolicySupportsCapabilities(policy, ["research", "web-search"])).toBe(true);
    expect(modelPolicySupportsCapabilities(policy, ["image-generation"])).toBe(false);
    expect(() =>
      resolveStaticModelPolicy({
        alias: "worker.research",
        requiredCapabilities: ["image-generation"],
      })
    ).toThrow(ModelCapabilityMismatchError);
  });

  it("resolves a static policy with stable metadata", () => {
    const resolved = resolveStaticModelPolicy({
      alias: "flow.architect.strong",
      requiredCapabilities: ["reasoning", "tool-use", "json-output"],
      now: new Date("2026-05-28T00:00:00.000Z"),
    });

    expect(resolved).toMatchObject({
      alias: "flow.architect.strong",
      backend: "gateway",
      modelId: "anthropic/claude-opus-4.7",
      source: "static",
      resolvedAt: "2026-05-28T00:00:00.000Z",
    });
  });
});
