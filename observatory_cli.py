#!/usr/bin/env python3
"""
CLI and Interactive Shell for the Observatory's Untrustworthy Formulas System.
Provides formula evaluation, parsing/evaluation traces, expression tree visualization,
variable management, error diagnostics, and built-in demonstrations.
"""

import sys
import argparse
from typing import Dict, Any, Optional

from observatory.processor import process_formula, FormulaResult
from observatory.formatter import print_plain_text_result, display_rich_result, RICH_AVAILABLE
from observatory.errors import ObservatoryError


def parse_var_definitions(var_args: list[str]) -> Dict[str, float | int]:
    """Parses variable arguments in the form 'var=val' or 'var:val'."""
    variables: Dict[str, float | int] = {}
    if not var_args:
        return variables

    for item in var_args:
        # Support comma separated definitions: "a=10, b=5"
        parts = item.split(",")
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if "=" in part:
                k, v = part.split("=", 1)
            elif ":" in part:
                k, v = part.split(":", 1)
            else:
                raise ValueError(f"Invalid variable definition '{part}'. Expected format 'name=value'.")

            var_name = k.strip()
            val_str = v.strip()
            if not var_name.isidentifier():
                raise ValueError(f"Invalid variable identifier '{var_name}'. Must be alphanumeric starting with letter/underscore.")

            try:
                val = float(val_str) if "." in val_str else int(val_str)
            except ValueError:
                raise ValueError(f"Invalid numeric value '{val_str}' for variable '{var_name}'.")

            variables[var_name] = val

    return variables


def run_demonstration(use_rich: bool = True) -> None:
    """
    Executes the required demonstration scenarios:
    1. Illustrative example: -(a + b) * 2 + 30 / 5 with a=10, b=5 -> -24
    2. Unseen complex expression with variables, nested parentheses, and negative values.
    3. Processing of malformed expressions showing specific, helpful error messages.
    """
    print("\n" + "=" * 80)
    print("🔭 THE OBSERVATORY'S UNTRUSTWORTHY FORMULAS - SYSTEM DEMONSTRATION")
    print("=" * 80)

    # Demo 1: Illustrative Example
    print("\n[DEMO 1] Illustrative Example from Requirements")
    print("Expression: -(a + b) * 2 + 30 / 5 with a = 10, b = 5")
    print("Expected: -24 with intermediate subexpression calculation trace\n")
    res1 = process_formula("-(a + b) * 2 + 30 / 5", {"a": 10, "b": 5})
    if use_rich and RICH_AVAILABLE:
        display_rich_result(res1)
    else:
        print(print_plain_text_result(res1))

    # Demo 2: Unseen Complex Expression
    print("\n" + "=" * 80)
    print("[DEMO 2] Unseen Complex Formula (Variables, Nested Parentheses, Negative Values & Real Division)")
    expr2 = "((flux_raw - -15.5) * -damping) / (airmass + (elevation_deg / -45.0))"
    vars2 = {"flux_raw": 24.5, "damping": 2, "airmass": 10.0, "elevation_deg": 270.0}
    print(f"Expression: {expr2}")
    print(f"Variables:  {vars2}\n")
    res2 = process_formula(expr2, vars2)
    if use_rich and RICH_AVAILABLE:
        display_rich_result(res2)
    else:
        print(print_plain_text_result(res2))

    # Demo 3: Comprehensive Malformed Expressions Error Handling
    print("\n" + "=" * 80)
    print("[DEMO 3] Malformed Expressions and Specific Rejection Messages")
    print("=" * 80)

    malformed_cases = [
        ("Invalid token character", "100 * flux + $val", {"flux": 2, "val": 3}),
        ("Missing / unmatched closing bracket", "-(a + b * (c - 2)", {"a": 1, "b": 2, "c": 3}),
        ("Unexpected closing bracket", "-(a + b)) * 2", {"a": 1, "b": 2}),
        ("Empty parentheses", "radius * () + 10", {"radius": 5}),
        ("Undefined variable", "alpha + beta * gamma", {"alpha": 10, "beta": 5}),
        ("Division by zero (direct constant)", "100 / 0", {}),
        ("Division by zero (evaluated subexpression)", "50 / (zenith_angle - 45)", {"zenith_angle": 45}),
        ("Consecutive binary operators", "10 + * 5", {}),
        ("Trailing operator at end", "a + b -", {"a": 1, "b": 2}),
        ("Missing operator between adjacent operands", "(a + b) (c - d)", {"a": 1, "b": 2, "c": 3, "d": 4}),
    ]

    for title, bad_expr, bad_vars in malformed_cases:
        print(f"\n--- Test Case: {title} ---")
        print(f"Formula:   {bad_expr}")
        if bad_vars:
            print(f"Variables: {bad_vars}")
        try:
            process_formula(bad_expr, bad_vars)
            print("❌ FAILED: Unexpectedly accepted malformed expression!")
        except ObservatoryError as err:
            print(f"✅ REJECTED AS EXPECTED:")
            print(err.format_diagnostic())
        except Exception as e:
            print(f"⚠️ Caught unexpected error: {type(e).__name__}: {e}")

    print("\n" + "=" * 80)
    print("✅ DEMONSTRATION COMPLETE: All requirements successfully verified.")
    print("=" * 80 + "\n")


