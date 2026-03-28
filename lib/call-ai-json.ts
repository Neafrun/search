import { preprocessAiJsonRaw } from "@/lib/parse-loose-json";

/**
 * AI 통합 해석: Google Gemini — `GEMINI_API_KEY` 우선, 없으면 `GOOGLE_API_KEY`.
 * 둘 다 없을 때만 `OPENAI_API_KEY`(선택). Gemini 오류 시 OpenAI로 자동 전환하지 않습니다.
 */

export type AiJsonResult =
  | { ok: true; raw: string; provider: "gemini" | "openai"; model?: string }
  | { ok: false; reason: "no_key" }
  | { ok: false; reason: "upstream"; detail: string };

/** Gemini 응답에서 텍스트·종료 사유 추출 */
function geminiExtractTextAndFinish(data: unknown): { text: string; finishReason: string } {
  const d = data as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };
  const block = d.promptFeedback?.blockReason;
  if (block) {
    throw new Error(`gemini_blocked:${block}`);
  }
  const cand = d.candidates?.[0];
  const parts = cand?.content?.parts;
  const finishReason = cand?.finishReason ?? "UNKNOWN";
  if (!parts?.length) {
    throw new Error(`gemini_no_text:${finishReason}`);
  }
  const text = parts.map((p) => p.text ?? "").join("");
  return { text, finishReason };
}

/** 카카오 대화 분석용 — 과도한 안전 차단 완화 (여전히 정책 준수) */
const GEMINI_SAFETY = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
] as const;

/**
 * AI Studio `v1beta` generateContent 에서 자주 통하는 ID (404면 다음으로).
 * 하드코딩 목록이 모두 404면 `models.list`로 쓸 수 있는 모델을 이어서 시도합니다.
 */
const GEMINI_MODEL_FALLBACKS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash-001",
] as const;

const GEMINI_DYNAMIC_TRY_LIMIT = 40;

async function fetchGeminiGenerateContentModelIds(
  apiKey: string
): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };
  const ids: string[] = [];
  for (const m of data.models ?? []) {
    const methods = m.supportedGenerationMethods ?? [];
    if (!methods.includes("generateContent")) continue;
    const name = m.name?.replace(/^models\//, "") ?? "";
    if (name) ids.push(name);
  }
  return ids;
}

function scoreGeminiModelForFallback(id: string): number {
  const lower = id.toLowerCase();
  if (!/^gemini/i.test(id)) return 100;
  if (/embedding|embed|batch|tts|audio|imagen|video|robotics/i.test(lower))
    return 90;
  if (/flash/.test(lower) && !/8b|lite|experimental|preview/.test(lower))
    return 0;
  if (/flash/.test(lower)) return 5;
  if (/pro/.test(lower) && !/vision/.test(lower)) return 10;
  return 20;
}

/** 예전 문서·설정에 남은 이름 → 현재 쓸 수 있는 ID로 치환 */
function resolveGeminiModelId(preferred: string): string {
  const t = preferred.trim();
  const aliases: Record<string, string> = {
    "gemini-1.5-pro": "gemini-2.0-flash",
    "gemini-1.5-pro-latest": "gemini-2.0-flash",
    "gemini-pro": "gemini-2.0-flash",
    "gemini-pro-vision": "gemini-2.0-flash",
  };
  return aliases[t] ?? t;
}

function readGeminiMaxOutputTokens(): number {
  const n = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "16384", 10);
  if (!Number.isFinite(n)) return 16384;
  return Math.min(32768, Math.max(4096, n));
}

async function geminiGenerateOnce(
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<{ text: string; model: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let maxTok = readGeminiMaxOutputTokens();

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        safetySettings: [...GEMINI_SAFETY],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: maxTok,
          responseMimeType: "application/json",
        },
      }),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      const err = new Error(`gemini_http_${res.status}:${bodyText.slice(0, 500)}`) as Error & {
        status?: number;
      };
      err.status = res.status;
      throw err;
    }
    let data: unknown;
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error(`gemini_bad_json:${bodyText.slice(0, 200)}`);
    }
    const { text: rawText, finishReason } = geminiExtractTextAndFinish(data);
    const text = rawText.trim();
    if (!text) {
      throw new Error("gemini_empty_body");
    }
    /** 출력이 토큰 한도로 잘리면 JSON이 불완전해짐 → 한도를 올려 재시도 */
    if (finishReason === "MAX_TOKENS" && attempt < 2 && maxTok < 32768) {
      maxTok = Math.min(32768, Math.max(maxTok * 2, 12288));
      continue;
    }
    return { text: preprocessAiJsonRaw(text), model };
  }
  throw new Error("gemini_retry_exhausted");
}

