"""
Token definitions for the Observatory expression evaluator.
"""

from enum import Enum, auto
from dataclasses import dataclass
from typing import Any, Optional


class TokenType(Enum):
    NUMBER = auto()
    IDENTIFIER = auto()
    PLUS = auto()
    MINUS = auto()
    MULTIPLY = auto()
    DIVIDE = auto()
    UNARY_MINUS = auto()
    UNARY_PLUS = auto()
    LPAREN = auto()
    RPAREN = auto()
    EOF = auto()


@dataclass
class Token:
    type: TokenType
    value: Any
    raw: str
    position: int  # 0-indexed column in the original expression

    def __repr__(self) -> str:
        return f"Token({self.type.name}, {self.raw!r}, pos={self.position})"

    @property
    def is_operator(self) -> bool:
        return self.type in (
            TokenType.PLUS,
            TokenType.MINUS,
            TokenType.MULTIPLY,
            TokenType.DIVIDE,
            TokenType.UNARY_MINUS,
            TokenType.UNARY_PLUS,
        )

    @property
    def is_operand(self) -> bool:
        return self.type in (TokenType.NUMBER, TokenType.IDENTIFIER)
