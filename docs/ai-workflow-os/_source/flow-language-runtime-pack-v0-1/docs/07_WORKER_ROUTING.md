# Worker/Subagent Routing

## Goal

The main AI writes `.flow`. The runtime executes. Workers do scoped work.

## Worker types

- `ai`: general reasoning/language worker
- `image`: image prompt/generation worker
- `voice`: speech/text-to-voice/calling worker
- `code`: code/script writer
- `sandbox`: script execution worker
- `tool`: tool/API executor
- `verifier`: validation worker
- `analytics`: metrics/insight worker
- `memory`: memory/patch worker
- `router`: worker selection/router
- `system`: internal runtime worker

## Worker registry

Each worker has:

- id
- type
- capabilities
- model/provider
- allowed tools
- cost profile
- latency profile
- quality score
- failure rate
- approval rate
- verifier pass rate
- max concurrency

## Worker selection

Tasks can use:

```yaml
worker: writer
```

or:

```yaml
worker_policy:
  require: [write_content, brand_voice]
  optimize_for: quality
  max_credits: 12
  fallback: writer_fast
```

## Router scoring

Basic score:

```text
score =
  capability_match * 0.35
+ quality_score * 0.25
+ reliability_score * 0.15
+ cost_fit * 0.10
+ latency_fit * 0.10
+ user_preference_fit * 0.05
```

## Worker communication

Workers communicate through ECP, not direct chat.

Example:

```text
image_worker → artifact.image.generated → scheduler
```

## Performance metrics

Track:

- task type
- worker id
- model used
- cost
- latency
- verifier pass/fail
- approval accepted/rejected
- user edit distance
- retry count
- failure type

## Routing modes

- static worker
- cost optimized
- quality optimized
- speed optimized
- reliability optimized
- live orchestration premium mode
