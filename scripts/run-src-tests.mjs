import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const explicitFiles = process.argv.slice(2);
const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/;

function collectTestFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTestFiles(path));
      continue;
    }

    if (entry.isFile() && testFilePattern.test(path)) {
      files.push(path);
    }
  }

  return files;
}

const files = explicitFiles.length > 0 ? explicitFiles : collectTestFiles("src");

if (files.length === 0) {
  console.error("No source test files found.");
  process.exit(1);
}

for (const file of files) {
  if (!statSync(file).isFile()) {
    console.error(`Test file not found: ${file}`);
    process.exit(1);
  }
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
