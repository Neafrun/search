import type { AxisScores } from "@/lib/mood-analysis";

/**
 * 한국어 채팅 텍스트에서 **문헌상 개념을 키워드로 근사**하기 위한 범주·단어 목록.
 *
 * 참고 개념(본 코드는 해당 도구·논문의 공식 검사가 아님):
 * - 대인관계 원형(Interpersonal Circumplex): Wiggins, Kiesler — 수평(친밀·따뜻함), 수직(주도·지배)
 * - 애착 불안·회피: Brennan 등 ECR 척도의 **문항 맥락**을 참고한 감정·거리 단어(근사)
 * - 정서: Watson 등 PANAS류 긍정·부정 정서 단어 빈도 아이디어
 * - LIWC(Pennebaker): 대명사·사회·정서 범주 아이디어를 단순화
 */

function countKeywordHits(text: string, keywords: readonly string[]): number {
  if (!text.trim()) return 0;
  let n = 0;
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    let i = 0;
    while (i < text.length) {
      const j = text.indexOf(kw, i);
      if (j === -1) break;
      n += 1;
      i = j + kw.length;
    }
  }
  return n;
}

function normalizePerThousandChars(hits: number, charLen: number): number {
  if (charLen < 1) return 0;
  return (hits / charLen) * 1000;
}

/** Communion / Warmth 근사: 친밀·감사·협력 어휘 밀도 */
const COMMUNION: readonly string[] = [
  "고마",
  "미안",
  "사랑",
  "보고",
  "보고싶",
  "좋아",
  "대화",
  "함께",
  "같이",
  "우리",
  "응원",
  "걱정",
  "괜찮",
  "이해",
  "위로",
  "안아",
  "챙겨",
  "배려",
  "사랑해",
  "고마워",
  "미안해",
  "ㅠㅠ",
  "♥",
  "❤",
];

/** Agency / Dominance 근사: 지시·단정·주도 어휘 */
const AGENCY: readonly string[] = [
  "해라",
  "하세요",
  "해야",
  "할거",
  "내가",
  "정해",
  "결정",
  "무조건",
  "반드시",
  "당연",
  "틀렸",
  "아니야",
  "그만",
  "이렇게만",
  "내 말",
  "듣고",
  "따라",
];

/** 애착 불안(키워드 근사): 버림·거절·확인 욕구 관련 표현 */
const ATTACHMENT_ANXIETY: readonly string[] = [
  "왜",
  "진짜",
  "확실",
  "나만",
  "싫어하는",
  "미워",
  "떠날",
  "잊",
  "연락",
  "읽씹",
  "안읽",
  "서운",
  "섭섭",
  "불안",
  "걱정",
  "미칠",
  "미치겠",
  "제발",
  "아프",
];

/** 애착 회피(키워드 근사): 거리·단절·억제 관련 표현 */
const ATTACHMENT_AVOIDANCE: readonly string[] = [
  "상관없",
  "모르겠",
  "그냥",
  "됐어",
  "됐다",
  "피곤",
  "바빠",
  "나중",
  "연락하지",
  "말하기",
  "싫고",
  "부담",
  "답장",
  "안할",
  "멀리",
  "혼자",
  "쉬고",
];

/** 긍정 정서(PA) 근사 */
const POSITIVE_AFFECT: readonly string[] = [
  "좋아",
  "행복",
  "기쁘",
  "감사",
  "괜찮",
  "편해",
  "설렘",
  "웃",
  "ㅎㅎ",
  "ㅋㅋ",
  "최고",
  "잘",
  "사랑",
];

/** 부정 정서(NA) 근사 */
const NEGATIVE_AFFECT: readonly string[] = [
  "슬프",
  "우울",
  "화나",
  "짜증",
  "힘들",
  "지옥",
  "망했",
  "끔찍",
  "싫어",
  "별로",
  "불편",
  "무서",
  "답답",
  "절망",
];

export type LexiconScores = {
  /** 0~1 근사, Communion 밀도 */
  communion: number;
  /** 0~1 근사, Agency 밀도 */
  agency: number;
  /** 0~1 근사 */
  attachmentAnxiety: number;
  /** 0~1 근사 */
  attachmentAvoidance: number;
  /** 0~1 근사 */
  positiveAffect: number;
  /** 0~1 근사 */
  negativeAffect: number;
  /** 문자 수 */
  charLength: number;
};

function saturate(raw: number, cap = 2.5): number {
  return Math.min(1, raw / cap);
}

/** 문장 길이·어휘 범주로 정규화한 지표 (문헌 개념의 키워드 프록시) */
export function scoreLexiconDimensions(text: string): LexiconScores {
  const t = text.trim();
  const len = t.length;
  if (len < 8) {
    return {
      communion: 0.5,
      agency: 0.5,
      attachmentAnxiety: 0.5,
      attachmentAvoidance: 0.5,
      positiveAffect: 0.5,
      negativeAffect: 0.5,
      charLength: len,
    };
  }

  const cComm = normalizePerThousandChars(countKeywordHits(t, COMMUNION), len);
  const cAg = normalizePerThousandChars(countKeywordHits(t, AGENCY), len);
  const cAnx = normalizePerThousandChars(countKeywordHits(t, ATTACHMENT_ANXIETY), len);
  const cAvo = normalizePerThousandChars(countKeywordHits(t, ATTACHMENT_AVOIDANCE), len);
  const cPa = normalizePerThousandChars(countKeywordHits(t, POSITIVE_AFFECT), len);
  const cNa = normalizePerThousandChars(countKeywordHits(t, NEGATIVE_AFFECT), len);

  return {
    communion: saturate(cComm, 2.2),
    agency: saturate(cAg, 1.8),
    attachmentAnxiety: saturate(cAnx, 2),
    attachmentAvoidance: saturate(cAvo, 1.6),
    positiveAffect: saturate(cPa, 2),
    negativeAffect: saturate(cNa, 2),
    charLength: len,
  };
}

/**
 * 네 축으로 매핑 (8~98).
 * expression ← Agency + 서술 분량(문자 수 로그 스케일)
 * connection ← Communion
 * sensitivity ← Attachment anxiety + NA (가중)
 * wellbeing ← PA 대비 NA + (1 - avoidance) — Gross 정서조절·회복 아이디어를 단순화
 */
export function axesFromLexiconScores(L: LexiconScores): AxisScores {
  const len = L.charLength;
  const volume = Math.min(1, Math.log10(len + 10) / Math.log10(400));

  const expr = 0.5 * L.agency + 0.35 * volume + 0.15 * L.communion;
  const conn = L.communion;
  const sens = 0.55 * L.attachmentAnxiety + 0.45 * L.negativeAffect;
  const affRatio =
    L.positiveAffect + L.negativeAffect > 0.01
      ? L.positiveAffect / (L.positiveAffect + L.negativeAffect + 0.15)
      : 0.5;
  const well = 0.55 * affRatio + 0.45 * (1 - L.attachmentAvoidance * 0.85);

  function toPct(v: number): number {
    return Math.round(Math.min(98, Math.max(8, 8 + v * 90)));
  }

  return {
    expression: toPct(expr),
    connection: toPct(conn),
    sensitivity: toPct(sens),
    wellbeing: toPct(well),
  };
}
