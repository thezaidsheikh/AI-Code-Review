const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

function stripCodeFences(text) {
  const trimmed = (text || "").trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, "").replace(/\s*```$/, "").trim();
}

function extractFirstJsonBlock(text) {
  const src = stripCodeFences(text);
  if (!src) return "";

  let start = -1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{" || ch === "[") {
      start = i;
      break;
    }
  }
  if (start === -1) return "";

  const open = src[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }

  return "";
}

function parseModelJson(raw) {
  if (raw && typeof raw === "object") return raw;
  const text = typeof raw === "string" ? raw : "";
  if (!text.trim()) throw new Error("LLM returned an empty response");

  try {
    return JSON.parse(stripCodeFences(text));
  } catch (_err) {
    const extracted = extractFirstJsonBlock(text);
    if (!extracted) {
      throw new Error("LLM response did not contain a valid JSON object/array");
    }
    try {
      return JSON.parse(extracted);
    } catch (err) {
      throw new Error(`Failed to parse LLM JSON: ${err.message}`);
    }
  }
}

async function callOpenAI({ model, system, user, maxTokens, temperature }) {
  const apiKey = process.env.OPENAI_API_KEY;
  assert(apiKey, 'OPENAI_API_KEY is required for provider "openai"');
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

async function callOpenRouter({ model, system, user, maxTokens, temperature }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  assert(apiKey, 'OPENROUTER_API_KEY is required for provider "openrouter"');
  const base = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

async function callOllama({ model, system, user, maxTokens, temperature }) {
  const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      options: { temperature, num_predict: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.message?.content || "";
}

async function callGoogle({ model, system, user, maxTokens, temperature }) {
  let llm = 0;
  const apiKey = process.env.AI_API_KEY;
  const base = process.env.BASE_URL || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(`${base}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${system}\n\n${user}`,
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Google error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.candidates?.[0].content?.parts?.[0].text || "";
}

exports.callLLM = async (cfg) => {
  const p = (cfg.provider || "google").toLowerCase();
  let raw = "";
  if (p === "google") raw = await callGoogle(cfg);
  else if (p === "openai") raw = await callOpenAI(cfg);
  else if (p === "openrouter") raw = await callOpenRouter(cfg);
  else if (p === "ollama") raw = await callOllama(cfg);
  else throw new Error(`Unknown LLM provider: ${cfg.provider}`);

  const parsed = parseModelJson(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM response JSON must be an object");
  }
  return parsed;
};
