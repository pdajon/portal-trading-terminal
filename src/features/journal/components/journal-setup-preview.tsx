"use client";

import type { SVGProps } from "react";

export type JournalSetupPreviewKind =
  | "vibes"
  | "trend-break"
  | "range-break"
  | "support-bounce"
  | "resistance-rejection"
  | "liquidity-sweep"
  | "retest"
  | "breakout"
  | "reversal"
  | "continuation"
  | "news-event"
  | "custom";

export type JournalSetupPreviewTone = "cyan" | "violet" | "amber";

export type JournalSetupMetadata = {
  description: string;
  kind: JournalSetupPreviewKind;
  tone: JournalSetupPreviewTone;
};

type PreviewPoint = {
  x: number;
  y: number;
};

type PreviewGuide = {
  d?: string;
  opacity?: number;
  stroke?: string;
  strokeDasharray?: string;
  strokeWidth?: number;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
};

type TechnicalPreviewScene = {
  guides: PreviewGuide[];
  keyPoint: PreviewPoint;
  path: PreviewPoint[];
  postPath?: PreviewPoint[];
};

const GUIDE_STROKES = {
  amber: "rgba(245,158,11,0.34)",
  cyan: "rgba(34,211,238,0.34)",
  violet: "rgba(139,92,246,0.34)",
  white: "rgba(255,255,255,0.24)",
} as const;

export const JOURNAL_SETUP_TONE_COLORS: Record<JournalSetupPreviewTone, string> = {
  amber: "rgba(245,158,11,0.54)",
  cyan: "rgba(34,211,238,0.54)",
  violet: "rgba(139,92,246,0.56)",
};

export const DEFAULT_JOURNAL_SETUP_TAGS = [
  "Vibes",
  "Trend Break",
  "Range Break",
  "Support Bounce",
  "Resistance Rejection",
  "Liquidity Sweep",
  "Retest",
  "Breakout",
  "Reversal",
  "Continuation",
  "News/Event",
] as const;

export const JOURNAL_SETUP_METADATA: Record<string, JournalSetupMetadata> = {
  Vibes: {
    description: "Pure discretion: no formal setup, just something on the chart worth acting on.",
    kind: "vibes",
    tone: "violet",
  },
  "Trend Break": {
    description: "Price respects a diagonal structure, then breaks through it with intent.",
    kind: "trend-break",
    tone: "cyan",
  },
  "Range Break": {
    description: "Price compresses inside a range, then leaves the box decisively.",
    kind: "range-break",
    tone: "cyan",
  },
  "Support Bounce": {
    description: "Price tests a protected floor and turns back up from that level.",
    kind: "support-bounce",
    tone: "cyan",
  },
  "Resistance Rejection": {
    description: "Price pushes into a ceiling and gets rejected back down.",
    kind: "resistance-rejection",
    tone: "cyan",
  },
  "Liquidity Sweep": {
    description: "Price runs a prior extreme, then snaps back after taking liquidity.",
    kind: "liquidity-sweep",
    tone: "violet",
  },
  Retest: {
    description: "Price breaks a level, returns to test it, then continues from there.",
    kind: "retest",
    tone: "cyan",
  },
  Breakout: {
    description: "Price leaves compression or a key level with clean continuation.",
    kind: "breakout",
    tone: "cyan",
  },
  Reversal: {
    description: "Price exhausts one direction and begins rotating the other way.",
    kind: "reversal",
    tone: "violet",
  },
  Continuation: {
    description: "Price pauses inside the existing move, then resumes the same direction.",
    kind: "continuation",
    tone: "cyan",
  },
  "News/Event": {
    description: "A headline, tweet, or catalyst changed the tape and became the trade reason.",
    kind: "news-event",
    tone: "amber",
  },
};

export function getJournalSetupMetadata(tag: string | null): JournalSetupMetadata {
  if (tag && JOURNAL_SETUP_METADATA[tag]) {
    return JOURNAL_SETUP_METADATA[tag];
  }

  return {
    description: "Custom setup tag: a trader-defined reason captured for later review.",
    kind: "custom",
    tone: "violet",
  };
}

