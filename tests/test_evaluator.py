"""
Comprehensive test suite for the Observatory Expression Evaluation System.
Verifies arithmetic correctness, precedence, associativity, unary operators,
unicode operators, AST tree construction, traces, and specific error rejections.
"""

import unittest
from observatory.processor import process_formula
from observatory.ast_nodes import NumberNode, VariableNode, UnaryOpNode, BinaryOpNode
from observatory.errors import (
    LexerError,
    ParserError,
    EvaluationError,
    UndefinedVariableError,
    DivisionByZeroError,
)


class TestObservatoryEvaluator(unittest.TestCase):

    def test_illustrative_example(self):
        """Illustrative Example from Requirements: -(a + b) * 2 + 30 / 5 -> -24"""
        res = process_formula("-(a + b) * 2 + 30 / 5", {"a": 10, "b": 5})
        self.assertEqual(res.result, -24)
        self.assertEqual(res.formatted_result, "-24")
        self.assertEqual(res.postfix_str, "a b + neg 2 * 30 5 / +")
        # Verify trace contains intermediate calculations
        subexpressions = [s.subexpression_evaluated for s in res.eval_trace]
        self.assertTrue(any("15" in s for s in subexpressions))
        self.assertTrue(any("-15" in s for s in subexpressions))
        self.assertTrue(any("-30" in s for s in subexpressions))
        self.assertTrue(any("6" in s for s in subexpressions))
        self.assertTrue(any("-24" in s for s in subexpressions))

    def test_precedence_and_associativity(self):
        """Tests standard operator precedence and left-associativity."""
        # Precedence: * before +
        self.assertEqual(process_formula("2 + 3 * 4").result, 14)
        self.assertEqual(process_formula("2 * 3 + 4").result, 10)
        # Left associativity of subtraction: (10 - 4) - 2 = 4, NOT 10 - (4 - 2) = 8
        self.assertEqual(process_formula("10 - 4 - 2").result, 4)
        # Left associativity of division: (24 / 4) / 2 = 3, NOT 24 / (4 / 2) = 12
        self.assertEqual(process_formula("24 / 4 / 2").result, 3)

    def test_unary_minus_variations(self):
        """Tests various forms of unary minus."""
        # Simple unary minus at start
        self.assertEqual(process_formula("-5").result, -5)
        self.assertEqual(process_formula("-5 + 10").result, 5)
        # Unary minus after binary operator
        self.assertEqual(process_formula("5 * -2").result, -10)
        self.assertEqual(process_formula("10 + -3").result, 7)
        self.assertEqual(process_formula("10 - -3").result, 13)
        # Double unary minus
        self.assertEqual(process_formula("- - 5").result, 5)
        self.assertEqual(process_formula("-(-a)", {"a": 42}).result, 42)
        # Unary minus with parenthesis
        self.assertEqual(process_formula("-(3 + 2)").result, -5)

    def test_unicode_operators(self):
        """Tests unicode mathematical operators (−, ×, ÷)."""
        self.assertEqual(process_formula("15 − 7").result, 8)
        self.assertEqual(process_formula("6 × 7").result, 42)
        self.assertEqual(process_formula("36 ÷ 6").result, 6)
        self.assertEqual(process_formula("−(10 × 2) ÷ 4").result, -5)

    def test_decimals_and_real_division(self):
        """Tests floating-point numbers and real-valued division."""
        self.assertAlmostEqual(process_formula("10 / 4").result, 2.5)
        self.assertAlmostEqual(process_formula("3.5 * 2.0").result, 7.0)
        self.assertAlmostEqual(process_formula("0.1 + 0.2").result, 0.3, places=5)
        self.assertAlmostEqual(process_formula("100.5 / 2.5").result, 40.2)

    def test_nested_parentheses(self):
        """Tests deeply nested expressions with variables."""
        expr = "((a + b) * (c - (d / e)))"
        vars_dict = {"a": 2, "b": 3, "c": 10, "d": 8, "e": 2}
        # (2 + 3) * (10 - (8 / 2)) = 5 * (10 - 4) = 5 * 6 = 30
        self.assertEqual(process_formula(expr, vars_dict).result, 30)

    def test_unseen_complex_astronomy_formula(self):
        """Tests an unseen astronomy formula with variables, nested parens, and negative values."""
        expr = "((flux_raw - -15.5) * -damping) / (airmass + (elevation_deg / -45.0))"
        vars_dict = {"flux_raw": 24.5, "damping": 2, "airmass": 10.0, "elevation_deg": 270.0}
        # flux_raw - -15.5 = 24.5 + 15.5 = 40.0
        # 40.0 * -2 = -80.0
        # elevation_deg / -45.0 = 270.0 / -45.0 = -6.0
        # airmass + -6.0 = 10.0 - 6.0 = 4.0
        # -80.0 / 4.0 = -20.0
        res = process_formula(expr, vars_dict)
        self.assertAlmostEqual(res.result, -20.0)
        self.assertEqual(res.formatted_result, "-20")
        self.assertIn("Var(flux_raw = 24.5)", res.tree_text)
        self.assertIn("Var(damping = 2)", res.tree_text)

    def test_expression_tree_structure(self):
        """Tests AST tree structure and class types."""
        res = process_formula("-(a + 2)", {"a": 5})
        self.assertIsInstance(res.tree, UnaryOpNode)
        self.assertEqual(res.tree.op, "-")
        self.assertIsInstance(res.tree.operand, BinaryOpNode)
        self.assertEqual(res.tree.operand.op, "+")
        self.assertIsInstance(res.tree.operand.left, VariableNode)
        self.assertEqual(res.tree.operand.left.name, "a")
        self.assertIsInstance(res.tree.operand.right, NumberNode)
        self.assertEqual(res.tree.operand.right.value, 2)

    def test_traces_are_generated(self):
        """Verifies that both Shunting-Yard trace and intermediate calculation trace are non-empty."""
        res = process_formula("10 + 20 * 3")
        self.assertTrue(len(res.shunting_trace) > 0)
        self.assertTrue(len(res.eval_trace) > 0)
        for s in res.shunting_trace:
            self.assertTrue(s.action)
        for s in res.eval_trace:
            self.assertTrue(s.subexpression_evaluated)

    def test_high_token_count_scaling(self):
        """Tests scaling up to 1000 tokens efficiently."""
        terms = ["1"] * 500
        expr = " + ".join(terms)  # 500 numbers + 499 operators = 999 tokens
        res = process_formula(expr)
        self.assertEqual(res.result, 500)

    # ---------------- ERROR HANDLING REJECTION TESTS ----------------

    def test_reject_invalid_token(self):
        """Rejects unknown symbols with specific LexerError."""
        with self.assertRaises(LexerError) as ctx:
            process_formula("10 + $5")
        self.assertIn("Invalid token '$'", str(ctx.exception))
        self.assertEqual(ctx.exception.position, 5)

    def test_reject_multiple_decimal_points(self):
        """Rejects numbers with multiple decimal points."""
        with self.assertRaises(LexerError) as ctx:
            process_formula("3.14.15 + 2")
        self.assertIn("multiple decimal points", str(ctx.exception))

    def test_reject_unmatched_opening_parenthesis(self):
        """Rejects unclosed opening parenthesis with specific ParserError."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("(a + b * 2", {"a": 1, "b": 2})
        self.assertIn("Unmatched opening parenthesis", str(ctx.exception))

    def test_reject_unmatched_closing_parenthesis(self):
        """Rejects extra closing parenthesis with specific ParserError."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("a + b) * 2", {"a": 1, "b": 2})
        self.assertIn("Unexpected closing parenthesis", str(ctx.exception))

    def test_reject_empty_parentheses(self):
        """Rejects empty parentheses '()'."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("a + () * b", {"a": 1, "b": 2})
        self.assertIn("Empty expression inside parentheses", str(ctx.exception))

    def test_reject_empty_expression(self):
        """Rejects empty or whitespace-only expressions."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("   ")
        self.assertIn("empty", str(ctx.exception).lower())

    def test_reject_consecutive_binary_operators(self):
        """Rejects consecutive binary operators like '+ *'."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("5 + * 3")
        self.assertIn("Unexpected operator '*'", str(ctx.exception))

    def test_reject_leading_binary_operator(self):
        """Rejects binary operator at the start of expression."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("* 5 + 3")
        self.assertIn("Expression cannot start with operator '*'", str(ctx.exception))

    def test_reject_trailing_operator(self):
        """Rejects trailing operator at end of expression."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("5 + 3 -")
        self.assertIn("Unexpected end of expression after operator '-'", str(ctx.exception))

    def test_reject_missing_operator_between_operands(self):
        """Rejects adjacent operands missing an operator."""
        with self.assertRaises(ParserError) as ctx:
            process_formula("5 4")
        self.assertIn("Missing operator", str(ctx.exception))

        with self.assertRaises(ParserError) as ctx:
            process_formula("(a + b) c", {"a": 1, "b": 2, "c": 3})
        self.assertIn("Missing operator", str(ctx.exception))

    def test_reject_undefined_variable(self):
        """Rejects undefined variables with list of available variables."""
        with self.assertRaises(UndefinedVariableError) as ctx:
            process_formula("a + b + c", {"a": 10, "b": 20})
        self.assertIn("Undefined variable 'c'", str(ctx.exception))
        self.assertIn("Available variables: a, b", str(ctx.exception))

    def test_reject_division_by_zero_direct(self):
        """Rejects direct division by zero with specific message."""
        with self.assertRaises(DivisionByZeroError) as ctx:
            process_formula("42 / 0")
        self.assertIn("Division by zero", str(ctx.exception))

    def test_reject_division_by_zero_evaluated_subexpression(self):
        """Rejects division by zero when divisor evaluates to zero."""
        with self.assertRaises(DivisionByZeroError) as ctx:
            process_formula("100 / (5 - 5)")
        self.assertIn("Division by zero", str(ctx.exception))
        self.assertIn("evaluated to 0", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
