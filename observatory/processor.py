"""
Unified high-level processor for the Observatory Formula System.
"""

from dataclasses import dataclass
from typing import Dict, Any, List, Optional
from observatory.tokens import Token, TokenType
from observatory.lexer import tokenize
from observatory.shunting_yard import infix_to_postfix, ShuntingYardStep
from observatory.ast_nodes import ExprNode
from observatory.evaluator import build_expression_tree, evaluate_postfix, EvalTraceStep, format_number
from observatory.errors import ObservatoryError


@dataclass
class FormulaResult:
    expression: str
    variables: Dict[str, float | int]
    tokens: List[Token]
    shunting_trace: List[ShuntingYardStep]
    postfix_tokens: List[Token]
    postfix_str: str
    tree: ExprNode
    tree_text: str
    eval_trace: List[EvalTraceStep]
    result: float | int
    formatted_result: str


def process_formula(
    expression: str,
    variables: Optional[Dict[str, float | int]] = None,
) -> FormulaResult:
    """
    Processes and evaluates a mathematical formula end-to-end:
    1. Lexing / Tokenizing (with unary minus detection)
    2. Shunting-Yard Infix-to-Postfix conversion (with step-by-step trace)
    3. Expression Tree (AST) construction
    4. Postfix Evaluation (with subexpression calculation trace)
    """
    if variables is None:
        variables = {}

    # 1. Tokenize
    tokens = tokenize(expression)

    # 2. Infix-to-Postfix (Shunting-Yard)
    postfix_tokens, shunting_trace = infix_to_postfix(tokens, expression)
    postfix_str = " ".join(t.raw if t.type != TokenType.UNARY_MINUS else "neg" for t in postfix_tokens)

    # 3. Build Expression Tree
    tree = build_expression_tree(postfix_tokens, expression)
    tree_text = tree.render_tree(var_values=variables)

    # 4. Evaluate with Trace
    result_val, eval_trace = evaluate_postfix(postfix_tokens, variables, expression)

    return FormulaResult(
        expression=expression,
        variables=variables,
        tokens=tokens,
        shunting_trace=shunting_trace,
        postfix_tokens=postfix_tokens,
        postfix_str=postfix_str,
        tree=tree,
        tree_text=tree_text,
        eval_trace=eval_trace,
        result=result_val,
        formatted_result=format_number(result_val),
    )
