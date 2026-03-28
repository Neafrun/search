/** 무드 타입 — 채팅 분석 결과 카드용 공통 타입·빌더 (자기관찰용, 임상 진단 아님) */

export type AxisScores = {
  expression: number;
  connection: number;
  sensitivity: number;
  wellbeing: number;
};

export type PatternBlock = {
  icon: string;
  title: string;
  subtitle: string;
  body: string;
};

export type AnalysisResult = {
  archetype: string;
  emoji: string;
  tagline: string;
  patterns: {
    visual: PatternBlock;
    language: PatternBlock;
    behavior: PatternBlock;
  };
  methodologyNote: string;
  axes: { key: keyof AxisScores; label: string; value: number; hint: string }[];
  summary: string[];
  gentleNote: string;
};

function pickArchetype(a: AxisScores): { name: string; emoji: string; tagline: string } {
  const { expression: e, connection: c, sensitivity: s, wellbeing: w } = a;
  if (e >= 70 && c >= 65 && s <= 55 && w >= 55) {
    return { name: "라이트하우스형", emoji: "🔆", tagline: "기록과 연결이 자연스러운 표현가" };
  }
  if (s >= 65 && w <= 45) {
    return { name: "글래스 하트형", emoji: "💗", tagline: "반응과 비교에 예민하게 반응하는 편" };
  }
  if (e <= 45 && c <= 50 && w >= 60) {
    return { name: "사이렌 오프형", emoji: "🌙", tagline: "조용히 지켜보고 거리 두기를 잘하는 편" };
  }
  if (c >= 70 && e >= 55) {
    return { name: "서클 메이커형", emoji: "🫶", tagline: "관계·공동체 감각이 큰 타입" };
  }
  if (w >= 70) {
    return { name: "그라운드형", emoji: "🌿", tagline: "화면·알림 경계와 쉼의 감각이 비교적 또렷함" };
  }
  return { name: "믹스드 톤형", emoji: "✨", tagline: "상황에 따라 표현·거리·민감도가 섞여 나타나는 타입" };
}

function buildAxisList(axes: AxisScores): AnalysisResult["axes"] {
  return [
    {
      key: "expression",
      label: "표현·기록 에너지",
      value: axes.expression,
      hint: "글·메시지로 ‘나’를 드러내고 남기는 힘",
    },
    {
      key: "connection",
      label: "관계·연결",
      value: axes.connection,
      hint: "타인·공동체와 맺는 거리감과 빈도",
    },
    {
      key: "sensitivity",
      label: "반응·비교 민감도",
      value: axes.sensitivity,
      hint: "알림·반응·비교 자극에 얼마나 흔들리기 쉬운지",
    },
    {
      key: "wellbeing",
      label: "접속·알림 경계",
      value: axes.wellbeing,
      hint: "끊음·균형·보호 본능(높을수록 회복과 경계가 비교적 안정)",
    },
  ];
}

