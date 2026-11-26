import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef } from "react";
import type { CompileResult, Diagnostic, Token } from "../engine";
import { isVariableName } from "../engine";
import type { Preset, VariableRow } from "../model";
import { PRESETS } from "../model";
import { CloseIcon, PlusIcon } from "./Icons";

interface FormulaBarProps {
  expression: string;
  onExpressionChange: (value: string) => void;
  variables: VariableRow[];
  variableIssues: Record<string, string>;
  focusVariableId?: string;
  onVariableChange: (
    id: string,
    field: "name" | "value",
    value: string,
  ) => void;
  onAddVariable: () => void;
  onRemoveVariable: (id: string) => void;
  onLoadPreset: (preset: Preset) => void;
  result: CompileResult;
  activeTokenId?: number;
  secondaryTokenId?: number;
}

interface Segment {
  text: string;
  token?: Token;
}

function buildSegments(expression: string, tokens: Token[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.start > cursor) {
      segments.push({ text: expression.slice(cursor, token.start) });
    }
    segments.push({
      text: expression.slice(token.start, token.end),
      token,
    });
    cursor = token.end;
  }

  if (cursor < expression.length) {
    segments.push({ text: expression.slice(cursor) });
  }

  return segments;
}

function tokenClassName(
  token: Token,
  activeTokenId: number | undefined,
  secondaryTokenId: number | undefined,
  diagnostic: Diagnostic | undefined,
): string {
  const isActive = token.id === activeTokenId;
  const isSecondary = token.id === secondaryTokenId;
  const isError = diagnostic?.tokenId === token.id;

  if (isActive) {
    return "rounded-[2px] bg-ochre/[0.11] text-ink shadow-[inset_0_-2px_0_#C47521]";
  }
  if (isError) {
    return "rounded-[2px] bg-rust/[0.08] text-ink shadow-[inset_0_-2px_0_#A8462E]";
  }
  if (isSecondary) {
    return "rounded-[2px] bg-indigo/[0.07] text-ink shadow-[inset_0_-1.5px_0_rgba(31,72,84,0.55)]";
  }
  return "text-ink";
}

function diagnosticLabel(diagnostic: Diagnostic): string {
  return `${diagnostic.code} · column ${diagnostic.column}`;
}

