#!/usr/bin/env node

// Interactive search wrapper for Typesense.
// Auto-detects query_by fields from the collection schema when not specified.
//
// Usage:
//   node search.js <collection> <query> [options]
//
// Options:
//   --query-by <fields>   Fields to search (default: auto-detect string fields)
//   --filter <expr>       Filter expression (filter_by)
//   --sort <expr>         Sort expression (sort_by)
//   --facet-by <fields>   Facet fields
//   --per-page <n>        Results per page (default: 10)
//   --page <n>            Page number (default: 1)

const Typesense = require("typesense");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const positional = [];
const options = {};

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--") && i + 1 < args.length) {
    const key = args[i].slice(2);
    options[key] = args[++i];
  } else {
    positional.push(args[i]);
  }
}

const collection = positional[0];
const query = positional[1];

if (!collection || !query) {
  console.error(
    "Usage: node search.js <collection> <query> [--filter ...] [--sort ...] [--query-by ...] [--facet-by ...] [--per-page N] [--page N]"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Typesense client
// ---------------------------------------------------------------------------
const host = process.env.TYPESENSE_HOST || "http://localhost";
const client = new Typesense.Client({
  nodes: [
    {
      host: host.replace(/^https?:\/\//, ""),
      port: process.env.TYPESENSE_PORT || "443",
      protocol: process.env.TYPESENSE_PROTOCOL || "https",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Auto-detect query_by from schema if not provided
  let queryBy = options["query-by"];
  if (!queryBy) {
    const schema = await client.collections(collection).retrieve();
    queryBy = schema.fields
      .filter((f) => f.index !== false && (f.type === "string" || f.type === "string[]"))
      .map((f) => f.name)
      .join(",");

    if (!queryBy) {
      console.error("Error: no indexed string fields found and --query-by not specified");
      process.exit(1);
    }
  }

  const searchParams = {
    q: query,
    query_by: queryBy,
  };

  if (options.filter) searchParams.filter_by = options.filter;
  if (options.sort) searchParams.sort_by = options.sort;
  if (options["facet-by"]) searchParams.facet_by = options["facet-by"];
  if (options["per-page"]) searchParams.per_page = parseInt(options["per-page"], 10);
  if (options.page) searchParams.page = parseInt(options.page, 10);

  const results = await client.collections(collection).documents().search(searchParams);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
