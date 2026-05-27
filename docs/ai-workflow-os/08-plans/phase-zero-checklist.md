# Phase Zero Checklist

## Purpose

Phase zero exists to prevent a blind rewrite. It should produce enough evidence to decide what to salvage, what to delete, and what to build first.

## Checklist

- [ ] Inventory current monorepo packages, apps, services, and deployment files.
- [ ] Identify all E2B-specific code paths.
- [ ] Identify all auth-related code paths and current Better Auth state.
- [ ] Identify current Inngest usage and task orchestration behavior.
- [ ] Validate DB-backed trigger registry and static scheduler/event-router design.
- [ ] Define EventContextPacket, TaskReport, and Run Reflection Packet schemas.
- [ ] Identify current database schema and migrations.
- [ ] Identify current chat/agent loop and tool routing architecture.
- [ ] Identify current artifact/file pipeline.
- [ ] Identify current design system and Manus-derived CSS tokens.
- [ ] Verify Next.js 16.2 upgrade requirements against official docs.
- [ ] Verify Vercel Sandbox API and runtime constraints against official docs.
- [ ] Verify Vercel Cron limits before using it for anything user-visible.
- [ ] Verify Inngest schedule, wait, concurrency, and fan-out behavior against official docs.
- [ ] Produce backend audit report.
- [ ] Produce frontend audit report.
- [ ] Produce workflow kernel implementation plan.
- [ ] Produce redesign plan with acceptance criteria.

## Imported Plans

- [`build-checklist.md`](./build-checklist.md)
- [`project-plan.csv`](./project-plan.csv)
- [`scale-trigger-event-ecp-checklist.md`](./scale-trigger-event-ecp-checklist.md)
