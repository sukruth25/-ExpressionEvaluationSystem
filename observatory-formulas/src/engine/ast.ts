import { diagnostic } from "./tokenizer";
import type { ASTNode, Diagnostic, OperatorNode, Token } from "./types";

export interface BuildTreeResult {
  ast?: ASTNode;
  diagnostics: Diagnostic[];
}

const SYMBOL: Record<string, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
  "u+": "+",
  "u-": "−",
};

const PRECEDENCE: Record<string, number> = {
  "u+": 4,
  "u-": 4,
  "*": 3,
  "/": 3,
  "+": 2,
  "-": 2,
};

export function operatorSymbol(node: OperatorNode): string {
  return SYMBOL[node.operator] ?? node.operator;
}

export function formatNode(node: ASTNode): string {
  if (node.kind === "number") return node.raw;
  if (node.kind === "variable") return node.name;

  if (node.arity === 1) {
    const child = node.children[0];
    const childText = formatNode(child);
    return `${operatorSymbol(node)}${needsUnaryParens(child) ? `(${childText})` : childText}`;
  }

  const [left, right] = node.children;
  const leftText = formatNode(left);
  const rightText = formatNode(right);
  const currentPrecedence = PRECEDENCE[node.operator] ?? 0;

  const wrapLeft =
    left.kind === "operator" && PRECEDENCE[left.operator] < currentPrecedence;
  const wrapRight =
    right.kind === "operator" &&
    (PRECEDENCE[right.operator] < currentPrecedence ||
      ((node.operator === "-" || node.operator === "/") &&
        PRECEDENCE[right.operator] === currentPrecedence));

  return `${wrapLeft ? `(${leftText})` : leftText} ${operatorSymbol(node)} ${
    wrapRight ? `(${rightText})` : rightText
  }`;
}

function needsUnaryParens(node: ASTNode): boolean {
  return node.kind === "operator" && node.arity === 2;
}

export function collectNodeIds(node: ASTNode): string[] {
  const ids: string[] = [node.id];
  if (node.kind === "operator") {
    for (const child of node.children) ids.push(...collectNodeIds(child));
  }
  return ids;
}

export function findNode(node: ASTNode, id: string): ASTNode | undefined {
  if (node.id === id) return node;
  if (node.kind === "operator") {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Builds an explicit tree from the postfix stream. The postfix order is already
 * a post-order traversal, so operands become leaves and operators consume the
 * appropriate number of children.
 */
export function buildTree(
  postfix: Token[],
  expression: string,
): BuildTreeResult {
  const stack: ASTNode[] = [];
  const diagnostics: Diagnostic[] = [];
  let nodeId = 0;

  const nextId = () => `n${nodeId++}`;

  for (const token of postfix) {
    if (token.type === "number") {
      stack.push({
        id: nextId(),
        kind: "number",
        tokenId: token.id,
        start: token.start,
        end: token.end,
        tokenStart: token.start,
        tokenEnd: token.end,
        source: expression.slice(token.start, token.end),
        value: token.value!,
        raw: token.raw,
      });
      continue;
    }

    if (token.type === "variable") {
      stack.push({
        id: nextId(),
        kind: "variable",
        tokenId: token.id,
        start: token.start,
        end: token.end,
        tokenStart: token.start,
        tokenEnd: token.end,
        source: expression.slice(token.start, token.end),
        name: token.name!,
      });
      continue;
    }

    if (token.type === "operator") {
      const arity = token.unary ? 1 : 2;
      if (stack.length < arity) {
        diagnostics.push(
          diagnostic(
            "MALFORMED_TREE",
            "Incomplete expression tree",
            `The operator “${token.raw}” at column ${token.start + 1} does not have enough operands to form a node.`,
            token.start,
            token.end,
            { tokenId: token.id, tokenRaw: token.raw },
          ),
        );
        return { diagnostics };
      }

      const children =
        arity === 1 ? [stack.pop()!] : [stack.pop()!, stack.pop()!].reverse();

      const start = arity === 1 ? token.start : children[0].start;
      const end = children[children.length - 1].end;

      stack.push({
        id: nextId(),
        kind: "operator",
        tokenId: token.id,
        start,
        end,
        tokenStart: token.start,
        tokenEnd: token.end,
        source: expression.slice(start, end),
        operator: token.operator!,
        arity,
        children,
      });
    }
  }

  if (stack.length !== 1) {
    diagnostics.push(
      diagnostic(
        "MALFORMED_TREE",
        "Incomplete expression tree",
        "The postfix queue did not reduce to a single expression tree.",
        0,
        Math.max(0, expression.length),
        {
          detail:
            "This usually means the formula contains an operator without a complete pair of operands.",
        },
      ),
    );
    return { diagnostics };
  }

  return { ast: stack[0], diagnostics };
}
