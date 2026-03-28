import { NextResponse } from "next/server";
import { loadAiAnalysisRules } from "@/lib/load-ai-analysis-rules";
import { completeAnalysisJson } from "@/lib/call-ai-json";
import { parseLooseJsonObject } from "@/lib/parse-loose-json";

export const runtime = "nodejs";

const MAX_CHARS = 12_000;

const MAX_SITUATION_CHARS = 2_000;
const MAX_CURIOSITY_CHARS = 2_000;

/** 모델이 스키마 설명 문장을 그대로 배열에 넣는 경우 제거 */
function normalizeBulletList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !/^최소\s*\d+개/i.test(s) &&
        !/^많으면\s*\d+개/i.test(s)
    );
}

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 가설: 확신도 있는 것만(서버에서 55 미만 제거, 최대 5개) */
function normalizeScoredHypotheses(raw: unknown): { claim: string; confidence: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { claim: string; confidence: number }[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push({ claim: item.trim(), confidence: 70 });
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const claim =
        typeof o.claim === "string"
          ? o.claim
          : typeof o.text === "string"
            ? o.text
            : typeof o.hypothesis === "string"
              ? o.hypothesis
              : "";
      const cRaw =
        typeof o.confidence === "number"
          ? o.confidence
          : typeof o.score === "number"
            ? o.score
            : 65;
      const c = Math.max(0, Math.min(100, Math.round(cRaw)));
      if (claim.trim()) out.push({ claim: claim.trim(), confidence: c });
    }
  }
  return out
    .filter((x) => x.confidence >= 60)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

type Body = {
  myText?: string;
  theirText?: string;
  /** 사용자가 관계·배경 등을 간단히 적은 맥락 (선택) */
  situationBrief?: string;
  /** 이 대화에서 특히 알고 싶은 점 (선택) */
  curiosityBrief?: string;
};