export function FormulaBar({
  expression,
  onExpressionChange,
  variables,
  variableIssues,
  focusVariableId,
  onVariableChange,
  onAddVariable,
  onRemoveVariable,
  onLoadPreset,
  result,
  activeTokenId,
  secondaryTokenId,
}: FormulaBarProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const segments = useMemo(
    () => buildSegments(expression, result.tokens),
    [expression, result.tokens],
  );

  const diagnostic = result.diagnostics[0];
  const isOk = result.status === "ok";
  const activePreset = PRESETS.find(
    (preset) => preset.expression === expression,
  );
  const varNames = variables
    .map((row) => row.name)
    .filter((name) => isVariableName(name));

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-5">
        <div className="hidden shrink-0 select-none pb-3 font-serif text-3xl italic leading-none text-slate/70 sm:block">
          ƒ({varNames.slice(0, 4).join(", ")}
          {varNames.length > 4 ? ", …" : ""}) =
        </div>

        <div className="group relative min-w-0 flex-1">
          <div className="relative">
            <input
              ref={inputRef}
              value={expression}
              onChange={(event) => {
                onExpressionChange(event.target.value);
                if (overlayRef.current) overlayRef.current.scrollLeft = 0;
              }}
              onScroll={(event) => {
                if (overlayRef.current) {
                  overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }
              }}
              aria-label="Mathematical expression"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              className="formula-editor relative z-10 w-full border-0 bg-transparent px-0 pb-3 pt-1 font-mono text-[clamp(1.45rem,4vw,2.55rem)] font-medium leading-[1.35] tracking-[-0.035em] tabular-nums text-transparent caret-ink outline-none selection:bg-ochre/20"
            />
            <div
              ref={overlayRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre px-0 pb-3 pt-1 font-mono text-[clamp(1.45rem,4vw,2.55rem)] font-medium leading-[1.35] tracking-[-0.035em] tabular-nums"
            >
              {segments.length > 0 ? (
                segments.map((segment, index) =>
                  segment.token ? (
                    <span
                      key={`${segment.token.id}-${index}`}
                      className={`transition-colors duration-200 ${tokenClassName(
                        segment.token,
                        activeTokenId,
                        secondaryTokenId,
                        diagnostic,
                      )}`}
                    >
                      {segment.text}
                    </span>
                  ) : (
                    <span key={`raw-${index}`}>{segment.text}</span>
                  ),
                )
              ) : (
                <span className="text-slate/45">Enter a formula…</span>
              )}
            </div>
          </div>
          <div className="h-px w-full bg-hairline transition-colors duration-300 group-focus-within:bg-indigo" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate">
        <span className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isOk ? "bg-sage" : "bg-rust"
            }`}
          />
          <span className={isOk ? "text-sage" : "text-rust"}>
            {isOk
              ? "Well-formed"
              : diagnostic
                ? `Halted · ${diagnostic.title}`
                : "Halted"}
          </span>
        </span>
        <span className="text-slate/55">·</span>
        <span>{result.tokens.length} tokens</span>
        <span className="ml-auto hidden text-slate/45 md:inline">
          No eval(), no Function(), no parser dependency.
        </span>
      </div>

      <AnimatePresence initial={false}>
        {diagnostic ? (
          <motion.div
            key={`${diagnostic.code}-${diagnostic.column}-${diagnostic.message}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-6 border-l-2 border-rust bg-rust/[0.025] py-1 pl-4 sm:pl-5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-[11px] text-rust">
                  Diagnostic {diagnosticLabel(diagnostic)}
                </span>
                <span className="text-[11px] text-slate/65">
                  {diagnostic.tokenRaw
                    ? `Offending span “${diagnostic.tokenRaw}”`
                    : "End of formula"}
                </span>
              </div>
              <p className="mt-2 font-serif text-[1.45rem] leading-tight text-ink">
                {diagnostic.title}
              </p>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate">
                {diagnostic.message}
              </p>
              {diagnostic.detail ? (
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate/85">
                  {diagnostic.detail}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate/70">
                {diagnostic.tokenRaw ? (
                  <code className="border border-rust/25 bg-paper px-2 py-0.5 font-mono text-[11px] text-rust">
                    {diagnostic.tokenRaw}
                  </code>
                ) : null}
                <span className="font-mono text-[11px]">
                  Character {diagnostic.column}
                </span>
                {diagnostic.hint ? (
                  <span className="italic">{diagnostic.hint}</span>
                ) : null}
              </div>
              {result.diagnostics.length > 1 ? (
                <p className="mt-3 text-[11px] text-rust/80">
                  {result.diagnostics.length - 1} additional diagnostic
                  {result.diagnostics.length - 1 === 1 ? "" : "s"} at column
                  {result.diagnostics.length - 1 === 1 ? " " : "s "}
                  {result.diagnostics
                    .slice(1, 5)
                    .map((item) => item.column)
                    .join(", ")}
                  {result.diagnostics.length > 5 ? "…" : ""}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-8 flex flex-col gap-6 border-t border-hairline pt-5 lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium text-slate">
              Variable ledger
            </span>
            <span className="h-px flex-1 bg-hairline" />
            <button
              type="button"
              onClick={onAddVariable}
              className="group flex items-center gap-1.5 text-[12px] text-indigo transition-colors hover:text-ochre focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
            >
              <PlusIcon size={12} />
              Add variable
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-start gap-x-7 gap-y-3">
            <AnimatePresence initial={false}>
            {variables.map((row) => {
              const issue = variableIssues[row.id];
              return (
                <motion.div
                  layout
                  key={row.id}
                  initial={{ opacity: 0, y: -5, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="group/variable relative"
                >
                  <div className="flex items-center gap-1.5 font-mono text-[15px] tabular-nums">
                    <input
                      value={row.name}
                      onChange={(event) =>
                        onVariableChange(row.id, "name", event.target.value)
                      }
                      aria-label={`Name for variable ${row.name || "row"}`}
                      spellCheck={false}
                      autoComplete="off"
                      autoFocus={row.id === focusVariableId}
                      className={`min-w-[1ch] border-b bg-transparent pb-0.5 text-right text-slate outline-none transition-colors focus:border-indigo focus:text-indigo ${
                        issue ? "border-rust/60" : "border-hairline"
                      }`}
                      style={{
                        width: `${Math.max(row.name.length, 1) + 0.6}ch`,
                      }}
                    />
                    <span className="text-slate/45">=</span>
                    <input
                      value={row.value}
                      onChange={(event) =>
                        onVariableChange(row.id, "value", event.target.value)
                      }
                      aria-label={`Value for ${row.name || "variable"}`}
                      inputMode="decimal"
                      spellCheck={false}
                      autoComplete="off"
                      className={`w-[5.5ch] border-b bg-transparent pb-0.5 text-ink outline-none transition-colors focus:border-indigo ${
                        issue ? "border-rust/60" : "border-hairline"
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveVariable(row.id)}
                    aria-label={`Remove variable ${row.name}`}
                    className="absolute -right-4 top-0.5 text-slate/35 opacity-0 transition-opacity hover:text-rust focus-visible:opacity-100 focus-visible:outline-none group-hover/variable:opacity-100"
                  >
                    <CloseIcon size={11} />
                  </button>
                  {issue ? (
                    <p className="mt-1 max-w-[18ch] font-mono text-[9px] leading-snug text-rust">
                      {issue}
                    </p>
                  ) : null}
                </motion.div>
              );
            })}
            </AnimatePresence>

            {variables.length === 0 ? (
              <p className="font-serif text-sm italic text-slate/65">
                No names bound. The formula may still use literals.
              </p>
            ) : null}
          </div>
        </div>

        <div className="hidden h-14 w-px shrink-0 bg-hairline lg:block" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium text-slate">
              Load a specimen
            </span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
            {PRESETS.map((preset) => {
              const active = activePreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onLoadPreset(preset)}
                  title={preset.note}
                  className={`border px-2.5 py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
                    active
                      ? "border-ochre/70 bg-ochre/[0.08] text-ink"
                      : "border-hairline bg-transparent text-slate hover:border-indigo/35 hover:text-indigo"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 max-w-xl font-serif text-[13px] italic leading-snug text-slate/65">
            {activePreset?.note ??
              "Each specimen carries its own variable ledger and diagnostic posture."}
          </p>
        </div>
      </div>
    </div>
  );
}
