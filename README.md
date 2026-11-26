# 🔭 The Observatory's Untrustworthy Formulas
### Expression Evaluation, Trace & Visualization System

A robust, fully transparent mathematical expression processing and evaluation system designed specifically for the volunteers at the observatory. It eliminates calculation ambiguity by providing:
1. **Accurate Arithmetic Results** strictly respecting operator precedence and associativity without using `eval()`.
2. **Infix-to-Postfix (Shunting-Yard) Parsing Trace** recording token-by-token operator stack and output queue transitions.
3. **Readable Text-Based Expression Trees (AST)** displaying subexpression hierarchy with box-drawing characters and variable bindings.
4. **Step-by-Step Intermediate Calculations Trace** showing exact subexpressions evaluated, variable substitutions, and evaluation stack snapshots.
5. **High-Precision Diagnostic Error Reporting** pin-pointing invalid tokens, missing/unmatched brackets, undefined variables, and division-by-zero with visual caret pointers (`^`).

---

## 🚀 Key Features & Capabilities

- **Supported Operators**:
  - Addition (`+`), Subtraction (`-`, unicode `−`), Multiplication (`*`, unicode `×`), Division (`/`, unicode `÷`).
  - Unary minus (`-(a + b)`, `-5`, `5 * -2`, `--a`).
  - Nested parentheses at arbitrary depth.
  - Named variables (e.g., `a`, `b`, `flux_raw`, `elevation_deg`) assigned integer or decimal values.
- **Dijkstra's Shunting-Yard Algorithm**:
  - Converts infix notation to Postfix (Reverse Polish Notation) with full trace history.
- **Pure Arithmetic Evaluator**:
  - **Zero use of `eval()` or string evaluators**.
  - Evaluates postfix stack with step-by-step intermediate calculation log.
- **Diagnostic Error Handling**:
  - Rejects unknown tokens (e.g. `$`, `@`, `^`).
  - Rejects mismatched, unclosed, or unexpected parentheses.
  - Rejects empty parentheses `()`.
  - Rejects consecutive binary operators (e.g. `10 + * 5`) or trailing operators (`a + b -`).
  - Rejects undefined variables with lists of known variables.
  - Rejects division by zero (both direct constants `100 / 0` and dynamically evaluated zero divisors `50 / (zenith - 45)`).
- **Multiple Interfaces**:
  - **Rich CLI**: Formatted tables, trees, and panels via `observatory_cli.py`.
  - **Interactive REPL**: Variable assignment (`let a = 10`), formula calculation, and real-time trace inspection.
  - **Zero-Dependency Web GUI**: Beautiful browser interface running on standard library `http.server`.

---

## 📋 Quick Start

### 1. Direct Evaluation via CLI
```bash
python3 observatory_cli.py "-(a + b) * 2 + 30 / 5" --var a=10 --var b=5
```
Or with plain text formatting:
```bash
python3 observatory_cli.py "-(a + b) * 2 + 30 / 5" --var a=10 --var b=5 --plain
```

### 2. Run Comprehensive Demonstration
Runs the illustrative example (`-24`), an unseen complex formula with negative values, and 10 malformed test cases:
```bash
python3 observatory_cli.py --demo
```

### 3. Interactive REPL Shell
```bash
python3 observatory_cli.py
```
Inside the interactive shell:
```
observatory> let a = 10
observatory> let b = 5
observatory> -(a + b) * 2 + 30 / 5
observatory> vars
observatory> demo
```

### 4. Interactive Web Interface
Launch the local web server:
```bash
python3 observatory_cli.py --web
# Open http://localhost:8080 in your web browser
```

---

## 🧪 Running Automated Tests

Run the full test suite (26 comprehensive tests covering precedence, associativity, unary minus, decimals, unicode operators, traces, and specific error rejections):
```bash
python3 -m unittest discover tests -v
```

---

## 📐 Illustrative Example Walkthrough

**Expression**: `-(a + b) * 2 + 30 / 5` with `a = 10, b = 5`

### 1. Generated Postfix (RPN)
```
a b + neg 2 * 30 5 / +
```

### 2. Expression Tree
```
└── Op(+)
    ├── Op(*)
    │   ├── Unary(-)
    │   │   └── Op(+)
    │   │       ├── Var(a = 10)
    │   │       └── Var(b = 5)
    │   └── Num(2)
    └── Op(/)
        ├── Num(30)
        └── Num(5)
```

### 3. Intermediate Calculation Steps
1. `Resolve a -> 10`
2. `Resolve b -> 5`
3. `(a + b) = 10 + 5 = 15`
4. `Unary negate: -((a + b)) -> -15`
5. `Push 2`
6. `(-((a + b)) * 2) = -15 * 2 = -30`
7. `Push 30`
8. `Push 5`
9. `(30 / 5) = 6`
10. `((-((a + b)) * 2) + (30 / 5)) = -30 + 6 = -24`

**Verified Accurate Result**: `-24`
