import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsPath = path.join(__dirname, '../packages/contracts/dist/index.js');

// Dynamic import to load built contracts
const contractsModule = await import(contractsPath);
const contracts = (contractsModule as any).default ?? contractsModule;

/**
 * Generates Markdown documentation from Zod contracts.
 */

function main() {
  const output: string[] = [
    '# Rubic Platform Contracts',
    '',
    '**Version:** 1.0.0',
    '**Frozen:** February 2026',
    '**Status:** Canonical',
    '',
    'This document describes all type contracts for the Rubic platform.',
    '',
    '---',
    '',
  ];

  // Tools section
  output.push('## Tools', '');
  output.push('### Entrance Tools (13)', '');

  const toolSchemas = Object.keys(contracts)
    .filter(k => k.endsWith('ToolIntentSchema'))
    .sort();

  for (const schemaName of toolSchemas) {
    const toolName = schemaName.replace('ToolIntentSchema', '');
    output.push(`#### \`${toolName}\``, '');
    output.push('*Intent schema available in contracts package*', '');
  }

  output.push('');

  // Events section
  output.push('## Events', '');
  output.push('### Canonical Event Protocol', '');

  const { EVENT_REGISTRY } = contracts as any;

  output.push('**Active Events:**', '');
  for (const eventType of EVENT_REGISTRY.active) {
    output.push(`- \`${eventType}\``);
  }

  output.push('');
  output.push('**Reserved Events:**', '');
  for (const eventType of EVENT_REGISTRY.reserved) {
    output.push(`- \`${eventType}\``);
  }

  output.push('');

  // API section
  output.push('## API Endpoints', '');

  const apiSchemas = Object.keys(contracts)
    .filter(k => k.endsWith('RequestSchema') || k.endsWith('ResponseSchema'))
    .sort();

  const endpoints = new Set<string>();

  for (const schemaName of apiSchemas) {
    const endpoint = schemaName
      .replace('RequestSchema', '')
      .replace('ResponseSchema', '')
      .replace(/([A-Z])/g, ' $1')
      .trim();

    endpoints.add(endpoint);
  }

  for (const endpoint of Array.from(endpoints).sort()) {
    output.push(`### ${endpoint}`, '');
    output.push('*Request/Response schemas available in contracts package*', '');
  }

  // Write docs
  const docsPath = 'docs/refactor-2026/CONTRACTS.md';
  fs.writeFileSync(docsPath, output.join('\n'));

  console.log(`✅ Contract documentation generated: ${docsPath}`);
  console.log(`   - ${toolSchemas.length / 2} tools (${toolSchemas.length} schemas)`);
  console.log(`   - ${EVENT_REGISTRY.total} events`);
  console.log(`   - ${endpoints.size} API endpoint groups`);
}

main();
