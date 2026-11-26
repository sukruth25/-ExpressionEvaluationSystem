import { MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Diagnostic,
  EvalStep,
  ParseStep,
  VerificationCase,
  VerificationOutcome,
} from "./engine";
import {
  compileExpression,
  formatNumber,
  isVariableName,
  runVerificationCase,
  VERIFICATION_CASES,
} from "./engine";
import { Astrolabe } from "./components/Astrolabe";
import { ExpressionTree } from "./components/ExpressionTree";
import { FormulaBar } from "./components/FormulaBar";
import { ArrowRightIcon, FlaskIcon } from "./components/Icons";
import { PlaybackBar } from "./components/PlaybackBar";
import { ShuntingYardStage, type StageSnapshot } from "./components/ShuntingYardStage";
import { VerificationDrawer } from "./components/VerificationDrawer";
import {
  DEFAULT_EXPRESSION,
  type Preset,
  type VariableRow,
} from "./model";

let rowSequence = 0;

function nextRowId(): string {
  rowSequence += 1;
  return `variable-row-${rowSequence}`;
}

function rowsFromRecord(record: Record<string, number>): VariableRow[] {
  return Object.entries(record).map(([name, value]) => ({
    id: nextRowId(),
    name,
    value: formatNumber(value),
  }));
}

const INITIAL_VARIABLES = rowsFromRecord({ a: 10, b: 5 });

function variablesToRecord(rows: VariableRow[]): Record<string, number> {
  const record: Record<string, number> = {};
  for (const row of rows) {
    const name = row.name.trim();
    const value = row.value.trim();
    if (!isVariableName(name) || value === "") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) record[name] = numeric;
  }
  return record;
}

function variableIssuesFor(rows: VariableRow[]): Record<string, string> {
  const issues: Record<string, string> = {};
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.name.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  for (const row of rows) {
    const name = row.name.trim();
    const value = row.value.trim();
    if (!name) {
      issues[row.id] = "Give the variable a name.";
    } else if (!isVariableName(name)) {
      issues[row.id] = "Start with a letter; use letters, digits, or _.";
    } else if ((counts.get(name) ?? 0) > 1) {
      issues[row.id] = "This name is used more than once.";
    } else if (value === "" || !Number.isFinite(Number(value))) {
      issues[row.id] = "Enter a finite number.";
    }
  }

  return issues;
}

function makeVariableName(rows: VariableRow[]): string {
  const used = new Set(rows.map((row) => row.name.trim()));
  for (const name of ["c", "d", "e", "f", "g", "h", "i", "j"]) {
    if (!used.has(name)) return name;
  }
  let index = 1;
  while (used.has(`v${index}`)) index += 1;
  return `v${index}`;
}

type Phase = "ready" | "parse" | "eval" | "complete" | "halted";

