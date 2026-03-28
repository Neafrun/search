/**
 * 카카오톡·간단 "이름: 메시지" 형식에서 발화자를 구분해
 * 나/상대 텍스트로 나눕니다.
 */

export type ParsedBySpeaker = {
  bySpeaker: Record<string, string>;
  /** 발화 빈도 순 정렬된 이름 */
  speakerOrder: string[];
};

/** 카카오: 날짜 뒤 ", 이름 : 메시지" */
const KAKAO_LINE =
  /^(\d{4}[년.\s-]*\d{1,2}[월.\s-]*\d{1,2}[일]?[^,\n]*),\s*([^:\n]+?)\s*:\s*(.*)$/u;

/**
 * 카카오톡 모바일 내보내기(흔한 형식):
 * "오전 7:32 지훈 나 학교 가고있어" / "오후 12:22 애깅🐰🤍 메시지…"
 * 시간 뒤 첫 토큰이 발화자(이모지 닉 포함), 나머지가 본문.
 */
const KAKAO_MOBILE_TIME_NAME =
  /^(오전|오후)\s*(\d{1,2}):(\d{1,2})\s+(\S+)\s*(.*)$/u;

/**
 * 연도 없이 시작하는 줄: "오전 11:30, 홍길동 : 메시지"
 * 첫 번째 콜론이 시:분이면 simple 파서가 "오전 11"을 이름으로 오인하므로 이 패턴을 먼저 씁니다.
 */
const KAKAO_TIME_COMMA_NAME =
  /^([^,\n]+),\s*([^:\n]+?)\s*:\s*(.*)$/u;

/** 간단: 한 줄이 "이름 : 메시지" (쉼표 없이) */
const SIMPLE_NAME_LINE = /^([^:\n]{1,40})\s*:\s*(.+)$/u;

/** [이름] 내용 */
const BRACKET_LINE = /^\[([^\]]+)\]\s*(.*)$/u;

function normalizeSpeakerName(s: string): string {
  return s.replace(/\u200b/g, "").trim().replace(/님$/u, "").trim();
}

/** 날짜·시간만 있는 줄의 앞부분인지 (이름 자리가 아님) */
function looksLikeKakaoTimestampPrefix(s: string): boolean {
  const t = s.trim();
  if (/오전|오후/u.test(t)) return true;
  if (/\d{4}\s*년|\d{1,2}\s*월|\d{1,2}\s*일/u.test(t)) return true;
  if (/[월화수목금토일]요일/u.test(t)) return true;
  if (/\b(am|pm)\b/iu.test(t)) return true;
  if (/\d{1,2}\s*:\s*\d{1,2}/u.test(t)) return true;
  return false;
}

/**
 * 사람 이름·닉네임으로 쓸 수 있는지 (오전 9, 오전 11:30 등 시간 조각 제외)
 */
export function isValidSpeakerName(name: string): boolean {
  const t = normalizeSpeakerName(name);
  if (t.length < 1 || t.length > 36) return false;

  if (/^\d{4}[년.\s-]/u.test(t)) return false;
  if (/^[월화수목금토일]요일/u.test(t)) return false;

  if (/^(오전|오후)\s*\d{0,2}\s*:\s*\d{1,2}/iu.test(t)) return false;
  if (/^(오전|오후)\s*\d{1,2}$/iu.test(t)) return false;
  if (/^(오전|오후)\d{1,2}$/iu.test(t)) return false;
  if (/^(오전|오후)\s*\d{1,2}\s*시/u.test(t)) return false;

  if (/^\d{1,2}\s*:\s*\d{1,2}(?:\s*:\s*\d{1,2})?$/.test(t)) return false;

  if (/^[\d\s:：.\-]+$/u.test(t)) return false;

  if (/^(오전|오후)([\s\d:：.]+)?$/iu.test(t)) return false;

  const timeOnlyLike =
    /^[\d\s:：.\-오전오후]+$/u.test(t) && (/오전|오후/u.test(t) || /\d\s*:\s*\d/u.test(t));
  if (timeOnlyLike && !/[가-힣a-zA-Z]/.test(t.replace(/오전|오후|\s|\d|:|：|\.|-/gu, ""))) {
    return false;
  }

  return true;
}