const JSON_INSTRUCTION = `
반드시 JSON **한 개의 객체**만 출력하세요. 마크다운·코드펜스 금지.
**독자 기분·위로·완곡·책임 분산은 금지.** 냉정·직설·단정. 규칙 문서 §2·§7를 반드시 따르세요.
**JSON 문법:** 문자열 값 안에는 큰따옴표 문자를 넣지 마세요(깨지면 전체가 파싱 불가). 인용은 그냥 서술하거나 필요 시 작은따옴표만 사용하세요.
필드:
{
  "plainSummary": "심리를 잘 모르는 사람도 이해하도록, 이 관계·대화의 큰 그림을 3~6문장으로 쉬운 말로. 전문용어는 최소화.",
  "curiosityAnswer": "사용자가 [사용자가 특히 궁금해 하는 점]으로 질문을 준 경우에만: 그 질문에 **직접** 답하는 문단(4~12문장). 대화 인용·근거를 넣고 단정적으로. 질문이 없으면 빈 문자열 \"\".",
  "together": {
    "headline": "한 줄 제목(한국어). 중립 완충 없이 날카롭게 잡아도 됨.",
    "paragraphs": ["6~12문단. 관계 역동·애착·권력·정서·반복을 **보고서**처럼 상세히. 각 문단 여러 문장. 대화 근거 필수. 비약 금지."]
  },
  "clinicalImpression": "임상가 인상 한두 문장. 단정. 배려 문장 없이.",
  "clinicalImpressionConfidence": 75,
  "diagnosticHypotheses": [
    { "claim": "가설 한 줄(라벨·근거 단정).", "confidence": 82 },
    { "claim": "둘째 가설…", "confidence": 71 }
  ],
  "defenseAndTransference": "방어기제·전이·역전이·반복 역동을 **길고 촘촘하게**. \\n\\n 문단 구분.",
  "relationshipMoodScore": 42,
  "mineOneLiner": "나의 발화 정서·역동(한 문장, 수식 없이)",
  "theirOneLiner": "상대 발화 정서·역동(한 문장, 수식 없이)",
  "unconscious": {
    "mine": "나: 무의식·그림자·억압 욕구. **단정·충분 분량.**",
    "theirs": "상대: 동일",
    "relation": "둘 사이 무의식적 맞물림·긴장. 상세히."
  },
  "theirDeepRead": {
    "estimatedRealThought": "상대가 말·태도 **겉으로 드러낸 것 너머**, 현실적으로 추정되는 **실제 생각·의도·계산**(단정, 대화 근거).",
    "estimatedUnconscious": "상대 **무의식** 층(억압된 욕구·공포·수치·질투 등) 추정. 위 필드와 겹치면 여기엔 더 깊은 층·말하지 않은 동기에 초점."
  },
  "factAudit": {
    "whatIsWrong": ["나·상대·관계 맥락을 각각 이해한 뒤, **팩트 톤**으로 틀렸거나 비효율·자기기만·역동상 위험한 점. 항목마다 짧게 단정.", "최소 3개, 많으면 10개"],
    "whatMustFix": ["**고쳐야 할 것**: 행동·경계·기대·말버릇 등. 위로 없이.", "최소 3개, 많으면 10개"]
  }
}
`;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false as const, reason: "bad_json" }, { status: 400 });
  }

  const myText = String(body.myText ?? "")
    .trim()
    .slice(0, MAX_CHARS);
  const theirText = String(body.theirText ?? "")
    .trim()
    .slice(0, MAX_CHARS);
  const situationBrief = String(body.situationBrief ?? "")
    .trim()
    .slice(0, MAX_SITUATION_CHARS);
  const curiosityBrief = String(body.curiosityBrief ?? "")
    .trim()
    .slice(0, MAX_CURIOSITY_CHARS);
  if (myText.length < 20 || theirText.length < 20) {
    return NextResponse.json({ ok: false as const, reason: "too_short" }, { status: 400 });
  }

  const rules = loadAiAnalysisRules();

  const system = `아래 **규칙 문서 전체**를 준수합니다. 특히 **독자 배려·위로·완곡을 배제**하고, 텍스트가 가리키는 바를 **확실하게·냉정하게** 쓰세요. 소극적 해석·얼버무림은 금지입니다.
사용자가 **상황 설명**이나 **궁금한 점**을 주면 관계·배경·질문에 반영하되, **대화 인용과 모순되면 대화 텍스트를 우선**합니다.
**궁금한 점**이 비어 있지 않으면 \`curiosityAnswer\`에 반드시 그 질문에 대한 **직접 답변**을 채웁니다(다른 필드와 중복돼도 됨).
\`theirDeepRead\`·\`factAudit\`은 **추정·해석**이지만, 톤은 **사실 보도에 가깝게** 직설하고, **책임 분산·감싸는 말**은 쓰지 마세요.

**점수 필드 (필수):**
- \`clinicalImpressionConfidence\`: 임상 인상 한 줄에 대한 **모델 확신도** 0~100 정수.
- \`diagnosticHypotheses\`: 각 항목은 \`{ "claim", "confidence" }\`만 사용.**confidence 60 이상인 가설만** 넣고 **최대 5개**. 애매하면 넣지 마세요.
- \`relationshipMoodScore\`: 이 대화·관계의 **전반적 무드** 0~100.**낮을수록** 긴장·충돌·냉기·불안,**높을수록** 완화·유연·덜 압박. UI 톤에 쓰이므로 대화 근거로 채점.

=== 규칙 문서 시작 ===
${rules}
=== 규칙 문서 끝 ===

${JSON_INSTRUCTION}`;

  const userParts: string[] = [];
  if (situationBrief.length > 0) {
    userParts.push(`[사용자가 제공한 상황·맥락]\n${situationBrief}`);
  }
  if (curiosityBrief.length > 0) {
    userParts.push(`[사용자가 특히 궁금해 하는 점]\n${curiosityBrief}`);
  }
  userParts.push(
    `[나가 보낸 말]\n${myText}\n\n[상대가 보낸 말]\n${theirText}`
  );
  const user = userParts.join("\n\n");

  const JSON_RETRY_SUFFIX = `

[출력 형식 — 필수]
직전에 같은 요청으로 잘못된 JSON이 나온 경우입니다. 이번에는 반드시 **RFC 8259에 맞는 JSON 객체 하나만** 출력하세요.
문자열 값 안에 큰따옴표(")를 넣지 마세요. together.paragraphs 각 항목은 4문장 이내로 짧게 나누세요.`;

  let started = await completeAnalysisJson(system, user);
  if (!started.ok) {
    if (started.reason === "no_key") {
      return NextResponse.json({ ok: false as const, reason: "no_key" });
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[analyze-chat-ai] upstream:", started.detail);
    }
    return NextResponse.json(
      {
        ok: false as const,
        reason: "upstream" as const,
        detail: started.detail,
      },
      { status: 502 }
    );
  }

  let parsed: {
    plainSummary?: string;
    curiosityAnswer?: string;
    together?: { headline?: string; paragraphs?: unknown };
    clinicalImpression?: string;
    clinicalImpressionConfidence?: unknown;
    diagnosticHypotheses?: unknown;
    defenseAndTransference?: string;
    relationshipMoodScore?: unknown;
    mineOneLiner?: string;
    theirOneLiner?: string;
    unconscious?: {
      mine?: string;
      theirs?: string;
      relation?: string;
    };
    theirDeepRead?: {
      estimatedRealThought?: string;
      estimatedUnconscious?: string;
    };
    factAudit?: {
      whatIsWrong?: unknown;
      whatMustFix?: unknown;
    };
  };

  try {
    parsed = parseLooseJsonObject(started.raw) as typeof parsed;
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[analyze-chat-ai] parse_error 1st try, len=%s tail=%s",
        started.raw.length,
        started.raw.slice(-400)
      );
    }
    const retry = await completeAnalysisJson(system + JSON_RETRY_SUFFIX, user);
    if (!retry.ok) {
      const tail = started.raw.slice(-400);
      const why =
        retry.reason === "upstream"
          ? retry.detail
          : retry.reason === "no_key"
            ? "API 키 없음"
            : "알 수 없음";
      return NextResponse.json(
        {
          ok: false as const,
          reason: "parse_error" as const,
          detail: `JSON 파싱 실패(응답 ${started.raw.length}자). 재요청 실패: ${why} …처음 응답 끝: ${tail.slice(0, 180)}`,
        },
        { status: 502 }
      );
    }
    try {
      parsed = parseLooseJsonObject(retry.raw) as typeof parsed;
      started = retry;
    } catch {
      const tail = retry.raw.slice(-400);
      if (process.env.NODE_ENV === "development") {
        console.error("[analyze-chat-ai] parse_error 2nd try, len=%s", retry.raw.length);
      }
      return NextResponse.json(
        {
          ok: false as const,
          reason: "parse_error" as const,
          detail: `JSON 파싱 실패(재시도 응답 ${retry.raw.length}자). 토큰·형식 문제일 수 있습니다. GEMINI_MAX_OUTPUT_TOKENS를 16384 이상으로 두고 다시 시도하세요. ${tail.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }
  }

  try {
    const paragraphs = Array.isArray(parsed.together?.paragraphs)
      ? (parsed.together!.paragraphs as unknown[])
          .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];

    const plainSummary =
      typeof parsed.plainSummary === "string" ? parsed.plainSummary.trim() : "";

    let curiosityAnswer =
      typeof parsed.curiosityAnswer === "string" ? parsed.curiosityAnswer.trim() : "";
    if (curiosityBrief.length > 0 && curiosityAnswer.length === 0) {
      curiosityAnswer =
        "모델 응답에 직접 답변 필드가 비었습니다. 아래 「관계·대화 흐름」「심층 추정」블록에서 같은 질문을 염두에 두고 해석했는지 함께 확인해 보세요.";
    }

    const clinicalImpression =
      typeof parsed.clinicalImpression === "string" ? parsed.clinicalImpression.trim() : "";

    const clinicalImpressionConfidence = clampScore(parsed.clinicalImpressionConfidence);

    const diagnosticHypotheses = normalizeScoredHypotheses(parsed.diagnosticHypotheses);

    const relationshipMoodScore = clampScore(parsed.relationshipMoodScore);

    const defenseAndTransference =
      typeof parsed.defenseAndTransference === "string"
        ? parsed.defenseAndTransference.trim()
        : "";

    const unconscious = parsed.unconscious
      ? {
          mine:
            typeof parsed.unconscious.mine === "string"
              ? parsed.unconscious.mine.trim()
              : "",
          theirs:
            typeof parsed.unconscious.theirs === "string"
              ? parsed.unconscious.theirs.trim()
              : "",
          relation:
            typeof parsed.unconscious.relation === "string"
              ? parsed.unconscious.relation.trim()
              : "",
        }
      : null;

    const hasUn =
      unconscious &&
      (unconscious.mine.length > 0 ||
        unconscious.theirs.length > 0 ||
        unconscious.relation.length > 0);

    const dr = parsed.theirDeepRead;
    const theirDeepRead =
      dr && typeof dr === "object"
        ? {
            estimatedRealThought:
              typeof dr.estimatedRealThought === "string"
                ? dr.estimatedRealThought.trim()
                : "",
            estimatedUnconscious:
              typeof dr.estimatedUnconscious === "string"
                ? dr.estimatedUnconscious.trim()
                : "",
          }
        : null;
    const hasDeep =
      theirDeepRead &&
      (theirDeepRead.estimatedRealThought.length > 0 ||
        theirDeepRead.estimatedUnconscious.length > 0);

    const fa = parsed.factAudit;
    const whatIsWrong =
      fa && typeof fa === "object" ? normalizeBulletList(fa.whatIsWrong) : [];
    const whatMustFix =
      fa && typeof fa === "object" ? normalizeBulletList(fa.whatMustFix) : [];
    const hasFact = whatIsWrong.length > 0 || whatMustFix.length > 0;

    const hasBody = paragraphs.length > 0;
    const hasPlain = plainSummary.length > 0;
    const hasClinical =
      clinicalImpression.length > 0 ||
      diagnosticHypotheses.length > 0 ||
      defenseAndTransference.length > 0 ||
      clinicalImpressionConfidence != null;
    /** 궁금한 점을 적었으면 서버가 보강한 curiosityAnswer만으로도 성공 처리 */
    const hasCuriosityFilled =
      curiosityBrief.length > 0 && curiosityAnswer.trim().length > 0;

    if (
      !hasBody &&
      !hasClinical &&
      !hasUn &&
      !hasPlain &&
      !hasDeep &&
      !hasFact &&
      !hasCuriosityFilled
    ) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[analyze-chat-ai] empty: paragraphs=%s plain=%s clinical=%s",
          paragraphs.length,
          plainSummary.length,
          hasClinical
        );
      }
      return NextResponse.json(
        {
          ok: false as const,
          reason: "empty" as const,
          detail: "모델 응답에 본문·임상·무의식·심층·팩트·궁금한 점 답 필드가 비었습니다.",
        },
        { status: 502 }
      );
    }

    const togetherHeadline =
      typeof parsed.together?.headline === "string" && parsed.together.headline.trim()
        ? parsed.together.headline.trim()
        : "AI 통합 해석";

    const fallbackPara =
      "(통합 본문이 비었습니다. 임상 인상·가설·무의식 블록을 참고하세요.)";

    return NextResponse.json({
      ok: true as const,
      provider: started.provider,
      model: started.model ?? null,
      plainSummary: hasPlain ? plainSummary : null,
      curiosityAnswer:
        curiosityBrief.length > 0 && curiosityAnswer.length > 0 ? curiosityAnswer : null,
      together: {
        headline: togetherHeadline,
        paragraphs: paragraphs.length > 0 ? paragraphs : [fallbackPara],
      },
      clinicalImpression: clinicalImpression.length > 0 ? clinicalImpression : null,
      clinicalImpressionConfidence,
      diagnosticHypotheses: diagnosticHypotheses.length > 0 ? diagnosticHypotheses : null,
      defenseAndTransference:
        defenseAndTransference.length > 0 ? defenseAndTransference : null,
      relationshipMoodScore,
      mineOneLiner:
        typeof parsed.mineOneLiner === "string" ? parsed.mineOneLiner.trim() : null,
      theirOneLiner:
        typeof parsed.theirOneLiner === "string" ? parsed.theirOneLiner.trim() : null,
      unconscious: hasUn ? unconscious : null,
      theirDeepRead: hasDeep ? theirDeepRead : null,
      factAudit: hasFact ? { whatIsWrong, whatMustFix } : null,
    });
  } catch {
    return NextResponse.json({ ok: false as const, reason: "error" }, { status: 500 });
  }
}
