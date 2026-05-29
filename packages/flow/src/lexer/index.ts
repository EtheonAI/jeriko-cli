import { z } from "zod";
import { type FlowDiagnostic, flowDiagnosticSchema } from "../diagnostics/index.js";
import { type FlowSource, flowSourceSpanSchema } from "../source/index.js";

export const flowStructuralTokenKindSchema = z.enum([
  "BOM",
  "NEWLINE",
  "INDENT",
  "DEDENT",
  "KEY",
  "COLON",
  "DASH",
  "COMMA",
  "INLINE_LIST_START",
  "INLINE_LIST_END",
  "BLOCK_LITERAL_START",
  "EOF",
]);

export const flowScalarTokenKindSchema = z.enum([
  "SCALAR_BARE",
  "SCALAR_SINGLE_QUOTED",
  "SCALAR_DOUBLE_QUOTED",
  "BLOCK_LITERAL_TEXT",
  "COMMENT",
]);

export const flowYamlReservedTokenKindSchema = z.enum([
  "YAML_DIRECTIVE",
  "YAML_DOCUMENT_MARKER",
  "YAML_TAG",
  "YAML_ANCHOR",
  "YAML_ALIAS",
  "YAML_MERGE_KEY",
]);

export const flowTokenKindSchema = z.union([
  flowStructuralTokenKindSchema,
  flowScalarTokenKindSchema,
  flowYamlReservedTokenKindSchema,
]);

export const flowTokenSchema = z.object({
  id: z.string().min(1),
  kind: flowTokenKindSchema,
  lexeme: z.string(),
  span: flowSourceSpanSchema,
  indent: z.number().int().nonnegative().optional(),
  value: z.string().optional(),
});

export const flowTokenStreamSchema = z.object({
  sourceId: z.string().min(1),
  tokens: z.array(flowTokenSchema),
});

export const flowLexResultSchema = z.object({
  ok: z.boolean(),
  stream: flowTokenStreamSchema.optional(),
  diagnostics: z.array(flowDiagnosticSchema).default([]),
});

export type FlowStructuralTokenKind = z.infer<typeof flowStructuralTokenKindSchema>;
export type FlowScalarTokenKind = z.infer<typeof flowScalarTokenKindSchema>;
export type FlowYamlReservedTokenKind = z.infer<typeof flowYamlReservedTokenKindSchema>;
export type FlowTokenKind = z.infer<typeof flowTokenKindSchema>;
export type FlowToken = z.infer<typeof flowTokenSchema>;
export type FlowTokenStream = z.infer<typeof flowTokenStreamSchema>;
export type FlowLexResult = z.infer<typeof flowLexResultSchema>;

type MutableToken = Omit<FlowToken, "id">;

const INDENT_SIZE = 2;

