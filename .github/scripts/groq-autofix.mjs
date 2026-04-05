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

const ISSUE_KEY = process.env.ISSUE_KEY;
const ISSUE_MESSAGE = process.env.ISSUE_MESSAGE;
const ISSUE_FILE_PATH = process.env.ISSUE_FILE_PATH;
const ISSUE_LINE = process.env.ISSUE_LINE;
const ISSUE_RULE = process.env.ISSUE_RULE;
const ISSUE_SEVERITY = process.env.ISSUE_SEVERITY;

const PAGE_SIZE = 100;
const MAX_FILE_CHARS = 30000;
const MAX_ISSUES_PER_FILE = 8;
const API_COOLDOWN_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeModelOutput(text) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1] : trimmed;
}

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

async function fetchIssues() {
  if (!SONAR_TOKEN || !SONAR_PROJECT_KEY) {
    throw new Error("SONAR_TOKEN and SONAR_PROJECT_KEY are required when no dispatch file is provided");
  }

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
    page += 1;
  }

  console.log(`Fetched ${all.length} open issues from SonarCloud`);
  return all;
}

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

function getIssuesByFile() {
  if (!ISSUE_FILE_PATH) return null;

  const issue = {
    line: ISSUE_LINE ? Number.parseInt(ISSUE_LINE, 10) : undefined,
    message: ISSUE_MESSAGE || `Issue ${ISSUE_KEY || "repository_dispatch"}`,
    rule: ISSUE_RULE || "repository_dispatch",
    severity: ISSUE_SEVERITY || "MAJOR",
  };

  return new Map([[ISSUE_FILE_PATH, [issue]]]);
}

function buildPrompt(filePath, code, issues) {
  const issueList = issues
    .map((issue) => `  - Line ${issue.line ?? "?"}: [${issue.severity}] ${issue.rule} - ${issue.message}`)
    .join("\n");

  return `Fix the following SonarCloud issues in this file.

Rules:
- Return ONLY the complete corrected file content.
- Do not wrap the answer in markdown fences.
- Preserve existing behavior unless required to fix the listed issues.
- Make the smallest safe changes possible.
- Keep imports, formatting style, and TypeScript compatibility intact.
- If you cannot produce a safe fix, return the original file content exactly.

File: ${filePath}

Issues to fix:
${issueList}

Current file content:
${code}`;
}

async function callOpenAICompatible(url, apiKey, model, prompt, providerName) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) throw new Error(`${providerName} error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

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
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGroq(filePath, code, issues) {
  return callOpenAICompatible(
    "https://api.groq.com/openai/v1/chat/completions",
    GROQ_API_KEY,
    "llama-3.3-70b-versatile",
    buildPrompt(filePath, code, issues),
    "Groq",
  );
}

async function callOpenRouter(filePath, code, issues) {
  return callOpenAICompatible(
    "https://openrouter.ai/api/v1/chat/completions",
    OPENROUTER_API_KEY,
    "meta-llama/llama-3.3-70b-instruct:free",
    buildPrompt(filePath, code, issues),
    "OpenRouter",
  );
}

async function callDeepSeek(filePath, code, issues) {
  return callOpenAICompatible(
    "https://api.deepseek.com/chat/completions",
    DEEPSEEK_API_KEY,
    "deepseek-coder",
    buildPrompt(filePath, code, issues),
    "DeepSeek",
  );
}

async function callTogether(filePath, code, issues) {
  return callOpenAICompatible(
    "https://api.together.xyz/v1/chat/completions",
    TOGETHER_API_KEY,
    "meta-llama/Llama-3-70b-chat-hf",
    buildPrompt(filePath, code, issues),
    "Together",
  );
}

async function callMistral(filePath, code, issues) {
  return callOpenAICompatible(
    "https://api.mistral.ai/v1/chat/completions",
    MISTRAL_API_KEY,
    "mistral-medium",
    buildPrompt(filePath, code, issues),
    "Mistral",
  );
}

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
  let prediction = await res.json();

  while (prediction.status === "starting" || prediction.status === "processing") {
    await sleep(1000);
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
    });
    if (!pollRes.ok) throw new Error(`Replicate polling error ${pollRes.status}`);
    prediction = await pollRes.json();
  }

  if (prediction.status !== "succeeded") throw new Error(`Replicate failed: ${prediction.status}`);
  return prediction.output?.join?.("") || prediction.output || "";
}

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
      prompt,
      max_tokens: 8192,
      temperature: 0.1,
      stop_sequences: [],
    }),
  });

  if (!res.ok) throw new Error(`Cohere error ${res.status}`);
  const data = await res.json();
  return data.generations?.[0]?.text?.trim?.() ?? "";
}

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
  return data[0]?.generated_text?.replace(prompt, "").trim?.() || data[0]?.generated_text || "";
}

function getAvailableApis(filePath, code, issues) {
  const apis = [];

  if (GROQ_API_KEY) apis.push({ name: "Groq", fn: () => callGroq(filePath, code, issues) });
  if (GEMINI_API_KEY) apis.push({ name: "Gemini", fn: () => callGemini(filePath, code, issues) });
  if (DEEPSEEK_API_KEY) apis.push({ name: "DeepSeek", fn: () => callDeepSeek(filePath, code, issues) });
  if (TOGETHER_API_KEY) apis.push({ name: "Together", fn: () => callTogether(filePath, code, issues) });
  if (OPENROUTER_API_KEY) apis.push({ name: "OpenRouter", fn: () => callOpenRouter(filePath, code, issues) });
  if (MISTRAL_API_KEY) apis.push({ name: "Mistral", fn: () => callMistral(filePath, code, issues) });
  if (COHERE_API_KEY) apis.push({ name: "Cohere", fn: () => callCohere(filePath, code, issues) });
  if (REPLICATE_API_KEY) apis.push({ name: "Replicate", fn: () => callReplicate(filePath, code, issues) });
  if (HUGGINGFACE_API_KEY) apis.push({ name: "HuggingFace", fn: () => callHuggingFace(filePath, code, issues) });

  return apis;
}

function validateAndWrite(filePath, originalCode, fixedCode) {
  const fullPath = join(process.cwd(), filePath);
  const normalizedCode = normalizeModelOutput(fixedCode);

  if (!normalizedCode || normalizedCode === originalCode) {
    return false;
  }

  writeFileSync(fullPath, normalizedCode, "utf8");

  try {
    const tscDir = filePath.startsWith("backend/") ? "backend" : "frontend";
    execSync("npx tsc --noEmit", {
      cwd: join(process.cwd(), tscDir),
      stdio: "pipe",
      timeout: 60000,
    });
    console.log("  tsc passed - keeping fix");
    return true;
  } catch {
    writeFileSync(fullPath, originalCode, "utf8");
    return false;
  }
}

async function tryFixWithValidation(filePath, code, issues) {
  const apis = getAvailableApis(filePath, code, issues);
  if (apis.length === 0) {
    throw new Error("No autofix API keys configured");
  }

  for (let index = 0; index < apis.length; index += 1) {
    const api = apis[index];
    const isLastApi = index === apis.length - 1;

    try {
      const fixed = await api.fn();
      console.log(`  ${api.name} responded - validating...`);

      if (validateAndWrite(filePath, code, fixed)) {
        console.log(`  Fixed with ${api.name}`);
        return { success: true, api: api.name };
      }

      if (isLastApi) {
        console.log(`  LAST API FAILED (${apis.length}/${apis.length}) - all generated invalid code`);
        return { exhausted: true };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${api.name} failed: ${msg}`);

      if (isLastApi) {
        console.log(`  LAST API FAILED (${apis.length}/${apis.length}) - complete saturation detected`);
        return { exhausted: true };
      }
    }
  }

  return null;
}

