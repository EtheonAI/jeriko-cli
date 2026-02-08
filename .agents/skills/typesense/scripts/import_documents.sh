#!/usr/bin/env bash

# Bulk import JSONL documents into a Typesense collection.
#
# Usage: ./import_documents.sh <collection> <file.jsonl>

set -euo pipefail

COLLECTION="${1:-}"
FILE="${2:-}"

if [ -z "$COLLECTION" ] || [ -z "$FILE" ]; then
  echo "Usage: ./import_documents.sh <collection> <file.jsonl>" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "Error: file not found: $FILE" >&2
  exit 1
fi

curl "${TYPESENSE_HOST}/collections/${COLLECTION}/documents/import?action=upsert" \
  -X POST \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  -H "Content-Type: text/plain" \
  --data-binary @"${FILE}"
