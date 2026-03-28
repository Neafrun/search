/**
 * AI 응답에서 JSON 객체 추출·복구 후 파싱.
 * - 마크다운 코드펜스(```json … ```) 제거
 * - 첫 `{`부터 괄호 균형이 맞는 `}`까지 잘라서 파싱 (단순 lastIndexOf("}") 보다 안전)
 * - 흔한 LLM 깨짐: 배열·객체 끝의 trailing comma 제거
 */

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** 본문 안의 첫 ```json 또는 ``` … ``` 블록만 추출 */
function stripCodeFences(raw: string): string {
  const t = stripBom(raw).trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

/**
 * 문자열 리터럴을 고려해 첫 번째 최상위 `{` … 짝 `}` 구간만 추출.
 * (전체를 first`{`~last`}`로 자르면 문자열 안의 `}` 때문에 잘리는 경우가 있음)
 */
export function extractFirstBalancedJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return raw.slice(start, i + 1);
      }
    }
  }
  return null;
}

function repairTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

export function preprocessAiJsonRaw(raw: string): string {
  return stripCodeFences(raw);
}

export function parseLooseJsonObject(raw: string): unknown {
  const pre = preprocessAiJsonRaw(raw);
  const slices: string[] = [pre];
  const balanced = extractFirstBalancedJsonObject(pre);
  if (balanced && balanced !== pre) slices.push(balanced);

  for (const slice of slices) {
    for (const candidate of [slice, repairTrailingCommas(slice)]) {
      try {
        return JSON.parse(candidate);
      } catch {
        /* 다음 시도 */
      }
    }
  }

  throw new Error("json_parse");
}
