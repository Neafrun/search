import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * AI 키·Gemini 연결 상태 확인 (키 값은 노출하지 않음).
 * GET /api/ai-health — 어떤 키가 있는지
 * GET /api/ai-health?live=1 — Gemini `models.list`로 키·네트워크 검증 (토큰 거의 없음)
 */
export async function GET(req: Request) {
  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  const url = new URL(req.url);
  const live = url.searchParams.get("live") === "1";

  const base = {
    hasGeminiKey: Boolean(geminiKey),
    hasOpenAiKey: Boolean(openaiKey),
    preferredProvider: geminiKey ? ("gemini" as const) : openaiKey ? ("openai" as const) : null,
    geminiModelConfigured: geminiModel,
  };

  if (!live) {
    return NextResponse.json({ ok: true as const, ...base });
  }

  if (!geminiKey) {
    return NextResponse.json({
      ok: true as const,
      ...base,
      live: { geminiListModelsOk: null, geminiListModelsError: "GEMINI_API_KEY 없음" },
    });
  }

  let listOk: boolean | null = null;
  let listError: string | null = null;
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiKey)}&pageSize=5`
    );
    listOk = listRes.ok;
    if (!listRes.ok) {
      listError = (await listRes.text()).slice(0, 400);
    }
  } catch (e) {
    listOk = false;
    listError = e instanceof Error ? e.message : "fetch failed";
  }

  return NextResponse.json({
    ok: true as const,
    ...base,
    live: {
      geminiListModelsOk: listOk,
      geminiListModelsError: listError,
      hint: listOk
        ? "키가 유효합니다. 모델 오류 시 GEMINI_MODEL을 gemini-1.5-flash 등으로 바꿔 보세요."
        : "키가 거부되었거나 네트워크 오류입니다. AI Studio에서 키·결제 한도를 확인하세요.",
    },
  });
}
