import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const projectRoot = process.cwd();

const terminalUiFiles = [
  "src/components/layout/app-shell.tsx",
  "src/components/ui/panel.tsx",
  "src/components/ui/toast.tsx",
  "src/features/account-activity/components/account-activity-panel.tsx",
  "src/features/ai/components/avatar-soul-panel.tsx",
  "src/features/ai/components/chart-soul-intervention.tsx",
  "src/features/avatar/components/avatar-exp-panel.tsx",
  "src/features/chart/components/chart-area-placeholder.tsx",
  "src/features/chart/components/live-position-rail.tsx",
  "src/features/chart/components/market-switcher.tsx",
  "src/features/chart/components/minimal-price-chart.tsx",
  "src/features/chart/components/timeframe-switcher.tsx",
  "src/features/discipline/components/avatar-armory-panel.tsx",
  "src/features/journal/components/journal-setup-preview.tsx",
  "src/features/session-log/components/activity-session-log-panel.tsx",
];

const allowedRadiusClasses = new Set([
  "rounded-portal-chip",
  "rounded-portal-control",
  "rounded-portal-panel",
  "rounded-portal-modal",
  "rounded-portal-surface",
  "rounded-full",
]);

const allowedPrefixedClass = /^(?:[a-z0-9-]+:)*rounded-(?:portal-(?:chip|control|panel|modal|surface)|full)$/;

function readProjectFile(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

function getLine(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function isCheckboxRadiusException(file: string, source: string, index: number, className: string) {
  if (!file.endsWith("account-activity-panel.tsx")) {
    return false;
  }

  const line = getLine(source, index);
  const nearbySource = source.split("\n").slice(Math.max(0, line - 3), line + 3).join("\n");

  return (
    (className === "rounded-[4px]" && nearbySource.includes("h-[18px] w-[18px]")) ||
    (className === "rounded-[2px]" && nearbySource.includes("h-[10px] w-[10px]"))
  );
}

test("Portal radius tokens are defined in the shared token files", () => {
  const tokens = readProjectFile("src/styles/tokens.css");
  const tailwindConfig = readProjectFile("tailwind.config.ts");
  const globals = readProjectFile("src/app/globals.css");

  for (const [name, value] of [
    ["--portal-radius-surface", "7px"],
    ["--portal-radius-chip", "var\\(--portal-radius-surface\\)"],
    ["--portal-radius-control", "var\\(--portal-radius-surface\\)"],
    ["--portal-radius-panel", "var\\(--portal-radius-surface\\)"],
    ["--portal-radius-modal", "var\\(--portal-radius-surface\\)"],
  ] as const) {
    assert.match(tokens, new RegExp(`${name}: ${value};`));
  }

  for (const token of [
    "portal-surface",
    "portal-chip",
    "portal-control",
    "portal-panel",
    "portal-modal",
  ]) {
    assert.match(tailwindConfig, new RegExp(`\"${token}\"`));
  }

  for (const utility of [
    ".rounded-portal-chip",
    ".rounded-portal-surface",
    ".rounded-portal-control",
    ".rounded-portal-panel",
    ".rounded-portal-modal",
    ".portal-clip-chip",
    ".portal-clip-surface",
    ".portal-clip-control",
    ".portal-clip-panel",
    ".portal-clip-modal",
  ]) {
    assert.match(globals, new RegExp(utility.replace(".", "\\.")));
  }
});

test("terminal UI uses only the official Portal radius classes", () => {
  const failures: string[] = [];

  for (const file of terminalUiFiles) {
    const source = readProjectFile(file);
    const radiusClasses = source.matchAll(/(?:[a-z0-9-]+:)*rounded-(?:\[[^\]]+\]|[a-z0-9-]+)/g);

    for (const match of radiusClasses) {
      const className = match[0];
      if (allowedRadiusClasses.has(className) || allowedPrefixedClass.test(className)) {
        continue;
      }

      if (isCheckboxRadiusException(file, source, match.index, className)) {
        continue;
      }

      failures.push(`${file}: replace ${className} with a Portal radius token`);
    }

    const clipPaths = source.match(/\[clip-path:inset\(0_round_[^\]]+\)\]/g) ?? [];
    for (const clipPath of clipPaths) {
      if (clipPath.includes("999px")) {
        continue;
      }

      failures.push(`${file}: replace ${clipPath} with a portal-clip-* utility`);
    }

    const lines = source.split("\n");
    lines.forEach((line, index) => {
      const roundedToken = line.match(/rounded-portal-(chip|control|panel|modal)/)?.[1];
      const clipToken = line.match(/portal-clip-(chip|control|panel|modal)/)?.[1];

      if (roundedToken && clipToken && roundedToken !== clipToken) {
        failures.push(
          `${file}:${index + 1}: rounded-portal-${roundedToken} must match portal-clip-${clipToken}`,
        );
      }
    });
  }

  assert.deepEqual(failures, []);
});

test("global terminal CSS keeps rectangular radii on the Phoenix surface token", () => {
  const globals = readProjectFile("src/app/globals.css");
  const failures: string[] = [];

  for (const match of globals.matchAll(/border-radius:\s*([^;]+);/g)) {
    const value = match[1].trim();
    if (
      value.includes("var(--portal-radius") ||
      value === "inherit" ||
      value === "999px" ||
      value === "50%" ||
      value === "calc(var(--portal-radius-surface) - 1px)"
    ) {
      continue;
    }

    failures.push(`src/app/globals.css:${getLine(globals, match.index)}: replace border-radius: ${value}`);
  }

  for (const match of globals.matchAll(/clip-path:\s*inset\(0 round ([^)]+)\);/g)) {
    const value = match[1].trim();
    if (value.includes("var(--portal-radius") || value === "999px") {
      continue;
    }

    failures.push(`src/app/globals.css:${getLine(globals, match.index)}: replace clip-path radius ${value}`);
  }

  assert.deepEqual(failures, []);
});
