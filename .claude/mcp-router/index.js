import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "ai-router", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Helpers ────────────────────────────────────────────────────────────────

function log(model, task, reason) {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [ai-router] delegating to ${model} | reason: ${reason} | task: ${task.slice(0, 120)}\n`);
}

function requireKey(name) {
  const val = process.env[name];
  if (!val || val === "PENDIENTE") {
    throw new Error(`API key ${name} no configurada. Añádela en la configuración del MCP.`);
  }
  return val;
}

// ── Providers ──────────────────────────────────────────────────────────────

async function callGroq(task) {
  const key = requireKey("GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: task }],
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(task) {
  const key = requireKey("GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: task }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function callCodestral(task) {
  const key = requireKey("MISTRAL_API_KEY");
  const res = await fetch("https://codestral.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "codestral-latest",
      messages: [{ role: "user", content: task }],
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`Codestral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callOpenRouter(task) {
  const key = requireKey("OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://github.com/dapio/proyecto-web",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [{ role: "user", content: task }],
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Tool definitions ───────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "delegate_to_groq",
    description:
      "Delega tareas mecánicas y predecibles a Groq (Llama 3.3). Ideal para: issues SonarCloud Minor/Major (replaceAll, Readonly, globalThis, parseInt), cambios repetitivos en múltiples archivos, tests simples con patrón fijo, formateo y limpieza de código.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Descripción completa de la tarea a ejecutar." },
        reason: { type: "string", description: "Motivo por el que se delega a Groq." },
      },
      required: ["task", "reason"],
    },
  },
  {
    name: "delegate_to_gemini",
    description:
      "Delega análisis y tareas de solo lectura a Gemini 1.5 Flash. Ideal para: explicar reportes CI, analizar cobertura de tests, resumir documentación, cualquier tarea de solo lectura.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Descripción completa de la tarea a analizar." },
        reason: { type: "string", description: "Motivo por el que se delega a Gemini." },
      },
      required: ["task", "reason"],
    },
  },
  {
    name: "delegate_to_codestral",
    description:
      "Delega refactors de código a Codestral (Mistral). Ideal para: reducir cognitive complexity, extraer funciones anidadas, simplificar ternarios anidados, refactors sin lógica de negocio.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Descripción completa del refactor a realizar." },
        reason: { type: "string", description: "Motivo por el que se delega a Codestral." },
      },
      required: ["task", "reason"],
    },
  },
  {
    name: "delegate_to_openrouter",
    description:
      "Fallback universal via OpenRouter (Llama 3.3 free). Usar cuando otro modelo ha fallado o como segunda opinión.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Descripción completa de la tarea." },
        reason: { type: "string", description: "Motivo por el que se usa OpenRouter como fallback." },
      },
      required: ["task", "reason"],
    },
  },
];

// ── Handlers ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { task, reason } = args;

  try {
    let result;
    switch (name) {
      case "delegate_to_groq":
        log("Groq (Llama 3.3)", task, reason);
        result = await callGroq(task);
        break;
      case "delegate_to_gemini":
        log("Gemini 1.5 Flash", task, reason);
        result = await callGemini(task);
        break;
      case "delegate_to_codestral":
        log("Codestral (Mistral)", task, reason);
        result = await callCodestral(task);
        break;
      case "delegate_to_openrouter":
        log("OpenRouter (fallback)", task, reason);
        result = await callOpenRouter(task);
        break;
      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ERROR: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("[ai-router] MCP server started\n");
