import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const MAGIC_TRADE_WIDTH = 1920;
export const MAGIC_TRADE_HEIGHT = 1080;
export const MAGIC_TRADE_FPS = 30;
export const MAGIC_TRADE_DURATION_SECONDS = 12;
export const MAGIC_TRADE_DURATION_FRAMES =
  MAGIC_TRADE_FPS * MAGIC_TRADE_DURATION_SECONDS;

const TIMING = {
  titleIn: 0.25,
  ifIn: 2.0,
  thenIn: 4.0,
  afterFireIn: 6.0,
  sentenceLock: 8.0,
  armedIn: 10.0,
} as const;

const COLORS = {
  void: "#05060A",
  deepSpace: "#090B14",
  panel: "rgba(13, 16, 27, 0.74)",
  glass: "rgba(17, 24, 39, 0.52)",
  cyan: "#33F5FF",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  pink: "#FF3D8A",
  amber: "#F59E0B",
  green: "#22C55E",
  white: "#F8FAFC",
  muted: "rgba(226, 232, 240, 0.64)",
} as const;

type ChipTone = "primary" | "condition" | "action" | "system" | "risk" | "quiet";

type CommandChipProps = {
  text: string;
  tone?: ChipTone;
  delaySeconds: number;
  settleY?: number;
};

const sec = (seconds: number, fps: number) => seconds * fps;

const clampInterpolate = (
  frame: number,
  input: [number, number],
  output: [number, number],
) =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const toneStyles = (tone: ChipTone) => {
  if (tone === "primary") {
    return {
      border: `1px solid rgba(51, 245, 255, 0.58)`,
      boxShadow:
        "0 0 22px rgba(51, 245, 255, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.13)",
      color: COLORS.cyan,
      background:
        "linear-gradient(135deg, rgba(14, 165, 233, 0.26), rgba(17, 24, 39, 0.72))",
    };
  }

  if (tone === "action") {
    return {
      border: "1px solid rgba(34, 197, 94, 0.42)",
      boxShadow:
        "0 0 18px rgba(34, 197, 94, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.11)",
      color: "#D8FBE9",
      background:
        "linear-gradient(135deg, rgba(34, 197, 94, 0.14), rgba(17, 24, 39, 0.70))",
    };
  }

  if (tone === "system") {
    return {
      border: "1px solid rgba(139, 92, 246, 0.52)",
      boxShadow:
        "0 0 20px rgba(139, 92, 246, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.11)",
      color: "#E9D5FF",
      background:
        "linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(17, 24, 39, 0.70))",
    };
  }

  if (tone === "risk") {
    return {
      border: "1px solid rgba(245, 158, 11, 0.54)",
      boxShadow:
        "0 0 20px rgba(245, 158, 11, 0.16), 0 0 18px rgba(51, 245, 255, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
      color: "#FFE9B8",
      background:
        "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(14, 165, 233, 0.12), rgba(17, 24, 39, 0.74))",
    };
  }

  if (tone === "condition") {
    return {
      border: "1px solid rgba(59, 130, 246, 0.44)",
      boxShadow:
        "0 0 18px rgba(59, 130, 246, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
      color: "#E0F2FE",
      background:
        "linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(17, 24, 39, 0.72))",
    };
  }

  return {
    border: "1px solid rgba(148, 163, 184, 0.22)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    color: COLORS.white,
    background: "rgba(17, 24, 39, 0.56)",
  };
};

const CommandChip = ({
  text,
  tone = "quiet",
  delaySeconds,
  settleY = 0,
}: CommandChipProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = sec(delaySeconds, fps);
  const progress = clampInterpolate(frame, [start, start + sec(0.58, fps)], [0, 1]);
  const lockGlow = interpolate(
    frame,
    [sec(TIMING.sentenceLock, fps), sec(TIMING.sentenceLock + 0.5, fps), sec(TIMING.sentenceLock + 1.2, fps)],
    [0, 1, 0.18],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        ...toneStyles(tone),
        opacity: progress,
        transform: `translate3d(${(1 - progress) * -44}px, ${(1 - progress) * (40 + settleY)}px, 0) scale(${0.94 + progress * 0.06})`,
        filter: `drop-shadow(0 0 ${8 + lockGlow * 12}px rgba(51, 245, 255, ${0.09 + lockGlow * 0.10}))`,
        borderRadius: 16,
        padding: "20px 28px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 36,
        fontWeight: 760,
        letterSpacing: 0,
        lineHeight: 1,
        whiteSpace: "nowrap",
        backdropFilter: "blur(18px)",
      }}
    >
      {text}
    </div>
  );
};

