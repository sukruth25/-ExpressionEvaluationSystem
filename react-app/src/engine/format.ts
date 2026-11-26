/** Human-facing number formatting, kept in the engine so the CLI matches the UI. */
export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "∞";
  if (value === Number.NEGATIVE_INFINITY) return "−∞";
  if (Object.is(value, -0)) return "0";

  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude >= 1e12 || magnitude < 1e-7)) {
    return value
      .toExponential(6)
      .replace(/\.?0+e/, "e")
      .replace("e+", "e");
  }

  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}

export function displayOperator(operator: string): string {
  if (operator === "-" || operator === "u-") return "−";
  if (operator === "*") return "×";
  if (operator === "/") return "÷";
  return operator;
}
