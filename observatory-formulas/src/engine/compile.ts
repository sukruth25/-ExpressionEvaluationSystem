import { buildTree } from "./ast";
import { evaluateTree } from "./evaluator";
import { parseTokens } from "./parser";
import { tokenize } from "./tokenizer";
import type { CompileResult, Diagnostic } from "./types";

/**
 * One deterministic pass: tokenize → parse → build tree → reduce.
 * No eval(), no Function(), no parser dependency.
 */
export function compileExpression(
  expression: string,
  variables: Record<string, number> = {},
): CompileResult {
  const tokenized = tokenize(expression);
  const base: CompileResult = {
    expression,
    variables,
    tokens: tokenized.tokens,
    steps: [],
    postfix: [],
    evalSteps: [],
    evalValues: {},
    diagnostics: [],
    status: "error",
  };

  if (tokenized.diagnostics.length > 0) {
    return {
      ...base,
      diagnostics: tokenized.diagnostics,
    };
  }

  const parsed = parseTokens(tokenized.tokens);
  base.steps = parsed.steps;
  base.postfix = parsed.postfix;

  if (parsed.diagnostics.length > 0) {
    return {
      ...base,
      diagnostics: parsed.diagnostics,
    };
  }

  const tree = buildTree(parsed.postfix, expression);
  if (!tree.ast || tree.diagnostics.length > 0) {
    return {
      ...base,
      diagnostics: tree.diagnostics,
    };
  }

  base.ast = tree.ast;
  const evaluated = evaluateTree(tree.ast, variables);
  base.evalSteps = evaluated.steps;
  base.evalValues = evaluated.values;
  base.value = evaluated.value;

  const diagnostics: Diagnostic[] = [...evaluated.diagnostics];
  base.diagnostics = diagnostics;
  base.status = diagnostics.length === 0 ? "ok" : "error";

  return base;
}
