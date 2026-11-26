"""
Dijkstra's Shunting-Yard Algorithm with comprehensive syntax validation
and detailed infix-to-postfix conversion trace generation.
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
from observatory.tokens import Token, TokenType
from observatory.errors import ParserError


@dataclass
class ShuntingYardStep:
    step_num: int
    token: Token
    action: str
    operator_stack: List[str]
    output_queue: List[str]


# Precedence and associativity configuration
# Higher number = higher precedence
PRECEDENCE = {
    TokenType.PLUS: 1,
    TokenType.MINUS: 1,
    TokenType.MULTIPLY: 2,
    TokenType.DIVIDE: 2,
    TokenType.UNARY_MINUS: 3,
    TokenType.UNARY_PLUS: 3,
}

ASSOCIATIVITY = {
    TokenType.PLUS: 'L',
    TokenType.MINUS: 'L',
    TokenType.MULTIPLY: 'L',
    TokenType.DIVIDE: 'L',
    TokenType.UNARY_MINUS: 'R',
    TokenType.UNARY_PLUS: 'R',
}

OP_DISPLAY = {
    TokenType.PLUS: '+',
    TokenType.MINUS: '-',
    TokenType.MULTIPLY: '*',
    TokenType.DIVIDE: '/',
    TokenType.UNARY_MINUS: 'neg',
    TokenType.UNARY_PLUS: 'pos',
    TokenType.LPAREN: '(',
    TokenType.RPAREN: ')',
}


def validate_token_sequence(tokens: List[Token], expression: str) -> None:
    """
    Validates the sequence of tokens before Shunting-Yard conversion.
    Detects syntax errors such as missing operands, consecutive binary operators,
    empty brackets, missing operators, and improper beginnings/endings.
    """
    if not tokens:
        raise ParserError("Expression is empty.", expression, 0)

    # Check for empty parentheses: '(' immediately followed by ')'
    for i in range(len(tokens) - 1):
        if tokens[i].type == TokenType.LPAREN and tokens[i + 1].type == TokenType.RPAREN:
            raise ParserError(
                "Empty expression inside parentheses '()'",
                expression,
                tokens[i].position,
            )

    # First token validation
    first = tokens[0]
    if first.type in (TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY, TokenType.DIVIDE):
        # Only binary operators cannot start an expression (lexer assigns UNARY_MINUS / UNARY_PLUS at start)
        raise ParserError(
            f"Expression cannot start with operator '{first.raw}'",
            expression,
            first.position,
        )
    if first.type == TokenType.RPAREN:
        raise ParserError(
            "Unexpected closing parenthesis ')' at start of expression",
            expression,
            first.position,
        )

    # Last token validation
    last = tokens[-1]
    if last.is_operator:
        raise ParserError(
            f"Unexpected end of expression after operator '{last.raw}'",
            expression,
            last.position,
        )
    if last.type == TokenType.LPAREN:
        raise ParserError(
            "Unclosed opening parenthesis '(' at end of expression",
            expression,
            last.position,
        )

    # Adjacent token sequence checks
    for i in range(len(tokens) - 1):
        curr = tokens[i]
        nxt = tokens[i + 1]

        # Two consecutive operands without an operator: e.g. "a b", "2 3", "2 a"
        if curr.is_operand and nxt.is_operand:
            raise ParserError(
                f"Missing operator between '{curr.raw}' and '{nxt.raw}'",
                expression,
                nxt.position,
            )

        # Operand followed directly by '(': e.g. "a (b + c)" or "3 (x)"
        if curr.is_operand and nxt.type == TokenType.LPAREN:
            raise ParserError(
                f"Missing operator between '{curr.raw}' and '('",
                expression,
                nxt.position,
            )

        # ')' followed directly by operand: e.g. "(a + b) c"
        if curr.type == TokenType.RPAREN and nxt.is_operand:
            raise ParserError(
                f"Missing operator between ')' and '{nxt.raw}'",
                expression,
                nxt.position,
            )

        # ')' followed directly by '(': e.g. "(a + b)(c + d)"
        if curr.type == TokenType.RPAREN and nxt.type == TokenType.LPAREN:
            raise ParserError(
                "Missing operator between ')' and '('",
                expression,
                nxt.position,
            )

        # Binary operator followed by binary operator: e.g. "a + * b"
        if curr.is_operator and nxt.is_operator and not (nxt.type in (TokenType.UNARY_MINUS, TokenType.UNARY_PLUS)):
            raise ParserError(
                f"Unexpected operator '{nxt.raw}' immediately following '{curr.raw}'",
                expression,
                nxt.position,
            )

        # Binary operator followed by ')': e.g. "(a + )"
        if curr.is_operator and nxt.type == TokenType.RPAREN:
            raise ParserError(
                f"Unexpected closing parenthesis ')' after operator '{curr.raw}'",
                expression,
                nxt.position,
            )

        # '(' followed by binary operator: e.g. "( * a)"
        if curr.type == TokenType.LPAREN and nxt.is_operator and not (nxt.type in (TokenType.UNARY_MINUS, TokenType.UNARY_PLUS)):
            raise ParserError(
                f"Unexpected operator '{nxt.raw}' after opening parenthesis '('",
                expression,
                nxt.position,
            )


def infix_to_postfix(tokens: List[Token], expression: str) -> Tuple[List[Token], List[ShuntingYardStep]]:
    """
    Converts infix tokens to postfix tokens using Dijkstra's Shunting-Yard algorithm.
    Generates a step-by-step trace of operator stack and output queue transitions.
    Raises ParserError if mismatched parentheses are encountered.
    """
    validate_token_sequence(tokens, expression)

    output: List[Token] = []
    op_stack: List[Token] = []
    trace: List[ShuntingYardStep] = []
    step_counter = 0

    def stack_repr() -> List[str]:
        return [OP_DISPLAY.get(t.type, t.raw) for t in op_stack]

    def queue_repr() -> List[str]:
        return [t.raw if t.type != TokenType.UNARY_MINUS else 'neg' for t in output]

    for tok in tokens:
        step_counter += 1

        if tok.is_operand:
            output.append(tok)
            trace.append(ShuntingYardStep(
                step_num=step_counter,
                token=tok,
                action=f"Enqueue operand '{tok.raw}' to output",
                operator_stack=stack_repr(),
                output_queue=queue_repr(),
            ))

        elif tok.type == TokenType.LPAREN:
            op_stack.append(tok)
            trace.append(ShuntingYardStep(
                step_num=step_counter,
                token=tok,
                action="Push '(' onto operator stack",
                operator_stack=stack_repr(),
                output_queue=queue_repr(),
            ))

        elif tok.type == TokenType.RPAREN:
            popped_any = False
            while op_stack and op_stack[-1].type != TokenType.LPAREN:
                popped = op_stack.pop()
                output.append(popped)
                popped_any = True
                trace.append(ShuntingYardStep(
                    step_num=step_counter,
                    token=tok,
                    action=f"Pop operator '{OP_DISPLAY.get(popped.type, popped.raw)}' from stack to output (closing bracket match)",
                    operator_stack=stack_repr(),
                    output_queue=queue_repr(),
                ))

            if not op_stack:
                raise ParserError(
                    "Unexpected closing parenthesis ')' with no matching opening '('",
                    expression,
                    tok.position,
                )

            # Pop the '('
            lparen = op_stack.pop()
            trace.append(ShuntingYardStep(
                step_num=step_counter,
                token=tok,
                action="Discard matching '(' from stack",
                operator_stack=stack_repr(),
                output_queue=queue_repr(),
            ))

        elif tok.is_operator:
            tok_prec = PRECEDENCE[tok.type]
            tok_assoc = ASSOCIATIVITY[tok.type]

            while op_stack and op_stack[-1].type != TokenType.LPAREN:
                top_tok = op_stack[-1]
                top_prec = PRECEDENCE.get(top_tok.type, 0)

                should_pop = False
                if top_prec > tok_prec:
                    should_pop = True
                elif top_prec == tok_prec and tok_assoc == 'L':
                    should_pop = True

                if should_pop:
                    popped = op_stack.pop()
                    output.append(popped)
                    trace.append(ShuntingYardStep(
                        step_num=step_counter,
                        token=tok,
                        action=f"Pop operator '{OP_DISPLAY.get(popped.type, popped.raw)}' (precedence {top_prec} >= {tok_prec}) to output",
                        operator_stack=stack_repr(),
                        output_queue=queue_repr(),
                    ))
                else:
                    break

            op_stack.append(tok)
            trace.append(ShuntingYardStep(
                step_num=step_counter,
                token=tok,
                action=f"Push operator '{OP_DISPLAY.get(tok.type, tok.raw)}' (precedence {tok_prec}) onto stack",
                operator_stack=stack_repr(),
                output_queue=queue_repr(),
            ))

    # Empty remaining operators from the stack
    while op_stack:
        step_counter += 1
        top = op_stack.pop()
        if top.type == TokenType.LPAREN:
            raise ParserError(
                "Unmatched opening parenthesis '(' without closing ')'",
                expression,
                top.position,
            )
        output.append(top)
        trace.append(ShuntingYardStep(
            step_num=step_counter,
            token=top,
            action=f"End of expression: pop remaining operator '{OP_DISPLAY.get(top.type, top.raw)}' to output",
            operator_stack=stack_repr(),
            output_queue=queue_repr(),
        ))

    return output, trace
