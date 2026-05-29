import { z } from "zod";
import { flowAstSchema, type FlowAst } from "../ast/index.js";
import { flowCstDocumentSchema, type FlowCstNode } from "../cst/index.js";
import {
  flowDiagnosticSchema,
  type FlowDiagnostic,
  type FlowDiagnosticCode,
  type FlowDiagnosticSeverity,
} from "../diagnostics/index.js";
import { lexFlowSource, type FlowToken } from "../lexer/index.js";
import { type FlowSource, flowSourceSpanSchema } from "../source/index.js";

export const flowCstParseResultSchema = z.object({
  ok: z.boolean(),
  cst: flowCstDocumentSchema.optional(),
  diagnostics: z.array(flowDiagnosticSchema).default([]),
});

export const flowParseResultSchema = z.object({
  ok: z.boolean(),
  ast: flowAstSchema.optional(),
  diagnostics: z.array(flowDiagnosticSchema).default([]),
});

export type FlowCstParseResult = z.infer<typeof flowCstParseResultSchema>;
export type FlowParseResult = z.infer<typeof flowParseResultSchema>;

export {
  flowDiagnosticCodeSchema,
  flowDiagnosticSchema,
  flowDiagnosticSeveritySchema,
} from "../diagnostics/index.js";

export type { FlowDiagnostic, FlowDiagnosticCode, FlowDiagnosticSeverity };

export type FlowParser = {
  parse(source: FlowSource): FlowParseResult | Promise<FlowParseResult>;
};

export function createUnimplementedParseResult(message: string): FlowParseResult {
  return flowParseResultSchema.parse({
    ok: false,
    diagnostics: [
      {
        code: "FLOW_PARSER_NOT_IMPLEMENTED",
        message,
        severity: "error",
      },
    ],
  });
}

type ContainerEntry = {
  indent: number;
  node: FlowCstNode;
};

