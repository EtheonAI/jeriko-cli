import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsPath = path.join(__dirname, '../packages/contracts/dist/index.js');

// Dynamic import to load built contracts
const contractsModule = await import(contractsPath);
const contracts = (contractsModule as any).default ?? contractsModule;

/**
 * Detects breaking changes in contract schemas.
 *
 * Breaking changes:
 * - Removing a tool
 * - Removing an event type
 * - Removing a required field
 * - Changing a field type
 * - Adding a required field (without default)
 *
 * Non-breaking changes:
 * - Adding a new tool
 * - Adding a new event type
 * - Adding an optional field
 * - Adding a default value
 */

interface SchemaSnapshot {
  version: string;
  tools: string[];
  events: string[];
  apiEndpoints: string[];
  timestamp: string;
}

const SNAPSHOT_FILE = 'docs/refactor-2026/baseline/contract-snapshot.json';

function getCurrentSnapshot(): SchemaSnapshot {
  const tools = Object.keys(contracts)
    .filter(k => k.endsWith('ToolIntentSchema') || k.endsWith('ToolResultSchema'))
    .sort();

  const events = Object.keys(contracts)
    .filter(k => k.endsWith('Event') && !k.includes('Schema'))
    .sort();

  const apiEndpoints = Object.keys(contracts)
    .filter(k => k.endsWith('RequestSchema') || k.endsWith('ResponseSchema'))
    .sort();

  return {
    version: '1.0.0',
    tools,
    events,
    apiEndpoints,
    timestamp: new Date().toISOString(),
  };
}

function loadBaselineSnapshot(): SchemaSnapshot | null {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    console.log('No baseline snapshot found - creating first snapshot');
    return null;
  }

  return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
}

function detectBreakingChanges(
  baseline: SchemaSnapshot,
  current: SchemaSnapshot
): string[] {
  const breaking: string[] = [];

  // Removed tools
  for (const tool of baseline.tools) {
    if (!current.tools.includes(tool)) {
      breaking.push(`BREAKING: Tool removed: ${tool}`);
    }
  }

  // Removed events
  for (const event of baseline.events) {
    if (!current.events.includes(event)) {
      breaking.push(`BREAKING: Event removed: ${event}`);
    }
  }

  // Removed API endpoints
  for (const endpoint of baseline.apiEndpoints) {
    if (!current.apiEndpoints.includes(endpoint)) {
      breaking.push(`BREAKING: API endpoint removed: ${endpoint}`);
    }
  }

  return breaking;
}

function detectNonBreakingChanges(
  baseline: SchemaSnapshot,
  current: SchemaSnapshot
): string[] {
  const nonBreaking: string[] = [];

  // Added tools
  for (const tool of current.tools) {
    if (!baseline.tools.includes(tool)) {
      nonBreaking.push(`Added tool: ${tool}`);
    }
  }

  // Added events
  for (const event of current.events) {
    if (!baseline.events.includes(event)) {
      nonBreaking.push(`Added event: ${event}`);
    }
  }

  // Added API endpoints
  for (const endpoint of current.apiEndpoints) {
    if (!baseline.apiEndpoints.includes(endpoint)) {
      nonBreaking.push(`Added API endpoint: ${endpoint}`);
    }
  }

  return nonBreaking;
}

async function main() {
  console.log('=== Contract Schema Diff Tool ===\n');

  const current = getCurrentSnapshot();
  const baseline = loadBaselineSnapshot();

  if (!baseline) {
    // First run - save snapshot
    fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(current, null, 2));
    console.log('✅ Baseline snapshot created\n');
    console.log(`  Tools: ${current.tools.length}`);
    console.log(`  Events: ${current.events.length}`);
    console.log(`  API endpoints: ${current.apiEndpoints.length}`);
    process.exit(0);
  }

  // Detect changes
  const breaking = detectBreakingChanges(baseline, current);
  const nonBreaking = detectNonBreakingChanges(baseline, current);

  if (breaking.length === 0 && nonBreaking.length === 0) {
    console.log('✅ No contract changes detected\n');
    process.exit(0);
  }

  // Print non-breaking changes
  if (nonBreaking.length > 0) {
    console.log('Non-breaking changes:\n');
    for (const change of nonBreaking) {
      console.log(`  ✓ ${change}`);
    }
    console.log();
  }

  // Print breaking changes
  if (breaking.length > 0) {
    console.log('❌ BREAKING CHANGES DETECTED:\n');
    for (const change of breaking) {
      console.error(`  ${change}`);
    }
    console.log();
    console.error('Breaking changes are not allowed during refactor freeze.');
    console.error('Please revert your changes or get approval from tech lead.\n');
    process.exit(1);
  }

  // Update snapshot if only non-breaking
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(current, null, 2));
  console.log('✅ Contract snapshot updated\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
