import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localStateRoot =
  process.env.PORTAL_LOCAL_STATE_DIR?.trim() || join(homedir(), ".portal-dev");
const projectHash = createHash("sha1").update(projectRoot).digest("hex").slice(0, 10);
const installRoot = join(
  localStateRoot,
  `portal-install-${basename(projectRoot)}-${projectHash}`,
);
const externalNodeModules = join(installRoot, "node_modules");
const workspaceNodeModules = join(projectRoot, "node_modules");
const externalHyperliquidVenv = join(installRoot, "venv-hl");
const workspaceHyperliquidVenv = join(projectRoot, ".venv-hl");
const externalHyperliquidPython = join(externalHyperliquidVenv, "bin", "python");
const externalNextDistDir = join(installRoot, "next-dev");
const workspaceNextDistDir = join(projectRoot, ".portal-next-dev");
const externalNextBuildDistDir = join(installRoot, "next-build");
const workspaceNextBuildDistDir = join(projectRoot, ".portal-next-build");
const packageJsonPath = join(projectRoot, "package.json");
const packageLockPath = join(projectRoot, "package-lock.json");
const installPackageJsonPath = join(installRoot, "package.json");
const installPackageLockPath = join(installRoot, "package-lock.json");
const hyperliquidPythonPackages = [
  "hyperliquid-python-sdk==0.23.0",
  "eth-account==0.13.7",
];
const workspaceSmokeFiles = [
  { relativePath: "tailwind.config.ts" },
  { relativePath: "postcss.config.js" },
  {
    relativePath: "public/asset-icons/btc.svg",
    restoreFrom: "tmp/portal-runtime-clean/public/asset-icons/btc.svg",
  },
  {
    relativePath: "public/asset-icons/eth.svg",
    restoreFrom: "tmp/portal-runtime-clean/public/asset-icons/eth2.svg",
  },
  {
    relativePath: "public/asset-icons/eth2.svg",
    restoreFrom: "tmp/portal-runtime-clean/public/asset-icons/eth2.svg",
  },
  {
    relativePath: "public/asset-icons/sol.svg",
    restoreFrom: "tmp/portal-runtime-clean/public/asset-icons/sol.svg",
  },
  {
    relativePath: "public/portal/avatar/portal-being.svg",
    restoreFrom: "tmp/portal-runtime-clean/public/portal/avatar/portal-being.svg",
  },
];

function readIfExists(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function hasReadableDependencyTree() {
  const smokeFiles = [
    join(externalNodeModules, "arg", "index.js"),
    join(externalNodeModules, "tailwindcss", "lib", "cli.js"),
    join(externalNodeModules, "next", "package.json"),
  ];

  return smokeFiles.every((filePath) => {
    try {
      const fileStat = statSync(filePath);
      if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.blocks === 0) {
        return false;
      }
      readFileSync(filePath);
      return true;
    } catch {
      return false;
    }
  });
}

function isMaterializedRegularFile(filePath) {
  try {
    const fileStat = statSync(filePath);

    return (
      fileStat.isFile() &&
      fileStat.size > 0 &&
      (typeof fileStat.blocks !== "number" || fileStat.blocks > 0)
    );
  } catch {
    return false;
  }
}

function restoreWorkspaceSmokeFile(entry) {
  if (!entry.restoreFrom) {
    return false;
  }

  const targetPath = join(projectRoot, entry.relativePath);
  const restorePath = join(projectRoot, entry.restoreFrom);

  if (!isMaterializedRegularFile(restorePath)) {
    return false;
  }

  try {
    if (existsSync(targetPath)) {
      renameSync(targetPath, `${targetPath}.fileprovider-broken-${Date.now()}`);
    }
    copyFileSync(restorePath, targetPath);
    console.warn(`[portal] restored ${entry.relativePath} from local clean copy`);
    return true;
  } catch {
    return false;
  }
}

function ensureReadableWorkspaceSmokeFiles() {
  const brokenFiles = [];

  for (const entry of workspaceSmokeFiles) {
    const targetPath = join(projectRoot, entry.relativePath);

    if (isMaterializedRegularFile(targetPath)) {
      continue;
    }

    if (restoreWorkspaceSmokeFile(entry) && isMaterializedRegularFile(targetPath)) {
      continue;
    }

    brokenFiles.push(entry.relativePath);
  }

  if (brokenFiles.length === 0) {
    return;
  }

  console.error(
    [
      "[portal] local dev cannot start because critical workspace files are not materialized.",
      "This usually means macOS/iCloud/File Provider left placeholder files in the repo.",
      ...brokenFiles.map((filePath) => ` - ${filePath}`),
      "Make those files available locally, then run `npm run local:repair` again.",
    ].join("\n"),
  );
  process.exit(1);
}

function packageInputsChanged() {
  return (
    readIfExists(packageJsonPath) !== readIfExists(installPackageJsonPath) ||
    readIfExists(packageLockPath) !== readIfExists(installPackageLockPath)
  );
}

function runNpmCi() {
  mkdirSync(installRoot, { recursive: true });
  copyFileSync(packageJsonPath, installPackageJsonPath);
  copyFileSync(packageLockPath, installPackageLockPath);

  const result = spawnSync("npm", ["ci", "--prefix", installRoot], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolvePythonExecutable() {
  const candidates = [
    process.env.PORTAL_HYPERLIQUID_PYTHON?.trim(),
    "/opt/homebrew/bin/python3.14",
    "/opt/homebrew/bin/python3",
    "python3",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], {
      cwd: projectRoot,
      env: process.env,
      stdio: "ignore",
      timeout: 5_000,
    });

    if (result.status === 0) {
      return candidate;
    }
  }

  console.error(
    "[portal] local dev cannot find a Python 3 runtime for the Hyperliquid testnet bridge.",
  );
  process.exit(1);
}