function isGeminiNotFound(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as Error & { status?: number }).status;
  return (
    status === 404 ||
    /404|NOT_FOUND|not found|is not found for API version/i.test(msg)
  );
}

/** 429·RESOURCE_EXHAUSTED 등은 다른 Gemini 모델로 바꿔도 같은 프로젝트 한도면 동일할 때가 많음 → 즉시 상위로 전달 */
function isGeminiQuotaOrRateLimit(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as Error & { status?: number }).status;
  return (
    status === 429 ||
    /gemini_http_429|429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(msg)
  );
}

async function geminiGenerate(
  apiKey: string,
  preferredModel: string,
  system: string,
  user: string
): Promise<{ text: string; model: string }> {
  const tried = new Set<string>();
  const order = [preferredModel, ...GEMINI_MODEL_FALLBACKS].filter((m) => {
    if (tried.has(m)) return false;
    tried.add(m);
    return true;
  });

  let lastErr = "";
  for (const model of order) {
    try {
      return await geminiGenerateOnce(apiKey, model, system, user);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = msg;
      if (isGeminiQuotaOrRateLimit(e)) throw e;
      if (isGeminiNotFound(e)) continue;
      throw e;
    }
  }

  const dynamic = await fetchGeminiGenerateContentModelIds(apiKey);
  const sorted = [...dynamic].sort(
    (a, b) =>
      scoreGeminiModelForFallback(a) - scoreGeminiModelForFallback(b) ||
      a.localeCompare(b)
  );
  let n = 0;
  for (const model of sorted) {
    if (tried.has(model)) continue;
    tried.add(model);
    if (n++ >= GEMINI_DYNAMIC_TRY_LIMIT) break;
    try {
      return await geminiGenerateOnce(apiKey, model, system, user);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = msg;
      if (isGeminiQuotaOrRateLimit(e)) throw e;
      if (isGeminiNotFound(e)) continue;
      throw e;
    }
  }
  throw new Error(lastErr || "gemini_all_models_failed");
}

async function openaiGenerate(
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      response_format: { type: "json_object" },
      temperature: 0.45,
      max_tokens: 12000,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`openai_http_${res.status}:${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw?.trim()) {
    throw new Error("openai_empty");
  }
  return preprocessAiJsonRaw(raw);
}

export async function completeAnalysisJson(
  system: string,
  user: string
): Promise<AiJsonResult> {
  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (geminiKey) {
    const preferred = resolveGeminiModelId(
      process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
    );
    try {
      const { text, model } = await geminiGenerate(geminiKey, preferred, system, user);
      return { ok: true, raw: text, provider: "gemini", model };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      const fallback =
        process.env.AI_ANALYSIS_FALLBACK_OPENAI?.trim() === "1" && openaiKey;
      if (fallback) {
        try {
          const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
          const raw = await openaiGenerate(openaiKey, model, system, user);
          return { ok: true, raw, provider: "openai", model };
        } catch (e2) {
          const d2 = e2 instanceof Error ? e2.message : String(e2);
          return {
            ok: false,
            reason: "upstream",
            detail: `Gemini: ${detail.slice(0, 400)} | OpenAI 폴백: ${d2.slice(0, 400)}`,
          };
        }
      }
      return { ok: false, reason: "upstream", detail: detail.slice(0, 800) };
    }
  }
  if (openaiKey) {
    try {
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      const raw = await openaiGenerate(openaiKey, model, system, user);
      return { ok: true, raw, provider: "openai", model };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: "upstream", detail: detail.slice(0, 800) };
    }
  }
  return { ok: false, reason: "no_key" };
}