function mergeBody(prev: string, add: string): string {
  if (!prev) return add;
  if (!add) return prev;
  return `${prev}\n${add}`;
}

/** 줄 단위로 메시지 블록 수집 (카카오 연속 줄 포함) */
function parseKakaoStyle(lines: string[]): Map<string, string[]> {
  const chunks = new Map<string, string[]>();
  let currentSpeaker: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, "");
    const trimmed = line.trim();
    if (!trimmed) continue;

    const kakao = trimmed.match(KAKAO_LINE);
    if (kakao) {
      const name = normalizeSpeakerName(kakao[2] ?? "");
      const body = (kakao[3] ?? "").trim();
      if (name && isValidSpeakerName(name)) {
        if (!chunks.has(name)) chunks.set(name, []);
        chunks.get(name)!.push(body);
        currentSpeaker = name;
        continue;
      }
    }

    const mobile = trimmed.match(KAKAO_MOBILE_TIME_NAME);
    if (mobile) {
      const name = normalizeSpeakerName(mobile[4] ?? "");
      const body = (mobile[5] ?? "").trim();
      if (name && isValidSpeakerName(name)) {
        if (!chunks.has(name)) chunks.set(name, []);
        chunks.get(name)!.push(body);
        currentSpeaker = name;
        continue;
      }
    }

    const commaName = trimmed.match(KAKAO_TIME_COMMA_NAME);
    if (commaName) {
      const prefix = (commaName[1] ?? "").trim();
      const name = normalizeSpeakerName(commaName[2] ?? "");
      const body = (commaName[3] ?? "").trim();
      if (
        body &&
        name &&
        isValidSpeakerName(name) &&
        looksLikeKakaoTimestampPrefix(prefix)
      ) {
        if (!chunks.has(name)) chunks.set(name, []);
        chunks.get(name)!.push(body);
        currentSpeaker = name;
        continue;
      }
    }

    const bracket = trimmed.match(BRACKET_LINE);
    if (bracket && (bracket[2] ?? "").trim().length > 0) {
      const name = normalizeSpeakerName(bracket[1] ?? "");
      const body = (bracket[2] ?? "").trim();
      if (name.length >= 1 && isValidSpeakerName(name)) {
        if (!chunks.has(name)) chunks.set(name, []);
        chunks.get(name)!.push(body);
        currentSpeaker = name;
        continue;
      }
    }

    const simple = trimmed.match(SIMPLE_NAME_LINE);
    const sg1 = simple?.[1] ?? "";
    if (
      simple &&
      !/^(오전|오후)\s*\d{1,2}\s*:/u.test(trimmed) &&
      !/^\d{4}/u.test(sg1) &&
      !/^https?$/iu.test(sg1) &&
      !/\/\//u.test(sg1) &&
      (sg1.length < 35 || !sg1.includes("년")) &&
      isValidSpeakerName(sg1)
    ) {
      const name = normalizeSpeakerName(sg1);
      const body = (simple![2] ?? "").trim();
      if (name.length >= 1 && name.length <= 36 && body.length > 0) {
        if (!chunks.has(name)) chunks.set(name, []);
        chunks.get(name)!.push(body);
        currentSpeaker = name;
        continue;
      }
    }

    if (currentSpeaker) {
      const arr = chunks.get(currentSpeaker)!;
      arr[arr.length - 1] = mergeBody(arr[arr.length - 1] ?? "", trimmed);
    }
  }

  return chunks;
}

function aggregateChunks(chunks: Map<string, string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, parts] of chunks) {
    if (!isValidSpeakerName(name)) continue;
    out[name] = parts.filter(Boolean).join("\n");
  }
  return out;
}