function hasReadableHyperliquidVenv() {
  if (!isMaterializedRegularFile(externalHyperliquidPython)) {
    return false;
  }

  const result = spawnSync(
    externalHyperliquidPython,
    [
      "-c",
      [
        "import requests, urllib3, idna, charset_normalizer",
        "import eth_account",
        "from hyperliquid.info import Info",
        "print('portal-hyperliquid-runtime-ok')",
      ].join("; "),
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      encoding: "utf8",
      stdio: "pipe",
      timeout: 15_000,
    },
  );

  return (
    result.status === 0 &&
    typeof result.stdout === "string" &&
    result.stdout.includes("portal-hyperliquid-runtime-ok")
  );
}

function runHyperliquidVenvInstall() {
  const pythonExecutable = resolvePythonExecutable();

  rmSync(externalHyperliquidVenv, { force: true, recursive: true });
  mkdirSync(installRoot, { recursive: true });

  let result = spawnSync(pythonExecutable, ["-m", "venv", externalHyperliquidVenv], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  result = spawnSync(externalHyperliquidPython, ["-m", "pip", "install", "--upgrade", "pip"], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  result = spawnSync(
    externalHyperliquidPython,
    ["-m", "pip", "install", ...hyperliquidPythonPackages],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (!hasReadableHyperliquidVenv()) {
    console.error("[portal] Hyperliquid Python bridge runtime failed its import smoke test.");
    process.exit(1);
  }
}

function ensureWorkspaceSymlink() {
  const expectedTarget = externalNodeModules;

  try {
    const current = lstatSync(workspaceNodeModules);
    if (current.isSymbolicLink()) {
      const currentTarget = resolve(projectRoot, readlinkSync(workspaceNodeModules));
      if (currentTarget === expectedTarget) {
        return;
      }
      rmSync(workspaceNodeModules);
    } else {
      const archiveName = `node_modules.workspace-archive-${Date.now()}`;
      renameSync(workspaceNodeModules, join(projectRoot, archiveName));
    }
  } catch {
    // Missing node_modules is fine; the symlink will be created below.
  }

  symlinkSync(expectedTarget, workspaceNodeModules, "dir");
}

function ensureHyperliquidVenvSymlink() {
  const expectedTarget = externalHyperliquidVenv;

  try {
    const current = lstatSync(workspaceHyperliquidVenv);
    if (current.isSymbolicLink()) {
      const currentTarget = resolve(projectRoot, readlinkSync(workspaceHyperliquidVenv));
      if (currentTarget === expectedTarget) {
        return;
      }
      rmSync(workspaceHyperliquidVenv);
    } else {
      const archiveName = `.venv-hl.workspace-archive-${Date.now()}`;
      renameSync(workspaceHyperliquidVenv, join(projectRoot, archiveName));
    }
  } catch {
    // Missing Python venv is fine; the symlink will be created below.
  }

  symlinkSync(expectedTarget, workspaceHyperliquidVenv, "dir");
}

function ensureNextDistSymlink() {
  mkdirSync(externalNextDistDir, { recursive: true });

  try {
    const current = lstatSync(workspaceNextDistDir);
    if (current.isSymbolicLink()) {
      const currentTarget = resolve(projectRoot, readlinkSync(workspaceNextDistDir));
      if (currentTarget === externalNextDistDir) {
        return;
      }
      rmSync(workspaceNextDistDir);
    } else {
      const archiveName = `.portal-next-dev.workspace-archive-${Date.now()}`;
      renameSync(workspaceNextDistDir, join(projectRoot, archiveName));
    }
  } catch {
    // Missing dist dir is fine; the symlink will be created below.
  }

  symlinkSync(externalNextDistDir, workspaceNextDistDir, "dir");
}

function ensureNextBuildDistSymlink() {
  mkdirSync(externalNextBuildDistDir, { recursive: true });

  try {
    const current = lstatSync(workspaceNextBuildDistDir);
    if (current.isSymbolicLink()) {
      const currentTarget = resolve(projectRoot, readlinkSync(workspaceNextBuildDistDir));
      if (currentTarget === externalNextBuildDistDir) {
        return;
      }
      rmSync(workspaceNextBuildDistDir);
    } else {
      const archiveName = `.portal-next-build.workspace-archive-${Date.now()}`;
      renameSync(workspaceNextBuildDistDir, join(projectRoot, archiveName));
    }
  } catch {
    // Missing build dist dir is fine; the symlink will be created below.
  }

  symlinkSync(externalNextBuildDistDir, workspaceNextBuildDistDir, "dir");
}

mkdirSync(localStateRoot, { recursive: true });

if (!existsSync(externalNodeModules) || packageInputsChanged() || !hasReadableDependencyTree()) {
  runNpmCi();
}

if (!existsSync(externalHyperliquidVenv) || !hasReadableHyperliquidVenv()) {
  runHyperliquidVenvInstall();
}

ensureWorkspaceSymlink();
ensureHyperliquidVenvSymlink();
ensureNextDistSymlink();
ensureNextBuildDistSymlink();
ensureReadableWorkspaceSmokeFiles();
