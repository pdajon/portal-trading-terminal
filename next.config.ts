import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const configuredDistDir = process.env.PORTAL_NEXT_DIST_DIR?.trim();
const defaultDevDistDir = ".portal-next-dev";
const defaultBuildDistDir = ".portal-next-build";

const createNextConfig = (phase: string): NextConfig => ({
  distDir:
    configuredDistDir ||
    (phase === PHASE_DEVELOPMENT_SERVER ? defaultDevDistDir : defaultBuildDistDir),
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
});

export default createNextConfig;
