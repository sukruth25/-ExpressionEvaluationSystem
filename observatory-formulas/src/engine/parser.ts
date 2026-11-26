import { diagnostic } from "./tokenizer";
import type {
  Diagnostic,
  OperatorSymbol,
  ParseResult,
  ParseStep,
  Token,
} from "./types";

const PRECEDENCE: Record<OperatorSymbol, number> = {
  "u+": 4,
  "u-": 4,
  "*": 3,
  "/": 3,
  "+": 2,
  "-": 2,
};

const OPERATOR_LABEL: Record<string, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
  "u+": "unary +",
  "u-": "unary −",
};

function label(token: Token): string {
  if (token.type === "operator") {
    return OPERATOR_LABEL[token.operator ?? token.raw] ?? token.raw;
  }
  return token.raw;
}

function precedence(operator: OperatorSymbol | undefined): number {
  return operator ? PRECEDENCE[operator] : -1;
}

function isLeftAssociative(operator: OperatorSymbol): boolean {
  return operator !== "u+" && operator !== "u-";
}

function findLastOpenParen(stack: Token[]): number {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].type === "lparen") return i;
  }
  return -1;
}

function snapshot(tokens: Token[]): Token[] {
  return tokens.slice();
}

function operatorNarration(
  operator: OperatorSymbol,
  context: "precedence" | "equal" | "boundary" | "flush",
): string {
  const symbol = OPERATOR_LABEL[operator] ?? operator;
  if (context === "precedence") {
    return `Pop ${symbol} onto the queue: it binds more tightly than the incoming operator.`;
  }
  if (context === "equal") {
    return `Pop ${symbol} onto the queue before the incoming operator; equal precedence is read left to right.`;
  }
  if (context === "boundary") {
    return `Pop ${symbol} onto the queue until the matching ( boundary is reached.`;
  }
  return `The input is exhausted. Pop ${symbol} onto the queue.`;
}

/**
 * Converts infix tokens to postfix with a step-by-step shunting-yard trace.
 * Every push, pop-to-output, boundary discard, and final flush is a step.
 */