function buildPatternBlocks(axes: AxisScores): AnalysisResult["patterns"] {
  const { expression: e, connection: c, sensitivity: s, wellbeing: w } = axes;

  const visualBody =
    e >= 65 && w >= 55
      ? "표현 에너지가 높게 잡힙니다. ‘보여 주고 기록한다’는 쪽의 패턴으로 읽힐 수 있어요."
      : e >= 55
        ? "적당한 기록·공유 욕구가 보입니다. 한 박자 차분하게 정리하려는 경향으로 해석할 수 있어요."
        : "드러내는 톤은 비교적 낮게 잡힙니다. 관찰·수신에 가까운 역할로 읽힐 수 있어요.";

  const languageBody =
    c >= 65 && s <= 50
      ? "문장은 관계·초대형 어조(질문, 이모지로 말 걸기)에 가깝게 그려질 수 있어요. 사고는 ‘함께’·‘공유’ 쪽으로 정렬되어 보입니다."
      : s >= 60
        ? "짧은 호흡의 문장, 감탄·의문 부호, 이모지 밀도가 높아질 수 있는 민감한 어조로 읽힐 수 있어요."
        : "서술은 차분하고 핵심만 남기는 경향으로 볼 수 있어요. 이모지는 절제되거나 의미 있는 몇 개에 머무를 수 있습니다.";

  const behaviorBody =
    e >= 60 && w >= 58
      ? "연락·공유 리듬은 비교적 규칙적이고 에너지가 꾸준한 편으로 추정됩니다. ‘보내고 기록’에 무게가 실릴 수 있어요."
      : s >= 58
        ? "알림·반응·비교 자극에 반응이 잦아지기 쉬운 리듬으로 읽힐 수 있어요. 시간대가 늦게 몰리기 쉬운 패턴으로 볼 수 있습니다."
        : "활동은 몰아서 하거나 긴 간격을 두는 ‘파도형’에 가깝게 보입니다. 상호작용은 적지만 깊게 남기는 쪽으로 해석할 수 있어요.";

  return {
    visual: {
      icon: "🎨",
      title: "표현 스타일",
      subtitle: "드러냄·기록 욕구로 읽히는 패턴(추정)",
      body: visualBody,
    },
    language: {
      icon: "✍️",
      title: "언어 패턴",
      subtitle: "어조·이모지·문장 구조로 읽히는 사고·감정 처리(추정)",
      body: languageBody,
    },
    behavior: {
      icon: "🕐",
      title: "행동 리듬",
      subtitle: "연락·반응으로 보이는 심리적 에너지(추정)",
      body: behaviorBody,
    },
  };
}

function buildSummaryLines(axes: AxisScores): string[] {
  const summary: string[] = [];
  if (axes.sensitivity >= 60 && axes.wellbeing <= 50) {
    summary.push(
      "반응과 비교에 마음이 쉽게 가닿는 편으로 보입니다. ‘완전히 끊기’보다 알림 줄이기·방해 금지 시간처럼 작은 경계부터 시험해 보는 것이 도움이 될 수 있어요."
    );
  } else if (axes.expression >= 65 && axes.wellbeing >= 55) {
    summary.push(
      "기록과 표현에 에너지를 쓰면서도, 비교적 균형을 찾으려는 흔적이 보입니다. 부담을 나누면 더 오래 지속될 수 있어요."
    );
  } else if (axes.connection >= 65 && axes.expression <= 55) {
    summary.push(
      "관계·공동체 쪽 감각이 큰 편입니다. 피로할 때는 ‘읽기만’ 하는 시간을 의도적으로 두면 여유가 생길 수 있어요."
    );
  } else {
    summary.push(
      "표현·관계·민감도·경계가 한데 섞여, 상황에 따라 다른 모드로 쓰는 타입에 가깝습니다. 한동안 어떤 모드가 많았는지만 떠올려도 패턴이 보일 수 있어요."
    );
  }
  summary.push("자기관찰·대화 소재용이며, 임상 진단이나 타인 평가가 아닙니다.");
  return summary;
}

const METHODOLOGY_NOTE =
  "서술 틀은 심리언어학·행동 패턴·융의 원형 개념에서 영감을 받았습니다. 채팅 텍스트에서 낸 점수 조합으로 카드를 구성합니다. 임상 진단이 아닙니다.";

export type BuildAnalysisOptions = {
  methodologyNote?: string;
  patterns?: AnalysisResult["patterns"];
  axes?: AnalysisResult["axes"];
  summary?: string[];
};

export function buildAnalysisResult(
  axes: AxisScores,
  gentleNote: string,
  options?: BuildAnalysisOptions
): AnalysisResult {
  const { name, emoji, tagline } = pickArchetype(axes);
  return {
    archetype: name,
    emoji,
    tagline,
    patterns: options?.patterns ?? buildPatternBlocks(axes),
    methodologyNote: options?.methodologyNote ?? METHODOLOGY_NOTE,
    axes: options?.axes ?? buildAxisList(axes),
    summary: options?.summary ?? buildSummaryLines(axes),
    gentleNote,
  };
}
