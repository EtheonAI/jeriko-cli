#!/usr/bin/env node

// Translated from NaturalLanguageSearchModelManager::generate_schema_prompt
// in https://github.com/typesense/typesense/blob/7e71e114b67e00af2f57b3b14204417ae994dfe3/src/natural_language_search_model_manager.cpp
//
// Generates an LLM-ready schema prompt for one or more Typesense collections.
// The prompt includes a field table with types, index/facet flags, and sampled
// enum values for string facetable fields, plus Typesense query syntax reference
// and expected JSON output format.
//
// Usage:
//   node generate_schema_context.js [options]
//
// Options:
//   --collections <names>     Comma-separated collection names (default: all)
//   --max-facet-values <n>    Max facet values to fetch per field (default: 20)
//   --output <file>           Write output to file instead of stdout

const Typesense = require("typesense");
const fs = require("fs");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const collectionsArg = getArg("--collections");
const maxFacetValues = parseInt(getArg("--max-facet-values") || "20", 10);
const outputFile = getArg("--output");

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
// Prompt generation — mirrors generate_schema_prompt() from C++ source
// ---------------------------------------------------------------------------

const DISPLAY_MAX_VALUES = 10; // C++ hard-codes display to 10

async function generateSchemaPrompt(collectionName) {
  const collection = await client.collections(collectionName).retrieve();
  const fields = collection.fields || [];

  // -- Header --
  let prompt = "";
  prompt += "You are given the database schema structure below. ";
  prompt +=
    "Your task is to extract relevant SQL-like query parameters from the user's search query.\n\n";
  prompt += "Database Schema:\n";
  prompt +=
    "Table fields are listed in the format: [Field Name] [Data Type] [Is Indexed] [Is Faceted] [Enum Values]\n\n";
  prompt += "| Field Name | Data Type | Is Indexed | Is Faceted | Enum Values |\n";
  prompt += "|------------|-----------|------------|------------|-------------|\n";

  // -- Collect string facetable fields --
  const stringFacetFields = fields
    .filter((f) => f.facet && (f.type === "string" || f.type === "string[]"))
    .map((f) => f.name);

  // -- Single facet search to sample enum values (matches C++ approach) --
  const fieldFacetValues = {};

  if (stringFacetFields.length > 0) {
    // Need a valid query_by for the API; pick first indexed string field
    const firstStringField = fields.find(
      (f) => f.index !== false && (f.type === "string" || f.type === "string[]")
    );

    const searchParams = {
      q: "*",
      facet_by: stringFacetFields.join(","),
      per_page: 0,
      max_facet_values: maxFacetValues,
    };
    if (firstStringField) {
      searchParams.query_by = firstStringField.name;
    }

    try {
      const results = await client.collections(collectionName).documents().search(searchParams);

      if (results.facet_counts && Array.isArray(results.facet_counts)) {
        for (const facet of results.facet_counts) {
          if (facet.field_name && Array.isArray(facet.counts)) {
            fieldFacetValues[facet.field_name] = facet.counts.map((c) => c.value);
          }
        }
      }
    } catch (err) {
      process.stderr.write(`Warning: facet search failed for ${collectionName}: ${err.message}\n`);
    }
  }

  // -- Build field rows --
  for (const field of fields) {
    const isStringType = field.type === "string" || field.type === "string[]";
    let enumValues = "N/A";

    if (field.facet && isStringType) {
      const values = fieldFacetValues[field.name];
      if (values && values.length > 0) {
        const display = values.slice(0, DISPLAY_MAX_VALUES);
        enumValues = "[" + display.join(", ");
        if (values.length > DISPLAY_MAX_VALUES) enumValues += ", ...";
        enumValues += "]";
      } else {
        enumValues = "[Faceted field with unique values]";
      }
    }

    const indexed = field.index !== false ? "Yes" : "No";
    const faceted = field.facet ? "Yes" : "No";
    prompt += `| ${field.name} | ${field.type} | ${indexed} | ${faceted} | ${enumValues} |\n`;
  }

  // -- Instructions --
  prompt += "\nInstructions:\n";
  prompt += "1. Find all search terms that match fields in the schema.\n";
  prompt +=
    "2. Find filter values for faceted fields. Map user intent to the appropriate value when possible.\n";
  prompt += "3. Ensure that filter terms are properly associated with their fields.\n";
  prompt +=
    "4. For faceted fields, use the example values to interpret user intent even if the exact value isn't specified.\n";
  prompt += "5. Infer query parameters from context, even if not explicitly mentioned.\n";

  // -- Typesense query syntax --
  prompt += "\nTypesense Query Syntax:\n";

  prompt += "\nFiltering:\n";
  prompt +=
    "- Matching values: {fieldName}:{value} or {fieldName}:[value1,value2] for OR conditions\n";
  prompt +=
    "- Numeric filters: {fieldName}:[min..max] for ranges, or {fieldName}:>, {fieldName}:<, {fieldName}:>=, {fieldName}:<=, {fieldName}:=\n";
  prompt += "- Multiple conditions: {condition1} && {condition2}\n";
  prompt += "- OR conditions across fields: {fieldName1}:{value1} || {fieldName2}:{value2}\n";
  prompt += "- Negation: {fieldName}:!= or {fieldName}:!=[value1,value2]\n";
  prompt +=
    "- For values with parentheses, surround with backticks: {fieldName}:`value (with parentheses)`\n";

  prompt += "\nSorting:\n";
  prompt += "- Format: {fieldName}:asc or {fieldName}:desc, maximum 3 fields\n";
  prompt += "- Multiple sort fields: {fieldName1}:asc,{fieldName2}:desc\n";

  // -- Expected output format --
  prompt += "\nThe output should be in JSON format like this:\n";
  prompt += "{\n";
  prompt +=
    '  "q": "Include query only if both filter_by and sort_by are inadequate, remove any other text converted into filter_by or sort_by from the query",\n';
  prompt += '  "filter_by": "typesense filter syntax explained above",\n';
  prompt += '  "sort_by": "typesense sort syntax explained above"\n';
  prompt += "}\n";

  return prompt;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let collectionNames;

  if (collectionsArg) {
    collectionNames = collectionsArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    const collections = await client.collections().retrieve();
    collectionNames = collections.map((c) => c.name);
  }

  if (collectionNames.length === 0) {
    process.stderr.write("No collections found.\n");
    process.exit(1);
  }

  let output = "";

  for (const name of collectionNames) {
    if (collectionNames.length > 1) {
      output += `=== Collection: ${name} ===\n\n`;
    }
    output += await generateSchemaPrompt(name);
    output += "\n";
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, output, "utf8");
    process.stderr.write(`Written to ${outputFile}\n`);
  } else {
    process.stdout.write(output);
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
