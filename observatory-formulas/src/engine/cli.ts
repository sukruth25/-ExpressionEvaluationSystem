/**
 * Framework-free inspection CLI.
 *
 *   npm run engine:check
 *   npm run engine:check -- "2 * (a + (b - 3) * (4 - 1))"
 *
 * The same tokenizer, parser, tree builder, and evaluator used by the browser.
 */
import { expressionToAscii } from "./ascii";
import { compileExpression } from "./compile";
import { formatNumber } from "./format";
import { describeExpected, runVerificationSuite } from "./verification";

const expression = process.argv[2] ?? "-(a + b) * 2 + 30 / 5";
const variables = { a: 10, b: 5 };

const result = compileExpression(expression, variables);

console.log("THE OBSERVATORY · ENGINE INSPECTION");
console.log("───────────────────────────────────");
console.log(`formula   ${expression}`);
console.log(
  `ledger    ${Object.entries(variables)
    .map(([key, value]) => `${key} = ${formatNumber(value)}`)
    .join(", ")}`,
);
console.log(`tokens    ${result.tokens.length}`);
console.log(`status    ${result.status}`);
console.log("");

if (result.diagnostics.length > 0) {
  for (const diagnostic of result.diagnostics) {
    console.log(
      `! ${diagnostic.code} at column ${diagnostic.column}: ${diagnostic.message}`,
    );
    if (diagnostic.detail) console.log(`  ${diagnostic.detail}`);
  }
  console.log("");
} else {
  console.log("POSTFIX");
  console.log(result.postfix.map((token) => token.raw).join(" "));
  console.log("");

  console.log("PARSE TRACE");
  result.steps.forEach((step, index) => {
    console.log(`${String(index + 1).padStart(2, "0")}  ${step.narration}`);
  });
  console.log("");

  if (result.ast) {
    console.log("TREE");
    console.log(expressionToAscii(result.ast, result.evalValues));
    console.log("");

    console.log("REDUCTION");
    result.evalSteps.forEach((step, index) => {
      console.log(
        `${String(index + 1).padStart(2, "0")}  ${step.kind.toUpperCase().padEnd(7)} ${step.calculation ?? step.expression}`,
      );
    });
    console.log("");
    console.log(
      `VALUE     ${result.value === undefined ? "undefined" : formatNumber(result.value)}`,
    );
    console.log("");
  }
}

console.log("VERIFICATION SUITE");
let failed = 0;
for (const outcome of runVerificationSuite()) {
  if (!outcome.pass) failed += 1;
  const expected = describeExpected(outcome.test);
  const actual = outcome.actual;
  console.log(
    `${(outcome.pass ? "PASS" : "FAIL").padEnd(5)} ${outcome.test.label.padEnd(28)} expected ${expected.padEnd(24)} actual ${actual}`,
  );
}
console.log("");
console.log(
  failed === 0
    ? `All ${runVerificationSuite().length} checks passed. No eval() or Function() was used.`
    : `${failed} check(s) failed.`,
);

if (failed > 0) process.exitCode = 1;
