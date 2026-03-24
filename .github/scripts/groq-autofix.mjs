import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SONAR_TOKEN = process.env.SONAR_TOKEN;
const SONAR_PROJECT_KEY = process.env.SONAR_PROJECT_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
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
    const component = issue.component;
    const filePath = component.split(":").slice(1).join(":");
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

// ── Build prompt ───────────────────────────────────────────────────────────

function buildPrompt(filePath, code, issues) {
  const issueList = issues
    .map((i) => `  - Line ${i.line ?? "?"}: [${i.severity}] ${i.rule} — ${i.message}`)
    .join("\n");

  return `Fix the following SonarCloud issues in this file. Return ONLY the complete corrected file content, no explanations, no markdown fences.\n\nFile: ${filePath}\n\nIssues to fix:\n${issueList}\n\nCurrent file content:\n${code}`;
}

// ── Call Gemini ────────────────────────────────────────────────────────────

async function callGemini(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// ── Call Groq ──────────────────────────────────────────────────────────────

async function callGroq(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Call OpenRouter ────────────────────────────────────────────────────────

async function callOpenRouter(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Call DeepSeek ─────────────────────────────────────────────────────────

async function callDeepSeek(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-coder",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Call Together AI ───────────────────────────────────────────────────────

async function callTogether(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/Llama-3-70b-chat-hf",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) throw new Error(`Together error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Try fix with fallback ──────────────────────────────────────────────────

async function tryFix(filePath, code, issues) {
  const apis = [
    { name: "Gemini", fn: () => callGemini(filePath, code, issues) },
    { name: "Groq", fn: () => callGroq(filePath, code, issues) },
    { name: "OpenRouter", fn: () => callOpenRouter(filePath, code, issues) },
    { name: "DeepSeek", fn: () => callDeepSeek(filePath, code, issues) },
    { name: "Together", fn: () => callTogether(filePath, code, issues) },
  ];

  for (const api of apis) {
    try {
      const fixed = await api.fn();
      console.log(`  ✓ Fixed with ${api.name}`);
      return fixed;
    } catch (err) {
      console.log(`  ⚠ ${api.name} failed: ${err.message}`);
    }
  }

  throw new Error("All APIs failed");
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
      console.log(`  → Skipped (file not found locally)`);
      skipped++;
      continue;
    }

    try {
      const fixed_code = await tryFix(filePath, code, fileIssues);
      writeFileSync(join(process.cwd(), filePath), fixed_code, "utf8");
      console.log(`  → Written to ${filePath}`);
      fixed++;
    } catch (err) {
      console.error(`  → Error: ${err.message}`);
      skipped++;
    }

    await sleep(2500);
  }

  console.log(`\nDone. Fixed: ${fixed} files. Skipped: ${skipped} files.`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