export default function App() {
  const [expression, setExpression] = useState(DEFAULT_EXPRESSION);
  const [variables, setVariables] = useState<VariableRow[]>(INITIAL_VARIABLES);
  const [focusVariableId, setFocusVariableId] = useState<string | undefined>();
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [outcomes, setOutcomes] = useState<
    Record<string, VerificationOutcome>
  >({});

  const variableRecord = useMemo(
    () => variablesToRecord(variables),
    [variables],
  );
  const variableIssues = useMemo(
    () => variableIssuesFor(variables),
    [variables],
  );
  const result = useMemo(
    () => compileExpression(expression, variableRecord),
    [expression, variableRecord],
  );

  const parseCount = result.steps.length;
  const evalCount = result.evalSteps.length;
  const maxIndex = parseCount + evalCount;
  const diagnostic: Diagnostic | undefined = result.diagnostics[0];

  const activeParse: ParseStep | undefined =
    stepIndex > 0 && stepIndex <= parseCount
      ? result.steps[stepIndex - 1]
      : undefined;
  const activeEval: EvalStep | undefined =
    stepIndex > parseCount
      ? result.evalSteps[stepIndex - parseCount - 1]
      : undefined;

  const lastParseStep = result.steps[result.steps.length - 1];
  const snapshot: StageSnapshot = activeParse
    ? {
        input: activeParse.input,
        stack: activeParse.stack,
        output: activeParse.output,
      }
    : stepIndex > parseCount && lastParseStep
      ? {
          input: lastParseStep.input,
          stack: lastParseStep.stack,
          output: lastParseStep.output,
        }
      : {
          input: result.tokens,
          stack: [],
          output: [],
        };

  const evalProgress = Math.max(
    0,
    Math.min(stepIndex - parseCount, evalCount),
  );
  const visibleEvalSteps = result.evalSteps.slice(0, evalProgress);

  const phase: Phase = (() => {
    if (stepIndex === 0) return "ready";
    if (activeParse) return "parse";
    if (activeEval) {
      if (activeEval.kind === "error") return "halted";
      if (stepIndex >= maxIndex && result.status === "ok") return "complete";
      return "eval";
    }
    if (result.diagnostics.length > 0) return "halted";
    return "ready";
  })();

  const isComplete =
    maxIndex > 0 &&
    stepIndex === maxIndex &&
    result.status === "ok" &&
    result.value !== undefined;

  const narration = (() => {
    if (activeParse) return activeParse.narration;
    if (activeEval) {
      if (activeEval.kind === "error") return activeEval.narration;
      if (stepIndex >= maxIndex && result.status === "ok") {
        return `${activeEval.narration} The tree is fully reduced.`;
      }
      return activeEval.narration;
    }
    if (stepIndex === 0) {
      if (result.diagnostics.length > 0 && result.steps.length === 0) {
        return "The formula could not enter the parser. Repair the diagnostic below, then replay.";
      }
      return "Press Play or step forward to watch the shunting-yard pass. Every move is recorded.";
    }
    return "Choose a step to inspect the trace.";
  })();

  const annotation =
    phase === "complete"
      ? "Complete"
      : activeParse?.annotation ??
        activeEval?.annotation ??
        (phase === "halted" ? "Halted" : phase === "ready" ? "Ready" : "Trace");

  const phaseLabel =
    phase === "ready"
      ? "Ready to parse"
      : phase === "parse"
        ? "Shunting-yard pass"
        : phase === "eval"
          ? "Post-order reduction"
          : phase === "complete"
            ? "Reduction complete"
            : "Evaluation halted";

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [expression, variables]);

  useEffect(() => {
    if (!playing) return;
    if (maxIndex === 0 || stepIndex >= maxIndex) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setStepIndex((index) => Math.min(index + 1, maxIndex)),
      1050 / speed,
    );
    return () => window.clearTimeout(timer);
  }, [playing, stepIndex, maxIndex, speed]);

  const handleTogglePlay = useCallback(() => {
    if (maxIndex === 0) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (stepIndex >= maxIndex) setStepIndex(0);
    setPlaying(true);
  }, [maxIndex, playing, stepIndex]);

  const handleStep = useCallback(
    (direction: -1 | 1) => {
      setPlaying(false);
      setStepIndex((index) =>
        Math.max(0, Math.min(maxIndex, index + direction)),
      );
    },
    [maxIndex],
  );

  const handleReset = useCallback(() => {
    setPlaying(false);
    setStepIndex(0);
  }, []);

  const handleScrub = useCallback((value: number) => {
    setPlaying(false);
    setStepIndex(value);
  }, []);

  const handleExpressionChange = useCallback((value: string) => {
    setExpression(value);
    setFocusVariableId(undefined);
  }, []);

  const handleVariableChange = useCallback(
    (id: string, field: "name" | "value", value: string) => {
      setVariables((rows) =>
        rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const handleAddVariable = useCallback(() => {
    const row: VariableRow = {
      id: nextRowId(),
      name: makeVariableName(variables),
      value: "0",
    };
    setVariables((rows) => [...rows, row]);
    setFocusVariableId(row.id);
  }, [variables]);

  const handleRemoveVariable = useCallback((id: string) => {
    setVariables((rows) => rows.filter((row) => row.id !== id));
    setFocusVariableId((current) => (current === id ? undefined : current));
  }, []);

  const handleLoadPreset = useCallback((preset: Preset) => {
    setExpression(preset.expression);
    if (preset.variables) setVariables(rowsFromRecord(preset.variables));
    setFocusVariableId(undefined);
  }, []);

  const handleJumpToNode = useCallback(
    (nodeId: string) => {
      const evalIndex = result.evalSteps.findIndex(
        (step) => step.nodeId === nodeId,
      );
      if (evalIndex < 0) return;
      setPlaying(false);
      setStepIndex(parseCount + evalIndex + 1);
    },
    [parseCount, result.evalSteps],
  );

  const runAllChecks = useCallback(() => {
    const next: Record<string, VerificationOutcome> = {};
    for (const test of VERIFICATION_CASES) {
      next[test.id] = runVerificationCase(test);
    }
    setOutcomes(next);
  }, []);

  const runOneCheck = useCallback((test: VerificationCase) => {
    setOutcomes((current) => ({
      ...current,
      [test.id]: runVerificationCase(test),
    }));
  }, []);

  const activeTokenId = activeParse?.focusTokenId ?? activeEval?.tokenId;
  const secondaryTokenId = activeParse?.triggerTokenId;

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-paper">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-hairline bg-[#E8F1EB]"
      >
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
          <div className="flex items-baseline justify-between gap-6 border-b border-hairline py-4 text-[12px] text-slate">
            <p>The Observatory · instrument no. 07</p>
            <button
              type="button"
              onClick={() => setSuiteOpen(true)}
              className="text-slate transition-colors hover:text-indigo focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
            >
              Verification suite
            </button>
          </div>

          <div className="grid gap-10 pb-10 pt-9 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-end lg:gap-16 lg:pb-12">
            <div>
              <p className="max-w-lg text-[13px] leading-relaxed text-slate">
                A working instrument for watching a formula become tokens,
                postfix, and a tree. Scrub the trace; question the arithmetic.
              </p>
              <h1 className="mt-5 max-w-[900px] font-serif text-[clamp(3.1rem,7.4vw,6.9rem)] font-normal leading-[0.9] tracking-[-0.045em] text-ink">
                The Observatory’s
                <br />
                <span className="italic text-sage">Untrustworthy</span> Formulas
              </h1>
              <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate">
                Every operator move and every intermediate value is recorded.
                Nothing is evaluated by the browser’s code engine; the whole
                apparatus is visible.
              </p>
            </div>
            <Astrolabe />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="pt-10 sm:pt-12"
          aria-labelledby="formula-heading"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="font-serif text-[1.5rem] italic text-ochre/85">
              01
            </span>
            <h2
              id="formula-heading"
              className="font-serif text-[2.1rem] leading-none text-ink sm:text-[2.45rem]"
            >
              The formula
            </h2>
            <p className="ml-auto hidden text-[12px] text-slate/55 md:block">
              Edit the line or load a specimen.
            </p>
          </div>

          <FormulaBar
            expression={expression}
            onExpressionChange={handleExpressionChange}
            variables={variables}
            variableIssues={variableIssues}
            focusVariableId={focusVariableId}
            onVariableChange={handleVariableChange}
            onAddVariable={handleAddVariable}
            onRemoveVariable={handleRemoveVariable}
            onLoadPreset={handleLoadPreset}
            result={result}
            activeTokenId={activeTokenId}
            secondaryTokenId={secondaryTokenId}
          />

          <div className="mt-8">
            <PlaybackBar
              stepIndex={stepIndex}
              maxIndex={maxIndex}
              playing={playing}
              speed={speed}
              phaseLabel={phaseLabel}
              onTogglePlay={handleTogglePlay}
              onStep={handleStep}
              onReset={handleReset}
              onScrub={handleScrub}
              onSpeedChange={setSpeed}
            />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 sm:mt-20"
          aria-labelledby="trace-heading"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="font-serif text-[1.65rem] italic text-sage/85">
              02
            </span>
            <h2
              id="trace-heading"
              className="font-serif text-[2.5rem] leading-none text-ink sm:text-[2.9rem]"
            >
              Trace the movement
            </h2>
            <p className="ml-auto hidden max-w-sm text-right text-[12.5px] leading-relaxed text-slate/60 md:block">
              The stack holds precedence; the queue holds the sentence.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-slate">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-ochre" />
              Input stream
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-indigo" />
              Operator stack
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-sage" />
              Postfix queue
            </span>
            <span className="ml-auto hidden text-[11.5px] text-slate/50 lg:inline">
              {result.steps.length} parse moves · {result.evalSteps.length}{" "}
              reductions
            </span>
          </div>

          <ShuntingYardStage
            snapshot={snapshot}
            narration={narration}
            annotation={annotation}
            stepIndex={stepIndex}
            maxIndex={maxIndex}
            phase={phase}
            activeParse={activeParse}
            activeEval={activeEval}
            errorTokenId={diagnostic?.tokenId}
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 sm:mt-20"
          aria-labelledby="tree-heading"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="font-serif text-[1.5rem] italic text-indigo/80">
              03
            </span>
            <h2
              id="tree-heading"
              className="font-serif text-[2.1rem] leading-none text-ink sm:text-[2.45rem]"
            >
              Reduce the tree
            </h2>
            <p className="ml-auto hidden text-[12px] text-slate/55 md:block">
              Click a resolved operator to jump to its reduction.
            </p>
          </div>

          <ExpressionTree
            ast={result.ast}
            expression={expression}
            visibleEvalSteps={visibleEvalSteps}
            activeEvalStep={activeEval}
            finalValue={result.value}
            isComplete={isComplete}
            diagnostic={diagnostic}
            onJumpToNode={handleJumpToNode}
          />
        </motion.section>

        <footer className="mt-20 border-t-2 border-indigo/20 pt-8 sm:mt-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)] lg:gap-16">
            <div>
              <p className="text-[12px] text-slate">Method</p>
              <p className="mt-2 max-w-2xl font-serif text-[2rem] leading-[1.1] text-ink sm:text-[2.35rem]">
                No eval. No Function. No hidden parser.
              </p>
              <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-slate">
                The tokenizer, shunting-yard parser, tree builder, and evaluator
                live in <code className="font-mono text-[13px] text-ink">src/engine</code>{" "}
                as framework-agnostic TypeScript. The interface only observes
                their recorded steps.
              </p>
            </div>

            <div className="border-t border-hairline pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <button
                type="button"
                onClick={() => setSuiteOpen(true)}
                className="group flex items-center gap-3 text-left font-serif text-[1.45rem] leading-tight text-ink transition-colors hover:text-indigo focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
              >
                <FlaskIcon size={17} />
                Open the verification suite
                <ArrowRightIcon
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </button>
              <p className="mt-3 text-[12px] leading-relaxed text-slate">
                Eleven checks cover precedence, unary minus, nesting, decimals,
                malformed sequences, invalid tokens, unbound names, and
                division by zero.
              </p>
              <p className="mt-4 text-[12px] leading-relaxed text-slate/60">
                For inspection from a terminal:{" "}
                <code className="font-mono text-[11px] text-ink">
                  npm run engine:check
                </code>
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-hairline pt-5 text-[11px] text-slate/45">
            <span>Sea glass · quiet arithmetic</span>
            <span>React, TypeScript, Tailwind CSS, Framer Motion</span>
            <span>No third-party expression parser</span>
          </div>
        </footer>
      </main>

      <VerificationDrawer
        open={suiteOpen}
        onClose={() => setSuiteOpen(false)}
        outcomes={outcomes}
        onRunAll={runAllChecks}
        onRunOne={runOneCheck}
        cases={VERIFICATION_CASES}
      />
    </div>
    </MotionConfig>
  );
}
