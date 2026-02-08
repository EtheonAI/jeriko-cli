#!/usr/bin/env node

// Create a Typesense collection from a JSON schema file.
//
// Usage:
//   node create_collection.js <schema.json>

const Typesense = require("typesense");
const fs = require("fs");

const schemaFile = process.argv[2];

if (!schemaFile) {
  console.error("Usage: node create_collection.js <schema.json>");
  process.exit(1);
}

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

async function main() {
  const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
  const result = await client.collections().create(schema);
  console.log(`Created collection: ${result.name}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
