import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildManualHistoryImportDebugOutput,
  runManualHistoryImportFromFiles,
  type ManualHistoryImportFileInput,
} from "../src/features/baseline-import";

type CliOptions = {
  accountAddress?: string;
  environment?: "mainnet" | "testnet";
  files: string[];
  output?: string;
  timezone?: string;
};

function readCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    files: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === "--file" && value && !value.startsWith("--")) {
      options.files.push(value);
      index += 1;
      continue;
    }

    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      continue;
    }

    switch (flag) {
      case "--account-address":
      case "--address":
        options.accountAddress = value;
        break;
      case "--environment":
        if (value === "mainnet" || value === "testnet") {
          options.environment = value;
        }
        break;
      case "--output":
        options.output = value;
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

async function readInputFiles(files: string[]): Promise<ManualHistoryImportFileInput[]> {
  if (files.length === 0) {
    return [
      {
        name: "manual-history-import-sample.csv",
        text:
          "time,coin,side,dir,px,sz,fee,feeToken,closedPnl,oid,tid,startPosition\n" +
          "2026-04-28T12:00:00.000Z,BTC,B,Open Long,100000,0.01,0.15,USDC,0,101,501,0\n" +
          "2026-04-28T12:30:00.000Z,BTC,A,Close Long,100500,0.01,0.15,USDC,5,102,502,0.01\n",
      },
    ];
  }

  return Promise.all(
    files.map(async (filePath) => ({
      name: path.basename(filePath),
      text: await readFile(path.resolve(process.cwd(), filePath), "utf8"),
    })),
  );
}

async function main() {
  const options = readCliOptions(process.argv.slice(2));
  const outputPath = path.resolve(
    process.cwd(),
    options.output ?? ".portal/audits/manual-history-import-latest.json",
  );
  const files = await readInputFiles(options.files);
  const result = runManualHistoryImportFromFiles({
    accountAddress: options.accountAddress,
    environment: options.environment,
    files,
    timezone:
      options.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      "UTC",
  });
  const debugOutput = buildManualHistoryImportDebugOutput(result);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(debugOutput, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(
    [
      `${debugOutput.rowCounts.accepted} accepted rows`,
      `${debugOutput.rowCounts.rejected} rejected rows`,
      `${debugOutput.reconstruction.reconstructedTradeCount} trades`,
      `${debugOutput.reconstruction.reconstructedSessionCount} sessions`,
      debugOutput.sourceQuality.readiness,
    ].join(" · "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
