import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SONAR_TOKEN = process.env.SONAR_TOKEN;
const SONAR_PROJECT_KEY = process.env.SONAR_PROJECT_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-pro";
const PAGE_SIZE = 100;

// ── Fetch all open issues from SonarCloud ──────────────────────────────────

async function fetchIssues() {
  let page = 1;
  const all = [];

  while (true) {
    const url =
      `https://sonarcloud.io/api/issues/search` +
      `?projectKeys=${SONAR_PROJECT_KEY}` +
      `&statuses=OPEN` +
      `&severities=BLOCKER,CRITICAL,MAJOR,MINOR` +
      `&ps=${PAGE_SIZE}&p=${page}`;

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(SONAR_TOKEN + ":").toString("base64")}` },
    });
    if (!res.ok) throw new Error(`SonarCloud error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...data.issues);

    if (page * PAGE_SIZE >= data.total) break;
    page++;
  }

  console.log(`Fetched ${all.length} open issues from SonarCloud`);
  return all;
}

// ── Group issues by file path ──────────────────────────────────────────────

function groupByFile(issues) {
  const map = new Map();
  for (const issue of issues) {
    const component = issue.component; // e.g. "project:frontend/src/utils.ts"
    const filePath = component.split(":").slice(1).join(":"); // strip project key
    if (!map.has(filePath)) map.set(filePath, []);
    map.get(filePath).push({
      line: issue.line,
      message: issue.message,
      rule: issue.rule,
      severity: issue.severity,
    });
  }
  return map;
}

// ── Read local file ────────────────────────────────────────────────────────

function readLocal(filePath) {
  try {
    return readFileSync(join(process.cwd(), filePath), "utf8");
  } catch {
    return null;
  }
}

// ── Call Gemini ────────────────────────────────────────────────────────────

async function callGemini(filePath, code, issues) {
  const issueList = issues
    .map((i) => `  - Line ${i.line ?? "?"}: [${i.severity}] ${i.rule} — ${i.message}`)
    .join("\n");

  const prompt =
    `Fix the following SonarCloud issues in this file. ` +
    `Return ONLY the complete corrected file content, no explanations, no markdown fences.\n\n` +
    `File: ${filePath}\n\n` +
    `Issues to fix:\n${issueList}\n\n` +
    `Current file content:\n${code}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// ── Sleep helper ───────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const issues = await fetchIssues();
  if (issues.length === 0) {
    console.log("No issues to fix.");
    return;
  }

  const byFile = groupByFile(issues);
  let fixed = 0;
  let skipped = 0;

  for (const [filePath, fileIssues] of byFile.entries()) {
    console.log(`\nProcessing: ${filePath} (${fileIssues.length} issues)`);

    const code = readLocal(filePath);
    if (!code) {
      console.log(`  → Skipped (file not found locally): ${filePath}`);
      skipped++;
      continue;
    }

    try {
      const fixed_code = await callGemini(filePath, code, fileIssues);
      writeFileSync(join(process.cwd(), filePath), fixed_code, "utf8");
      console.log(`  → Fixed and written: ${filePath}`);
      fixed++;
    } catch (err) {
      console.error(`  → Error processing ${filePath}: ${err.message}`);
      skipped++;
    }

    // Rate limit: 500ms between calls (Gemini has higher quota)
    await sleep(500);
  }

  console.log(`\nDone. Fixed: ${fixed} files. Skipped: ${skipped} files.`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