function pathFromPoints(points: PreviewPoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

function getTechnicalScene(kind: JournalSetupPreviewKind): TechnicalPreviewScene {
  switch (kind) {
    case "trend-break":
      return {
        guides: [
          { x1: 40, y1: 126, x2: 170, y2: 44, stroke: GUIDE_STROKES.white, strokeDasharray: "7 7" },
        ],
        keyPoint: { x: 172, y: 74 },
        path: [
          { x: 24, y: 132 },
          { x: 58, y: 112 },
          { x: 90, y: 92 },
          { x: 124, y: 70 },
          { x: 160, y: 48 },
          { x: 172, y: 74 },
          { x: 204, y: 102 },
          { x: 238, y: 120 },
          { x: 270, y: 134 },
        ],
      };
    case "range-break":
      return {
        guides: [
          { x1: 26, y1: 58, x2: 220, y2: 58, stroke: GUIDE_STROKES.cyan },
          { x1: 26, y1: 122, x2: 220, y2: 122, stroke: GUIDE_STROKES.cyan, opacity: 0.52 },
        ],
        keyPoint: { x: 232, y: 42 },
        path: [
          { x: 24, y: 122 },
          { x: 56, y: 58 },
          { x: 88, y: 122 },
          { x: 120, y: 58 },
          { x: 152, y: 122 },
          { x: 184, y: 58 },
          { x: 216, y: 120 },
          { x: 232, y: 42 },
          { x: 270, y: 26 },
        ],
      };
    case "support-bounce":
      return {
        guides: [{ x1: 42, y1: 122, x2: 202, y2: 122, stroke: GUIDE_STROKES.cyan, strokeDasharray: "8 7" }],
        keyPoint: { x: 158, y: 122 },
        path: [
          { x: 22, y: 50 },
          { x: 56, y: 82 },
          { x: 92, y: 122 },
          { x: 124, y: 92 },
          { x: 158, y: 122 },
          { x: 194, y: 78 },
          { x: 234, y: 54 },
          { x: 270, y: 38 },
        ],
      };
    case "resistance-rejection":
      return {
        guides: [{ x1: 56, y1: 44, x2: 206, y2: 44, stroke: GUIDE_STROKES.amber, strokeDasharray: "8 7" }],
        keyPoint: { x: 160, y: 44 },
        path: [
          { x: 22, y: 134 },
          { x: 58, y: 92 },
          { x: 94, y: 44 },
          { x: 126, y: 74 },
          { x: 160, y: 44 },
          { x: 196, y: 86 },
          { x: 236, y: 116 },
          { x: 270, y: 130 },
        ],
      };
    case "liquidity-sweep":
      return {
        guides: [{ x1: 72, y1: 54, x2: 224, y2: 54, stroke: GUIDE_STROKES.violet, strokeDasharray: "8 7" }],
        keyPoint: { x: 176, y: 32 },
        path: [
          { x: 22, y: 104 },
          { x: 58, y: 84 },
          { x: 96, y: 94 },
          { x: 132, y: 70 },
          { x: 160, y: 86 },
          { x: 176, y: 32 },
          { x: 194, y: 62 },
          { x: 232, y: 104 },
          { x: 270, y: 92 },
        ],
      };
    case "retest":
      return {
        guides: [
          { x1: 44, y1: 116, x2: 176, y2: 42, stroke: GUIDE_STROKES.white, strokeDasharray: "7 7" },
          { x1: 140, y1: 82, x2: 224, y2: 82, stroke: GUIDE_STROKES.cyan, opacity: 0.48 },
        ],
        keyPoint: { x: 184, y: 82 },
        path: [
          { x: 24, y: 126 },
          { x: 58, y: 106 },
          { x: 94, y: 84 },
          { x: 130, y: 60 },
          { x: 162, y: 40 },
          { x: 148, y: 72 },
          { x: 184, y: 82 },
          { x: 222, y: 58 },
          { x: 270, y: 34 },
        ],
      };
    case "breakout":
      return {
        guides: [{ x1: 38, y1: 102, x2: 182, y2: 102, stroke: GUIDE_STROKES.cyan, strokeDasharray: "8 7" }],
        keyPoint: { x: 210, y: 54 },
        path: [
          { x: 22, y: 122 },
          { x: 54, y: 102 },
          { x: 86, y: 116 },
          { x: 118, y: 102 },
          { x: 150, y: 112 },
          { x: 182, y: 86 },
          { x: 210, y: 54 },
          { x: 240, y: 34 },
          { x: 270, y: 26 },
        ],
      };
    case "reversal":
      return {
        guides: [{ x1: 80, y1: 122, x2: 178, y2: 122, stroke: GUIDE_STROKES.violet, strokeDasharray: "8 7" }],
        keyPoint: { x: 132, y: 122 },
        path: [
          { x: 22, y: 40 },
          { x: 58, y: 66 },
          { x: 94, y: 94 },
          { x: 132, y: 122 },
          { x: 168, y: 106 },
          { x: 206, y: 78 },
          { x: 240, y: 54 },
          { x: 270, y: 36 },
        ],
      };
    case "continuation":
      return {
        guides: [
          { x1: 32, y1: 126, x2: 142, y2: 42, stroke: GUIDE_STROKES.white, opacity: 0.36 },
          { x1: 132, y1: 48, x2: 224, y2: 78, stroke: GUIDE_STROKES.white, strokeDasharray: "7 7", opacity: 0.54 },
        ],
        keyPoint: { x: 226, y: 52 },
        path: [
          { x: 22, y: 128 },
          { x: 58, y: 96 },
          { x: 94, y: 66 },
          { x: 130, y: 42 },
          { x: 164, y: 66 },
          { x: 194, y: 78 },
          { x: 226, y: 52 },
          { x: 270, y: 26 },
        ],
      };
    case "custom":
    default:
      return {
        guides: [
          { x1: 22, y1: 124, x2: 270, y2: 124, stroke: "rgba(255,255,255,0.10)", strokeDasharray: "5 8" },
          { x1: 22, y1: 34, x2: 270, y2: 34, stroke: "rgba(255,255,255,0.08)", strokeDasharray: "5 8" },
        ],
        keyPoint: { x: 196, y: 52 },
        path: [
          { x: 22, y: 118 },
          { x: 58, y: 98 },
          { x: 94, y: 82 },
          { x: 126, y: 92 },
          { x: 160, y: 78 },
          { x: 196, y: 52 },
          { x: 232, y: 46 },
          { x: 270, y: 62 },
        ],
      };
  }
}

function PreviewGuideLine({ guide }: { guide: PreviewGuide }) {
  const stroke = guide.stroke ?? "rgba(255,255,255,0.18)";
  const props: SVGProps<SVGPathElement | SVGLineElement> = {
    opacity: guide.opacity ?? 1,
    stroke,
    strokeDasharray: guide.strokeDasharray,
    strokeLinecap: "round",
    strokeWidth: guide.strokeWidth ?? 1.5,
  };

  if (guide.d) {
    return <path d={guide.d} fill="none" {...(props as SVGProps<SVGPathElement>)} />;
  }

  return (
    <line
      x1={guide.x1}
      x2={guide.x2}
      y1={guide.y1}
      y2={guide.y2}
      {...(props as SVGProps<SVGLineElement>)}
    />
  );
}

function TechnicalSetupArt({
  kind,
  staticPreview = false,
  tone,
}: {
  kind: JournalSetupPreviewKind;
  staticPreview?: boolean;
  tone: JournalSetupPreviewTone;
}) {
  const scene = getTechnicalScene(kind);
  const activePath = pathFromPoints(scene.path);
  const postPath = scene.postPath ? pathFromPoints(scene.postPath) : null;
  const glowColor = JOURNAL_SETUP_TONE_COLORS[tone];

  return (
    <>
      <path d="M18 136H270" stroke="rgba(255,255,255,0.06)" strokeDasharray="5 9" />
      <path d="M18 24H270" stroke="rgba(255,255,255,0.055)" strokeDasharray="5 9" />
      {scene.guides.map((guide, index) => (
        <PreviewGuideLine key={`${kind}-guide-${index}`} guide={guide} />
      ))}
      <path
        d={activePath}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.2"
      />
      <path
        d={activePath}
        fill="none"
        filter={`url(#journal-setup-glow-${kind})`}
        stroke="currentColor"
        strokeDasharray="360"
        strokeDashoffset={staticPreview ? "0" : "360"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.5"
        style={{ color: glowColor }}
      >
        {staticPreview ? null : (
          <animate attributeName="stroke-dashoffset" values="360;0;0" dur="3.15s" repeatCount="indefinite" />
        )}
      </path>
      {postPath ? (
        <path d={postPath} fill="none" stroke="rgba(255,255,255,0.18)" strokeLinecap="round" strokeWidth="2.5" />
      ) : null}
      <circle cx={scene.keyPoint.x} cy={scene.keyPoint.y} fill="none" r="13" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" style={{ color: glowColor }}>
        {staticPreview ? null : <animate attributeName="r" values="9;18;9" dur="2.2s" repeatCount="indefinite" />}
        {staticPreview ? null : <animate attributeName="opacity" values="0.20;0.62;0.20" dur="2.2s" repeatCount="indefinite" />}
      </circle>
      <circle
        cx={scene.keyPoint.x}
        cy={scene.keyPoint.y}
        fill="rgba(5,7,12,0.90)"
        filter={`url(#journal-setup-glow-${kind})`}
        r="6"
        stroke="currentColor"
        strokeWidth="2.5"
        style={{ color: glowColor }}
      >
        {staticPreview ? null : <animate attributeName="r" values="4.4;7.5;4.4" dur="2.2s" repeatCount="indefinite" />}
      </circle>
    </>
  );
}

function VibesSetupArt({ staticPreview = false }: { staticPreview?: boolean }) {
  return (
    <>
      <ellipse cx="144" cy="84" rx="46" ry="58" stroke="rgba(139,92,246,0.24)" strokeWidth="1.4">
        {staticPreview ? null : (
          <>
            <animate attributeName="rx" values="42;60;42" dur="3.8s" repeatCount="indefinite" />
            <animate attributeName="ry" values="54;72;54" dur="3.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.34;0.74;0.34" dur="3.8s" repeatCount="indefinite" />
          </>
        )}
      </ellipse>
      <ellipse cx="144" cy="84" rx="78" ry="38" stroke="rgba(34,211,238,0.18)" strokeWidth="1.2">
        {staticPreview ? null : (
          <>
            <animate attributeName="rx" values="64;88;64" dur="4.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.20;0.52;0.20" dur="4.4s" repeatCount="indefinite" />
          </>
        )}
      </ellipse>
      <path
        d="M76 80 L54 66 M76 108 L50 118 M212 76 L236 60 M212 108 L238 120 M144 20 L144 6 M110 26 L96 12 M178 26 L192 12"
        stroke="rgba(139,92,246,0.66)"
        strokeLinecap="round"
        strokeWidth="2"
      >
        {staticPreview ? null : (
          <animate attributeName="opacity" values="0.28;0.82;0.28" dur="2.7s" repeatCount="indefinite" />
        )}
      </path>
      <g filter="url(#journal-setup-glow-vibes)">
        {staticPreview ? null : (
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -7; 0 0" dur="3.3s" repeatCount="indefinite" />
        )}
        <circle cx="144" cy="50" r="13" fill="rgba(5,7,12,0.76)" stroke="rgba(196,181,253,0.92)" strokeWidth="3" />
        <path
          d="M144 64 L144 88 M144 73 L116 54 M144 73 L172 54 M124 98 C135 86 153 86 164 98 M124 98 C108 110 96 118 82 120 M164 98 C180 110 192 118 206 120"
          stroke="rgba(196,181,253,0.94)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4.2"
        />
        <circle cx="114" cy="53" r="4" fill="rgba(34,211,238,0.86)" />
        <circle cx="174" cy="53" r="4" fill="rgba(34,211,238,0.86)" />
      </g>
      <path
        d="M92 134 C122 146 166 146 196 134"
        stroke="rgba(255,255,255,0.14)"
        strokeDasharray="5 8"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </>
  );
}

function NewsEventSetupArt({ staticPreview = false }: { staticPreview?: boolean }) {
  const impulsePath = "M24 124 L78 122 L124 122 L154 120 L168 82 L188 54 L208 86 L264 82";

  return (
    <>
      <path
        d={impulsePath}
        fill="none"
        stroke="rgba(245,158,11,0.18)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d={impulsePath}
        fill="none"
        filter="url(#journal-setup-glow-news-event)"
        stroke="rgba(245,158,11,0.64)"
        strokeDasharray="320"
        strokeDashoffset={staticPreview ? "0" : "320"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.5"
      >
        {staticPreview ? null : (
          <animate attributeName="stroke-dashoffset" values="320;0;0" dur="3.4s" repeatCount="indefinite" />
        )}
      </path>
      <g filter="url(#journal-setup-glow-news-event)">
        <rect x="48" y="22" width="192" height="92" rx="16" fill="rgba(8,13,24,0.88)" stroke="rgba(255,255,255,0.16)" />
        <circle cx="72" cy="48" r="10" fill="rgba(34,211,238,0.28)" stroke="rgba(34,211,238,0.52)" />
        <text x="90" y="44" fill="rgba(255,255,255,0.86)" fontSize="9" fontWeight="700" letterSpacing="1.1">
          PORTAL WIRE
        </text>
        <text x="90" y="58" fill="rgba(255,255,255,0.38)" fontFamily="monospace" fontSize="8">
          @portalwire
        </text>
        <text x="216" y="48" fill="rgba(255,255,255,0.72)" fontSize="14" fontWeight="700">
          X
        </text>
        <text x="68" y="80" fill="rgba(255,255,255,0.84)" fontSize="11" fontWeight="600">
          Today at 10, the world
        </text>
        <text x="68" y="96" fill="rgba(255,255,255,0.84)" fontSize="11" fontWeight="600">
          will end yet again.
        </text>
        <circle cx="226" cy="28" r="5" fill="rgba(245,158,11,0.80)">
          {staticPreview ? null : (
            <>
              <animate attributeName="r" values="4;7;4" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;1;0.55" dur="1.8s" repeatCount="indefinite" />
            </>
          )}
        </circle>
      </g>
    </>
  );
}

export function JournalSetupPreviewArtwork({
  metadata,
  staticPreview = false,
}: {
  metadata: JournalSetupMetadata;
  staticPreview?: boolean;
}) {
  if (metadata.kind === "vibes") {
    return <VibesSetupArt staticPreview={staticPreview} />;
  }

  if (metadata.kind === "news-event") {
    return <NewsEventSetupArt staticPreview={staticPreview} />;
  }

  return <TechnicalSetupArt kind={metadata.kind} staticPreview={staticPreview} tone={metadata.tone} />;
}

export function JournalSetupPreview({ metadata, tag }: { metadata: JournalSetupMetadata; tag: string }) {
  const accentClass =
    metadata.tone === "amber"
      ? "text-amber-200"
      : metadata.tone === "violet"
        ? "text-violet-200"
        : "text-cyan-200";
  const glowColor = JOURNAL_SETUP_TONE_COLORS[metadata.tone];

  return (
    <div className="relative flex h-full min-h-[230px] flex-col overflow-hidden rounded-portal-panel border border-white/[0.065] bg-[radial-gradient(circle_at_22%_18%,rgba(34,211,238,0.10),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(139,92,246,0.12),transparent_32%),linear-gradient(180deg,rgba(9,14,24,0.92),rgba(5,7,12,0.96))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`text-[10px] font-medium uppercase tracking-[0.18em] ${accentClass}`}>
            Setup Signal
          </div>
          <div className="mt-2 text-xl font-medium text-white/92">{tag}</div>
        </div>
        <div className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/42">
          Preview
        </div>
      </div>

      <div className="relative mt-4 min-h-[128px] flex-1">
        <svg aria-hidden="true" className="h-full min-h-[128px] w-full" fill="none" viewBox="0 0 288 156">
          <defs>
            <filter id={`journal-setup-glow-${metadata.kind}`} x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="0 0 0 0 0.2 0 0 0 0 0.96 0 0 0 0 1 0 0 0 0.55 0"
              />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id={`journal-setup-wormhole-${metadata.kind}`} cx="50%" cy="48%" r="62%">
              <stop offset="0%" stopColor={glowColor} stopOpacity="0.16" />
              <stop offset="48%" stopColor="rgba(139,92,246,0.10)" />
              <stop offset="100%" stopColor="rgba(5,7,12,0)" />
            </radialGradient>
          </defs>
          <rect width="288" height="156" fill={`url(#journal-setup-wormhole-${metadata.kind})`} opacity="0.78" />
          <JournalSetupPreviewArtwork metadata={metadata} />
        </svg>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4 text-sm leading-6 text-white/58">
        {metadata.description}
      </div>
    </div>
  );
}