const WormholeBackground = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = frame / fps;
  const ringPulse = Math.sin(drift * 1.2) * 0.5 + 0.5;
  const particleOpacity = interpolate(
    frame,
    [0, sec(1.4, fps), sec(11.6, fps), sec(12, fps)],
    [0, 1, 1, 0.78],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const particles = Array.from({ length: 34 }, (_, index) => {
    const x = 7 + ((index * 137) % 86);
    const y = 9 + ((index * 83) % 78);
    const size = 2 + (index % 4);
    const shimmer = Math.sin(drift * (0.8 + (index % 5) * 0.12) + index) * 0.5 + 0.5;
    return { x, y, size, shimmer, index };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.void,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 47%, rgba(3, 7, 18, 0.20) 0, rgba(3, 7, 18, 0.62) 18%, transparent 33%), radial-gradient(circle at 48% 48%, rgba(51, 245, 255, 0.16), transparent 24%), radial-gradient(circle at 54% 45%, rgba(139, 92, 246, 0.14), transparent 30%), linear-gradient(180deg, #05060A 0%, #070A13 48%, #05060A 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          width: 980,
          height: 980,
          marginLeft: -490,
          marginTop: -490,
          borderRadius: "50%",
          opacity: 0.42 + ringPulse * 0.18,
          transform: `rotate(${drift * 5}deg) scale(${1 + ringPulse * 0.012})`,
          background:
            "conic-gradient(from 18deg, transparent 0deg, rgba(51, 245, 255, 0.14) 56deg, transparent 114deg, rgba(139, 92, 246, 0.16) 178deg, transparent 244deg, rgba(255, 61, 138, 0.10) 292deg, transparent 360deg)",
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.24,
          backgroundImage:
            "linear-gradient(rgba(51, 245, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(51, 245, 255, 0.07) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          transform: `perspective(900px) rotateX(61deg) translateY(${180 + (frame % 96)}px) scale(1.3)`,
          transformOrigin: "50% 70%",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,1) 70%, transparent 100%)",
        }}
      />
      {particles.map((particle) => (
        <div
          key={particle.index}
          style={{
            position: "absolute",
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            borderRadius: "50%",
            opacity: particleOpacity * (0.18 + particle.shimmer * 0.56),
            background:
              particle.index % 5 === 0
                ? COLORS.purple
                : particle.index % 7 === 0
                  ? COLORS.pink
                  : COLORS.cyan,
            boxShadow: `0 0 ${12 + particle.shimmer * 22}px currentColor`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 64,
          border: "1px solid rgba(148, 163, 184, 0.10)",
          boxShadow:
            "inset 0 0 80px rgba(51, 245, 255, 0.03), 0 0 80px rgba(51, 245, 255, 0.04)",
        }}
      />
    </AbsoluteFill>
  );
};

const EnergyConnection = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = clampInterpolate(
    frame,
    [sec(TIMING.thenIn + 0.2, fps), sec(TIMING.afterFireIn + 0.9, fps)],
    [0, 1],
  );
  const fade = interpolate(
    frame,
    [sec(TIMING.sentenceLock - 0.2, fps), sec(TIMING.sentenceLock + 0.6, fps)],
    [1, 0.24],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const dash = 880 - 880 * progress;

  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{
        position: "absolute",
        inset: 0,
        opacity: fade,
        overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id="portal-energy-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.04" />
          <stop offset="34%" stopColor={COLORS.cyan} stopOpacity="0.72" />
          <stop offset="68%" stopColor={COLORS.purple} stopOpacity="0.58" />
          <stop offset="100%" stopColor={COLORS.amber} stopOpacity="0.20" />
        </linearGradient>
        <filter id="portal-line-glow">
          <feGaussianBlur stdDeviation="7" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M 420 476 C 620 385, 770 404, 928 512 S 1215 671, 1496 610"
        fill="none"
        stroke="url(#portal-energy-line)"
        strokeWidth="4"
        strokeDasharray="880"
        strokeDashoffset={dash}
        strokeLinecap="round"
        filter="url(#portal-line-glow)"
      />
    </svg>
  );
};

const PhaseLabel = ({ text, delaySeconds }: { text: string; delaySeconds: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = clampInterpolate(
    frame,
    [sec(delaySeconds, fps), sec(delaySeconds + 0.4, fps)],
    [0, 1],
  );

  return (
    <div
      style={{
        opacity,
        color: "rgba(226, 232, 240, 0.52)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 1.8,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
};

const CommandDeck = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [sec(TIMING.sentenceLock, fps), sec(TIMING.sentenceLock + 0.72, fps)],
    [1, 0.12],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const y = interpolate(
    frame,
    [sec(TIMING.sentenceLock, fps), sec(TIMING.sentenceLock + 0.72, fps)],
    [0, -28],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 210,
        right: 210,
        top: 320,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <EnergyConnection />
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <PhaseLabel text="Source condition" delaySeconds={TIMING.ifIn} />
          <CommandChip text="IF" tone="primary" delaySeconds={TIMING.ifIn} />
          <CommandChip text="BTC" tone="condition" delaySeconds={TIMING.ifIn + 0.22} />
          <CommandChip
            text="15m candle closes below"
            tone="condition"
            delaySeconds={TIMING.ifIn + 0.44}
          />
          <CommandChip text="76,500" tone="condition" delaySeconds={TIMING.ifIn + 0.66} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, paddingLeft: 178 }}>
          <PhaseLabel text="Target action" delaySeconds={TIMING.thenIn} />
          <CommandChip text="THEN" tone="primary" delaySeconds={TIMING.thenIn} />
          <CommandChip text="Close" tone="action" delaySeconds={TIMING.thenIn + 0.26} />
          <CommandChip text="SOL Long" tone="action" delaySeconds={TIMING.thenIn + 0.48} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, paddingLeft: 356 }}>
          <PhaseLabel text="Behavior lock" delaySeconds={TIMING.afterFireIn} />
          <CommandChip
            text="AFTER FIRE"
            tone="system"
            delaySeconds={TIMING.afterFireIn}
          />
          <CommandChip text="Disarm" tone="system" delaySeconds={TIMING.afterFireIn + 0.24} />
          <CommandChip text="MODE" tone="primary" delaySeconds={TIMING.afterFireIn + 0.52} />
          <CommandChip
            text="Live Risk-Reducing"
            tone="risk"
            delaySeconds={TIMING.afterFireIn + 0.72}
          />
        </div>
      </div>
    </div>
  );
};

