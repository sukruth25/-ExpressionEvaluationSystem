import { compileExpression } from "./compile";
import { formatNumber } from "./format";
import type {
  DiagnosticCode,
  VerificationCase,
  VerificationOutcome,
} from "./types";

export const VERIFICATION_CASES: VerificationCase[] = [
  {
    id: "precedence",
    label: "Standard precedence",
    category: "Arithmetic",
    expression: "2 + 3 * 4",
    variables: {},
    expected: { kind: "value", value: 14 },
    note: "Multiplication binds before addition.",
  },
  {
    id: "unary-minus",
    label: "Unary minus",
    category: "Arithmetic",
    expression: "-3 + 5 * -2",
    variables: {},
    expected: { kind: "value", value: -13 },
    note: "Prefix negation is distinct from subtraction.",
  },
  {
    id: "nested",
    label: "Nested parentheses",
    category: "Arithmetic",
    expression: "2 * (3 + (4 - 1) * 2)",
    variables: {},
    expected: { kind: "value", value: 18 },
    note: "The inner boundary closes before the outer one.",
  },
  {
    id: "decimals",
    label: "Decimal arithmetic",
    category: "Arithmetic",
    expression: "2.5 * 4 - 1.25",
    variables: {},
    expected: { kind: "value", value: 8.75 },
    note: "Real-valued division is supported throughout.",
  },
  {
    id: "default-formula",
    label: "The house formula",
    category: "Variables",
    expression: "-(a + b) * 2 + 30 / 5",
    variables: { a: 10, b: 5 },
    expected: { kind: "value", value: -24 },
    note: "Unary minus, precedence, and division in one line.",
  },
  {
    id: "undefined-variable",
    label: "Undefined variable",
    category: "Diagnostics",
    expression: "a + mystery",
    variables: { a: 10 },
    expected: { kind: "error", code: "UNDEFINED_VARIABLE" },
    note: "Unbound names halt evaluation at the exact token.",
  },
  {
    id: "mismatched-brackets",
    label: "Mismatched brackets",
    category: "Diagnostics",
    expression: "(2 + 3",
    variables: {},
    expected: { kind: "error", code: "UNBALANCED_PARENTHESES" },
    note: "The opening boundary is reported.",
  },
  {
    id: "invalid-token",
    label: "Invalid token",
    category: "Diagnostics",
    expression: "2 + $ 3",
    variables: {},
    expected: { kind: "error", code: "INVALID_CHARACTER" },
    note: "Invalid characters carry exact columns.",
  },
  {
    id: "malformed",
    label: "Malformed sequence",
    category: "Diagnostics",
    expression: "5 + * 2",
    variables: {},
    expected: { kind: "error", code: "MALFORMED_SEQUENCE" },
    note: "A binary operator cannot stand where an operand is required.",
  },
  {
    id: "empty-parens",
    label: "Empty parentheses",
    category: "Diagnostics",
    expression: "5 + ()",
    variables: {},
    expected: { kind: "error", code: "EMPTY_PARENTHESES" },
    note: "A boundary pair must contain an expression.",
  },
  {
    id: "division-zero",
    label: "Dynamic division by zero",
    category: "Diagnostics",
    expression: "30 / (a - 10)",
    variables: { a: 10 },
    expected: { kind: "error", code: "DIVISION_BY_ZERO" },
    note: "The denominator is resolved before the division is attempted.",
  },
];

export function describeExpected(test: VerificationCase): string {
  return test.expected.kind === "value"
    ? formatNumber(test.expected.value)
    : test.expected.code;
}

function errorCodeOf(code: DiagnosticCode | undefined): string {
  return code ?? "UNEXPECTED_ERROR";
}

export function runVerificationCase(test: VerificationCase): VerificationOutcome {
  const result = compileExpression(test.expression, test.variables);
  const firstDiagnostic = result.diagnostics[0];

  if (test.expected.kind === "value") {
    const actualValue = result.status === "ok" ? result.value : undefined;
    const pass =
      actualValue !== undefined &&
      Math.abs(actualValue - test.expected.value) < 1e-9;
    return {
      test,
      actual:
        actualValue !== undefined
          ? formatNumber(actualValue)
          : `${errorCodeOf(firstDiagnostic?.code)} · ${firstDiagnostic?.message ?? "No value"}`,
      actualValue,
      actualError: firstDiagnostic?.code,
      pass,
    };
  }

  const actualError = firstDiagnostic?.code;
  const pass = actualError === test.expected.code;
  return {
    test,
    actual: actualError
      ? `${actualError} · ${firstDiagnostic.message}`
      : result.value !== undefined
        ? formatNumber(result.value)
        : "No diagnostic",
    actualValue: result.value,
    actualError,
    pass,
  };
}

export function runVerificationSuite(): VerificationOutcome[] {
  return VERIFICATION_CASES.map(runVerificationCase);
}