export function lexFlowSource(source: FlowSource): FlowLexResult {
  const text = normalizeNewlines(source.text);
  const lineStarts = getLineStarts(text);
  const lines = text.split("\n");
  const tokens: FlowToken[] = [];
  const diagnostics: FlowDiagnostic[] = [];
  const indentStack = [0];
  let nextTokenId = 1;
  let blockLiteralParentIndent: number | undefined;

  const locationAt = (offset: number) => {
    let low = 0;
    let high = lineStarts.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const lineStart = lineStarts[mid] ?? 0;
      const nextLineStart = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY;

      if (offset < lineStart) {
        high = mid - 1;
      } else if (offset >= nextLineStart) {
        low = mid + 1;
      } else {
        return {
          line: mid + 1,
          column: offset - lineStart + 1,
          offset,
        };
      }
    }

    const lastLineStart = lineStarts.at(-1) ?? 0;
    return {
      line: lineStarts.length,
      column: offset - lastLineStart + 1,
      offset,
    };
  };

  const span = (start: number, end: number) => ({
    start: locationAt(start),
    end: locationAt(end),
  });

  const addToken = (token: MutableToken) => {
    tokens.push({
      id: `token_${nextTokenId++}`,
      ...token,
    });
  };

  const addDiagnostic = (
    code: FlowDiagnostic["code"],
    message: string,
    start: number,
    end: number,
    path: string[] = []
  ) => {
    diagnostics.push(
      flowDiagnosticSchema.parse({
        code,
        message,
        severity: "error",
        path,
        span: span(start, Math.max(start, end)),
      })
    );
  };

  if (text.startsWith("\uFEFF")) {
    addToken({
      kind: "BOM",
      lexeme: "\uFEFF",
      span: span(0, 1),
    });
  }

  let lineStartOffset = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";
    const hasNewline = lineIndex < lines.length - 1;
    const newlineOffset = lineStartOffset + line.length;

    if (blockLiteralParentIndent !== undefined) {
      const blockIndent = countLeadingSpaces(line);
      const trimmed = line.trim();

      if (trimmed === "" || blockIndent > blockLiteralParentIndent) {
        const contentStartColumn = Math.min(line.length, blockLiteralParentIndent + INDENT_SIZE);
        const contentStart = lineStartOffset + contentStartColumn;
        addToken({
          kind: "BLOCK_LITERAL_TEXT",
          lexeme: line.slice(contentStartColumn),
          value: line.slice(contentStartColumn),
          span: span(contentStart, lineStartOffset + line.length),
        });
        addNewlineToken(hasNewline, newlineOffset);
        lineStartOffset = newlineOffset + (hasNewline ? 1 : 0);
        continue;
      }

      blockLiteralParentIndent = undefined;
    }

    const indentInfo = readIndent(line, lineStartOffset);

    if (indentInfo.tabOffset !== undefined) {
      addDiagnostic(
        "FLOW_PARSE_TAB_INDENT",
        "Tabs are not valid .flow indentation.",
        indentInfo.tabOffset,
        indentInfo.tabOffset + 1
      );
    }

    const content = line.slice(indentInfo.width);
    const trimmedContent = content.trim();
    const isBlank = trimmedContent === "";
    const isCommentOnly = trimmedContent.startsWith("#");

    if (!isBlank && !isCommentOnly) {
      if (indentInfo.width % INDENT_SIZE !== 0) {
        addDiagnostic(
          "FLOW_PARSE_BAD_INDENT",
          ".flow indentation must use multiples of two spaces.",
          lineStartOffset,
          lineStartOffset + indentInfo.width
        );
      }

      updateIndent(indentInfo.width, lineStartOffset);
    }

    if (isBlank) {
      addNewlineToken(hasNewline, newlineOffset);
      lineStartOffset = newlineOffset + (hasNewline ? 1 : 0);
      continue;
    }

    if (isCommentOnly) {
      const commentStartColumn = line.indexOf("#");
      const commentStart = lineStartOffset + commentStartColumn;
      addToken({
        kind: "COMMENT",
        lexeme: line.slice(commentStartColumn),
        value: line.slice(commentStartColumn + 1).trim(),
        span: span(commentStart, lineStartOffset + line.length),
      });
      addNewlineToken(hasNewline, newlineOffset);
      lineStartOffset = newlineOffset + (hasNewline ? 1 : 0);
      continue;
    }

    scanLine(line, lineStartOffset, indentInfo.width);
    addNewlineToken(hasNewline, newlineOffset);
    lineStartOffset = newlineOffset + (hasNewline ? 1 : 0);
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    addToken({
      kind: "DEDENT",
      lexeme: "",
      span: span(text.length, text.length),
      indent: indentStack.at(-1) ?? 0,
    });
  }

  addToken({
    kind: "EOF",
    lexeme: "",
    span: span(text.length, text.length),
  });

  return flowLexResultSchema.parse({
    ok: diagnostics.length === 0,
    stream: {
      sourceId: source.id,
      tokens,
    },
    diagnostics,
  });

  function addNewlineToken(hasNewline: boolean, newlineOffset: number) {
    if (!hasNewline) return;

    addToken({
      kind: "NEWLINE",
      lexeme: "\n",
      span: span(newlineOffset, newlineOffset + 1),
    });
  }

  function updateIndent(indent: number, offset: number) {
    const currentIndent = indentStack.at(-1) ?? 0;

    if (indent > currentIndent) {
      indentStack.push(indent);
      addToken({
        kind: "INDENT",
        lexeme: "",
        span: span(offset, offset + indent),
        indent,
      });
      return;
    }

    if (indent === currentIndent) return;

    while (indentStack.length > 1 && indent < (indentStack.at(-1) ?? 0)) {
      indentStack.pop();
      addToken({
        kind: "DEDENT",
        lexeme: "",
        span: span(offset, offset),
        indent: indentStack.at(-1) ?? 0,
      });
    }

    if ((indentStack.at(-1) ?? 0) !== indent) {
      addDiagnostic(
        "FLOW_PARSE_BAD_INDENT",
        ".flow indentation does not match a previous indentation level.",
        offset,
        offset + indent
      );
    }
  }

  function scanLine(line: string, lineOffset: number, indent: number) {
    let column = indent;

    column = skipSpaces(line, column);

    if (line.startsWith("%YAML", column)) {
      emitYamlReserved("YAML_DIRECTIVE", lineOffset + column, line.slice(column));
      return;
    }

    const rest = line.slice(column).trim();
    if (rest === "---" || rest === "...") {
      emitYamlReserved("YAML_DOCUMENT_MARKER", lineOffset + column, rest);
      return;
    }

    if (line.startsWith("<<:", column)) {
      emitYamlReserved("YAML_MERGE_KEY", lineOffset + column, "<<");
      return;
    }

    if (line[column] === "-") {
      addToken({
        kind: "DASH",
        lexeme: "-",
        span: span(lineOffset + column, lineOffset + column + 1),
        indent,
      });
      column += 1;
      column = skipSpaces(line, column);
    }

    column = scanNode(line, lineOffset, column, indent);
    column = skipSpaces(line, column);

    if (line[column] === "#") {
      addToken({
        kind: "COMMENT",
        lexeme: line.slice(column),
        value: line.slice(column + 1).trim(),
        span: span(lineOffset + column, lineOffset + line.length),
      });
    }
  }

  function scanNode(line: string, lineOffset: number, startColumn: number, indent: number) {
    let column = skipSpaces(line, startColumn);
    const keyMatch = /^[A-Za-z_][A-Za-z0-9_-]*(?=\s*:)/.exec(line.slice(column));

    if (keyMatch?.[0]) {
      const key = keyMatch[0];
      const keyStart = lineOffset + column;
      addToken({
        kind: "KEY",
        lexeme: key,
        value: key,
        span: span(keyStart, keyStart + key.length),
        indent,
      });
      column += key.length;
      column = skipSpaces(line, column);

      addToken({
        kind: "COLON",
        lexeme: ":",
        span: span(lineOffset + column, lineOffset + column + 1),
      });
      column += 1;
      column = skipSpaces(line, column);

      if (line[column] === "|") {
        addToken({
          kind: "BLOCK_LITERAL_START",
          lexeme: "|",
          span: span(lineOffset + column, lineOffset + column + 1),
        });
        blockLiteralParentIndent = indent;
        return column + 1;
      }
    }

    return scanValue(line, lineOffset, column);
  }

  function scanValue(line: string, lineOffset: number, startColumn: number) {
    const column = skipSpaces(line, startColumn);

    if (column >= line.length || line[column] === "#") {
      return column;
    }

    if (line[column] === "[") {
      return scanInlineList(line, lineOffset, column);
    }

    if (line[column] === '"' || line[column] === "'") {
      return scanQuotedScalar(line, lineOffset, column);
    }

    if (line[column] === "!") {
      emitYamlReserved("YAML_TAG", lineOffset + column, readReservedLexeme(line, column));
      return line.length;
    }

    if (line[column] === "&") {
      emitYamlReserved("YAML_ANCHOR", lineOffset + column, readReservedLexeme(line, column));
      return line.length;
    }

    if (line[column] === "*") {
      emitYamlReserved("YAML_ALIAS", lineOffset + column, readReservedLexeme(line, column));
      return line.length;
    }

    return scanBareScalar(line, lineOffset, column);
  }

  function scanInlineList(line: string, lineOffset: number, startColumn: number) {
    let column = startColumn;
    addToken({
      kind: "INLINE_LIST_START",
      lexeme: "[",
      span: span(lineOffset + column, lineOffset + column + 1),
    });
    column += 1;

    let closed = false;

    while (column < line.length) {
      column = skipSpaces(line, column);

      if (line[column] === "]") {
        addToken({
          kind: "INLINE_LIST_END",
          lexeme: "]",
          span: span(lineOffset + column, lineOffset + column + 1),
        });
        column += 1;
        closed = true;
        break;
      }

      if (line[column] === ",") {
        addToken({
          kind: "COMMA",
          lexeme: ",",
          span: span(lineOffset + column, lineOffset + column + 1),
        });
        column += 1;
        continue;
      }

      if (line[column] === "#") break;

      if (line[column] === '"' || line[column] === "'") {
        column = scanQuotedScalar(line, lineOffset, column);
      } else {
        column = scanBareScalar(line, lineOffset, column, [",", "]"]);
      }
    }

    if (!closed) {
      addDiagnostic(
        "FLOW_PARSE_UNTERMINATED_INLINE_LIST",
        "Inline list is missing a closing ].",
        lineOffset + startColumn,
        lineOffset + line.length
      );
    }

    return column;
  }

  function scanQuotedScalar(line: string, lineOffset: number, startColumn: number) {
    const quote = line[startColumn];
    let column = startColumn + 1;
    let value = "";
    let closed = false;

    while (column < line.length) {
      const char = line[column];

      if (quote === '"' && char === "\\") {
        const next = line[column + 1];
        if (next === undefined) break;
        value += unescapeDoubleQuotedChar(next);
        column += 2;
        continue;
      }

      if (char === quote) {
        closed = true;
        break;
      }

      value += char;
      column += 1;
    }

    if (!closed) {
      addDiagnostic(
        "FLOW_PARSE_UNTERMINATED_STRING",
        "Quoted scalar is missing a closing quote.",
        lineOffset + startColumn,
        lineOffset + line.length
      );
      addToken({
        kind: quote === '"' ? "SCALAR_DOUBLE_QUOTED" : "SCALAR_SINGLE_QUOTED",
        lexeme: line.slice(startColumn),
        value,
        span: span(lineOffset + startColumn, lineOffset + line.length),
      });
      return line.length;
    }

    addToken({
      kind: quote === '"' ? "SCALAR_DOUBLE_QUOTED" : "SCALAR_SINGLE_QUOTED",
      lexeme: line.slice(startColumn, column + 1),
      value,
      span: span(lineOffset + startColumn, lineOffset + column + 1),
    });

    return column + 1;
  }

  function scanBareScalar(
    line: string,
    lineOffset: number,
    startColumn: number,
    stopChars: string[] = ["#"]
  ) {
    let column = startColumn;

    while (column < line.length && !stopChars.includes(line[column] ?? "")) {
      column += 1;
    }

    const raw = line.slice(startColumn, column);
    const trimmedEnd = raw.trimEnd();
    const endColumn = startColumn + trimmedEnd.length;
    const value = trimmedEnd.trimStart();
    const leadingSpaceCount = trimmedEnd.length - value.length;
    const tokenStartColumn = startColumn + leadingSpaceCount;

    if (value.length > 0) {
      addToken({
        kind: "SCALAR_BARE",
        lexeme: value,
        value,
        span: span(lineOffset + tokenStartColumn, lineOffset + endColumn),
      });
    }

    return column;
  }

  function emitYamlReserved(kind: FlowYamlReservedTokenKind, start: number, lexeme: string) {
    addToken({
      kind,
      lexeme,
      span: span(start, start + lexeme.length),
    });
    addDiagnostic(
      "FLOW_PARSE_YAML_FEATURE_UNSUPPORTED",
      `${kind} is not supported in .flow.`,
      start,
      start + lexeme.length
    );
  }
}

function normalizeNewlines(text: string) {
  return text.replace(/\r\n?/g, "\n");
}

function getLineStarts(text: string) {
  const starts = [0];

  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}

function readIndent(line: string, lineOffset: number) {
  let width = 0;
  let tabOffset: number | undefined;

  while (width < line.length) {
    const char = line[width];

    if (char === " ") {
      width += 1;
      continue;
    }

    if (char === "\t") {
      tabOffset = lineOffset + width;
      width += 1;
      continue;
    }

    break;
  }

  return {
    width,
    tabOffset,
  };
}

function countLeadingSpaces(line: string) {
  let count = 0;

  while (line[count] === " ") {
    count += 1;
  }

  return count;
}

function skipSpaces(line: string, column: number) {
  let nextColumn = column;

  while (line[nextColumn] === " ") {
    nextColumn += 1;
  }

  return nextColumn;
}

function readReservedLexeme(line: string, startColumn: number) {
  let column = startColumn;

  while (column < line.length && !/\s/.test(line[column] ?? "")) {
    column += 1;
  }

  return line.slice(startColumn, column);
}

function unescapeDoubleQuotedChar(char: string) {
  switch (char) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    default:
      return char;
  }
}
