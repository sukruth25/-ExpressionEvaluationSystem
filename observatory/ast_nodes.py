"""
Abstract Syntax Tree (AST) node representations for mathematical expressions.
Includes visual text-based tree rendering.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class ExprNode(ABC):
    """Abstract base class for all expression tree nodes."""

    @abstractmethod
    def to_tree_lines(self, prefix: str = "", is_tail: bool = True, var_values: Optional[Dict[str, Any]] = None) -> List[str]:
        """Returns a list of strings representing the text tree with box-drawing characters."""
        pass

    @abstractmethod
    def to_string(self) -> str:
        """Returns an infix string representation of the subtree."""
        pass

    def render_tree(self, var_values: Optional[Dict[str, Any]] = None) -> str:
        """Renders the full text-based tree as a readable multiline string."""
        return "\n".join(self.to_tree_lines(prefix="", is_tail=True, var_values=var_values))


class NumberNode(ExprNode):
    """Leaf node representing a constant numeric value."""

    def __init__(self, value: float | int):
        self.value = value

    def to_tree_lines(self, prefix: str = "", is_tail: bool = True, var_values: Optional[Dict[str, Any]] = None) -> List[str]:
        connector = "└── " if is_tail else "├── "
        return [f"{prefix}{connector}Num({self.value})"]

    def to_string(self) -> str:
        return str(self.value)

    def __repr__(self) -> str:
        return f"NumberNode({self.value})"


class VariableNode(ExprNode):
    """Leaf node representing a named variable."""

    def __init__(self, name: str):
        self.name = name

    def to_tree_lines(self, prefix: str = "", is_tail: bool = True, var_values: Optional[Dict[str, Any]] = None) -> List[str]:
        connector = "└── " if is_tail else "├── "
        val_str = ""
        if var_values is not None and self.name in var_values:
            val_str = f" = {var_values[self.name]}"
        return [f"{prefix}{connector}Var({self.name}{val_str})"]

    def to_string(self) -> str:
        return self.name

    def __repr__(self) -> str:
        return f"VariableNode({self.name!r})"


class UnaryOpNode(ExprNode):
    """Node representing a unary operator (e.g. unary minus 'neg')."""

    def __init__(self, op: str, operand: ExprNode):
        self.op = op
        self.operand = operand

    def to_tree_lines(self, prefix: str = "", is_tail: bool = True, var_values: Optional[Dict[str, Any]] = None) -> List[str]:
        connector = "└── " if is_tail else "├── "
        op_label = f"Unary({self.op})"
        lines = [f"{prefix}{connector}{op_label}"]
        extension = "    " if is_tail else "│   "
        lines.extend(self.operand.to_tree_lines(prefix + extension, is_tail=True, var_values=var_values))
        return lines

    def to_string(self) -> str:
        operand_str = self.operand.to_string()
        if isinstance(self.operand, (BinaryOpNode, UnaryOpNode)):
            return f"-({operand_str})"
        return f"-{operand_str}"

    def __repr__(self) -> str:
        return f"UnaryOpNode({self.op!r}, {self.operand!r})"


class BinaryOpNode(ExprNode):
    """Node representing a binary operator (+, -, *, /)."""

    def __init__(self, op: str, left: ExprNode, right: ExprNode):
        self.op = op
        self.left = left
        self.right = right

    def to_tree_lines(self, prefix: str = "", is_tail: bool = True, var_values: Optional[Dict[str, Any]] = None) -> List[str]:
        connector = "└── " if is_tail else "├── "
        lines = [f"{prefix}{connector}Op({self.op})"]
        extension = "    " if is_tail else "│   "
        lines.extend(self.left.to_tree_lines(prefix + extension, is_tail=False, var_values=var_values))
        lines.extend(self.right.to_tree_lines(prefix + extension, is_tail=True, var_values=var_values))
        return lines

    def to_string(self) -> str:
        return f"({self.left.to_string()} {self.op} {self.right.to_string()})"

    def __repr__(self) -> str:
        return f"BinaryOpNode({self.op!r}, {self.left!r}, {self.right!r})"