function speakerOrderByCount(bySpeaker: Record<string, string>): string[] {
  return Object.keys(bySpeaker).sort((a, b) => {
    const la = bySpeaker[a]?.length ?? 0;
    const lb = bySpeaker[b]?.length ?? 0;
    return lb - la;
  });
}

function namesMatch(a: string, b: string): boolean {
  const x = normalizeSpeakerName(a).toLowerCase();
  const y = normalizeSpeakerName(b).toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  return false;
}

/** 통째 붙여넣기 → 발화자별 텍스트 */
export function parseChatExport(raw: string): ParsedBySpeaker | null {
  const text = raw.trim();
  if (text.length < 20) return null;

  const lines = text.split(/\n/u);
  const chunks = parseKakaoStyle(lines);
  if (chunks.size === 0) return null;

  const bySpeaker = aggregateChunks(chunks);
  const speakerOrder = speakerOrderByCount(bySpeaker);
  if (speakerOrder.length === 0) return null;

  return { bySpeaker, speakerOrder };
}

export type AssignSidesResult =
  | {
      ok: true;
      mine: string;
      theirs: string;
      speakers: [string, string];
      /** 채팅에 보이는 표시 이름 — 나 쪽 */
      meLabel: string;
      /** 채팅에 보이는 표시 이름 — 상대 쪽 */
      themLabel: string;
    }
  | { ok: false; reason: "need_pick" | "too_few" | "too_many"; speakers: string[] };

/** 상위 2명만 사용 (3명 이상이면 분량 많은 순) */
function topTwoSpeakers(order: string[], bySpeaker: Record<string, string>): string[] {
  if (order.length <= 2) return order;
  return order.slice(0, 2);
}

/**
 * 발화자별 텍스트에서 나/상대 할당.
 * @param myLabel 채팅에 보이는 내 이름(부분 일치 가능)
 */
export function assignMeAndThem(
  parsed: ParsedBySpeaker,
  myLabel?: string
): AssignSidesResult {
  const order = parsed.speakerOrder;
  const bySpeaker = parsed.bySpeaker;
  const two = topTwoSpeakers(order, bySpeaker);
  if (two.length < 2) {
    return { ok: false, reason: "too_few", speakers: two };
  }

  const [a, b] = two as [string, string];
  const textA = bySpeaker[a] ?? "";
  const textB = bySpeaker[b] ?? "";

  if (myLabel?.trim()) {
    const hint = myLabel.trim();
    const imA = namesMatch(a, hint);
    const imB = namesMatch(b, hint);
    if (imA && !imB) {
      return {
        ok: true,
        mine: textA,
        theirs: textB,
        speakers: [a, b],
        meLabel: a,
        themLabel: b,
      };
    }
    if (imB && !imA) {
      return {
        ok: true,
        mine: textB,
        theirs: textA,
        speakers: [a, b],
        meLabel: b,
        themLabel: a,
      };
    }
    if (imA && imB) {
      return {
        ok: true,
        mine: textA,
        theirs: textB,
        speakers: [a, b],
        meLabel: a,
        themLabel: b,
      };
    }
  }

  return {
    ok: false,
    reason: "need_pick",
    speakers: [a, b],
  };
}

/** 사용자가 "나"인 발화자 이름을 고른 뒤 */
export function assignWithPickedMe(
  parsed: ParsedBySpeaker,
  meName: string
): AssignSidesResult | null {
  const two = topTwoSpeakers(parsed.speakerOrder, parsed.bySpeaker);
  if (two.length < 2) return null;
  const [a, b] = two;
  const bySpeaker = parsed.bySpeaker;
  const ta = bySpeaker[a] ?? "";
  const tb = bySpeaker[b] ?? "";

  if (namesMatch(meName, a)) {
    return {
      ok: true,
      mine: ta,
      theirs: tb,
      speakers: [a, b],
      meLabel: a,
      themLabel: b,
    };
  }
  if (namesMatch(meName, b)) {
    return {
      ok: true,
      mine: tb,
      theirs: ta,
      speakers: [a, b],
      meLabel: b,
      themLabel: a,
    };
  }
  return null;
}
