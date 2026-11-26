"""
Demonstration Test Script satisfying all Demonstration Requirements:
1. Evaluate one unseen expression with variables, nested parentheses and negative values.
2. Process malformed expressions and verify specific rejection error messages.
3. Verify that eval() or equivalent string evaluators are not used anywhere.
"""

import os
import ast
import unittest
from observatory.processor import process_formula
from observatory.errors import (
    ObservatoryError,
    LexerError,
    ParserError,
    UndefinedVariableError,
    DivisionByZeroError,
)


class TestDemonstrationRequirements(unittest.TestCase):

    def test_verify_no_eval_used_in_codebase(self):
        """
        Parses all Python source files in the observatory package using the AST module,
        and strictly verifies that neither eval() nor exec() is called anywhere.
        """
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        observatory_dir = os.path.join(base_dir, "observatory")

        for root, _, files in os.walk(observatory_dir):
            for file in files:
                if file.endswith(".py"):
                    file_path = os.path.join(root, file)
                    with open(file_path, "r", encoding="utf-8") as f:
                        tree = ast.parse(f.read(), filename=file)

                    for node in ast.walk(tree):
                        if isinstance(node, ast.Call):
                            if isinstance(node.func, ast.Name):
                                self.assertNotIn(
                                    node.func.id,
                                    ("eval", "exec"),
                                    f"Forbidden function call {node.func.id}() found in {file} at line {node.lineno}",
                                )

    def test_unseen_expression_with_variables_nested_parens_and_negative_values(self):
        """
        Unseen expression:
        ((zenith_flux - -12.25) * -calibration_k) / (airmass + (elevation_deg / -30.0))
        Variables:
          zenith_flux = 17.75
          calibration_k = 4
          airmass = 15.0
          elevation_deg = 180.0

        Manual verification:
        1. zenith_flux - -12.25 = 17.75 - (-12.25) = 30.0
        2. -calibration_k = -4
        3. (30.0 * -4) = -120.0
        4. elevation_deg / -30.0 = 180.0 / -30.0 = -6.0
        5. airmass + -6.0 = 15.0 - 6.0 = 9.0
        6. -120.0 / 9.0 = -13.333333... (-40/3)
        """
        expr = "((zenith_flux - -12.25) * -calibration_k) / (airmass + (elevation_deg / -30.0))"
        vars_dict = {
            "zenith_flux": 17.75,
            "calibration_k": 4,
            "airmass": 15.0,
            "elevation_deg": 180.0,
        }

        res = process_formula(expr, vars_dict)

        self.assertAlmostEqual(res.result, -13.333333, places=5)
        self.assertEqual(res.formatted_result, "-13.3333")

        # Verify trace has intermediate calculations
        self.assertTrue(len(res.eval_trace) > 0)
        self.assertTrue(len(res.shunting_trace) > 0)

        # Verify expression tree exists
        self.assertIn("zenith_flux = 17.75", res.tree_text)
        self.assertIn("calibration_k = 4", res.tree_text)

    def test_malformed_expression_rejections(self):
        """Tests rejection of malformed expressions with specific descriptive messages."""
        # Malformed 1: Mismatched parentheses
        with self.assertRaises(ParserError) as ctx:
            process_formula("((a + b) * 2", {"a": 1, "b": 2})
        self.assertIn("Unmatched opening parenthesis", str(ctx.exception))

        # Malformed 2: Invalid token
        with self.assertRaises(LexerError) as ctx:
            process_formula("a + @ + b", {"a": 1, "b": 2})
        self.assertIn("Invalid token '@'", str(ctx.exception))

        # Malformed 3: Division by zero in subexpression
        with self.assertRaises(DivisionByZeroError) as ctx:
            process_formula("50 / (temp - 25)", {"temp": 25})
        self.assertIn("Division by zero", str(ctx.exception))

        # Malformed 4: Undefined variable
        with self.assertRaises(UndefinedVariableError) as ctx:
            process_formula("a + unassigned_sensor", {"a": 10})
        self.assertIn("Undefined variable 'unassigned_sensor'", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
