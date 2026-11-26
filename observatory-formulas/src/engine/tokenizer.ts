import { MAX_TOKENS } from "./types";
import type { Diagnostic, DiagnosticCode, OperatorSymbol, Token } from "./types";

export interface TokenizeResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const NORMALIZED_OPERATORS: Record<string, string> = {
  "+": "+",
  "-": "-",
  "\u2212": "-",
  "*": "*",
  "\u00d7": "*",
  "/": "/",
  "\u00f7": "/",
};

const NUMBER_START = /[0-9]/;
const VARIABLE_START = /[a-zA-Z_]/;
const VARIABLE_PART = /[a-zA-Z0-9_]/;

export function isVariableName(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

export function diagnostic(
  code: DiagnosticCode,
  title: string,
  message: string,
  start: number,
  end: number,
  options: {
    detail?: string;
    hint?: string;
    tokenId?: number;
    tokenRaw?: string;
  } = {},
): Diagnostic {
  return {
    code,
    title,
    message,
    detail: options.detail,
    hint: options.hint,
    severity: "error",
    start,
    end,
    tokenId: options.tokenId,
    tokenRaw: options.tokenRaw,
    column: start + 1,
  };
}

function unicodeCharacterAt(source: string, index: number): string {
  const codePoint = source.codePointAt(index);
  return codePoint === undefined ? source[index] : String.fromCodePoint(codePoint);
}

/**
 * Scans source text into tokens. It deliberately does not throw: every problem
 * becomes a diagnostic so the interface can point at the exact character.
 */
export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let index = 0;
  let tokenId = 0;
  let expectOperand = true;

  while (index < source.length) {
    const char = unicodeCharacterAt(source, index);

    if (/\s/.test(char)) {
      index += char.length;
      continue;
    }

    if (tokens.length >= MAX_TOKENS) {
      diagnostics.push(
        diagnostic(
          "TOKEN_LIMIT",
          "Formula is too large",
          `The tokenizer stopped at the 2,000-token limit, at column ${index + 1}.`,
          index,
          index + char.length,
          {
            detail:
              "The Observatory accepts at most 2,000 tokens per formula. Shorten the expression to continue.",
            hint: "This guard keeps parsing deterministic and the playback legible.",
            tokenRaw: char,
          },
        ),
      );
      break;
    }

    const start = index;

    if (NUMBER_START.test(char) || (char === "." && /[0-9]/.test(source[index + 1] ?? ""))) {
      if (char === ".") {
        index += 1;
        while (NUMBER_START.test(source[index] ?? "")) index += 1;
      } else {
        while (NUMBER_START.test(source[index] ?? "")) index += 1;
        if (source[index] === ".") {
          index += 1;
          while (NUMBER_START.test(source[index] ?? "")) index += 1;
        }
      }

      const raw = source.slice(start, index);
      const value = Number.parseFloat(raw);
      if (!Number.isFinite(value)) {
        diagnostics.push(
          diagnostic(
            "INVALID_CHARACTER",
            "Unreadable number",
            `“${raw}” at column ${start + 1} is not a finite decimal number.`,
            start,
            index,
            {
              tokenRaw: raw,
              detail: "Use an ordinary integer or decimal such as 12, -4.5, or .75.",
            },
          ),
        );
      } else {
        tokens.push({
          id: tokenId++,
          type: "number",
          raw,
          start,
          end: index,
          value,
        });
        expectOperand = false;
      }
      continue;
    }

    if (VARIABLE_START.test(char)) {
      index += 1;
      while (VARIABLE_PART.test(source[index] ?? "")) index += 1;
      const raw = source.slice(start, index);
      tokens.push({
        id: tokenId++,
        type: "variable",
        raw,
        start,
        end: index,
        name: raw,
      });
      expectOperand = false;
      continue;
    }

    if (char === "(") {
      tokens.push({
        id: tokenId++,
        type: "lparen",
        raw: char,
        start,
        end: index + 1,
      });
      expectOperand = true;
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({
        id: tokenId++,
        type: "rparen",
        raw: char,
        start,
        end: index + 1,
      });
      expectOperand = false;
      index += 1;
      continue;
    }

    const normalized = NORMALIZED_OPERATORS[char];
    if (normalized) {
      const isPrefix = (normalized === "-" || normalized === "+") && expectOperand;
      const operator = (isPrefix ? `u${normalized}` : normalized) as OperatorSymbol;
      tokens.push({
        id: tokenId++,
        type: "operator",
        raw: char,
        start,
        end: index + char.length,
        operator,
        unary: isPrefix,
      });
      expectOperand = true;
      index += char.length;
      continue;
    }

    diagnostics.push(
      diagnostic(
        "INVALID_CHARACTER",
        "Unknown character",
        `The character “${char}” at column ${start + 1} is not part of this notation.`,
        start,
        start + char.length,
        {
          detail:
            "Accepted characters are + − × ÷, parentheses, decimal numbers, and variable names.",
          hint:
            char === "^"
              ? "Powers are not supported. Write repeated multiplication instead."
              : char === ","
                ? "Use a decimal point rather than a comma for fractional values."
                : "Remove the character or replace it with a supported symbol.",
          tokenRaw: char,
        },
      ),
    );
    index += char.length;
  }

  return { tokens, diagnostics };
}
