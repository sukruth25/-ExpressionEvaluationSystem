import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ASTNode, Diagnostic, EvalStep } from "../engine";
import {
  expressionToAscii,
  formatNumber,
  nodeValuesFromSteps,
  operatorSymbol,
} from "../engine";
import { CheckIcon, CopyIcon, TextIcon, TreeIcon } from "./Icons";

interface ExpressionTreeProps {
  ast?: ASTNode;
  expression: string;
  visibleEvalSteps: EvalStep[];
  activeEvalStep?: EvalStep;
  finalValue?: number;
  isComplete: boolean;
  diagnostic?: Diagnostic;
  onJumpToNode?: (nodeId: string) => void;
}

interface PositionedNode {
  node: ASTNode;
  x: number;
  y: number;
  depth: number;
}

interface TreeEdge {
  from: PositionedNode;
  to: PositionedNode;
}

interface TreeLayout {
  nodes: PositionedNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
  radius: number;
}

interface TreeMetrics {
  radius: number;
  leafWidth: number;
  hGap: number;
  vGap: number;
  padX: number;
  padTop: number;
  padBottom: number;
  valueGutter: number;
}

const DESKTOP_METRICS: TreeMetrics = {
  radius: 22,
  leafWidth: 76,
  hGap: 16,
  vGap: 78,
  padX: 36,
  padTop: 34,
  padBottom: 42,
  valueGutter: 54,
};

const COMPACT_METRICS: TreeMetrics = {
  radius: 18,
  leafWidth: 50,
  hGap: 6,
  vGap: 68,
  padX: 14,
  padTop: 28,
  padBottom: 32,
  valueGutter: 36,
};

function computeLayout(root: ASTNode, metrics: TreeMetrics): TreeLayout {
  const {
    radius,
    leafWidth: LEAF_WIDTH,
    hGap: H_GAP,
    vGap: V_GAP,
    padX: PAD_X,
    padTop: PAD_TOP,
    padBottom: PAD_BOTTOM,
    valueGutter: VALUE_GUTTER,
  } = metrics;
  const widths = new Map<string, number>();
  const depths = new Map<string, number>();

  const measure = (node: ASTNode, depth: number): number => {
    depths.set(node.id, Math.max(depths.get(node.id) ?? 0, depth));
    if (node.kind !== "operator") {
      widths.set(node.id, LEAF_WIDTH);
      return LEAF_WIDTH;
    }
    const childWidths = node.children.map((child) => measure(child, depth + 1));
    const total =
      childWidths.reduce((sum, width) => sum + width, 0) +
      H_GAP * Math.max(0, childWidths.length - 1);
    const width = Math.max(LEAF_WIDTH, total);
    widths.set(node.id, width);
    return width;
  };

  measure(root, 0);

  const nodes: PositionedNode[] = [];
  const edges: TreeEdge[] = [];
  let maxDepth = 0;

  const place = (node: ASTNode, left: number, depth: number): PositionedNode => {
    maxDepth = Math.max(maxDepth, depth);
    const width = widths.get(node.id) ?? LEAF_WIDTH;
    const positioned: PositionedNode = {
      node,
      x: left + width / 2,
      y: PAD_TOP + depth * V_GAP,
      depth,
    };
    nodes.push(positioned);

    if (node.kind === "operator") {
      const childWidths = node.children.map(
        (child) => widths.get(child.id) ?? LEAF_WIDTH,
      );
      const childrenTotal =
        childWidths.reduce((sum, childWidth) => sum + childWidth, 0) +
        H_GAP * Math.max(0, childWidths.length - 1);
      let cursor = left + (width - childrenTotal) / 2;
      node.children.forEach((child, index) => {
        const childNode = place(child, cursor, depth + 1);
        edges.push({ from: positioned, to: childNode });
        cursor += childWidths[index] + H_GAP;
      });
    }

    return positioned;
  };

  const rootWidth = widths.get(root.id) ?? LEAF_WIDTH;
  place(root, PAD_X, 0);

  return {
    nodes,
    edges,
    width: rootWidth + PAD_X * 2 + VALUE_GUTTER,
    height: PAD_TOP + (maxDepth + 1) * V_GAP + PAD_BOTTOM,
    radius,
  };
}

