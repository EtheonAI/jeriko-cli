# `@repo/sandbox` `.flow` Task Plan

Date: 2026-05-27

Status: pending workflow runtime wiring phase.

## Role

`@repo/sandbox` owns provider-neutral sandbox contracts and Vercel Sandbox provider implementation.

It does not own `.flow` parsing, runtime orchestration, app UI, or database persistence.

## Current State

Implemented:

- provider-neutral sandbox contracts;
- Vercel adapter;
- mock adapter;
- tests.

Missing for `.flow`:

- task-level adapter invoked by runtime;
- artifact file persistence;
- stdout/stderr artifact policy;
- workflow/run/task DB links;
- strict sandbox policy validation from compiled plan.

## Build Checklist

- [ ] Define runtime-facing sandbox task input.
- [ ] Require command, args, cwd, timeout, env policy, network policy.
- [ ] Require declared outputs.
- [ ] Write input files before command execution.
- [ ] Capture stdout/stderr.
- [ ] Read declared output files.
- [ ] Return artifact refs.
- [ ] Persist sandbox session/execution metadata through database layer.
- [ ] Support cancellation/timeout.
- [ ] Add mock adapter tests.
