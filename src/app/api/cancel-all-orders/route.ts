import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const CANCEL_ALL_ORDERS_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_cancel_all_orders.py",
);

export async function POST() {
  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(CANCEL_ALL_ORDERS_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet cancel-all-orders runtime is not installed." },
      { status: 500 },
    );
  }

  if (!process.env.HYPERLIQUID_TESTNET_SECRET_KEY) {
    return Response.json(
      { error: "Missing Hyperliquid testnet signer config." },
      { status: 500 },
    );
  }

  try {
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [CANCEL_ALL_ORDERS_SCRIPT], {
      env: process.env,
      maxBuffer: 1024 * 1024,
    });

    return Response.json(JSON.parse(stdout) as unknown);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet cancel-all-orders bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
        };

        if (parsedError.error) {
          return Response.json({ error: parsedError.error }, { status: 502 });
        }
      } catch {
        // Fall through.
      }
    }

    return Response.json(
      { error: "Unable to cancel all Hyperliquid testnet pending orders." },
      { status: 502 },
    );
  }
}