function nodeLabel(node: ASTNode): string {
  if (node.kind === "number") return node.raw;
  if (node.kind === "variable") return node.name;
  return operatorSymbol(node);
}

function edgePath(
  from: PositionedNode,
  to: PositionedNode,
  radius: number,
): string {
  const fromY = from.y + radius;
  const toY = to.y - radius;
  const midY = fromY + (toY - fromY) * 0.5;
  return `M ${from.x} ${fromY} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${toY}`;
}

export function ExpressionTree({
  ast,
  expression,
  visibleEvalSteps,
  activeEvalStep,
  finalValue,
  isComplete,
  diagnostic,
  onJumpToNode,
}: ExpressionTreeProps) {
  const [mode, setMode] = useState<"visual" | "text">("visual");
  const [copied, setCopied] = useState(false);
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  const ledgerRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const values = useMemo(
    () => nodeValuesFromSteps(visibleEvalSteps),
    [visibleEvalSteps],
  );
  const layout = useMemo(
    () =>
      ast
        ? computeLayout(ast, compact ? COMPACT_METRICS : DESKTOP_METRICS)
        : undefined,
    [ast, compact],
  );
  const ascii = useMemo(
    () => (ast ? expressionToAscii(ast, values) : ""),
    [ast, values],
  );
  const activeNodeIds = useMemo(
    () => new Set(activeEvalStep?.nodeIds ?? []),
    [activeEvalStep],
  );
  const activeRootId = activeEvalStep?.nodeId;
  const activeColor =
    activeEvalStep?.kind === "error" ? "#A8462E" : "#1F4854";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    const container = ledgerRef.current;
    const row = container?.querySelector<HTMLElement>('[data-active="true"]');
    if (!container || !row) return;
    const rowTop = row.offsetTop - container.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    if (rowTop < container.scrollTop) {
      container.scrollTo({ top: rowTop, behavior: "smooth" });
    } else if (rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTo({
        top: rowBottom - container.clientHeight + 8,
        behavior: "smooth",
      });
    }
  }, [activeEvalStep?.id]);

  const copyAscii = async () => {
    if (!ascii) return;
    try {
      await navigator.clipboard.writeText(ascii);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const activeExpression =
    activeEvalStep?.calculation ??
    activeEvalStep?.expression ??
    (isComplete ? "The tree has fully reduced." : "Awaiting reduction.");

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 border-b border-hairline pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="font-serif text-[1.65rem] leading-tight text-ink">
            Expression tree
          </h3>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-slate">
            Operators wait for their children. Values climb back up in post-order
            as the reduction advances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-hairline">
            <button
              type="button"
              onClick={() => setMode("visual")}
              className={`flex h-8 items-center gap-1.5 px-3 text-[11px] transition-colors ${
                mode === "visual"
                  ? "bg-ink text-paper"
                  : "text-slate hover:text-indigo"
              }`}
            >
              <TreeIcon size={13} />
              Tree
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex h-8 items-center gap-1.5 border-l border-hairline px-3 text-[11px] transition-colors ${
                mode === "text"
                  ? "bg-ink text-paper"
                  : "text-slate hover:text-indigo"
              }`}
            >
              <TextIcon size={13} />
              Text
            </button>
          </div>
          {mode === "text" && ascii ? (
            <button
              type="button"
              onClick={copyAscii}
              className="flex h-8 items-center gap-1.5 border border-hairline px-3 text-[11px] text-slate transition-colors hover:border-indigo/35 hover:text-indigo"
            >
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              {copied ? "Copied" : "Copy tree"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 pt-5">
          <AnimatePresence mode="wait" initial={false}>
            {mode === "visual" ? (
              <motion.div
                key="visual"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {layout ? (
                  <div className="overflow-x-auto">
                    <svg
                      key={expression}
                      viewBox={`0 0 ${layout.width} ${layout.height}`}
                      className={`h-auto w-full ${compact ? "" : "min-w-[520px]"}`}
                      role="img"
                      aria-label="Expression tree"
                    >
                      <defs>
                        <filter id="node-soft" x="-40%" y="-40%" width="180%" height="180%">
                          <feDropShadow
                            dx="0"
                            dy="2"
                            stdDeviation="2.5"
                            floodColor="#12211C"
                            floodOpacity="0.06"
                          />
                        </filter>
                      </defs>

                      {layout.edges.map((edge) => {
                        const active =
                          activeNodeIds.has(edge.from.node.id) &&
                          activeNodeIds.has(edge.to.node.id);
                        const activeRootEdge =
                          active && edge.from.node.id === activeRootId;
                        return (
                          <motion.path
                            key={`${edge.from.node.id}-${edge.to.node.id}`}
                            d={edgePath(edge.from, edge.to, layout.radius)}
                            fill="none"
                            stroke={active ? activeColor : "#AEC4B9"}
                            strokeWidth={active ? 2 : 1}
                            className={
                              activeRootEdge ? "tree-edge-active" : undefined
                            }
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{
                              duration: 0.5,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          />
                        );
                      })}

                      {layout.nodes.map((positioned) => {
                        const { node, x, y } = positioned;
                        const active = activeNodeIds.has(node.id);
                        const isActiveRoot = node.id === activeRootId;
                        const resolved = values[node.id] !== undefined;
                        const isOperator = node.kind === "operator";
                        const value = values[node.id];
                        const canJump =
                          isOperator && resolved && onJumpToNode !== undefined;

                        return (
                          <motion.g
                            key={node.id}
                            initial={{ opacity: 0, y: -4, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              duration: 0.38,
                              delay: positioned.depth * 0.045,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            onClick={canJump ? () => onJumpToNode?.(node.id) : undefined}
                            style={{
                              cursor: canJump ? "pointer" : "default",
                              transformBox: "fill-box",
                              transformOrigin: "center",
                            }}
                            role={canJump ? "button" : undefined}
                            aria-label={
                              canJump
                                ? `Jump to the reduction of ${nodeLabel(node)}`
                                : undefined
                            }
                          >
                            {canJump ? (
                              <title>{`Jump to ${activeExpression}`}</title>
                            ) : null}
                            {isActiveRoot ? (
                              <circle
                                cx={x}
                                cy={y}
                                r={layout.radius + 6}
                                fill={
                                  activeEvalStep?.kind === "error"
                                    ? "rgba(168,70,46,0.08)"
                                    : "rgba(31,72,84,0.07)"
                                }
                              />
                            ) : null}
                            <circle
                              cx={x}
                              cy={y}
                              r={layout.radius}
                              className="tree-node"
                              fill={
                                isActiveRoot
                                  ? activeColor
                                  : active
                                    ? "#E3EFE8"
                                    : "#F8FBF7"
                              }
                              stroke={
                                isActiveRoot
                                  ? activeColor
                                  : active
                                    ? "rgba(31,72,84,0.45)"
                                    : resolved && isOperator
                                      ? "rgba(31,107,87,0.5)"
                                      : "#AEC4B9"
                              }
                              strokeWidth={1}
                              filter={
                                isActiveRoot ? "url(#node-soft)" : undefined
                              }
                            />
                            <text
                              x={x}
                              y={y + 4.5}
                              textAnchor="middle"
                              fontSize={
                                node.kind === "variable" && node.name.length > 4
                                  ? 10.5
                                  : 14
                              }
                              fontFamily="'JetBrains Mono', monospace"
                              fontWeight={500}
                              fill={isActiveRoot ? "#F5F9F5" : "#12211C"}
                            >
                              {nodeLabel(node)}
                            </text>
                            {node.kind === "operator" && node.arity === 1 ? (
                              <text
                                x={x + 14}
                                y={y - 10}
                                fontSize={8}
                                fontFamily="'Instrument Sans', sans-serif"
                                fill={isActiveRoot ? "#F5F9F5" : "#C47521"}
                              >
                                u
                              </text>
                            ) : null}
                            {isOperator && value !== undefined ? (
                              <motion.g
                                initial={{ opacity: 0, x: -3 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  duration: 0.3,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                              >
                                <line
                                  x1={x + layout.radius}
                                  y1={y}
                                  x2={x + layout.radius + 7}
                                  y2={y}
                                  stroke="rgba(31,107,87,0.6)"
                                  strokeWidth={1}
                                />
                                <text
                                  x={x + layout.radius + 11}
                                  y={y + 3.5}
                                  fontSize={11}
                                  fontFamily="'JetBrains Mono', monospace"
                                  fill="#1F6B57"
                                >
                                  {formatNumber(value)}
                                </text>
                              </motion.g>
                            ) : null}
                          </motion.g>
                        );
                      })}
                    </svg>
                  </div>
                ) : (
                  <TreePlaceholder diagnostic={diagnostic} />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {ascii ? (
                  <pre className="overflow-x-auto whitespace-pre font-mono text-[12px] leading-[1.9] text-ink">
                    {ascii}
                  </pre>
                ) : (
                  <TreePlaceholder diagnostic={diagnostic} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="border-t border-hairline pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-slate">Resolved value</span>
            <motion.span
              key={
                isComplete && finalValue !== undefined
                  ? formatNumber(finalValue)
                  : "pending"
              }
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={`font-mono text-[1.55rem] tabular-nums ${
                isComplete ? "text-sage" : "text-slate/35"
              }`}
            >
              {isComplete && finalValue !== undefined
                ? formatNumber(finalValue)
                : "—"}
            </motion.span>
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <p className="text-[12px] text-slate">Current reduction</p>
            <p className="mt-1.5 min-h-[2.6em] font-mono text-[12px] leading-relaxed text-ink">
              {activeExpression}
            </p>
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] text-slate">Reduction ledger</p>
              <p className="font-mono text-[10px] tabular-nums text-slate/45">
                {visibleEvalSteps.length}
              </p>
            </div>

            {visibleEvalSteps.length > 0 ? (
              <ol
                ref={ledgerRef}
                className="ledger-scroll mt-3 max-h-[300px] overflow-y-auto pr-1"
              >
                {visibleEvalSteps.map((step, index) => {
                  const active = step.id === activeEvalStep?.id;
                  const error = step.kind === "error";
                  return (
                    <li
                      key={step.id}
                      data-active={active ? "true" : undefined}
                      className={`flex gap-2.5 border-b border-hairline/70 py-2 text-[11.5px] leading-relaxed ${
                        active
                          ? "text-ink"
                          : error
                            ? "text-rust/80"
                            : "text-slate/75"
                      }`}
                    >
                      <span
                        className={`mt-[6px] h-1 w-1 shrink-0 rounded-full ${
                          active ? "bg-ochre" : error ? "bg-rust/60" : "bg-slate/35"
                        }`}
                      />
                      <span className="w-4 shrink-0 font-mono text-[10px] tabular-nums text-slate/55">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 font-mono">
                        {step.calculation ?? step.expression}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-3 font-serif text-sm italic leading-relaxed text-slate/55">
                Parsing must finish before the reduction ledger fills.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TreePlaceholder({ diagnostic }: { diagnostic?: Diagnostic }) {
  return (
    <div className="flex min-h-[320px] items-start gap-8 py-8">
      <svg
        width="150"
        height="180"
        viewBox="0 0 150 180"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M75 36v22M75 58 38 92M75 58l37 34"
          stroke="#AEC4B9"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <circle cx="75" cy="26" r="18" stroke="#9FB8AC" strokeWidth="1" />
        <circle cx="38" cy="104" r="15" stroke="#AEC4B9" strokeWidth="1" />
        <circle cx="112" cy="104" r="15" stroke="#AEC4B9" strokeWidth="1" />
        <path
          d="M29 140h64M29 152h38"
          stroke="#C2D4CB"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <text
          x="75"
          y="31"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="12"
          fill="#8FA99C"
        >
          ?
        </text>
      </svg>
      <div className="max-w-md pt-3">
        <p className="font-serif text-[1.35rem] leading-snug text-ink">
          No tree has formed yet.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate">
          {diagnostic
            ? "The parser stopped before a complete expression could be assembled. The diagnostic above marks the exact place to repair."
            : "The tree appears once a complete, balanced expression has been tokenized and parsed."}
        </p>
      </div>
    </div>
  );
}
