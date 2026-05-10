#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const action = process.argv[2];
if (!action || !["up", "down", "reset"].includes(action)) {
  console.error("Usage: node scripts/docker-compose.mjs <up|down|reset>");
  process.exit(2);
}

const dockerBin = resolveDockerBin();
if (!dockerBin) {
  console.error("Could not locate Docker CLI.");
  console.error(
    "Set DOCKER_BIN to docker.exe path, e.g. C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
  );
  process.exit(1);
}

const args =
  action === "up"
    ? [
        "compose",
        "--project-directory",
        ".",
        "-f",
        "deployment/docker-compose.yml",
        "up",
        "-d",
        "--wait",
      ]
    : action === "down"
      ? [
        "compose",
        "--project-directory",
        ".",
        "-f",
        "deployment/docker-compose.yml",
        "down",
      ]
      : [
          "compose",
          "--project-directory",
          ".",
          "-f",
          "deployment/docker-compose.yml",
          "down",
          "-v",
          "--remove-orphans",
        ];

const run = spawnSync(dockerBin, args, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false,
  env: buildDockerEnv(dockerBin),
});

if (typeof run.status === "number") {
  process.exit(run.status);
}

if (run.error) {
  console.error(`Failed to execute Docker CLI: ${run.error.message}`);
}
process.exit(1);

function resolveDockerBin() {
  const envOverride = process.env.DOCKER_BIN;
  const candidates = [
    envOverride,
    "docker",
    "docker.exe",
    path.join(
      process.env.ProgramFiles || "C:\\Program Files",
      "Docker",
      "Docker",
      "resources",
      "bin",
      "docker.exe",
    ),
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    "C:\\Program Files (x86)\\Docker\\Docker\\resources\\bin\\docker.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!isCallableDocker(candidate)) continue;
    return candidate;
  }
  return null;
}

function isCallableDocker(candidate) {
  try {
    const looksLikePath =
      candidate.includes("\\") ||
      candidate.includes("/") ||
      path.isAbsolute(candidate);
    if (looksLikePath && !fs.existsSync(candidate)) return false;

    const probe = spawnSync(candidate, ["--version"], {
      cwd: repoRoot,
      stdio: "ignore",
      shell: false,
      env: buildDockerEnv(candidate),
    });

    return probe.status === 0;
  } catch {
    return false;
  }
}

function buildDockerEnv(dockerBin) {
  const env = { ...process.env };
  const delimiter = path.delimiter;
  const existingPath = env.PATH ?? env.Path ?? "";
  const pathParts = existingPath
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const dockerDirs = new Set([
    path.join(
      process.env.ProgramFiles || "C:\\Program Files",
      "Docker",
      "Docker",
      "resources",
      "bin",
    ),
    "C:\\Program Files\\Docker\\Docker\\resources\\bin",
  ]);

  if (dockerBin.includes("\\") || dockerBin.includes("/")) {
    dockerDirs.add(path.dirname(dockerBin));
  }

  for (const dir of dockerDirs) {
    if (!dir) continue;
    if (!fs.existsSync(dir)) continue;
    if (!pathParts.some((part) => part.toLowerCase() === dir.toLowerCase())) {
      pathParts.unshift(dir);
    }
  }

  const nextPath = pathParts.join(delimiter);
  env.PATH = nextPath;
  env.Path = nextPath;
  return env;
}
