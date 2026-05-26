import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../components/layout/app-shell.tsx",
);

test("trade footer no longer renders the legacy Armed Magic shortcut", () => {
  const appShellSource = readFileSync(sourcePath, "utf8");

  assert.doesNotMatch(appShellSource, /portal-magic-trade-armed-link/);
  assert.doesNotMatch(appShellSource, />\s*Armed Magic\s*</);
});
