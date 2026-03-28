import {
  buildAnalysisResult,
  type AnalysisResult,
  type AxisScores,
  type PatternBlock,
} from "@/lib/mood-analysis";
import { axesFromLexiconScores, scoreLexiconDimensions } from "@/lib/lexicon-ko";

function buildChatSummaryLines(axes: AxisScores): string[] {
  const { sensitivity: s, wellbeing: w, expression: e, connection: c } = axes;
  const out: string[] = [];
  if (s >= 60 && w <= 50) {
    out.push(
      "갈등·불안 단서가 상대적으로 많이 잡힐 수 있어요. ‘완전히 끊기’보다 잠시 대화를 멈추거나, 한 문장만 짧게 남기는 식으로 호흡을 나눠 보는 것도 도움이 될 수 있어요."
    );
  } else if (e >= 65 && w >= 55) {
    out.push(
      "말로 에너지를 쓰면서도 균형을 찾으려는 흔적이 보일 수 있어요. ‘완벽한 한 번의 해명’보다 ‘오늘은 여기까지’처럼 부담을 나눠도 괜찮을 수 있어요."
    );
  } else if (c >= 65 && e <= 55) {
    out.push(
      "관계·정서 표현 쪽 감각이 큰 편으로 읽힐 수 있어요. 지칠 때는 읽기만 하거나 답을 미루는 시간을 의도적으로 두면 여유가 생길 수 있어요."
    );
  } else {
    out.push(
      "표현·관계·민감도·회복 신호가 한데 섞여, 상황마다 다른 말투로 나올 수 있어요. 최근에 어떤 톤이 많았는지만 떠올려도 패턴이 보일 수 있어요."
    );
  }
  out.push("자기관찰·대화 소재용이며, 임상 진단이나 타인 평가가 아닙니다.");
  return out;
}

const CHAT_METHODOLOGY =
  "점수는 문헌상 개념을 한국어 키워드·문장 길이로 **근사**한 것입니다. 공식 검사·논문의 원척도와 동일하지 않습니다.\n" +
  "• 대인관계 원형(Interpersonal Circumplex): 친밀·따뜻함(Communion), 주도·단호함(Agency) 아이디어(Wiggins, Kiesler 등).\n" +
  "• 애착 불안·회피: Experience in Close Relationships 등 문항 맥락을 참고한 단어 범주(본 앱은 ECR 척도가 아님).\n" +
  "• 정서: 긍정·부정 정서 단어 비율 아이디어(Watson 등 PANAS류).\n" +
  "• 수식: lib/lexicon-ko.ts 주석 참고. 임상 진단이 아닙니다.";

/** 문헌 프록시 어휘 점수 → 네 축 (8~98) */
export function computeAxesFromChatText(raw: string): AxisScores {
  const t = raw.trim();
  if (t.length < 8) {
    return { expression: 50, connection: 50, sensitivity: 50, wellbeing: 50 };
  }
  return axesFromLexiconScores(scoreLexiconDimensions(t));
}

