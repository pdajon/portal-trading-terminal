#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const backupDir = resolve(repoRoot, "..", "portal-backups");
const home = process.env.HOME;
const defaultIcloudRoot = resolve(
  home,
  "Library",
  "Mobile Documents",
  "com~apple~CloudDocs",
);
const defaultMirrorDir = resolve(defaultIcloudRoot, "Portal Backups", "portal-backups");
const uid = process.getuid();
const label = "com.portal.project-backup";
const launchAgentsDir = resolve(home, "Library", "LaunchAgents");
const plistPath = resolve(launchAgentsDir, `${label}.plist`);
const keepCount = Number.parseInt(process.env.PORTAL_BACKUP_KEEP || "96", 10);
const scheduleTimes = (
  process.env.PORTAL_BACKUP_SCHEDULE_TIMES || "09:00,14:00,20:00"
)
  .split(",")
  .map((time) => time.trim())
  .filter(Boolean);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function parseScheduleTime(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) {
    throw new Error(`Invalid schedule time "${time}". Use HH:MM, for example 09:00.`);
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid schedule time "${time}". Use 00:00 through 23:59.`);
  }

  return { hour, minute };
}

function renderCalendarIntervals(times) {
  return times
    .map(parseScheduleTime)
    .map(
      ({ hour, minute }) => `    <dict>
      <key>Hour</key>
      <integer>${hour}</integer>
      <key>Minute</key>
      <integer>${minute}</integer>
    </dict>`,
    )
    .join("\n");
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  });
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(launchAgentsDir, { recursive: true });
await mkdir(backupDir, { recursive: true });

const mirrorDir =
  process.env.PORTAL_BACKUP_MIRROR_DIR ||
  ((await pathExists(defaultIcloudRoot)) ? defaultMirrorDir : "");

const command = [
  `cd ${shellQuote(repoRoot)}`,
  "PATH='/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'",
  [
    `node scripts/backup-portal.mjs --keep ${keepCount}`,
    mirrorDir ? `--mirror-dir ${shellQuote(mirrorDir)}` : "--mirror-dir none",
  ].join(" "),
].join(" && ");

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>${escapeXml(command)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartCalendarInterval</key>
  <array>
${renderCalendarIntervals(scheduleTimes)}
  </array>
  <key>StandardOutPath</key>
  <string>${escapeXml(resolve(backupDir, "launchd.stdout.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(resolve(backupDir, "launchd.stderr.log"))}</string>
</dict>
</plist>
`;

await writeFile(plistPath, plist);

run("launchctl", ["bootout", `gui/${uid}`, plistPath]);

const bootstrap = run("launchctl", ["bootstrap", `gui/${uid}`, plistPath]);
if (bootstrap.status !== 0) {
  throw new Error(
    `launchctl bootstrap failed:\n${bootstrap.stdout}\n${bootstrap.stderr}`,
  );
}

run("launchctl", ["enable", `gui/${uid}/${label}`]);
run("launchctl", ["kickstart", "-k", `gui/${uid}/${label}`]);

console.log(`Installed Portal backup schedule: ${plistPath}`);
console.log(`Cadence: ${scheduleTimes.join(", ")} local time`);
console.log(`Backup directory: ${backupDir}`);
console.log(`Mirror directory: ${mirrorDir || "(disabled)"}`);
console.log(`Retention: latest ${keepCount} source backups`);
