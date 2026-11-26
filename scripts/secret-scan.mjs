import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const stagedMode = process.argv.includes("--staged");

function hasGitleaks() {
  try {
    execFileSync("gitleaks", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (hasGitleaks()) {
  const args = stagedMode
    ? ["protect", "--staged", "--redact", "-v"]
    : ["detect", "--no-git", "--redact", "-v"];
  execFileSync("gitleaks", args, { stdio: "inherit" });
}

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-server",
  "data",
  "coverage",
]);
const SECRET_PATTERNS = [
  { name: "Private key block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub Token", regex: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "Google API Key", regex: /AIza[0-9A-Za-z\-_]{30,}/ },
  { name: "OpenAI-style Key", regex: /sk-[A-Za-z0-9]{20,}/ },
];

function collectFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectFiles(full, acc);
    } else if (st.isFile() && st.size < 512 * 1024) {
      acc.push(full);
    }
  }
  return acc;
}

const files = stagedMode
  ? execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
      {
        encoding: "utf8",
      },
    )
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && existsSync(s))
  : collectFiles(".");

const findings = [];
for (const file of files) {
  if (file.endsWith(".db") || /(^|\/)\.env(\.|$)/.test(file)) {
    findings.push(`${file}: forbidden sensitive file`);
    continue;
  }
  const content = readFileSync(file, "utf8");
  for (const pat of SECRET_PATTERNS) {
    if (pat.regex.test(content)) {
      findings.push(`${file}: matched ${pat.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`Secret scan failed:\n${findings.join("\n")}`);
  process.exit(1);
}

console.log(`Secret scan passed (${files.length} files checked).`);