function buildChatPatterns(axes: AxisScores): {
  visual: PatternBlock;
  language: PatternBlock;
  behavior: PatternBlock;
} {
  const { expression: e, connection: c, sensitivity: s, wellbeing: w } = axes;

  const rhythmBody =
    e >= 65 && c >= 58
      ? "Agency·Communion 근사 점수가 함께 높게 잡힙니다. 주도적으로 말하면서도 관계 언어가 섞인 ‘밀도 있는’ 서술로 읽힐 수 있어요."
      : e >= 55
        ? "서술 분량과 단호·친밀 단서가 중간대로 보입니다. 긴 메시지와 짧은 반응이 섞일 수 있어요."
        : "말을 아끼거나 짧게 끊는 쪽으로 읽힐 수 있어요. 회피·억제 단서와 함께 해석할 수 있습니다.";

  const langBody =
    c >= 65 && s <= 55
      ? "질문·감사·사과·애정 표현이 섞일 수 있는, 관계를 열어두는 말투로 그려질 수 있어요."
      : s >= 60
        ? "느낌표·물음표·감정 단어 밀도가 높아질 수 있는 민감한 말투로 읽힐 수 있어요."
        : "차분한 단정형이나 짧은 반응 위주로, 감정을 덜 드러내는 톤으로 볼 수 있어요.";

  const relBody =
    c >= 65 && w >= 55
      ? "상대를 부르거나 ‘우리’에 가까운 표현이 보이면 관계 안전감을 중시하는 쪽으로 해석할 수 있어요."
      : s >= 58 && w <= 52
        ? "갈등·불안 단서가 상대적으로 많이 잡힐 수 있어요. 에너지가 말에 많이 실리는 시기로 볼 수 있습니다."
        : "거리 두기·짧은 응답·정리하는 말이 섞이면 회복과 경계를 동시에 찾는 패턴으로 읽을 수 있어요.";

  return {
    visual: {
      icon: "💬",
      title: "대화 리듬",
      subtitle: "분량·턴·한 줄 길이로 보는 호흡(추정)",
      body: rhythmBody,
    },
    language: {
      icon: "✍️",
      title: "말투·표현",
      subtitle: "Communion·불안·부정 정서 키워드 프록시(추정)",
      body: langBody,
    },
    behavior: {
      icon: "🫧",
      title: "관계·에너지",
      subtitle: "애착·정서 균형 키워드 프록시(추정)",
      body: relBody,
    },
  };
}

function buildChatAxes(axes: AxisScores): AnalysisResult["axes"] {
  return [
    {
      key: "expression",
      label: "Agency·서술 (주도·단호 근사)",
      value: axes.expression,
      hint: "대인관계 원형의 수직축·서술 분량 프록시",
    },
    {
      key: "connection",
      label: "Communion (친밀·따뜻함 근사)",
      value: axes.connection,
      hint: "원형의 수평축에 해당하는 친밀·협력 어휘 밀도",
    },
    {
      key: "sensitivity",
      label: "불안·부정 정서 (애착·NA 프록시)",
      value: axes.sensitivity,
      hint: "애착 불안·부정 정서 단서 가중(키워드 근사)",
    },
    {
      key: "wellbeing",
      label: "정서 균형·회피 완화 (PA/NA·회피 프록시)",
      value: axes.wellbeing,
      hint: "긍정 대비 부정 비율과 회피 단서의 보정(높을수록 안정 쪽)",
    },
  ];
}

/** 한쪽(나 또는 상대) 말만으로 프로필 */
export function analyzeChatSide(
  raw: string,
  role: "me" | "them"
): AnalysisResult | null {
  const text = raw.trim();
  if (text.length < CHAT_MIN_CHARS_EACH) return null;
  const axes = computeAxesFromChatText(text);
  const gentle =
    role === "me"
      ? "내가 보낸 말만으로 추정한 나의 무드입니다. 실제 심리 상태와 다를 수 있습니다."
      : "상대가 보낸 말만으로 추정한 패턴입니다. 진단·판단·비난 용도가 아닙니다.";
  return buildAnalysisResult(axes, gentle, {
    methodologyNote: CHAT_METHODOLOGY,
    patterns: buildChatPatterns(axes),
    axes: buildChatAxes(axes),
    summary: buildChatSummaryLines(axes),
  });
}

export type TogetherHeuristic = {
  headline: string;
  paragraphs: string[];
};

