import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildSessionIntelligenceDebugOutput,
  runHistoricalBaselineScan,
  validateHyperliquidAccountAddress,
  type BaselineImportRequest,
} from "../src/features/baseline-import";
import { selectImportedSessionSupportingContext } from "../src/features/diagnosis/lib/imported-session-supporting-context";
import {
  compareEvidenceSources,
  summarizeEvidenceComparisonDebugOutput,
} from "../src/features/diagnosis/lib/evidence-comparison";

type CliOptions = {
  address?: string;
  end?: string;
  environment?: "mainnet" | "testnet";
  output?: string;
  start?: string;
  timezone?: string;
};

function readCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      continue;
    }

    switch (flag) {
      case "--address":
        options.address = value;
        break;
      case "--end":
        options.end = value;
        break;
      case "--environment":
        if (value === "mainnet" || value === "testnet") {
          options.environment = value;
        }
        break;
      case "--output":
        options.output = value;
        break;
      case "--start":
        options.start = value;
        break;
      case "--timezone":
        options.timezone = value;
        break;
      default:
        break;
    }
  }

  return options;
}

function parseDateBoundary(value: string, boundary: "start" | "end") {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? boundary === "start"
      ? `${value}T00:00:00.000Z`
      : `${value}T23:59:59.999Z`
    : value;
  const parsed = Date.parse(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRequest(options: CliOptions): BaselineImportRequest {
  if (!options.address || !validateHyperliquidAccountAddress(options.address)) {
    throw new Error("Pass a valid Hyperliquid account with --address 0x...");
  }

  const startTime = options.start ? parseDateBoundary(options.start, "start") : null;
  const endTime = options.end ? parseDateBoundary(options.end, "end") : null;

  if (startTime === null || endTime === null || endTime <= startTime) {
    throw new Error("Pass a valid date range with --start and --end.");
  }

  return {
    accountAddress: options.address.trim(),
    endTime,
    environment: options.environment ?? "mainnet",
    startTime,
    timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  };
}

async function main() {
  const options = readCliOptions(process.argv.slice(2));
  const request = buildRequest(options);
  const outputPath = path.resolve(
    process.cwd(),
    options.output ?? ".portal/audits/session-intelligence-latest.json",
  );

  const result = await runHistoricalBaselineScan(request);

  if (!result.sessionIntelligence) {
    throw new Error("Session intelligence was not produced for this scan.");
  }

  const importedContexts = selectImportedSessionSupportingContext({
    sessionIntelligence: result.sessionIntelligence,
    sourceWarnings: result.warnings,
  });
  const evidenceComparison = summarizeEvidenceComparisonDebugOutput(
    compareEvidenceSources({
      importedContexts,
      nativeEvidence: [],
      sourceWarnings: result.warnings,
    }),
  );
  const debugOutput = buildSessionIntelligenceDebugOutput(request, result.sessionIntelligence, {
    evidenceComparison,
    sourceQualityWarnings: result.warnings,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(debugOutput, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(
    [
      `${debugOutput.sessionCount} sessions`,
      `${debugOutput.overnightSessionCount} overnight`,
      `${debugOutput.weekendSessionCount} weekend`,
      `${debugOutput.highDensitySessionCount} high-density`,
      `${debugOutput.totalSessionNetPnl} net PnL`,
    ].join(" · "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
