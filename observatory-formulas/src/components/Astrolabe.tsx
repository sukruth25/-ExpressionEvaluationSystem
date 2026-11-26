import { motion, useReducedMotion } from "framer-motion";

export function Astrolabe() {
  const reducedMotion = useReducedMotion();
  const ticks = Array.from({ length: 48 }, (_, index) => index);

  return (
    <figure className="mx-auto w-[220px] shrink-0 sm:w-[240px] lg:mx-0 lg:w-[250px]">
      <svg
        width="250"
        height="250"
        viewBox="0 0 250 250"
        fill="none"
        role="img"
        aria-label="A quiet astrolabe diagram"
        className="h-auto w-full"
      >
        <circle cx="125" cy="125" r="105" fill="#EAF3ED" />
        <circle cx="125" cy="125" r="104" stroke="#AEC4B9" strokeWidth="1" />
        <circle cx="125" cy="125" r="90" stroke="#C2D4CB" strokeWidth="1" />
        <circle
          cx="125"
          cy="125"
          r="70"
          stroke="#AEC4B9"
          strokeWidth="1"
          strokeDasharray="2 5"
        />

        {ticks.map((tick) => {
          const major = tick % 6 === 0;
          const angle = (tick / ticks.length) * Math.PI * 2;
          const inner = major ? 94 : 99;
          const outer = 104;
          return (
            <line
              key={tick}
              x1={125 + Math.cos(angle) * inner}
              y1={125 + Math.sin(angle) * inner}
              x2={125 + Math.cos(angle) * outer}
              y2={125 + Math.sin(angle) * outer}
              stroke={major ? "#4C6159" : "#9FB8AC"}
              strokeWidth="0.8"
            />
          );
        })}

        <motion.g
          animate={reducedMotion ? undefined : { rotate: 360 }}
          transition={
            reducedMotion
              ? undefined
              : { duration: 210, repeat: Infinity, ease: "linear" }
          }
          style={{ transformOrigin: "125px 125px" }}
        >
          <ellipse
            cx="125"
            cy="125"
            rx="84"
            ry="29"
            stroke="#C47521"
            strokeOpacity="0.55"
            strokeWidth="1"
          />
          <circle cx="209" cy="125" r="3.1" fill="#C47521" />
        </motion.g>

        <motion.g
          animate={reducedMotion ? undefined : { rotate: -360 }}
          transition={
            reducedMotion
              ? undefined
              : { duration: 300, repeat: Infinity, ease: "linear" }
          }
          style={{ transformOrigin: "125px 125px" }}
        >
          <ellipse
            cx="125"
            cy="125"
            rx="34"
            ry="83"
            stroke="#1F4854"
            strokeOpacity="0.24"
            strokeWidth="1"
          />
          <circle cx="125" cy="42" r="2.2" fill="#1F4854" fillOpacity="0.55" />
        </motion.g>

        <motion.g
          animate={reducedMotion ? undefined : { rotate: 360 }}
          transition={
            reducedMotion
              ? undefined
              : { duration: 260, repeat: Infinity, ease: "linear" }
          }
          style={{ transformOrigin: "125px 125px" }}
        >
          <ellipse
            cx="125"
            cy="125"
            rx="62"
            ry="76"
            stroke="#1F6B57"
            strokeOpacity="0.34"
            strokeWidth="1"
          />
          <circle cx="125" cy="49" r="2.6" fill="#1F6B57" fillOpacity="0.7" />
        </motion.g>

        <motion.circle
          cx="171"
          cy="72"
          r="1.7"
          fill="#C47521"
          animate={reducedMotion ? undefined : { opacity: [0.25, 0.95, 0.25] }}
          transition={
            reducedMotion
              ? undefined
              : { duration: 4.6, repeat: Infinity, ease: "easeInOut" }
          }
        />

        <path d="M125 18v18M125 214v18M18 125h18M214 125h18" stroke="#4C6159" />
        <circle cx="125" cy="125" r="4" fill="#1F4854" />
        <circle cx="125" cy="125" r="10" stroke="#1F4854" strokeOpacity="0.3" />

        <path d="M35 195h36" stroke="#AEC4B9" />
        <text
          x="35"
          y="209"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="9"
          fill="#4C6159"
        >
          θ 41° 12′
        </text>
        <text
          x="170"
          y="209"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="9"
          fill="#4C6159"
        >
          fig. 1
        </text>
      </svg>
      <figcaption className="mt-1 max-w-[230px] text-center text-[11px] leading-relaxed text-slate/55 lg:text-left">
        A device for watching thought move in circles until it arrives.
      </figcaption>
    </figure>
  );
}
