# The Observatory's Untrustworthy Formulas

A single-page instrument for watching an arithmetic expression become tokens,
postfix order, an operator stack, and a reduction tree. Every parser move and
every intermediate value is recorded, so the whole calculation can be scrubbed
forward and backward.

No `eval()`, no `Function()`, and no third-party expression parser.

## Run

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

```bash
npm run build      # type-check and produce dist/
npm run preview    # serve the production build
npm run engine:check
npm run engine:check -- "2 * (a + (b - 3) * (4 - 1))"
```

`engine:check` prints the postfix form, parse trace, ASCII tree, reduction
ledger, final value, and all verification outcomes for the given expression
(variables default to `a = 10`, `b = 5`).

## Engine

The engine is plain TypeScript in `src/engine/` and has no React imports. The UI
only observes its recorded steps.

| File | Responsibility |
| --- | --- |
| `tokenizer.ts` | Numbers, variables, `+ - * /`, parentheses, unary detection, 2,000-token cap, exact invalid-character columns |
| `parser.ts` | Shunting-yard parse with a discrete step for every push, pop, output append, and boundary discard |
| `ast.ts` | AST construction, operator formatting, ASCII tree rendering, node lookup |
| `evaluator.ts` | Post-order reduction, real division, intermediate values tied to node IDs |
| `compile.ts` | One pipeline: tokenize → parse → build → evaluate |
| `verification.ts` | Deterministic case suite plus expected/actual comparison |
| `cli.ts` | Framework-free inspection entry point |

Diagnostics cover invalid characters, the token limit, missing or mismatched
parentheses, empty parentheses, undefined variables, malformed operator
sequences, and division by zero (including a denominator that only becomes zero
during evaluation).

## Interface

- Formula line with inline token highlighting and a live variable ledger.
- Transport controls: reset, step back, play/pause, step forward, scrubber, and
  1×/2× speed.
- Animated shunting-yard stage with input stream, operator stack, and postfix
  queue.
- Animated SVG expression tree with Bézier edges, resolved values beside
  operators, and a copyable ASCII alternative.
- Collapsible verification drawer that runs the same cases as the CLI.

Stack: React 18, TypeScript, Tailwind CSS, Framer Motion, Vite. Fonts are
Newsreader, Instrument Sans, and JetBrains Mono.
