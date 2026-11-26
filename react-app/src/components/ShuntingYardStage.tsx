import { LayoutGroup, motion } from "framer-motion";
import type { EvalStep, ParseStep, Token } from "../engine";

export interface StageSnapshot {
  input: Token[];
  stack: Token[];
  output: Token[];
}

interface ShuntingYardStageProps {
  snapshot: StageSnapshot;
  narration: string;
  annotation: string;
  stepIndex: number;
  maxIndex: number;
  phase: "ready" | "parse" | "eval" | "complete" | "halted";
  activeParse?: ParseStep;
  activeEval?: EvalStep;
  errorTokenId?: number;
}

const TOKEN_MOTION = {
  duration: 0.52,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

function tokenLabel(token: Token): string {
  return token.raw;
}

function TokenChip({
  token,
  active,
  trigger,
  error,
}: {
  token: Token;
  active: boolean;
  trigger: boolean;
  error: boolean;
}) {
  const isBoundary = token.type === "lparen" || token.type === "rparen";
  const classes = active
    ? "border-ochre/80 bg-[#F7EBD9] text-ink shadow-[inset_0_-2px_0_#C47521]"
    : error
      ? "border-rust/60 bg-[#F3DFD9] text-ink shadow-[inset_0_-2px_0_#A8462E]"
      : trigger
        ? "border-indigo/45 bg-[#DDE9E9] text-ink"
        : "border-hairline bg-ivory text-ink";

  return (
    <motion.div
      layoutId={`token-${token.id}`}
      layout
      transition={TOKEN_MOTION}
      className={`relative inline-flex h-9 items-center justify-center border font-mono text-[13.5px] tabular-nums transition-colors duration-300 lg:h-10 lg:text-[14.5px] ${
        isBoundary ? "min-w-7 px-1.5 text-slate" : "min-w-9 px-2 lg:min-w-10"
      } ${classes}`}
      title={
        token.type === "operator" && token.unary
          ? `Unary ${token.raw}`
          : token.type === "operator"
            ? `Binary ${token.raw}`
            : token.raw
      }
    >
      {tokenLabel(token)}
      {token.type === "operator" && token.unary ? (
        <span className="absolute -right-0.5 -top-1 font-sans text-[8px] leading-none text-ochre">
          u
        </span>
      ) : null}
    </motion.div>
  );
}

function ZoneHeader({
  title,
  note,
  accent,
}: {
  title: string;
  note: string;
  accent: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <span className={`h-1.5 w-1.5 ${accent}`} />
        {title}
      </span>
      <span className="text-[11.5px] text-slate/60">{note}</span>
    </div>
  );
}

export function ShuntingYardStage({
  snapshot,
  narration,
  annotation,
  stepIndex,
  maxIndex,
  phase,
  activeParse,
  activeEval,
  errorTokenId,
}: ShuntingYardStageProps) {
  const focusId = activeParse?.focusTokenId ?? activeEval?.tokenId;
  const triggerId = activeParse?.triggerTokenId;
  const dotColor =
    phase === "halted"
      ? "bg-rust"
      : phase === "complete"
        ? "bg-sage"
        : phase === "eval"
          ? "bg-sage"
          : phase === "parse"
            ? "bg-ochre"
            : "bg-indigo";
  const progress = maxIndex === 0 ? 0 : (stepIndex / maxIndex) * 100;

  return (
    <div className="mt-7 overflow-hidden border border-hairline bg-ivory">
      <div className="bg-indigo px-5 py-6 text-paper sm:px-8 sm:py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 className="font-serif text-[2rem] leading-none text-paper sm:text-[2.35rem]">
              Shunting-yard stage
            </h3>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-paper/75">
              Read left to right. Tokens enter the stack, then leave in postfix
              order.
            </p>
          </div>
          <p className="font-mono text-[11.5px] tabular-nums text-paper/80">
            Step {stepIndex} of {maxIndex}
          </p>
        </div>
        <div className="mt-5 h-[3px] w-full bg-paper/15">
          <motion.div
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="h-full bg-ochre"
          />
        </div>
      </div>

      <LayoutGroup>
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.8fr_1.15fr]">
          <div className="flex min-h-[200px] flex-col border-b border-hairline bg-mint px-5 py-6 sm:px-7 lg:min-h-[300px] lg:border-b-0 lg:border-r">
            <ZoneHeader
              title="Input stream"
              note="unread tokens"
              accent="bg-ochre"
            />
            <div className="mt-5 flex flex-1 flex-wrap content-start gap-2 lg:gap-2.5">
              {snapshot.input.length > 0 ? (
                snapshot.input.map((token) => (
                  <TokenChip
                    key={token.id}
                    token={token}
                    active={token.id === focusId}
                    trigger={token.id === triggerId}
                    error={token.id === errorTokenId}
                  />
                ))
              ) : (
                <p className="pt-1 font-serif text-[15px] italic text-slate/55">
                  Input exhausted.
                </p>
              )}
            </div>
            {activeParse?.triggerTokenId !== undefined &&
            snapshot.input.some(
              (token) => token.id === activeParse.triggerTokenId,
            ) ? (
              <p className="mt-4 text-[11.5px] text-slate/60">
                Reading the highlighted token next.
              </p>
            ) : null}
          </div>

          <div className="flex min-h-[200px] flex-col border-b border-hairline bg-glacier px-5 py-6 sm:px-7 lg:min-h-[300px] lg:border-b-0 lg:border-r">
            <ZoneHeader
              title="Operator stack"
              note="top first"
              accent="bg-indigo"
            />
            <div className="relative mt-5 flex flex-1 flex-col items-start gap-2 lg:gap-2.5">
              {snapshot.stack.length > 0 ? (
                snapshot.stack
                  .slice()
                  .reverse()
                  .map((token) => (
                    <TokenChip
                      key={token.id}
                      token={token}
                      active={token.id === focusId}
                      trigger={token.id === triggerId}
                      error={token.id === errorTokenId}
                    />
                  ))
              ) : (
                <div className="flex flex-1 items-start pt-1">
                  <p className="font-serif text-[15px] italic text-slate/55">
                    Stack is empty.
                  </p>
                </div>
              )}
              <div className="mt-auto w-full pt-5">
                <div className="h-px w-14 bg-slate/25" />
                <p className="mt-1.5 text-[10.5px] text-slate/45">base</p>
              </div>
            </div>
          </div>

          <div className="flex min-h-[200px] flex-col bg-reed px-5 py-6 sm:px-7 lg:min-h-[300px]">
            <ZoneHeader
              title="Postfix queue"
              note="output order"
              accent="bg-sage"
            />
            <div className="mt-5 flex flex-1 flex-wrap content-start gap-2 lg:gap-2.5">
              {snapshot.output.length > 0 ? (
                snapshot.output.map((token) => (
                  <TokenChip
                    key={token.id}
                    token={token}
                    active={token.id === focusId}
                    trigger={token.id === triggerId}
                    error={token.id === errorTokenId}
                  />
                ))
              ) : (
                <p className="pt-1 font-serif text-[15px] italic text-slate/55">
                  Waiting for operands.
                </p>
              )}
            </div>
          </div>
        </div>
      </LayoutGroup>

      <div className="border-t border-hairline bg-[#F2F7F2] px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-4">
          <span
            className={`mt-2.5 h-2 w-2 shrink-0 rounded-full ${dotColor} ${
              phase === "parse" || phase === "eval" ? "stage-enter" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-slate/65">{annotation}</p>
            <motion.p
              key={`${activeParse?.id ?? activeEval?.id ?? phase}-${stepIndex}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-1.5 max-w-4xl font-serif text-[1.35rem] leading-snug text-ink sm:text-[1.55rem] lg:text-[1.7rem]"
              aria-live="polite"
            >
              {narration}
            </motion.p>
          </div>
          {activeParse?.action ? (
            <span className="hidden shrink-0 font-mono text-[11px] text-slate/50 sm:block">
              {activeParse.action}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
