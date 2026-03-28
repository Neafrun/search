import fs from "node:fs";
import path from "node:path";

const RULES_REL = ["docs", "ai-analysis-rules.md"];

const FALLBACK = `# AI 대화 분석 규칙 (fallback)
- 독자 배려·위로·완곡 금지. 냉정·직설·단정. 임상 라벨·가설 진단 허용.
- 무의식·역동 직접 분석. 한국어, JSON 스키마만 출력.`;

export function loadAiAnalysisRules(): string {
  const p = path.join(process.cwd(), ...RULES_REL);
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return FALLBACK;
  }
}
