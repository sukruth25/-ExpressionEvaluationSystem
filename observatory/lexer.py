"""
Lexer for the Observatory Expression Evaluator.
Tokenizes expressions containing +, −, ×, ÷, numbers, variables, and parentheses.
"""

from typing import List, Optional
from observatory.tokens import Token, TokenType
from observatory.errors import LexerError

MAX_TOKENS = 2000

# Mapping of operator characters (including unicode variants)
OPERATOR_MAP = {
    '+': TokenType.PLUS,
    '-': TokenType.MINUS,
    '\u2212': TokenType.MINUS,  # Unicode minus sign '−'
    '*': TokenType.MULTIPLY,
    '\u00d7': TokenType.MULTIPLY,  # Unicode multiplication sign '×'
    '/': TokenType.DIVIDE,
    '\u00f7': TokenType.DIVIDE,  # Unicode division sign '÷'
    '(': TokenType.LPAREN,
    ')': TokenType.RPAREN,
}


def tokenize(expression: str) -> List[Token]:
    """
    Tokenizes a mathematical expression string into a list of Tokens.
    Distinguishes unary minus/plus from binary minus/plus based on context.
    Raises LexerError on invalid characters or invalid numeric formats.
    """
    tokens: List[Token] = []
    i = 0
    n = len(expression)
    last_token: Optional[Token] = None

    while i < n:
        ch = expression[i]

        # Skip whitespace
        if ch.isspace():
            i += 1
            continue

        start_pos = i

        # Check for parentheses
        if ch == '(':
            tok = Token(TokenType.LPAREN, '(', '(', start_pos)
            tokens.append(tok)
            last_token = tok
            i += 1
            continue

        if ch == ')':
            tok = Token(TokenType.RPAREN, ')', ')', start_pos)
            tokens.append(tok)
            last_token = tok
            i += 1
            continue

        # Check for operators (+, -, *, / and unicode variants)
        if ch in OPERATOR_MAP:
            op_type = OPERATOR_MAP[ch]

            # Determine if + or - is unary or binary
            if op_type == TokenType.MINUS:
                is_unary = (
                    last_token is None
                    or last_token.is_operator
                    or last_token.type == TokenType.LPAREN
                )
                if is_unary:
                    tok = Token(TokenType.UNARY_MINUS, 'neg', ch, start_pos)
                else:
                    tok = Token(TokenType.MINUS, '-', ch, start_pos)
            elif op_type == TokenType.PLUS:
                is_unary = (
                    last_token is None
                    or last_token.is_operator
                    or last_token.type == TokenType.LPAREN
                )
                if is_unary:
                    tok = Token(TokenType.UNARY_PLUS, 'pos', ch, start_pos)
                else:
                    tok = Token(TokenType.PLUS, '+', ch, start_pos)
            else:
                tok = Token(op_type, ch, ch, start_pos)

            tokens.append(tok)
            last_token = tok
            i += 1
            continue

        # Check for numbers (integers or floating-point decimals)
        if ch.isdigit() or (ch == '.' and i + 1 < n and expression[i + 1].isdigit()):
            num_chars = []
            dot_count = 0
            while i < n and (expression[i].isdigit() or expression[i] == '.'):
                if expression[i] == '.':
                    dot_count += 1
                    if dot_count > 1:
                        # Scan the rest of the malformed number for clear error display
                        bad_num = "".join(num_chars) + expression[i]
                        i += 1
                        while i < n and (expression[i].isdigit() or expression[i] == '.'):
                            bad_num += expression[i]
                            i += 1
                        raise LexerError(
                            f"Invalid number format '{bad_num}' with multiple decimal points",
                            expression,
                            start_pos,
                        )
                num_chars.append(expression[i])
                i += 1

            num_str = "".join(num_chars)
            # Parse as float or int
            val = float(num_str) if '.' in num_str else int(num_str)
            tok = Token(TokenType.NUMBER, val, num_str, start_pos)
            tokens.append(tok)
            last_token = tok
            continue

        # Check for identifiers (named variables: letters and underscores)
        if ch.isalpha() or ch == '_':
            id_chars = []
            while i < n and (expression[i].isalnum() or expression[i] == '_'):
                id_chars.append(expression[i])
                i += 1
            var_name = "".join(id_chars)
            tok = Token(TokenType.IDENTIFIER, var_name, var_name, start_pos)
            tokens.append(tok)
            last_token = tok
            continue

        # Unrecognized character
        raise LexerError(
            f"Invalid token '{ch}' (unrecognized character)",
            expression,
            start_pos,
        )

    if len(tokens) > MAX_TOKENS:
        raise LexerError(
            f"Expression exceeds the maximum allowed token count of {MAX_TOKENS} (found {len(tokens)} tokens)",
            expression,
            0,
        )

    return tokens
