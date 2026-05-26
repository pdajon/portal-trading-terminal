#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const DEFAULT_BACKUP_DIR = resolve(repoRoot, "..", "portal-backups");
const DEFAULT_RESTORE_ROOT = resolve(repoRoot, "..", "portal-restores");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
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

const backupDir = resolve(
  readArg("--backup-dir", process.env.PORTAL_BACKUP_DIR || DEFAULT_BACKUP_DIR),
);
const manifestPath = resolve(
  readArg("--manifest", join(backupDir, "latest-manifest.json")),
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const archivePath = resolve(readArg("--archive", manifest.archive));
const restoreRoot = resolve(readArg("--restore-root", DEFAULT_RESTORE_ROOT));
const targetDir = resolve(
  readArg("--target-dir", join(restoreRoot, `portal-restore-${timestampForFile()}`)),
);

await stat(archivePath);
await stat(manifestPath);

const actualSha = await sha256File(archivePath);
if (actualSha !== manifest.sha256) {
  throw new Error(
    [
      "Backup checksum mismatch.",
      `Archive: ${archivePath}`,
      `Expected: ${manifest.sha256}`,
      `Actual:   ${actualSha}`,
    ].join("\n"),
  );
}

await mkdir(targetDir, { recursive: false });
run("tar", ["-xzf", archivePath, "-C", targetDir]);

console.log(`Portal backup restored into: ${targetDir}`);
console.log("The live checkout was not overwritten.");
console.log(`Archive: ${archivePath}`);
console.log(`Manifest: ${manifestPath}`);
