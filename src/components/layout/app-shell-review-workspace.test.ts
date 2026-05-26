import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("AI Coach and Diagnosis do not render workspace expand controls", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.doesNotMatch(appShellSource, /Expand AI Coach|Collapse AI Coach/);
  assert.doesNotMatch(appShellSource, /Expand diagnosis|Collapse diagnosis/);
});

test("avatar Insight rail click uses the in-shell subsystem reveal", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /pinnedAvatarSubsystem/);
  assert.match(
    appShellSource,
    /onPointerEnter=\{\(\) => \{[\s\S]*setActiveAvatarSubsystem\(subsystem\.id\);[\s\S]*\}\}/,
  );
  assert.match(
    appShellSource,
    /if \(subsystem\.id === "soul"\)[\s\S]*openAvatarCommandCenter\("soul"\)/,
  );
  assert.match(
    appShellSource,
    /:\s*"absolute inset-x-0 bottom-0 z-20 px-4 pb-2 pt-1"[\s\S]*\} transition-none`/,
  );
  assert.doesNotMatch(appShellSource, /transition-\[height,width,transform\]/);
});

test("baseline import overlays stay above command center surfaces", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(
    appShellSource,
    /isBaselineImportWizardOpen[\s\S]*<div className="fixed inset-0 z-\[90\] flex items-center justify-center/,
  );
  assert.match(
    appShellSource,
    /openBaselineProfileBundle[\s\S]*<div className="fixed inset-0 z-\[90\] bg-\[linear-gradient/,
  );
  assert.doesNotMatch(
    appShellSource,
    /isBaselineImportWizardOpen[\s\S]*<div className="absolute inset-0 z-30/,
  );
});

test("baseline import preview labels aggregated source-health counts", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /validated rows/);
  assert.match(appShellSource, /boundary excluded/);
  assert.match(appShellSource, /Boundary fills excluded/);
  assert.match(appShellSource, /sourceHealth[\s\S]*aggregatedFillCount/);
  assert.match(appShellSource, /sourceHealth[\s\S]*recommendationTradeCount/);
});

test("Context Source onboarding is upload-first and demotes wallet API scanning", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /Upload Hyperliquid Full History/);
  assert.match(appShellSource, /Trade History CSV/);
  assert.match(appShellSource, /Funding History CSV/);
  assert.match(appShellSource, /Deposits\/Withdrawals CSV/);
  assert.match(
    appShellSource,
    /These files allow Portal to build a more complete behavioral baseline than the capped API scan\./,
  );
  assert.match(appShellSource, /Recent API Scan/);
  assert.match(appShellSource, /Not full history/);
  assert.match(
    appShellSource,
    /Not recommended for serious baseline analysis/,
  );
  assert.doesNotMatch(appShellSource, />Run Baseline Scan</);
  assert.doesNotMatch(appShellSource, />Scan wallet</);
});

test("saved baseline modal uses coach-readable performance and source health labels", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /Reconstructed closed-trade net/);
  assert.doesNotMatch(appShellSource, /Net after fees/);
  assert.match(appShellSource, /Estimated fees on closed trades/);
  assert.match(appShellSource, /Gross before fees/);
  assert.match(appShellSource, /Avg closed trade/);
  assert.match(appShellSource, /Source Health/);
  assert.match(appShellSource, /No reliable timing pattern yet/);
  assert.doesNotMatch(
    appShellSource,
    /\$\{row\.key\} \$\{formatUsd\(row\.averageNetPnl\)\}/,
  );
  assert.doesNotMatch(
    appShellSource,
    /byHoldTimeBucket[\s\S]{0,400}\.map\(/,
  );
});

test("saved baseline modal labels session intelligence as imported directional context", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /Session Intelligence/);
  assert.match(appShellSource, /Timezone Used/);
  assert.match(appShellSource, /Overnight Sessions/);
  assert.match(appShellSource, /Weekend Sessions/);
  assert.match(appShellSource, /High-density Sessions/);
  assert.match(appShellSource, /Post-loss Clusters/);
  assert.match(appShellSource, /Revenge-risk Sessions/);
  assert.match(appShellSource, /Supporting Context/);
  assert.match(appShellSource, /supporting signals/);
  assert.match(appShellSource, /Evidence Comparison/);
  assert.match(appShellSource, /Comparison only/);
  assert.match(appShellSource, /Recommended use/);
  assert.match(appShellSource, /Source warnings/);
  assert.match(appShellSource, /confidenceLabel/);
  assert.match(appShellSource, /Native evidence owns\s+diagnosis/);
  assert.match(appShellSource, /Directional context/);
  assert.match(appShellSource, /Imported context only/);
  assert.match(appShellSource, /Not native Journal evidence/);
  assert.match(appShellSource, /Not diagnosis-grade yet/);
});

test("native session source health stays observable without diagnosis promotion", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /Portal Native Sessions/);
  assert.match(appShellSource, /Native session engine available/);
  assert.match(appShellSource, /Diagnosis-grade/);
  assert.match(appShellSource, /Some sessions are blocked/);
  assert.match(appShellSource, /Not yet promoted into Operator Diagnosis/);
  assert.match(appShellSource, /summarizeNativeSessionSourceHealth/);
  assert.match(appShellSource, /mapNativeSessionsToEvidenceComparisonSummaries/);
});

test("native session review candidates render separately from primary diagnosis findings", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /Native Session Review Candidates/);
  assert.match(appShellSource, /Review-only/);
  assert.match(appShellSource, /No rule\s+has been activated/);
  assert.match(appShellSource, /nativeSessionReviewCandidates/);
  assert.match(appShellSource, /nativeSessions:\s*portalNativeSessions/);
  assert.doesNotMatch(
    appShellSource,
    /recommendedPlan:\s*buildRecommendedPlan\([^)]*nativeSessionReviewCandidates/,
  );
});

test("operator diagnosis findings expose review-only evidence drawers", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /buildEvidenceDrawerForOperatorFinding/);
  assert.match(appShellSource, /buildEvidenceDrawerForNativeSessionReviewCandidate/);
  assert.match(appShellSource, /buildEvidenceDrawerForImportedSupportingContext/);
  assert.match(appShellSource, /buildEvidenceDrawerForComparison/);
  assert.match(appShellSource, /openEvidenceDrawerId/);
  assert.match(appShellSource, /View evidence/);
  assert.match(appShellSource, /Why\?/);
  assert.match(appShellSource, /Evidence Drawer/);
  assert.match(appShellSource, /This is review-only\. No rule has been activated\./);
  assert.match(appShellSource, /Imported Historical Baseline appears only as supporting context/);
  assert.doesNotMatch(
    appShellSource,
    /Evidence Drawer[\s\S]{0,3000}Imported history proves/,
  );
});

test("Operator Intelligence refinement merges integrity and reduces dashboard copy", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );
  const diagnosisSource =
    appShellSource.match(
      /selectedFooterTab === "diagnosis"[\s\S]*?selectedFooterTab === "session-logs"/,
    )?.[0] ?? appShellSource;

  assert.match(diagnosisSource, /Operator Intelligence/);
  assert.match(diagnosisSource, /Primary Operator Finding/);
  assert.match(diagnosisSource, /The machine found your biggest operational leak/);
  assert.match(diagnosisSource, /Evidence Integrity/);
  assert.match(diagnosisSource, /Native Evidence/);
  assert.match(diagnosisSource, /Imported Context/);
  assert.match(diagnosisSource, /Session Pressure Map/);
  assert.match(diagnosisSource, /behavioral pressure map/);
  assert.match(diagnosisSource, /Review-only native session signals/);
  assert.match(diagnosisSource, /No rule has been activated/);
  assert.doesNotMatch(diagnosisSource, /Evidence Quality/);
  assert.doesNotMatch(diagnosisSource, /Data Quality/);
});