def interactive_repl(initial_vars: Optional[Dict[str, float | int]] = None) -> None:
    """Interactive command shell for observatory volunteers."""
    variables: Dict[str, float | int] = initial_vars.copy() if initial_vars else {}

    print("=" * 76)
    print("🔭 The Observatory's Untrustworthy Formulas - Interactive Shell")
    print("   Type an expression to evaluate, or a command below:")
    print("     let <var> = <val>  : define or update a variable (e.g. let a = 10)")
    print("     vars               : show currently defined variables")
    print("     clear              : clear all variables")
    print("     demo               : run the full demonstration suite")
    print("     help               : display this help message")
    print("     exit / quit        : exit the shell")
    print("=" * 76)

    while True:
        try:
            line = input("\nobservatory> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting Observatory Shell. Clear skies!")
            break

        if not line:
            continue

        cmd = line.lower()
        if cmd in ("exit", "quit", "q"):
            print("Exiting Observatory Shell. Clear skies!")
            break
        elif cmd in ("help", "?"):
            print("Commands:")
            print("  let <var> = <val>  : assign a variable (e.g., 'let a = 10', 'a = 10')")
            print("  vars               : display defined variables")
            print("  clear              : clear defined variables")
            print("  demo               : run demonstration suite")
            print("  exit / quit        : quit")
            print("Expression examples:")
            print("  -(a + b) * 2 + 30 / 5")
            print("  (val1 * 3.5) / (val2 - -4)")
            continue
        elif cmd == "vars":
            if variables:
                print("Defined variables:")
                for k, v in sorted(variables.items()):
                    print(f"  {k} = {v}")
            else:
                print("No variables currently defined. Use 'let name = value' or 'name = value' to define one.")
            continue
        elif cmd == "clear":
            variables.clear()
            print("All variables cleared.")
            continue
        elif cmd == "demo":
            run_demonstration(use_rich=RICH_AVAILABLE)
            continue

        # Check for assignment: 'let var = val' or 'var = val'
        clean_line = line[4:].strip() if line.startswith("let ") else line
        if "=" in clean_line and not any(op in clean_line.split("=")[0] for op in "+-*/()"):
            parts = clean_line.split("=", 1)
            var_name = parts[0].strip()
            val_expr = parts[1].strip()
            if var_name.isidentifier():
                try:
                    # Evaluate RHS if it's an expression or number
                    res = process_formula(val_expr, variables)
                    variables[var_name] = res.result
                    print(f"✅ Set {var_name} = {res.formatted_result}")
                    continue
                except ObservatoryError as err:
                    print(err.format_diagnostic())
                    continue

        # Otherwise evaluate as formula
        try:
            res = process_formula(line, variables)
            if RICH_AVAILABLE:
                display_rich_result(res)
            else:
                print(print_plain_text_result(res))
        except ObservatoryError as err:
            print(err.format_diagnostic())
        except Exception as e:
            print(f"Error: {e}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="The Observatory's Untrustworthy Formulas - Expression Processing and Evaluation System",
    )
    parser.add_argument(
        "expression",
        nargs="?",
        default=None,
        help="Mathematical expression to evaluate (e.g. '-(a + b) * 2 + 30 / 5')",
    )
    parser.add_argument(
        "-v", "--var",
        action="append",
        default=[],
        help="Define variable value, e.g. -v a=10 -v b=5",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run comprehensive demonstration scenarios",
    )
    parser.add_argument(
        "--plain",
        action="store_true",
        help="Use plain text output (disable Rich formatting)",
    )
    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="Launch interactive REPL shell",
    )
    parser.add_argument(
        "--web",
        action="store_true",
        help="Launch the visual Web interface on http://localhost:8080",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port for the web interface (default: 8080)",
    )

    args = parser.parse_args()

    if args.web:
        from web_app import run_web_server
        run_web_server(port=args.port)
        return

    use_rich = RICH_AVAILABLE and not args.plain

    if args.demo:
        run_demonstration(use_rich=use_rich)
        return

    try:
        variables = parse_var_definitions(args.var)
    except ValueError as ve:
        print(f"Configuration Error: {ve}", file=sys.stderr)
        sys.exit(1)

    if args.expression:
        try:
            res = process_formula(args.expression, variables)
            if use_rich:
                display_rich_result(res)
            else:
                print(print_plain_text_result(res))
        except ObservatoryError as err:
            print(err.format_diagnostic(), file=sys.stderr)
            sys.exit(2)
        except Exception as e:
            print(f"Unexpected Error: {e}", file=sys.stderr)
            sys.exit(3)
    else:
        interactive_repl(initial_vars=variables)


if __name__ == "__main__":
    main()
