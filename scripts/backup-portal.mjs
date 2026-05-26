#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

const DEFAULT_BACKUP_DIR = resolve(repoRoot, "..", "portal-backups");
const DEFAULT_KEEP_COUNT = 96;
const DEFAULT_ICLOUD_ROOT = process.env.HOME
  ? resolve(process.env.HOME, "Library", "Mobile Documents", "com~apple~CloudDocs")
  : null;
const DEFAULT_MIRROR_DIR = DEFAULT_ICLOUD_ROOT
  ? resolve(DEFAULT_ICLOUD_ROOT, "Portal Backups", "portal-backups")
  : null;

const EXCLUDES = [
  "./node_modules",
  "./node_modules/*",
  "./.next",
  "./.next/*",
  "./.next-dev",
  "./.next-dev/*",
  "./out",
  "./out/*",
  "./output",
  "./output/*",
  "./tmp",
  "./tmp/*",
  "./.playwright-cli",
  "./.playwright-cli/*",
  "./.venv-hl",
  "./.venv-hl/*",
  "./portal-trading-site/node_modules",
  "./portal-trading-site/node_modules/*",
  "./portal-trading-site/.next",
  "./portal-trading-site/.next/*",
  "./portal-trading-site/out",
  "./portal-trading-site/out/*",
  "./tsconfig.tsbuildinfo",
  "./.DS_Store",
];

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveMirrorDir() {
  const configured = readArg(
    "--mirror-dir",
    process.env.PORTAL_BACKUP_MIRROR_DIR || "",
  );

  if (configured) {
    return configured === "none" ? null : resolve(configured);
  }

  if (DEFAULT_ICLOUD_ROOT && (await pathExists(DEFAULT_ICLOUD_ROOT))) {
    return DEFAULT_MIRROR_DIR;
  }

  return null;
}

function readIntArg(name, fallback) {
  const raw = readArg(name, String(fallback));
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestampForFile(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
    ...options,
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} failed with exit ${result.status}\n${detail}`);
  }

  return result;
}

async function enforceRetention(backupDir, keepCount) {
  const entries = await readdir(backupDir);
  const archives = entries.filter((entry) =>
    /^portal-source-\d{8}-\d{6}\.tar\.gz$/.test(entry),
  );

  const archiveStats = await Promise.all(
    archives.map(async (entry) => {
      const archivePath = join(backupDir, entry);
      const archiveStat = await stat(archivePath);
      return { entry, archivePath, mtimeMs: archiveStat.mtimeMs };
    }),
  );

  archiveStats.sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const oldArchive of archiveStats.slice(keepCount)) {
    await unlink(oldArchive.archivePath).catch(() => {});
    await unlink(
      join(backupDir, oldArchive.entry.replace(/\.tar\.gz$/, ".manifest.json")),
    ).catch(() => {});
  }
}

async function writeManifest(manifestPath, manifest) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function mirrorBackup({ mirrorDir, manifest }) {
  if (!mirrorDir) return null;

  await mkdir(mirrorDir, { recursive: true });

  const mirrorArchivePath = join(mirrorDir, manifest.archiveName);
  const mirrorManifestPath = join(
    mirrorDir,
    manifest.archiveName.replace(/\.tar\.gz$/, ".manifest.json"),
  );

  await copyFile(manifest.archive, mirrorArchivePath);

  const mirrorArchiveStat = await stat(mirrorArchivePath);
  const mirrorSha256 = await sha256File(mirrorArchivePath);
  if (mirrorSha256 !== manifest.sha256) {
    throw new Error(
      [
        "Mirrored backup checksum mismatch.",
        `Source: ${manifest.archive}`,
        `Mirror: ${mirrorArchivePath}`,
        `Expected: ${manifest.sha256}`,
        `Actual:   ${mirrorSha256}`,
      ].join("\n"),
    );
  }

  const mirrorManifest = {
    ...manifest,
    backupDir: mirrorDir,
    archive: mirrorArchivePath,
    manifest: mirrorManifestPath,
    sizeBytes: mirrorArchiveStat.size,
    sha256: mirrorSha256,
    mirroredFrom: {
      backupDir: manifest.backupDir,
      archive: manifest.archive,
      manifest: manifest.manifest,
    },
  };

  await writeManifest(mirrorManifestPath, mirrorManifest);
  await writeManifest(join(mirrorDir, "latest-manifest.json"), mirrorManifest);
  await enforceRetention(mirrorDir, manifest.keepCount);

  return mirrorManifest;
}

const backupDir = resolve(
  readArg("--backup-dir", process.env.PORTAL_BACKUP_DIR || DEFAULT_BACKUP_DIR),
);
const mirrorDir = await resolveMirrorDir();
const keepCount = readIntArg(
  "--keep",
  Number.parseInt(process.env.PORTAL_BACKUP_KEEP || "", 10) || DEFAULT_KEEP_COUNT,
);
const createdAt = new Date();
const stamp = timestampForFile(createdAt);
const archiveName = `portal-source-${stamp}.tar.gz`;
const archivePath = join(backupDir, archiveName);
const manifestPath = join(
  backupDir,
  archiveName.replace(/\.tar\.gz$/, ".manifest.json"),
);

await mkdir(backupDir, { recursive: true });

const tarArgs = [
  "-czf",
  archivePath,
  "-C",
  repoRoot,
  ...EXCLUDES.flatMap((pattern) => [`--exclude=${pattern}`]),
  ".",
];

run("tar", tarArgs);

const archiveStat = await stat(archivePath);
const sha256 = await sha256File(archivePath);
const listResult = run("tar", ["-tzf", archivePath], { cwd: backupDir });
const fileCount = listResult.stdout
  .split("\n")
  .filter((line) => line.trim().length > 0).length;

const manifest = {
  backupVersion: 1,
  createdAt: createdAt.toISOString(),
  repoRoot,
  backupDir,
  archive: archivePath,
  archiveName: basename(archivePath),
  manifest: manifestPath,
  sizeBytes: archiveStat.size,
  sha256,
  fileCount,
  keepCount,
  excludes: EXCLUDES,
  node: process.version,
};

await writeManifest(manifestPath, manifest);
await copyFile(manifestPath, join(backupDir, "latest-manifest.json"));
await enforceRetention(backupDir, keepCount);
const mirrorManifest = await mirrorBackup({ mirrorDir, manifest });

console.log(`Portal backup created: ${archivePath}`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Files archived: ${fileCount}`);
console.log(`Size: ${archiveStat.size} bytes`);
console.log(`SHA256: ${sha256}`);
if (mirrorManifest) {
  console.log(`Off-machine mirror: ${mirrorManifest.archive}`);
}