const LockedSentence = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sentenceProgress = clampInterpolate(
    frame,
    [sec(TIMING.sentenceLock, fps), sec(TIMING.sentenceLock + 0.8, fps)],
    [0, 1],
  );
  const pulse = interpolate(
    frame,
    [
      sec(TIMING.sentenceLock + 0.62, fps),
      sec(TIMING.sentenceLock + 1.08, fps),
      sec(TIMING.sentenceLock + 1.7, fps),
    ],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const armedProgress = clampInterpolate(
    frame,
    [sec(TIMING.armedIn, fps), sec(TIMING.armedIn + 0.62, fps)],
    [0, 1],
  );
  const breathe = Math.sin((frame / fps) * 2.1) * 0.5 + 0.5;

  return (
    <div
      style={{
        position: "absolute",
        left: 262,
        right: 262,
        top: 360,
        opacity: sentenceProgress,
        transform: `translateY(${(1 - sentenceProgress) * 34}px) scale(${0.975 + sentenceProgress * 0.025})`,
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 28,
          border: `1px solid rgba(51, 245, 255, ${0.22 + pulse * 0.28})`,
          background:
            "linear-gradient(135deg, rgba(17, 24, 39, 0.68), rgba(13, 16, 27, 0.42))",
          boxShadow: `0 0 ${30 + pulse * 46}px rgba(51, 245, 255, ${0.08 + pulse * 0.14}), inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
          backdropFilter: "blur(22px)",
          padding: "64px 72px 58px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent, rgba(51, 245, 255, 0.86), rgba(139, 92, 246, 0.62), transparent)",
            opacity: 0.4 + pulse * 0.44,
          }}
        />
        <div
          style={{
            color: "rgba(226, 232, 240, 0.52)",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: 20,
            fontWeight: 760,
            letterSpacing: 2.8,
            marginBottom: 26,
            textTransform: "uppercase",
          }}
        >
          Magic sentence compiled
        </div>
        <div
          style={{
            color: COLORS.white,
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: 58,
            fontWeight: 760,
            lineHeight: 1.14,
            letterSpacing: 0,
            maxWidth: 1220,
            textShadow: `0 0 ${16 + pulse * 18}px rgba(51, 245, 255, ${0.08 + pulse * 0.18})`,
          }}
        >
          If BTC 15m closes below 76,500, Portal will close SOL long.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 46,
          }}
        >
          <div
            style={{
              opacity: armedProgress,
              transform: `translateX(${(1 - armedProgress) * -18}px)`,
              color: COLORS.muted,
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: 26,
              fontWeight: 650,
            }}
          >
            Risk-reducing logic only.
          </div>
          <div
            style={{
              opacity: armedProgress,
              transform: `translateX(${(1 - armedProgress) * 22}px) scale(${0.96 + armedProgress * 0.04})`,
              borderRadius: 999,
              border: "1px solid rgba(245, 158, 11, 0.62)",
              background:
                "linear-gradient(135deg, rgba(245, 158, 11, 0.24), rgba(51, 245, 255, 0.10), rgba(17, 24, 39, 0.72))",
              boxShadow: `0 0 ${22 + breathe * 20}px rgba(245, 158, 11, ${0.12 + breathe * 0.10}), inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
              color: "#FFF4D6",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: 28,
              fontWeight: 840,
              letterSpacing: 2.4,
              padding: "18px 34px",
            }}
          >
            ARMED
          </div>
        </div>
      </div>
    </div>
  );
};

