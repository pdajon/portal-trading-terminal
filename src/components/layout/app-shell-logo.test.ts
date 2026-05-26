import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("terminal header uses the real Portal logo asset", () => {
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );

  assert.match(appShellSource, /\/portal\/brand\/portal-logo-white\.svg/);
});

test("Portal logo asset is SVG-backed and omits the uploaded divider line", () => {
  const logoSource = readFileSync(
    "public/portal/brand/portal-logo-white.svg",
    "utf8",
  );

  assert.match(logoSource, /<svg\b/);
  assert.match(logoSource, /viewBox="0 0 937 214"/);
  assert.doesNotMatch(logoSource, /portal-logo-divider/);
});
