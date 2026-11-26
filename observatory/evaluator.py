"""
Expression Tree Builder and Postfix Evaluator with detailed intermediate calculation traces.
Strictly implements pure arithmetic evaluation without using eval().
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
from observatory.tokens import Token, TokenType
from observatory.ast_nodes import ExprNode, NumberNode, VariableNode, UnaryOpNode, BinaryOpNode
from observatory.errors import (
    ParserError,
    EvaluationError,
    UndefinedVariableError,
    DivisionByZeroError,
)


@dataclass
class EvalTraceStep:
    step_num: int
    token: Token
    operation_desc: str
    subexpression_evaluated: str
    result_value: float | int
    stack_state: List[str]


def build_expression_tree(postfix_tokens: List[Token], expression: str) -> ExprNode:
    """
    Constructs an Abstract Syntax Tree (AST) from postfix tokens.
    """
    if not postfix_tokens:
        raise ParserError("Cannot build expression tree from empty token list.", expression, 0)

    node_stack: List[ExprNode] = []

    for tok in postfix_tokens:
        if tok.type == TokenType.NUMBER:
            node_stack.append(NumberNode(tok.value))
        elif tok.type == TokenType.IDENTIFIER:
            node_stack.append(VariableNode(tok.raw))
        elif tok.type in (TokenType.UNARY_MINUS, TokenType.UNARY_PLUS):
            if not node_stack:
                raise ParserError(f"Insufficient operands for unary operator '{tok.raw}'", expression, tok.position)
            operand_node = node_stack.pop()
            op_symbol = '-' if tok.type == TokenType.UNARY_MINUS else '+'
            node_stack.append(UnaryOpNode(op_symbol, operand_node))
        elif tok.is_operator:
            if len(node_stack) < 2:
                raise ParserError(f"Insufficient operands for binary operator '{tok.raw}'", expression, tok.position)
            right_node = node_stack.pop()
            left_node = node_stack.pop()
            op_symbol = tok.raw
            node_stack.append(BinaryOpNode(op_symbol, left_node, right_node))

    if len(node_stack) != 1:
        raise ParserError("Malformed expression: multiple disconnected terms remaining in tree stack.", expression, 0)

    return node_stack[0]


def format_number(val: float | int) -> str:
    """Formats float or int cleanly without trailing '.0' when it is an exact integer."""
    if isinstance(val, float):
        if val.is_integer():
            return str(int(val))
        return f"{val:.6g}"
    return str(val)


def evaluate_postfix(
    postfix_tokens: List[Token],
    variables: Dict[str, float | int],
    expression: str,
) -> Tuple[float | int, List[EvalTraceStep]]:
    """
    Evaluates a postfix token sequence using an evaluation stack.
    Variables are resolved against the provided dictionary.
    Produces an ordered trace of intermediate calculations.
    Guarantees no use of eval().
    """
    # Stack stores tuples of: (numeric_value, subexpression_string)
    stack: List[Tuple[float | int, str]] = []
    trace: List[EvalTraceStep] = []
    step_counter = 0

    def stack_display() -> List[str]:
        return [f"{format_number(v)} [{s}]" for v, s in stack]

    for tok in postfix_tokens:
        step_counter += 1

        if tok.type == TokenType.NUMBER:
            val = tok.value
            stack.append((val, str(val)))
            trace.append(EvalTraceStep(
                step_num=step_counter,
                token=tok,
                operation_desc=f"Push numeric constant {val}",
                subexpression_evaluated=str(val),
                result_value=val,
                stack_state=stack_display(),
            ))

        elif tok.type == TokenType.IDENTIFIER:
            var_name = tok.raw
            if var_name not in variables:
                raise UndefinedVariableError(
                    var_name=var_name,
                    expression=expression,
                    position=tok.position,
                    known_vars=variables,
                )
            val = variables[var_name]
            stack.append((val, var_name))
            trace.append(EvalTraceStep(
                step_num=step_counter,
                token=tok,
                operation_desc=f"Resolve variable '{var_name}' -> {format_number(val)}",
                subexpression_evaluated=f"{var_name} = {format_number(val)}",
                result_value=val,
                stack_state=stack_display(),
            ))

        elif tok.type == TokenType.UNARY_MINUS:
            if not stack:
                raise EvaluationError("Evaluation stack underflow for unary minus.", expression, tok.position)
            op_val, op_repr = stack.pop()
            res_val = -op_val
            if isinstance(res_val, float) and res_val.is_integer():
                res_val = int(res_val)
            sub_repr = f"-({op_repr})" if (" " in op_repr or op_repr.startswith("-")) else f"-{op_repr}"
            stack.append((res_val, sub_repr))
            trace.append(EvalTraceStep(
                step_num=step_counter,
                token=tok,
                operation_desc=f"Unary negate: -({format_number(op_val)})",
                subexpression_evaluated=f"-({op_repr}) -> {format_number(res_val)}",
                result_value=res_val,
                stack_state=stack_display(),
            ))

        elif tok.type == TokenType.UNARY_PLUS:
            if not stack:
                raise EvaluationError("Evaluation stack underflow for unary plus.", expression, tok.position)
            op_val, op_repr = stack.pop()
            res_val = op_val
            stack.append((res_val, op_repr))
            trace.append(EvalTraceStep(
                step_num=step_counter,
                token=tok,
                operation_desc=f"Unary positive: +({format_number(op_val)})",
                subexpression_evaluated=f"+({op_repr}) -> {format_number(res_val)}",
                result_value=res_val,
                stack_state=stack_display(),
            ))

        elif tok.is_operator:
            if len(stack) < 2:
                raise EvaluationError(f"Evaluation stack underflow for operator '{tok.raw}'.", expression, tok.position)
            right_val, right_repr = stack.pop()
            left_val, left_repr = stack.pop()

            res_val: float | int
            if tok.type == TokenType.PLUS:
                res_val = left_val + right_val
                calc_desc = f"{format_number(left_val)} + {format_number(right_val)} = {format_number(res_val)}"
                sub_repr = f"({left_repr} + {right_repr})"
            elif tok.type == TokenType.MINUS:
                res_val = left_val - right_val
                calc_desc = f"{format_number(left_val)} - {format_number(right_val)} = {format_number(res_val)}"
                sub_repr = f"({left_repr} - {right_repr})"
            elif tok.type == TokenType.MULTIPLY:
                res_val = left_val * right_val
                calc_desc = f"{format_number(left_val)} * {format_number(right_val)} = {format_number(res_val)}"
                sub_repr = f"({left_repr} * {right_repr})"
            elif tok.type == TokenType.DIVIDE:
                if right_val == 0:
                    raise DivisionByZeroError(
                        f"Division by zero: divisor '{right_repr}' evaluated to 0 in {format_number(left_val)} / {format_number(right_val)}",
                        expression,
                        tok.position,
                    )
                res_val = left_val / right_val
                calc_desc = f"{format_number(left_val)} / {format_number(right_val)} = {format_number(res_val)}"
                sub_repr = f"({left_repr} / {right_repr})"
            else:
                raise EvaluationError(f"Unsupported operator '{tok.raw}'", expression, tok.position)

            if isinstance(res_val, float) and res_val.is_integer():
                res_val = int(res_val)

            stack.append((res_val, sub_repr))
            trace.append(EvalTraceStep(
                step_num=step_counter,
                token=tok,
                operation_desc=f"Binary op '{tok.raw}': {calc_desc}",
                subexpression_evaluated=f"{sub_repr} = {format_number(res_val)}",
                result_value=res_val,
                stack_state=stack_display(),
            ))

    if len(stack) != 1:
        raise EvaluationError(
            f"Evaluation ended with {len(stack)} values on stack (expected 1).",
            expression,
            0,
        )

    final_val, _ = stack[0]
    return final_val, trace