const Title = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleProgress = clampInterpolate(
    frame,
    [sec(TIMING.titleIn, fps), sec(TIMING.titleIn + 0.82, fps)],
    [0, 1],
  );
  const dim = interpolate(
    frame,
    [sec(TIMING.ifIn - 0.35, fps), sec(TIMING.ifIn + 0.55, fps)],
    [1, 0.58],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 118,
        textAlign: "center",
        opacity: titleProgress * dim,
        transform: `translateY(${(1 - titleProgress) * 26}px)`,
      }}
    >
      <div
        style={{
          color: COLORS.white,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 86,
          fontWeight: 820,
          lineHeight: 1,
          letterSpacing: 0,
          textShadow: "0 0 42px rgba(51, 245, 255, 0.18)",
        }}
      >
        Magic Trade
      </div>
      <div
        style={{
          width: 212,
          height: 3,
          margin: "28px auto 0",
          background:
            "linear-gradient(90deg, transparent, rgba(51, 245, 255, 0.84), rgba(139, 92, 246, 0.58), transparent)",
          boxShadow: "0 0 22px rgba(51, 245, 255, 0.28)",
        }}
      />
    </div>
  );
};

export const MagicTradeExplainer = () => {
  return (
    <AbsoluteFill
      style={{
        background: COLORS.deepSpace,
      }}
    >
      <WormholeBackground />
      <Title />
      <CommandDeck />
      <LockedSentence />
    </AbsoluteFill>
  );
};
