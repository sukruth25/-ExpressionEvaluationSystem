import type { CSSProperties } from "react";
import {
  BackIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
} from "./Icons";

interface PlaybackBarProps {
  stepIndex: number;
  maxIndex: number;
  playing: boolean;
  speed: 1 | 2;
  phaseLabel: string;
  onTogglePlay: () => void;
  onStep: (direction: -1 | 1) => void;
  onReset: () => void;
  onScrub: (value: number) => void;
  onSpeedChange: (speed: 1 | 2) => void;
}

export function PlaybackBar({
  stepIndex,
  maxIndex,
  playing,
  speed,
  phaseLabel,
  onTogglePlay,
  onStep,
  onReset,
  onScrub,
  onSpeedChange,
}: PlaybackBarProps) {
  const disabled = maxIndex === 0;
  const progress = maxIndex === 0 ? 0 : (stepIndex / maxIndex) * 100;

  return (
    <div className="border-y border-hairline py-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:gap-7">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="flex h-9 items-center gap-2 border border-hairline px-3 text-[12px] text-slate transition-colors hover:border-indigo/35 hover:text-indigo disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <ResetIcon size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={disabled || stepIndex === 0}
            aria-label="Step back"
            title="Step back"
            className="flex h-9 w-9 items-center justify-center border border-hairline text-slate transition-colors hover:border-indigo/35 hover:text-indigo disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <BackIcon size={16} />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            disabled={disabled}
            className="flex h-9 min-w-[94px] items-center justify-center gap-2 bg-indigo px-4 text-[12px] font-medium text-paper transition-colors hover:bg-[#183b47] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            {playing ? "Pause" : "Play"}
          </button>

          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={disabled || stepIndex >= maxIndex}
            aria-label="Step forward"
            title="Step forward"
            className="flex h-9 w-9 items-center justify-center border border-hairline text-slate transition-colors hover:border-indigo/35 hover:text-indigo disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <ForwardIcon size={16} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-4 text-[12px] text-slate">
            <span>{phaseLabel}</span>
            <span className="font-mono text-[11px] tabular-nums text-slate/65">
              {stepIndex} / {maxIndex}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(maxIndex, 0)}
            step={1}
            value={Math.min(stepIndex, Math.max(maxIndex, 0))}
            onChange={(event) => onScrub(Number(event.target.value))}
            disabled={disabled}
            aria-label="Playback step"
            className="scrubber"
            style={
              {
                "--scrub-progress": `${progress}%`,
              } as CSSProperties
            }
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate">Speed</span>
          <div className="flex border border-hairline">
            {([1, 2] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onSpeedChange(value)}
                className={`h-8 px-3 font-mono text-[11px] transition-colors focus-visible:ring-1 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
                  speed === value
                    ? "bg-ink text-paper"
                    : "text-slate hover:text-indigo"
                }`}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
