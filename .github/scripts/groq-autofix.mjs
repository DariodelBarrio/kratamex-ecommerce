import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const SONAR_TOKEN = process.env.SONAR_TOKEN;
const SONAR_PROJECT_KEY = process.env.SONAR_PROJECT_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const PAGE_SIZE = 100;
const MAX_FILE_CHARS = 30000;
const MAX_ISSUES_PER_FILE = 8;
const API_COOLDOWN_MS = 5000;

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

function isEligibleFile(filePath, code, issues) {
  if (!filePath.startsWith("frontend/src/") && !filePath.startsWith("backend/src/")) {
    return { ok: false, reason: "outside frontend/src or backend/src" };
  }
  if (code.length > MAX_FILE_CHARS) {
    return { ok: false, reason: `file too large (${code.length} chars)` };
  }
  if (issues.length > MAX_ISSUES_PER_FILE) {
    return { ok: false, reason: `too many issues in one file (${issues.length})` };
  }
  return { ok: true };
}

// ── Build prompt ───────────────────────────────────────────────────────────

function buildPrompt(filePath, code, issues) {
  const issueList = issues
    .map((i) => `  - Line ${i.line ?? "?"}: [${i.severity}] ${i.rule} — ${i.message}`)
    .join("\n");

  return `Fix the following SonarCloud issues in this file.

Rules:
- Return ONLY the complete corrected file content.
- Do not wrap the answer in markdown fences.
- Preserve existing behavior unless required to fix the listed issues.
- Make the smallest safe changes possible.
- If you cannot produce a safe fix, return the original file content exactly.

File: ${filePath}

Issues to fix:
${issueList}

Current file content:
${code}`;
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

// ── Call Mistral ──────────────────────────────────────────────────────────

async function callMistral(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-medium",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) throw new Error(`Mistral error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Call Replicate ────────────────────────────────────────────────────────

async function callReplicate(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${REPLICATE_API_KEY}`,
    },
    body: JSON.stringify({
      version: "2e7f615e751a4e7c9c1f1c8c0e1c9b6d7f8e9f0a",
      input: { prompt, max_tokens: 8192, temperature: 0.1 },
      wait_for_webhook: false,
    }),
  });

  if (!res.ok) throw new Error(`Replicate error ${res.status}`);
  const data = await res.json();

  // Poll for result
  let prediction = data;
  while (prediction.status === "processing") {
    await sleep(1000);
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== "succeeded") throw new Error(`Replicate failed: ${prediction.status}`);
  return prediction.output?.join?.("") || prediction.output;
}

// ── Call Cohere ───────────────────────────────────────────────────────────

async function callCohere(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api.cohere.ai/v1/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "command",
      prompt: prompt,
      max_tokens: 8192,
      temperature: 0.1,
      stop_sequences: [],
    }),
  });

  if (!res.ok) throw new Error(`Cohere error ${res.status}`);
  const data = await res.json();
  return data.generations[0].text.trim();
}

// ── Call HuggingFace ──────────────────────────────────────────────────────

async function callHuggingFace(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api-inference.huggingface.co/models/meta-llama/Llama-2-70b-chat-hf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 8192, temperature: 0.1 },
    }),
  });

  if (!res.ok) throw new Error(`HuggingFace error ${res.status}`);
  const data = await res.json();
  return data[0]?.generated_text?.replace(prompt, "").trim() || data[0]?.generated_text;
}

// ── Try fix with fallback ──────────────────────────────────────────────────

async function tryFix(filePath, code, issues) {
  const apis = [
    { name: "Groq", fn: () => callGroq(filePath, code, issues) },
    { name: "Gemini", fn: () => callGemini(filePath, code, issues) },
    { name: "DeepSeek", fn: () => callDeepSeek(filePath, code, issues) },
    { name: "Together", fn: () => callTogether(filePath, code, issues) },
    { name: "OpenRouter", fn: () => callOpenRouter(filePath, code, issues) },
    { name: "Mistral", fn: () => callMistral(filePath, code, issues) },
    { name: "Cohere", fn: () => callCohere(filePath, code, issues) },
    { name: "Replicate", fn: () => callReplicate(filePath, code, issues) },
    { name: "HuggingFace", fn: () => callHuggingFace(filePath, code, issues) },
  ];

  for (let i = 0; i < apis.length; i++) {
    const api = apis[i];
    const isLastApi = i === apis.length - 1;

    try {
      const fixed = await api.fn();
      console.log(`  ✓ Fixed with ${api.name}`);
      return fixed;
    } catch (err) {
      console.log(`  ⚠ ${api.name} failed: ${err.message}`);

      // CRITICAL: Last API failed — complete saturation
      if (isLastApi) {
        console.log(`  ✗ LAST API FAILED (9/9) — Complete saturation detected`);
        return { exhausted: true };
      }
    }
  }

  // Should not reach here, but fallback
  console.log(`  ✗ All APIs exhausted (9/9 failed)`);
  return null;
}

// ── Sleep helper ───────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeModelOutput(text) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1] : trimmed;
}

// ── Validate fix with tsc before writing ───────────────────────────────────

function validateAndWrite(filePath, originalCode, fixedCode) {
  const fullPath = join(process.cwd(), filePath);
  const normalizedCode = normalizeModelOutput(fixedCode);

  if (!normalizedCode || normalizedCode === originalCode) {
    return false;
  }

  // Write the fixed code temporarily
  writeFileSync(fullPath, normalizedCode, "utf8");

  try {
    // Determine which tsc to run based on file path
    const tscDir = filePath.startsWith("backend/") ? "backend" : "frontend";

    execSync("npx tsc --noEmit", {
      cwd: join(process.cwd(), tscDir),
      stdio: "pipe",
      timeout: 60000,
    });

    console.log(`  ✓ tsc passed — keeping fix`);
    return true;
  } catch {
    // Revert to original
    writeFileSync(fullPath, originalCode, "utf8");
    return false;
  }
}

// ── Try fix with validation across all APIs ────────────────────────────────

async function tryFixWithValidation(filePath, code, issues) {
  const apis = [
    { name: "Groq", fn: () => callGroq(filePath, code, issues) },
    { name: "Gemini", fn: () => callGemini(filePath, code, issues) },
    { name: "DeepSeek", fn: () => callDeepSeek(filePath, code, issues) },
    { name: "Together", fn: () => callTogether(filePath, code, issues) },
    { name: "OpenRouter", fn: () => callOpenRouter(filePath, code, issues) },
    { name: "Mistral", fn: () => callMistral(filePath, code, issues) },
    { name: "Cohere", fn: () => callCohere(filePath, code, issues) },
    { name: "Replicate", fn: () => callReplicate(filePath, code, issues) },
    { name: "HuggingFace", fn: () => callHuggingFace(filePath, code, issues) },
  ];

  for (let i = 0; i < apis.length; i++) {
    const api = apis[i];
    const isLastApi = i === apis.length - 1;

    try {
      const fixed = await api.fn();
      console.log(`  ${api.name} responded — validating...`);

      if (validateAndWrite(filePath, code, fixed)) {
        console.log(`  ✓ Fixed with ${api.name}`);
        return { success: true, api: api.name };
      }

      // tsc failed — try next API
      if (isLastApi) {
        console.log(`  ✗ LAST API FAILED (9/9) — all generated invalid code`);
        return { exhausted: true };
      }
    } catch (err) {
      console.log(`  ⚠ ${api.name} failed: ${err.message}`);

      if (isLastApi) {
        console.log(`  ✗ LAST API FAILED (9/9) — Complete saturation detected`);
        return { exhausted: true };
      }
    }
  }

  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const issues = await fetchIssues();
  if (issues.length === 0) {
    console.log("No issues to fix.");
    return;
  }

  const byFile = new Map(
    [...groupByFile(issues).entries()].sort((a, b) => a[1].length - b[1].length)
  );
  let fixed = 0;
  let skipped = 0;
  let attempted = 0;
  const skippedReasons = [];

  for (const [filePath, fileIssues] of byFile.entries()) {
    console.log(`\nProcessing: ${filePath} (${fileIssues.length} issues)`);

    const code = readLocal(filePath);
    if (!code) {
      console.log(`  → Skipped (file not found locally)`);
      skippedReasons.push(`${filePath}: file not found locally`);
      skipped++;
      continue;
    }

    const eligibility = isEligibleFile(filePath, code, fileIssues);
    if (!eligibility.ok) {
      console.log(`  → Skipped (${eligibility.reason})`);
      skippedReasons.push(`${filePath}: ${eligibility.reason}`);
      skipped++;
      continue;
    }

    attempted++;

    try {
      const result = await tryFixWithValidation(filePath, code, fileIssues);

      if (result && result.exhausted) {
        console.log(`  → Skipped (all APIs exhausted for this file)`);
        skippedReasons.push(`${filePath}: all APIs exhausted`);
        skipped++;
        continue;
      }

      if (result === null || !result.success) {
        console.log(`  → Skipped (no valid fix produced)`);
        skippedReasons.push(`${filePath}: no valid fix produced`);
        skipped++;
      } else {
        console.log(`  → Written to ${filePath}`);
        fixed++;
      }
    } catch (err) {
      console.error(`  → Error: ${err.message}`);
      skippedReasons.push(`${filePath}: ${err.message}`);
      skipped++;
    }

    await sleep(API_COOLDOWN_MS);
  }

  const summary = [
    `Attempted: ${attempted}`,
    `Fixed: ${fixed}`,
    `Skipped: ${skipped}`,
  ];
  console.log(`\nDone. ${summary.join(" | ")}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      "## Groq Autofix Summary",
      "",
      `- Attempted files: ${attempted}`,
      `- Fixed files: ${fixed}`,
      `- Skipped files: ${skipped}`,
    ];
    if (skippedReasons.length) {
      summaryLines.push("", "### Skipped details", ...skippedReasons.slice(0, 20).map((reason) => `- ${reason}`));
    }
    writeFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      summaryLines.join("\n"),
      { flag: "a" }
    );
  }

  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `fixed_count=${fixed}\nattempted_count=${attempted}\n`, { flag: "a" });
  }

  if (fixed === 0) {
    throw new Error("Autofix completed without producing any valid code changes");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
