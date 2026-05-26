import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  DEFAULT_JOURNAL_SETUP_TAGS,
  getJournalSetupMetadata,
  JournalSetupPreviewArtwork,
  JOURNAL_SETUP_TONE_COLORS,
  type JournalSetupMetadata,
} from "../../src/features/journal/components/journal-setup-preview";

export const JOURNAL_SETUP_PREVIEW_LAB_WIDTH = 1920;
export const JOURNAL_SETUP_PREVIEW_LAB_HEIGHT = 1080;
export const JOURNAL_SETUP_PREVIEW_LAB_FPS = 30;
export const JOURNAL_SETUP_PREVIEW_LAB_DURATION_FRAMES = JOURNAL_SETUP_PREVIEW_LAB_FPS * 4;

const COLORS = {
  void: "#05060A",
  panel: "rgba(8, 13, 24, 0.88)",
  cyan: "#33F5FF",
  purple: "#8B5CF6",
  amber: "#F59E0B",
  white: "#F8FAFC",
  muted: "rgba(226, 232, 240, 0.58)",
} as const;

const setupTags = [...DEFAULT_JOURNAL_SETUP_TAGS];

const ease = Easing.bezier(0.16, 1, 0.3, 1);

function LabPreviewSvg({ metadata }: { metadata: JournalSetupMetadata }) {
  const glowColor = JOURNAL_SETUP_TONE_COLORS[metadata.tone];

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 288 156" style={{ height: 128, width: "100%" }}>
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
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.18" />
          <stop offset="48%" stopColor="rgba(139,92,246,0.10)" />
          <stop offset="100%" stopColor="rgba(5,7,12,0)" />
        </radialGradient>
      </defs>
      <rect width="288" height="156" fill={`url(#journal-setup-wormhole-${metadata.kind})`} opacity="0.85" />
      <JournalSetupPreviewArtwork metadata={metadata} staticPreview />
    </svg>
  );
}

function LabCard({ index, tag }: { index: number; tag: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const metadata = getJournalSetupMetadata(tag);
  const accent = JOURNAL_SETUP_TONE_COLORS[metadata.tone];
  const start = index * 2;
  const enter = interpolate(frame, [start, start + fps * 0.42], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background:
          "radial-gradient(circle at 22% 18%, rgba(51, 245, 255, 0.09), transparent 32%), radial-gradient(circle at 80% 12%, rgba(139, 92, 246, 0.12), transparent 34%), linear-gradient(180deg, rgba(9, 14, 24, 0.94), rgba(5, 7, 12, 0.98))",
        border: `1px solid ${index === 0 ? "rgba(139, 92, 246, 0.30)" : "rgba(255, 255, 255, 0.08)"}`,
        borderRadius: 22,
        boxShadow: `0 0 ${16 + enter * 18}px rgba(51, 245, 255, ${0.04 + enter * 0.06}), inset 0 1px 0 rgba(255, 255, 255, 0.08)`,
        minHeight: 222,
        opacity: enter,
        overflow: "hidden",
        padding: "17px 18px 14px",
        transform: `translateY(${(1 - enter) * 22}px) scale(${0.985 + enter * 0.015})`,
      }}
    >
      <div style={{ alignItems: "flex-start", display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div
            style={{
              color: accent,
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 780,
              letterSpacing: 2.3,
              textTransform: "uppercase",
            }}
          >
            Setup Signal
          </div>
          <div
            style={{
              color: COLORS.white,
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 720,
              letterSpacing: 0,
              marginTop: 7,
            }}
          >
            {tag}
          </div>
        </div>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 999,
            color: "rgba(255,255,255,0.44)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            fontWeight: 760,
            letterSpacing: 1.7,
            padding: "6px 10px",
            textTransform: "uppercase",
          }}
        >
          Preview
        </div>
      </div>
      <LabPreviewSvg metadata={metadata} />
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          color: COLORS.muted,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: 12,
          lineHeight: 1.35,
          marginTop: 5,
          paddingTop: 9,
        }}
      >
        {metadata.description}
      </div>
    </div>
  );
}

export const JournalSetupPreviewLab = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const glow = Math.sin((frame / fps) * 1.4) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.void, overflow: "hidden" }}>
      <div
        style={{
          inset: 0,
          opacity: 0.78,
          position: "absolute",
          background:
            "radial-gradient(circle at 50% 34%, rgba(51, 245, 255, 0.16), transparent 26%), radial-gradient(circle at 63% 20%, rgba(139, 92, 246, 0.15), transparent 30%), linear-gradient(180deg, #05060A 0%, #090B14 58%, #05060A 100%)",
        }}
      />
      <div
        style={{
          border: `1px solid rgba(51, 245, 255, ${0.18 + glow * 0.08})`,
          borderRadius: 36,
          boxShadow: `0 0 ${42 + glow * 34}px rgba(51,245,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)`,
          inset: 38,
          padding: 26,
          position: "absolute",
        }}
      >
        <div style={{ alignItems: "end", display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div
              style={{
                color: COLORS.cyan,
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: 3.2,
                textTransform: "uppercase",
              }}
            >
              Journal Setup Preview Lab
            </div>
            <div
              style={{
                color: COLORS.white,
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                fontSize: 40,
                fontWeight: 780,
                letterSpacing: 0,
                marginTop: 8,
              }}
            >
              Portal-native setup signals
            </div>
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.44)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 15,
              fontWeight: 760,
              letterSpacing: 2.4,
              textTransform: "uppercase",
            }}
          >
            11 defaults / hybrid native assets
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 13,
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          }}
        >
          {setupTags.map((tag, index) => (
            <LabCard key={tag} index={index} tag={tag} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