export function parseFlowCst(source: FlowSource): FlowCstParseResult {
  const lexResult = lexFlowSource(source);
  const tokens = lexResult.stream?.tokens ?? [];
  const diagnostics = [...lexResult.diagnostics];
  const rootSpan = spanFromTokens(tokens);
  let nextNodeId = 1;
  const root = createCstNode("document", rootSpan);
  const comments: FlowCstNode[] = [];
  const stack: ContainerEntry[] = [{ indent: -1, node: root }];
  let activeBlockLiteral:
    | {
        parentIndent: number;
        node: FlowCstNode;
      }
    | undefined;

  if (!lexResult.ok) {
    return flowCstParseResultSchema.parse({
      ok: false,
      cst: flowCstDocumentSchema.parse({
        sourceId: source.id,
        root,
        tokens,
        comments,
      }),
      diagnostics,
    });
  }

  for (const line of groupContentTokensByLine(tokens)) {
    const firstToken = line[0];
    if (!firstToken) continue;

    if (firstToken.kind !== "BLOCK_LITERAL_TEXT") {
      activeBlockLiteral = undefined;
    }

    if (firstToken.kind === "COMMENT") {
      const parent = parentForIndent(stack, tokenIndent(firstToken));
      const comment = createCommentNode(firstToken);
      comments.push(comment);
      addChild(parent.node, comment);
      continue;
    }

    if (firstToken.kind === "BLOCK_LITERAL_TEXT") {
      if (activeBlockLiteral) {
        appendBlockLiteralText(activeBlockLiteral.node, firstToken);
      }
      continue;
    }

    const indent = tokenIndent(firstToken);
    unwindStack(stack, indent);
    const parent = stack.at(-1)?.node ?? root;
    const parsed = parseLine(line, parent, indent);

    if (parsed?.container) {
      stack.push({
        indent,
        node: parsed.container,
      });
    }

    if (parsed?.blockLiteral) {
      activeBlockLiteral = {
        parentIndent: indent,
        node: parsed.blockLiteral,
      };
    }
  }

  const cst = flowCstDocumentSchema.parse({
    sourceId: source.id,
    root,
    tokens,
    comments,
  });

  return flowCstParseResultSchema.parse({
    ok: diagnostics.length === 0,
    cst,
    diagnostics,
  });

  function parseLine(
    line: FlowToken[],
    parent: FlowCstNode,
    indent: number
  ):
    | {
        container?: FlowCstNode;
        blockLiteral?: FlowCstNode;
      }
    | undefined {
    const firstToken = line[0];
    if (!firstToken) return undefined;

    if (firstToken.kind === "DASH") {
      const sequence = getOrCreateSequence(parent, firstToken, indent);
      const item = createCstNode("sequence_item", firstToken.span, {
        tokenIds: [firstToken.id],
        metadata: { indent },
      });
      addChild(sequence, item);

      const rest = line.slice(1);
      const parsedItemChild = parseNodeTokens(rest, item, indent + 2);

      return {
        container: item,
        blockLiteral: parsedItemChild?.blockLiteral,
      };
    }

    return parseNodeTokens(line, parent, indent);
  }

  function parseNodeTokens(
    tokensForNode: FlowToken[],
    parent: FlowCstNode,
    indent: number
  ):
    | {
        container?: FlowCstNode;
        blockLiteral?: FlowCstNode;
      }
    | undefined {
    const contentTokens = tokensForNode.filter((token) => token.kind !== "COMMENT");
    const commentTokens = tokensForNode.filter((token) => token.kind === "COMMENT");
    const firstToken = contentTokens[0];

    if (!firstToken) {
      for (const commentToken of commentTokens) {
        const comment = createCommentNode(commentToken);
        comments.push(comment);
        addChild(parent, comment);
      }
      return undefined;
    }

    if (firstToken.kind === "KEY") {
      const pair = createPairNode(contentTokens, indent);
      addChild(parent, pair);

      const valueTokens = valueTokensForPair(contentTokens);
      const valueNode = createValueNode(valueTokens);

      if (valueNode) {
        addChild(pair, valueNode);
      }

      for (const commentToken of commentTokens) {
        const comment = createCommentNode(commentToken);
        comments.push(comment);
        addChild(pair, comment);
      }

      return {
        container: valueNode ? undefined : pair,
        blockLiteral: valueNode?.kind === "block_literal" ? valueNode : undefined,
      };
    }

    const valueNode = createValueNode(contentTokens);
    if (valueNode) {
      addChild(parent, valueNode);
    }

    for (const commentToken of commentTokens) {
      const comment = createCommentNode(commentToken);
      comments.push(comment);
      addChild(parent, comment);
    }

    return undefined;
  }

  function createPairNode(line: FlowToken[], indent: number) {
    const keyToken = line.find((token) => token.kind === "KEY");
    const colonToken = line.find((token) => token.kind === "COLON");
    const pairTokens = [keyToken, colonToken].filter((token): token is FlowToken => Boolean(token));

    return createCstNode("pair", spanFromTokens(pairTokens), {
      key: keyToken?.value ?? keyToken?.lexeme,
      tokenIds: pairTokens.map((token) => token.id),
      metadata: { indent },
    });
  }

  function valueTokensForPair(line: FlowToken[]) {
    const colonIndex = line.findIndex((token) => token.kind === "COLON");
    if (colonIndex === -1) return [];

    return line.slice(colonIndex + 1);
  }

  function createValueNode(valueTokens: FlowToken[]) {
    const meaningfulTokens = valueTokens.filter((token) => token.kind !== "COMMA");
    const firstToken = meaningfulTokens[0];

    if (!firstToken) return undefined;

    if (firstToken.kind === "INLINE_LIST_START") {
      const inlineList = createCstNode("inline_list", spanFromTokens(valueTokens), {
        tokenIds: valueTokens.map((token) => token.id),
      });

      for (const scalarToken of valueTokens.filter(isScalarToken)) {
        addChild(inlineList, createScalarNode(scalarToken));
      }

      return inlineList;
    }

    if (firstToken.kind === "BLOCK_LITERAL_START") {
      return createCstNode("block_literal", firstToken.span, {
        tokenIds: [firstToken.id],
        value: "",
      });
    }

    if (isScalarToken(firstToken)) {
      return createScalarNode(firstToken);
    }

    return undefined;
  }

  function getOrCreateSequence(parent: FlowCstNode, dashToken: FlowToken, indent: number) {
    const lastChild = parent.children.at(-1);
    if (lastChild?.kind === "sequence" && lastChild.metadata.indent === indent) {
      return lastChild;
    }

    const sequence = createCstNode("sequence", dashToken.span, {
      metadata: { indent },
    });
    addChild(parent, sequence);
    return sequence;
  }

  function createScalarNode(token: FlowToken) {
    return createCstNode("scalar", token.span, {
      value: token.value ?? token.lexeme,
      tokenIds: [token.id],
    });
  }

  function createCommentNode(token: FlowToken) {
    return createCstNode("comment", token.span, {
      value: token.value ?? token.lexeme,
      tokenIds: [token.id],
    });
  }

  function createCstNode(
    kind: FlowCstNode["kind"],
    span: FlowCstNode["span"],
    options: Partial<Omit<FlowCstNode, "id" | "kind" | "span" | "children" | "metadata">> & {
      metadata?: Record<string, unknown>;
    } = {}
  ): FlowCstNode {
    return {
      id: `node_${nextNodeId++}`,
      kind,
      span,
      key: options.key,
      value: options.value,
      tokenIds: options.tokenIds ?? [],
      children: [],
      metadata: options.metadata ?? {},
    };
  }
}

