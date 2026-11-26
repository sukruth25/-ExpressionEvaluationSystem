export interface VariableRow {
  id: string;
  name: string;
  value: string;
}

export interface Preset {
  id: string;
  label: string;
  expression: string;
  variables?: Record<string, number>;
  note: string;
}

export const DEFAULT_EXPRESSION = "-(a + b) * 2 + 30 / 5";

export const PRESETS: Preset[] = [
  {
    id: "default",
    label: "House formula",
    expression: DEFAULT_EXPRESSION,
    variables: { a: 10, b: 5 },
    note: "Unary minus, precedence, and real division.",
  },
  {
    id: "nested",
    label: "Nested brackets",
    expression: "2 * (a + (b - 3) * (4 - 1)) - -2.5",
    variables: { a: 10, b: 5 },
    note: "Three depths of parentheses plus a negative decimal.",
  },
  {
    id: "negative-decimals",
    label: "Negative decimals",
    expression: "-2.5 * (a - -0.5) + b / -2",
    variables: { a: 10, b: 5 },
    note: "Prefix negation beside subtraction and division.",
  },
  {
    id: "malformed",
    label: "Malformed",
    expression: "5 + * (a + b)",
    variables: { a: 10, b: 5 },
    note: "An operator arrives where an operand is required.",
  },
  {
    id: "zero",
    label: "Zero divisor",
    expression: "30 / (a - 10)",
    variables: { a: 10, b: 5 },
    note: "A denominator that becomes zero only after substitution.",
  },
  {
    id: "undefined",
    label: "Unbound name",
    expression: "a + mystery * 2",
    variables: { a: 10, b: 5 },
    note: "A variable that is absent from the ledger.",
  },
];
