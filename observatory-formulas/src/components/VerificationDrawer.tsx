import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { VerificationCase, VerificationOutcome } from "../engine";
import { describeExpected } from "../engine";
import { CloseIcon, PlayIcon } from "./Icons";

interface VerificationDrawerProps {
  open: boolean;
  onClose: () => void;
  outcomes: Record<string, VerificationOutcome>;
  onRunAll: () => void;
  onRunOne: (test: VerificationCase) => void;
  cases: VerificationCase[];
}

export function VerificationDrawer({
  open,
  onClose,
  outcomes,
  onRunAll,
  onRunOne,
  cases,
}: VerificationDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const runCount = Object.keys(outcomes).length;
  const passCount = Object.values(outcomes).filter(
    (outcome) => outcome.pass,
  ).length;
  const allRun = runCount === cases.length;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80]">
          <motion.button
            type="button"
            aria-label="Close verification suite"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 h-full w-full cursor-default bg-indigo/25"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-0 flex h-full w-full max-w-[600px] flex-col border-l border-hairline bg-ivory shadow-paperlift"
          >
            <header className="border-b border-hairline bg-mint px-6 py-6 sm:px-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[12px] text-slate">
                    Deterministic checks against the same engine
                  </p>
                  <h2
                    id="verification-title"
                    className="mt-1 font-serif text-[2.2rem] leading-none text-ink"
                  >
                    Verification suite
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close verification suite"
                  className="mt-1 text-slate/55 transition-colors hover:text-ink focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <button
                  type="button"
                  onClick={onRunAll}
                  className="flex h-9 items-center gap-2 border border-ink/25 px-3.5 text-[12px] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                >
                  <PlayIcon size={13} />
                  Run all {cases.length}
                </button>
                <p className="text-[12px] text-slate">
                  {runCount === 0
                    ? "Not yet run."
                    : `${passCount} of ${runCount} passing${allRun ? "" : " so far"}.`}
                </p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 sm:px-8">
              <ol>
                {cases.map((test, index) => {
                  const outcome = outcomes[test.id];
                  return (
                    <motion.li
                      key={test.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(index * 0.025, 0.24),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="border-b border-hairline py-5 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2.5">
                            <span className="font-mono text-[10px] tabular-nums text-slate/40">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <h3 className="text-[13px] font-medium text-ink">
                              {test.label}
                            </h3>
                            <span className="text-[11px] text-slate/50">
                              {test.category}
                            </span>
                          </div>
                          <code className="mt-2 block font-mono text-[12px] text-slate">
                            {test.expression}
                          </code>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span
                            className={`text-[11px] ${
                              outcome
                                ? outcome.pass
                                  ? "text-sage"
                                  : "text-rust"
                                : "text-slate/40"
                            }`}
                          >
                            {outcome ? (outcome.pass ? "Pass" : "Fail") : "Not run"}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRunOne(test)}
                            className="border border-hairline px-2 py-1 text-[10px] text-slate transition-colors hover:border-indigo/40 hover:text-indigo focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                          >
                            Run
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 text-[11px]">
                        <div>
                          <span className="text-slate/50">Expected</span>
                          <p className="mt-0.5 font-mono text-slate">
                            {describeExpected(test)}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate/50">Actual</span>
                          <p
                            className={`mt-0.5 font-mono ${
                              outcome
                                ? outcome.pass
                                  ? "text-sage"
                                  : "text-rust"
                                : "text-slate/35"
                            }`}
                          >
                            {outcome?.actual ?? "—"}
                          </p>
                        </div>
                      </div>

                      {test.note ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-slate/55">
                          {test.note}
                        </p>
                      ) : null}
                    </motion.li>
                  );
                })}
              </ol>
            </div>

            <footer className="border-t border-hairline bg-mint/60 px-6 py-4 sm:px-8">
              <p className="text-[11px] leading-relaxed text-slate/60">
                These checks call <code className="font-mono">compileExpression</code>{" "}
                directly. The same module powers the page and{" "}
                <code className="font-mono">npm run engine:check</code>.
              </p>
            </footer>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