function groupContentTokensByLine(tokens: FlowToken[]) {
  const grouped = new Map<number, FlowToken[]>();

  for (const token of tokens) {
    if (["INDENT", "DEDENT", "NEWLINE", "EOF", "BOM"].includes(token.kind)) {
      continue;
    }

    const line = token.span.start.line;
    grouped.set(line, [...(grouped.get(line) ?? []), token]);
  }

  return [...grouped.values()].map((line) =>
    line.sort((left, right) => left.span.start.offset - right.span.start.offset)
  );
}

function parentForIndent(stack: ContainerEntry[], indent: number) {
  unwindStack(stack, indent);
  return stack.at(-1) ?? stack[0]!;
}

function unwindStack(stack: ContainerEntry[], indent: number) {
  while (stack.length > 1 && (stack.at(-1)?.indent ?? -1) >= indent) {
    stack.pop();
  }
}

function tokenIndent(token: FlowToken) {
  return token.indent ?? token.span.start.column - 1;
}

function addChild(parent: FlowCstNode, child: FlowCstNode) {
  parent.children.push(child);
  parent.span = mergeSpans(parent.span, child.span);
}

function appendBlockLiteralText(node: FlowCstNode, token: FlowToken) {
  const currentValue = node.value ?? "";
  node.value = `${currentValue}${currentValue ? "\n" : ""}${token.value ?? token.lexeme}`;
  node.tokenIds.push(token.id);
  node.span = mergeSpans(node.span, token.span);
}

function isScalarToken(token: FlowToken) {
  return (
    token.kind === "SCALAR_BARE" ||
    token.kind === "SCALAR_SINGLE_QUOTED" ||
    token.kind === "SCALAR_DOUBLE_QUOTED"
  );
}

function spanFromTokens(tokens: FlowToken[]) {
  const firstToken = tokens[0];
  const lastToken = tokens.at(-1);

  if (!firstToken || !lastToken) {
    return {
      start: {
        line: 1,
        column: 1,
        offset: 0,
      },
      end: {
        line: 1,
        column: 1,
        offset: 0,
      },
    };
  }

  return {
    start: firstToken.span.start,
    end: lastToken.span.end,
  };
}

function mergeSpans(left: FlowCstNode["span"], right: FlowCstNode["span"]) {
  return {
    start: left.start.offset <= right.start.offset ? left.start : right.start,
    end: left.end.offset >= right.end.offset ? left.end : right.end,
  };
}

export function createUnsupportedReservedTaskTypeDiagnostic(
  taskType: string,
  options: {
    path?: string[];
    span?: z.infer<typeof flowSourceSpanSchema>;
  } = {}
): FlowDiagnostic {
  return flowDiagnosticSchema.parse({
    code: "FLOW_PARSE_RESERVED_TASK_TYPE_UNSUPPORTED",
    message: `Task type "${taskType}" is reserved for a future .flow phase and is not supported yet.`,
    severity: "error",
    path: options.path ?? [],
    span: options.span,
  });
}

export function createUnsupportedReservedFailurePolicyDiagnostic(
  failurePolicy: string,
  options: {
    path?: string[];
    span?: z.infer<typeof flowSourceSpanSchema>;
  } = {}
): FlowDiagnostic {
  return flowDiagnosticSchema.parse({
    code: "FLOW_PARSE_RESERVED_FAILURE_POLICY_UNSUPPORTED",
    message: `Failure policy "${failurePolicy}" is reserved for a future .flow phase and is not supported yet.`,
    severity: "error",
    path: options.path ?? [],
    span: options.span,
  });
}

export function assertFlowAst(value: unknown): FlowAst {
  return flowAstSchema.parse(value);
}
