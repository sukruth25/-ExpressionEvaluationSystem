import { operatorSymbol } from "./ast";
import { formatNumber } from "./format";
import type { ASTNode } from "./types";

function labelFor(node: ASTNode, values: Record<string, number>): string {
  if (node.kind === "number") return node.raw;
  if (node.kind === "variable") {
    const value = values[node.id];
    return value === undefined
      ? node.name
      : `${node.name}  (${formatNumber(value)})`;
  }

  const symbol =
    node.arity === 1
      ? `${operatorSymbol(node)} (unary)`
      : operatorSymbol(node);
  const value = values[node.id];
  return value === undefined ? symbol : `${symbol}  = ${formatNumber(value)}`;
}

/**
 * A copy-friendly, indented text rendering of the expression tree.
 */
export function expressionToAscii(
  root: ASTNode,
  values: Record<string, number> = {},
): string {
  const lines: string[] = [];

  const walk = (
    node: ASTNode,
    prefix: string,
    isLast: boolean,
    isRoot: boolean,
  ) => {
    const branch = isRoot ? "" : `${prefix}${isLast ? "└─ " : "├─ "}`;
    lines.push(`${branch}${labelFor(node, values)}`);

    if (node.kind !== "operator") return;
    const childPrefix = isRoot
      ? ""
      : `${prefix}${isLast ? "   " : "│  "}`;
    node.children.forEach((child, index) => {
      walk(child, childPrefix, index === node.children.length - 1, false);
    });
  };

  walk(root, "", true, true);
  return lines.join("\n");
}