/** 나·상대 축 점수 차이로 둘 사이 흐름(휴리스틱) */
export function buildTogetherHeuristic(
  mine: AxisScores,
  theirs: AxisScores
): TogetherHeuristic {
  const paragraphs: string[] = [];
  const a = mine;
  const b = theirs;

  if (a.sensitivity >= 62 && b.sensitivity >= 62) {
    paragraphs.push(
      "두 쪽 모두 말에 정서가 많이 실리는 구간으로 읽힐 수 있어요. 작은 말에도 반응이 커질 수 있는 ‘밀도 높은’ 교차로 볼 수 있습니다. 잠시 템포를 늦추거나, 사실·감정을 한 번에 나눠 말하는 연습이 도움이 될 수 있어요."
    );
  } else if (a.sensitivity >= 62 && b.sensitivity < 52) {
    paragraphs.push(
      "한쪽은 자극·갈등 민감도가 높게 잡히고, 다른 쪽은 비교적 낮게 나옵니다. 같은 문장을 ‘가볍게’와 ‘무겁게’ 읽는 차이가 날 수 있어요."
    );
  } else if (b.sensitivity >= 62 && a.sensitivity < 52) {
    paragraphs.push(
      "상대 쪽에서 정서 자극이 더 크게 잡히고, 나는 비교적 낮게 나옵니다. 속도·온도 차이를 전제로 말을 맞춰 보는 것이 좋을 수 있어요."
    );
  }

  if (a.wellbeing >= 58 && b.wellbeing < 50) {
    paragraphs.push(
      "회복·안정 신호는 나에게 더 크게, 부담은 상대 쪽에 더 크게 읽힐 수 있어요. 관계에서 에너지를 쓰는 방향이 비대칭일 수 있습니다."
    );
  } else if (b.wellbeing >= 58 && a.wellbeing < 50) {
    paragraphs.push(
      "상대는 비교적 안정 신호가, 나는 정서 부담이 더 크게 잡힐 수 있어요. 지금은 한쪽이 더 지친 시기일 수 있다고 열어 두고 볼 수 있어요."
    );
  }

  if (a.connection >= 65 && b.connection >= 65) {
    paragraphs.push(
      "둘 다 관계·정서 표현 쪽 점수가 높게 나왔어요. 친밀·감사·개방형 언어가 동시에 많을 수 있는 구간으로 읽힙니다."
    );
  } else if (Math.abs(a.connection - b.connection) >= 18) {
    paragraphs.push(
      "‘말로 관계를 여는 정도’가 한쪽에 더 실립니다. 한쪽은 연결을 더 노래하고, 다른 쪽은 짧게 받거나 거리를 두는 패턴일 수 있어요."
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      "네 축이 완전히 같지는 않지만, 둘 다 중간대에 가깝게 모여 있어요. 특별히 벌어진 축보다는, 일상적인 오가는 말 속에서 톤 차이를 찾아보는 것이 도움이 될 수 있어요."
    );
  }

  paragraphs.push(
    "위는 각자 텍스트에서 낸 점수 차이를 바탕으로 한 통합 추정이며, 실제 관계·상황과 다를 수 있습니다. 임상 진단이 아닙니다."
  );

  return {
    headline: "대인관계 원형·애착 프록시 상 동역학(휴리스틱)",
    paragraphs,
  };
}

export type DualChatResult = {
  mine: AnalysisResult;
  theirs: AnalysisResult;
  mineAxes: AxisScores;
  theirAxes: AxisScores;
  together: TogetherHeuristic;
};

export function analyzeDualChat(myRaw: string, theirRaw: string): DualChatResult | null {
  const my = myRaw.trim();
  const their = theirRaw.trim();
  if (my.length < CHAT_MIN_CHARS_EACH || their.length < CHAT_MIN_CHARS_EACH) {
    return null;
  }
  const mine = analyzeChatSide(my, "me");
  const theirs = analyzeChatSide(their, "them");
  if (!mine || !theirs) return null;
  const mineAxes = computeAxesFromChatText(my);
  const theirAxes = computeAxesFromChatText(their);
  return {
    mine,
    theirs,
    mineAxes,
    theirAxes,
    together: buildTogetherHeuristic(mineAxes, theirAxes),
  };
}

/** @deprecated 단일 텍스트 — 나+상대 합친 붙여넣기용. 가능하면 analyzeDualChat 사용 */
export function analyzeFromChat(raw: string): AnalysisResult | null {
  const text = raw.trim();
  if (text.length < CHAT_MIN_CHARS_LEGACY) return null;
  const axes = computeAxesFromChatText(text);
  return buildAnalysisResult(
    axes,
    "붙여 넣은 대화만으로 추정한 결과입니다. 타인의 대화는 동의 없이 분석하지 마세요.",
    {
      methodologyNote: CHAT_METHODOLOGY,
      patterns: buildChatPatterns(axes),
      axes: buildChatAxes(axes),
      summary: buildChatSummaryLines(axes),
    }
  );
}

/** 나·상대 각각 최소 글자 수 */
export const CHAT_MIN_CHARS_EACH = 20;
/** 예전 한 칸 붙여넣기 최소 글자 수 */
export const CHAT_MIN_CHARS_LEGACY = 40;