function appendSummary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"), { flag: "a" });
}

function appendOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) return;
  const body = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n";
  writeFileSync(process.env.GITHUB_OUTPUT, body, { flag: "a" });
}

async function main() {
  const byFile = getIssuesByFile() ?? groupByFile(await fetchIssues());
  if (byFile.size === 0) {
    console.log("No issues to fix.");
    appendOutputs({ fixed_count: 0, attempted_count: 0 });
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let attempted = 0;
  const skippedReasons = [];

  for (const [filePath, fileIssues] of [...byFile.entries()].sort((a, b) => a[1].length - b[1].length)) {
    console.log(`\nProcessing: ${filePath} (${fileIssues.length} issues)`);

    const code = readLocal(filePath);
    if (!code) {
      console.log("  -> Skipped (file not found locally)");
      skippedReasons.push(`${filePath}: file not found locally`);
      skipped += 1;
      continue;
    }

    const eligibility = isEligibleFile(filePath, code, fileIssues);
    if (!eligibility.ok) {
      console.log(`  -> Skipped (${eligibility.reason})`);
      skippedReasons.push(`${filePath}: ${eligibility.reason}`);
      skipped += 1;
      continue;
    }

    attempted += 1;

    try {
      const result = await tryFixWithValidation(filePath, code, fileIssues);

      if (result?.exhausted) {
        console.log("  -> Skipped (all APIs exhausted for this file)");
        skippedReasons.push(`${filePath}: all APIs exhausted`);
        skipped += 1;
      } else if (!result?.success) {
        console.log("  -> Skipped (no valid fix produced)");
        skippedReasons.push(`${filePath}: no valid fix produced`);
        skipped += 1;
      } else {
        console.log(`  -> Written to ${filePath}`);
        fixed += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  -> Error: ${msg}`);
      skippedReasons.push(`${filePath}: ${msg}`);
      skipped += 1;
    }

    await sleep(API_COOLDOWN_MS);
  }

  console.log(`\nDone. Attempted: ${attempted} | Fixed: ${fixed} | Skipped: ${skipped}`);

  appendSummary([
    "## SonarCloud Autofix Summary",
    "",
    `- Attempted files: ${attempted}`,
    `- Fixed files: ${fixed}`,
    `- Skipped files: ${skipped}`,
    ...(skippedReasons.length ? ["", "### Skipped details", ...skippedReasons.slice(0, 20).map((reason) => `- ${reason}`)] : []),
  ]);

  appendOutputs({
    fixed_count: fixed,
    attempted_count: attempted,
  });
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Fatal error:", msg);
  process.exit(1);
});