export function parseTokens(tokens: Token[]): ParseResult {
  const steps: ParseStep[] = [];
  const stack: Token[] = [];
  const output: Token[] = [];
  const diagnostics: Diagnostic[] = [];

  if (tokens.length === 0) {
    diagnostics.push(
      diagnostic(
        "EMPTY_EXPRESSION",
        "Nothing to evaluate",
        "The formula is empty.",
        0,
        0,
        {
          detail:
            "Write an expression such as -(a + b) * 2 + 30 / 5, or load a preset.",
          hint: "Whitespace alone does not count as a formula.",
        },
      ),
    );
    return { steps, postfix: output, diagnostics };
  }

  const addStep = (
    action: ParseStep["action"],
    options: {
      focusTokenId?: number;
      triggerTokenId?: number;
      input: Token[];
      narration: string;
      annotation: string;
    },
  ) => {
    steps.push({
      id: `p${steps.length}`,
      phase: "parse",
      action,
      focusTokenId: options.focusTokenId,
      triggerTokenId: options.triggerTokenId,
      input: snapshot(options.input),
      stack: snapshot(stack),
      output: snapshot(output),
      narration: options.narration,
      annotation: options.annotation,
    });
  };

  let expectOperand = true;
  let lastToken: Token | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "invalid") {
      diagnostics.push(
        diagnostic(
          "INVALID_CHARACTER",
          "Unknown character",
          `The character “${token.raw}” at column ${token.start + 1} is not part of this notation.`,
          token.start,
          token.end,
          { tokenId: token.id, tokenRaw: token.raw },
        ),
      );
      return { steps, postfix: output, diagnostics };
    }

    if (token.type === "number" || token.type === "variable") {
      if (!expectOperand) {
        diagnostics.push(
          diagnostic(
            "MALFORMED_SEQUENCE",
            "Missing operator",
            `“${token.raw}” at column ${token.start + 1} appears directly after an operand.`,
            token.start,
            token.end,
            {
              tokenId: token.id,
              tokenRaw: token.raw,
              detail: `Insert +, −, ×, or ÷ before “${token.raw}”.`,
              hint: "The parser does not infer implicit multiplication.",
            },
          ),
        );
        return { steps, postfix: output, diagnostics };
      }

      output.push(token);
      addStep("output", {
        focusTokenId: token.id,
        input: tokens.slice(index + 1),
        narration:
          token.type === "number"
            ? `Append ${token.raw} to the postfix queue. A literal is already a complete operand.`
            : `Append ${token.raw} to the postfix queue as a variable operand.`,
        annotation: "Output",
      });
      expectOperand = false;
      lastToken = token;
      continue;
    }

    if (token.type === "lparen") {
      if (!expectOperand) {
        diagnostics.push(
          diagnostic(
            "MALFORMED_SEQUENCE",
            "Missing operator",
            `The opening parenthesis at column ${token.start + 1} follows an operand without an operator.`,
            token.start,
            token.end,
            {
              tokenId: token.id,
              tokenRaw: token.raw,
              detail:
                "The parser does not infer implicit multiplication. Insert × before the parenthesis.",
            },
          ),
        );
        return { steps, postfix: output, diagnostics };
      }

      stack.push(token);
      addStep("push", {
        focusTokenId: token.id,
        input: tokens.slice(index + 1),
        narration:
          "Push ( as a boundary marker. It will be discarded once its matching ) arrives.",
        annotation: "Push boundary",
      });
      expectOperand = true;
      lastToken = token;
      continue;
    }

    if (token.type === "rparen") {
      if (expectOperand) {
        const top = stack[stack.length - 1];
        if (top?.type === "lparen") {
          diagnostics.push(
            diagnostic(
              "EMPTY_PARENTHESES",
              "Empty parentheses",
              `The parentheses at columns ${top.start + 1}–${token.end} contain no expression.`,
              top.start,
              token.end,
              {
                tokenId: token.id,
                tokenRaw: token.raw,
                detail:
                  "Remove the empty pair or place a number, variable, or subexpression inside it.",
                hint: "Empty parentheses have no value and cannot be evaluated.",
              },
            ),
          );
        } else {
          diagnostics.push(
            diagnostic(
              "MALFORMED_SEQUENCE",
              "Missing operand",
              `A closing parenthesis at column ${token.start + 1} follows an operator.`,
              token.start,
              token.end,
              {
                tokenId: token.id,
                tokenRaw: token.raw,
                detail: "The operator before ) still needs a right operand.",
              },
            ),
          );
        }
        return { steps, postfix: output, diagnostics };
      }

      const openIndex = findLastOpenParen(stack);
      if (openIndex === -1) {
        diagnostics.push(
          diagnostic(
            "UNBALANCED_PARENTHESES",
            "Unexpected closing parenthesis",
            `The closing parenthesis at column ${token.start + 1} has no opening partner.`,
            token.start,
            token.end,
            {
              tokenId: token.id,
              tokenRaw: token.raw,
              detail:
                "Remove the extra ) or add an opening ( earlier in the formula.",
            },
          ),
        );
        return { steps, postfix: output, diagnostics };
      }

      while (stack.length > 0 && stack[stack.length - 1].type !== "lparen") {
        const operator = stack.pop()!;
        output.push(operator);
        addStep("pop", {
          focusTokenId: operator.id,
          triggerTokenId: token.id,
          input: tokens.slice(index),
          narration: operatorNarration(
            operator.operator!,
            "boundary",
          ),
          annotation: "Pop to queue",
        });
      }

      const boundary = stack.pop()!;
      addStep("discard", {
        focusTokenId: boundary.id,
        triggerTokenId: token.id,
        input: tokens.slice(index + 1),
        narration:
          "Discard the matching ( boundary. Parentheses are scaffolding, not operands.",
        annotation: "Discard boundary",
      });

      expectOperand = false;
      lastToken = token;
      continue;
    }

    // Operator token
    if (expectOperand) {
      if (token.unary) {
        stack.push(token);
        addStep("push", {
          focusTokenId: token.id,
          input: tokens.slice(index + 1),
          narration:
            token.operator === "u-"
              ? "Push unary −. Negation binds tighter than multiplication or addition."
              : "Push unary +. It preserves the sign and binds tightly to its operand.",
          annotation: "Push unary",
        });
        // expectOperand stays true: the unary operator still needs its operand.
        lastToken = token;
        continue;
      }

      diagnostics.push(
        diagnostic(
          "MALFORMED_SEQUENCE",
          "Operator needs a left operand",
          `The operator “${label(token)}” at column ${token.start + 1} has no operand on its left.`,
          token.start,
          token.end,
          {
            tokenId: token.id,
            tokenRaw: token.raw,
            detail:
              "A binary operator cannot follow another operator or an opening parenthesis.",
            hint: "Insert a number, variable, or parenthesized expression before it.",
          },
        ),
      );
      return { steps, postfix: output, diagnostics };
    }

    if (token.unary) {
      diagnostics.push(
        diagnostic(
          "MALFORMED_SEQUENCE",
          "Unexpected unary operator",
          `The prefix operator “${label(token)}” at column ${token.start + 1} appears where a binary operator was expected.`,
          token.start,
          token.end,
          { tokenId: token.id, tokenRaw: token.raw },
        ),
      );
      return { steps, postfix: output, diagnostics };
    }

    const incomingPrecedence = precedence(token.operator);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.type !== "operator") break;
      const topPrecedence = precedence(top.operator);
      const shouldPop =
        topPrecedence > incomingPrecedence ||
        (topPrecedence === incomingPrecedence &&
          isLeftAssociative(token.operator!));
      if (!shouldPop) break;

      const operator = stack.pop()!;
      output.push(operator);
      addStep("pop", {
        focusTokenId: operator.id,
        triggerTokenId: token.id,
        input: tokens.slice(index),
        narration: operatorNarration(
          operator.operator!,
          topPrecedence === incomingPrecedence ? "equal" : "precedence",
        ),
        annotation:
          topPrecedence === incomingPrecedence ? "Pop on tie" : "Pop by precedence",
      });
    }

    const below = stack[stack.length - 1];
    let narration = `Push ${label(token)} onto the operator stack.`;
    if (!below) {
      narration = `Push ${label(token)} onto the operator stack; the stack is empty.`;
    } else if (below.type === "lparen") {
      narration = `Push ${label(token)} above the ( boundary. It waits there for a right operand.`;
    } else if (below.type === "operator") {
      narration = `Push ${label(token)} above ${label(below)}; ${label(token)} binds more tightly and will be applied first.`;
    }

    stack.push(token);
    addStep("push", {
      focusTokenId: token.id,
      input: tokens.slice(index + 1),
      narration,
      annotation: "Push",
    });
    expectOperand = true;
    lastToken = token;
  }

  if (expectOperand) {
    if (lastToken?.type === "lparen") {
      diagnostics.push(
        diagnostic(
          "UNBALANCED_PARENTHESES",
          "Unclosed parenthesis",
          `The opening parenthesis at column ${lastToken.start + 1} never closes.`,
          lastToken.start,
          lastToken.end,
          {
            tokenId: lastToken.id,
            tokenRaw: lastToken.raw,
            detail: "Add a matching ) before the formula ends.",
          },
        ),
      );
    } else if (lastToken) {
      diagnostics.push(
        diagnostic(
          "MALFORMED_SEQUENCE",
          "Missing right operand",
          `The formula ends with “${label(lastToken)}” at column ${lastToken.start + 1}.`,
          lastToken.start,
          lastToken.end,
          {
            tokenId: lastToken.id,
            tokenRaw: lastToken.raw,
            detail: "The operator is missing the value it should operate on.",
            hint: "Add a number, variable, or parenthesized expression after it.",
          },
        ),
      );
    } else {
      diagnostics.push(
        diagnostic(
          "EMPTY_EXPRESSION",
          "Nothing to evaluate",
          "The formula is empty.",
          0,
          0,
        ),
      );
    }
    return { steps, postfix: output, diagnostics };
  }

  const openIndex = findLastOpenParen(stack);
  if (openIndex !== -1) {
    const open = stack[openIndex];
    diagnostics.push(
      diagnostic(
        "UNBALANCED_PARENTHESES",
        "Unclosed parenthesis",
        `The opening parenthesis at column ${open.start + 1} never closes.`,
        open.start,
        open.end,
        {
          tokenId: open.id,
          tokenRaw: open.raw,
          detail: "Add a matching ) before the formula ends.",
          hint: "Every ( needs exactly one corresponding ).",
        },
      ),
    );
    return { steps, postfix: output, diagnostics };
  }

  while (stack.length > 0) {
    const operator = stack.pop()!;
    output.push(operator);
    addStep("pop", {
      focusTokenId: operator.id,
      input: [],
      narration: operatorNarration(operator.operator!, "flush"),
      annotation: "Flush to queue",
    });
  }

  addStep("complete", {
    input: [],
    narration:
      "Postfix is complete. The queue now holds a single executable sentence.",
    annotation: "Complete",
  });

  return { steps, postfix: output, diagnostics };
}
