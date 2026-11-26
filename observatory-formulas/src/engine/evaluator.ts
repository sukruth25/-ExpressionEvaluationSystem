import { collectNodeIds, formatNode, operatorSymbol } from "./ast";
import { formatNumber } from "./format";
import { diagnostic } from "./tokenizer";
import type {
  ASTNode,
  Diagnostic,
  EvalStep,
  EvaluationResult,
  OperatorNode,
  VariableNode,
} from "./types";

class EvaluationHalt extends Error {
  diagnostic: Diagnostic;

  constructor(diagnosticValue: Diagnostic) {
    super(diagnosticValue.message);
    this.diagnostic = diagnosticValue;
  }
}

function hasFiniteBinding(
  variables: Record<string, number>,
  name: string,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(variables, name) &&
    Number.isFinite(variables[name])
  );
}

function stepBase(
  stepNumber: number,
  node: ASTNode,
  kind: EvalStep["kind"],
  expression: string,
  narration: string,
  annotation: string,
) {
  return {
    id: `e${stepNumber}`,
    phase: "eval" as const,
    kind,
    nodeId: node.id,
    tokenId: node.tokenId,
    range: { start: node.start, end: node.end },
    nodeIds: collectNodeIds(node),
    expression,
    narration,
    annotation,
  };
}

/**
 * Reduces the tree in strict post-order. Children are always resolved before
 * their operator, and each resolved node records its value and source range.
 */
export function evaluateTree(
  ast: ASTNode,
  variables: Record<string, number>,
): EvaluationResult {
  const steps: EvalStep[] = [];
  const values: Record<string, number> = {};
  const diagnostics: Diagnostic[] = [];

  const evaluate = (node: ASTNode): number => {
    if (node.kind === "number") {
      values[node.id] = node.value;
      steps.push({
        ...stepBase(
          steps.length,
          node,
          "resolve",
          node.raw,
          `The literal ${node.raw} resolves to ${formatNumber(node.value)}.`,
          "Literal",
        ),
        result: node.value,
        calculation: `${node.raw} → ${formatNumber(node.value)}`,
      });
      return node.value;
    }

    if (node.kind === "variable") {
      if (!hasFiniteBinding(variables, node.name)) {
        const diagnosticValue = diagnostic(
          "UNDEFINED_VARIABLE",
          "Undefined variable",
          `The variable “${node.name}” at column ${node.start + 1} is not in the ledger.`,
          node.start,
          node.end,
          {
            tokenId: node.tokenId,
            tokenRaw: node.name,
            detail: `Add a finite value for “${node.name}”, or replace it with a number.`,
            hint: "The evaluator never guesses a value for an unbound name.",
          },
        );
        diagnostics.push(diagnosticValue);
        steps.push({
          ...stepBase(
            steps.length,
            node,
            "error",
            node.name,
            `Evaluation halts: “${node.name}” has no value in the variable ledger.`,
            "Halt",
          ),
          diagnostic: diagnosticValue,
        });
        throw new EvaluationHalt(diagnosticValue);
      }

      const value = variables[node.name];
      values[node.id] = value;
      steps.push({
        ...stepBase(
          steps.length,
          node,
          "resolve",
          node.name,
          `${node.name} is bound to ${formatNumber(value)} in the variable ledger.`,
          "Bind",
        ),
        result: value,
        calculation: `${node.name} → ${formatNumber(value)}`,
      });
      return value;
    }

    const childValues = node.children.map(evaluate);
    const expression = formatNode(node);
    const symbol = operatorSymbol(node);

    if (node.arity === 1) {
      const value = node.operator === "u-" ? -childValues[0] : +childValues[0];
      const inner = formatNumber(childValues[0]);
      const calculation = `${symbol}(${inner}) = ${formatNumber(value)}`;
      values[node.id] = value;
      steps.push({
        ...stepBase(
          steps.length,
          node,
          "reduce",
          expression,
          node.operator === "u-"
            ? `Negate the resolved value: ${calculation}.`
            : `Apply unary +: ${calculation}.`,
          "Reduce unary",
        ),
        result: value,
        calculation,
      });
      return value;
    }

    const left = childValues[0];
    const right = childValues[1];
    const leftText = formatNumber(left);
    const rightText = formatNumber(right);

    if (node.operator === "/" && right === 0) {
      const diagnosticValue = diagnostic(
        "DIVISION_BY_ZERO",
        "Division by zero",
        `The division at column ${node.tokenStart + 1} asks for ${leftText} ÷ 0.`,
        node.tokenStart,
        node.tokenEnd,
        {
          tokenId: node.tokenId,
          tokenRaw: "/",
          detail: `The denominator ${formatNode(node.children[1])} resolves to 0. Division by zero has no finite value.`,
          hint: "Change a variable or the denominator so it does not resolve to zero.",
        },
      );
      diagnostics.push(diagnosticValue);
      steps.push({
        ...stepBase(
          steps.length,
          node,
          "error",
          expression,
          `Evaluation halts: the denominator resolves to zero, so ${leftText} ÷ 0 is undefined.`,
          "Halt division",
        ),
        diagnostic: diagnosticValue,
      });
      throw new EvaluationHalt(diagnosticValue);
    }

    let value: number;
    let narration: string;
    switch (node.operator) {
      case "+":
        value = left + right;
        narration = `Add the resolved operands: ${leftText} + ${rightText} = ${formatNumber(value)}.`;
        break;
      case "-":
        value = left - right;
        narration = `Subtract the resolved operands: ${leftText} − ${rightText} = ${formatNumber(value)}.`;
        break;
      case "*":
        value = left * right;
        narration = `Multiply the resolved operands: ${leftText} × ${rightText} = ${formatNumber(value)}.`;
        break;
      case "/":
        value = left / right;
        narration = `Divide the resolved operands: ${leftText} ÷ ${rightText} = ${formatNumber(value)}.`;
        break;
      default:
        value = Number.NaN;
        narration = "Unknown operator.";
    }

    const calculation = `${leftText} ${symbol} ${rightText} = ${formatNumber(value)}`;
    values[node.id] = value;
    steps.push({
      ...stepBase(
        steps.length,
        node,
        "reduce",
        expression,
        narration,
        node.operator === "/" ? "Reduce division" : "Reduce",
      ),
      result: value,
      calculation,
    });
    return value;
  };

  try {
    const value = evaluate(ast);
    return { steps, values, diagnostics, value };
  } catch (error) {
    if (error instanceof EvaluationHalt) {
      return { steps, values, diagnostics };
    }
    throw error;
  }
}

export function nodeValuesFromSteps(
  steps: EvalStep[],
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const step of steps) {
    if (step.result !== undefined) values[step.nodeId] = step.result;
  }
  return values;
}

export function isVariableNode(node: ASTNode): node is VariableNode {
  return node.kind === "variable";
}

export function isOperatorNode(node: ASTNode): node is OperatorNode {
  return node.kind === "operator";
}
