/**
 * Framework-agnostic types for the Observatory expression engine.
 * Nothing in src/engine imports React, the DOM, or a parser dependency.
 */

export const MAX_TOKENS = 2_000;

export type TokenType =
  | "number"
  | "variable"
  | "operator"
  | "lparen"
  | "rparen"
  | "invalid";

export type BinaryOperator = "+" | "-" | "*" | "/";
export type UnaryOperator = "u+" | "u-";
export type OperatorSymbol = BinaryOperator | UnaryOperator;

export interface Token {
  /** Stable id, assigned in source order. */
  id: number;
  type: TokenType;
  /** The exact characters from the source. */
  raw: string;
  /** Inclusive UTF-16 start offset. */
  start: number;
  /** Exclusive UTF-16 end offset. */
  end: number;
  value?: number;
  name?: string;
  operator?: OperatorSymbol;
  /** True only for prefix + and -. */
  unary?: boolean;
}

export type DiagnosticCode =
  | "INVALID_CHARACTER"
  | "TOKEN_LIMIT"
  | "EMPTY_EXPRESSION"
  | "MALFORMED_SEQUENCE"
  | "UNBALANCED_PARENTHESES"
  | "EMPTY_PARENTHESES"
  | "UNDEFINED_VARIABLE"
  | "DIVISION_BY_ZERO"
  | "MALFORMED_TREE";

export interface Diagnostic {
  code: DiagnosticCode;
  title: string;
  message: string;
  detail?: string;
  hint?: string;
  severity: "error";
  /** 0-based character offsets. */
  start: number;
  end: number;
  tokenId?: number;
  tokenRaw?: string;
  /** 1-based human-facing column. */
  column: number;
}

export type ParseAction =
  | "output"
  | "push"
  | "pop"
  | "discard"
  | "complete"
  | "error";

export interface ParseStep {
  id: string;
  phase: "parse";
  action: ParseAction;
  /** Token that is the subject of this step. */
  focusTokenId?: number;
  /** Token currently being read, if different from the subject. */
  triggerTokenId?: number;
  input: Token[];
  stack: Token[];
  output: Token[];
  narration: string;
  /** A short editorial annotation for the step header. */
  annotation: string;
}

export type EvalStepKind = "resolve" | "reduce" | "error";

export interface EvalStep {
  id: string;
  phase: "eval";
  kind: EvalStepKind;
  nodeId: string;
  tokenId?: number;
  /** Source range covered by the node, including interior parentheses. */
  range: { start: number; end: number };
  nodeIds: string[];
  expression: string;
  calculation?: string;
  result?: number;
  narration: string;
  annotation: string;
  diagnostic?: Diagnostic;
}

export interface BaseASTNode {
  id: string;
  tokenId: number;
  /** Range covered by the whole subtree. */
  start: number;
  end: number;
  /** Range of the token that created this node. */
  tokenStart: number;
  tokenEnd: number;
  source: string;
}

export interface NumberNode extends BaseASTNode {
  kind: "number";
  value: number;
  raw: string;
}

export interface VariableNode extends BaseASTNode {
  kind: "variable";
  name: string;
}

export interface OperatorNode extends BaseASTNode {
  kind: "operator";
  operator: OperatorSymbol;
  arity: 1 | 2;
  children: ASTNode[];
}

export type ASTNode = NumberNode | VariableNode | OperatorNode;

export interface ParseResult {
  steps: ParseStep[];
  postfix: Token[];
  diagnostics: Diagnostic[];
}

export interface EvaluationResult {
  steps: EvalStep[];
  values: Record<string, number>;
  diagnostics: Diagnostic[];
  value?: number;
}

export interface CompileResult {
  expression: string;
  variables: Record<string, number>;
  tokens: Token[];
  steps: ParseStep[];
  postfix: Token[];
  ast?: ASTNode;
  evalSteps: EvalStep[];
  evalValues: Record<string, number>;
  diagnostics: Diagnostic[];
  value?: number;
  status: "ok" | "error";
}

export interface VerificationCase {
  id: string;
  label: string;
  category: string;
  expression: string;
  variables: Record<string, number>;
  expected:
    | { kind: "value"; value: number }
    | { kind: "error"; code: DiagnosticCode };
  note?: string;
}

export interface VerificationOutcome {
  test: VerificationCase;
  actual: string;
  actualValue?: number;
  actualError?: DiagnosticCode;
  pass: boolean;
}
