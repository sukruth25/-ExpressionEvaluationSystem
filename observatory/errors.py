"""
The Observatory's Untrustworthy Formulas - Expression Processing System
Custom Exceptions with precise source location reporting.
"""

from typing import Optional


class ObservatoryError(Exception):
    """Base class for all observatory formula errors."""

    def __init__(self, message: str, expression: Optional[str] = None, position: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.expression = expression
        self.position = position

    def format_diagnostic(self) -> str:
        """Produce a friendly, formatted diagnostic message with a caret."""
        lines = [f"Error: {self.message}"]
        if self.expression is not None and self.position is not None:
            lines.append("")
            lines.append(f"  {self.expression}")
            caret_pos = max(0, min(self.position, len(self.expression)))
            lines.append(f"  {' ' * caret_pos}^")
            lines.append(f"  (at position {self.position + 1})")
        return "\n".join(lines)


class LexerError(ObservatoryError):
    """Raised when an unrecognized character or token is encountered."""
    pass


class ParserError(ObservatoryError):
    """Raised when expression syntax, bracket matching, or operator placement is invalid."""
    pass


class EvaluationError(ObservatoryError):
    """Raised during evaluation (e.g. division by zero, undefined variable)."""
    pass


class UndefinedVariableError(EvaluationError):
    """Raised when an expression references a variable not present in the environment."""
    def __init__(self, var_name: str, expression: Optional[str] = None, position: Optional[int] = None, known_vars: Optional[dict] = None):
        known = f" Available variables: {', '.join(sorted(known_vars.keys()))}" if known_vars else " No variables defined."
        super().__init__(f"Undefined variable '{var_name}'.{known}", expression, position)
        self.var_name = var_name


class DivisionByZeroError(EvaluationError):
    """Raised when an arithmetic division by zero occurs."""
    def __init__(self, message: str = "Division by zero encountered.", expression: Optional[str] = None, position: Optional[int] = None):
        super().__init__(message, expression, position)
