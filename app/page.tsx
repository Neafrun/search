"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  assignMeAndThem,
  assignWithPickedMe,
  parseChatExport,
  type ParsedBySpeaker,
} from "@/lib/chat-parse";

/** 분석 무드에 따라 페이지 하단이 어두워지는 그라데이션 */
function buildPageGradient(mood: number): string {
  const m = Math.max(0, Math.min(100, mood)) / 100;
  const stress = 1 - m;
  return `linear-gradient(162deg, #fafbfc 0%, #e8eef5 ${8 + m * 16}% , rgba(51,65,85,${0.1 + stress * 0.42}) 50%, rgba(15,23,42,${0.58 + stress * 0.38}) 100%)`;
}

function StoryReveal({
  show,
  children,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!show) return null;
  return <div className={`story-beat ${className ?? ""}`}>{children}</div>;
}

function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-black/20 ${className ?? ""}`}
      role="presentation"
    >
      <div
        className="h-full rounded-full bg-current opacity-90 transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function Home() {
  const [bulkPaste, setBulkPaste] = useState("");
  const [lastParsed, setLastParsed] = useState<ParsedBySpeaker | null>(null);
  const [pickSpeakers, setPickSpeakers] = useState<string[] | null>(null);
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [myChat, setMyChat] = useState("");
  const [theirChat, setTheirChat] = useState("");
  /** 파싱된 채팅 표시 이름 (탭·나는 누구인가요에 사용) */
  const [speakerLabels, setSpeakerLabels] = useState<{
    me: string;
    them: string;
  } | null>(null);
  const [chatView, setChatView] = useState<"me" | "them" | "together">("together");
  const [aiPlainSummary, setAiPlainSummary] = useState<string | null>(null);
  const [aiTogether, setAiTogether] = useState<{
    headline: string;
    paragraphs: string[];
  } | null>(null);
  const [aiOneLiners, setAiOneLiners] = useState<{
    mine: string | null;
    theirs: string | null;
  } | null>(null);
  const [aiUnconscious, setAiUnconscious] = useState<{
    mine: string;
    theirs: string;
    relation: string;
  } | null>(null);
  const [aiClinical, setAiClinical] = useState<{
    impression: string | null;
    impressionConfidence: number | null;
    hypotheses: { claim: string; confidence: number }[] | null;
    defense: string | null;
  } | null>(null);
  /** 0~100: 낮을수록 긴장·충돌(어두운 UI), 높을수록 완화(밝은 UI). 분석 후에만 설정 */
  const [aiMoodScore, setAiMoodScore] = useState<number | null>(null);
  const [aiTheirDeepRead, setAiTheirDeepRead] = useState<{
    estimatedRealThought: string;
    estimatedUnconscious: string;
  } | null>(null);
  const [aiFactAudit, setAiFactAudit] = useState<{
    whatIsWrong: string[];
    whatMustFix: string[];
  } | null>(null);
  /** API가 궁금한 점에 대해 직접 답한 문단 (질문을 안 적었으면 null) */
  const [aiCuriosityAnswer, setAiCuriosityAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  /** 분석 요청 중 가짜 진행률(0~100), 완료 시 100 */
  const [loadProgress, setLoadProgress] = useState(0);
  const [aiHint, setAiHint] = useState<string | null>(null);
  /** 분석 전·재분석 시 맥락 (관계, 최근 일 등) */
  const [situationBrief, setSituationBrief] = useState("");
  /** 특히 알고 싶은 질문·초점 */
  const [curiosityNote, setCuriosityNote] = useState("");
  const [siteLocked, setSiteLocked] = useState(false);
  /** 결과 블록 순차 공개 (스토리 비트) */
  const [storyBeat, setStoryBeat] = useState(0);

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((r) => r.json() as Promise<{ locked?: boolean }>)
      .then((d) => setSiteLocked(d.locked === true))
      .catch(() => setSiteLocked(false));
  }, []);

  useEffect(() => {
    if (!aiTogether) {
      setStoryBeat(0);
      return;
    }
    setStoryBeat(1);
    let n = 1;
    const maxBeat = 12;
    const id = setInterval(() => {
      n += 1;
      setStoryBeat(n);
      if (n >= maxBeat) clearInterval(id);
    }, 420);
    return () => clearInterval(id);
  }, [aiTogether]);

  useEffect(() => {
    if (!aiLoading) {
      setLoadProgress(0);
      return;
    }
    setLoadProgress(4);
    const started = Date.now();
    const tick = () => {
      setLoadProgress((p) => {
        if (p >= 96) return p;
        const elapsed = Date.now() - started;
        const target = Math.min(96, 12 + elapsed / 450);
        return p < target ? Math.min(96, p + Math.max(0.8, (target - p) * 0.08)) : p;
      });
    };
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [aiLoading]);

  /** 파싱 성공 후 분석 단계로 진행 */
  function applyParsedSides(
    mine: string,
    theirs: string,
    labels?: { me: string; them: string } | null
  ) {
    setMyChat(mine);
    setTheirChat(theirs);
    setSpeakerLabels(labels ?? null);
    setAiPlainSummary(null);
    setAiTogether(null);
    setAiOneLiners(null);
    setAiUnconscious(null);
    setAiClinical(null);
    setAiMoodScore(null);
    setAiTheirDeepRead(null);
    setAiFactAudit(null);
    setAiCuriosityAnswer(null);
    setAiHint(null);
    setSituationBrief("");
    setCuriosityNote("");
    setChatView("together");
  }

  function tryParseAndAnalyze() {
    setParseMessage(null);
    const p = parseChatExport(bulkPaste);
    if (!p) {
      setLastParsed(null);
      setPickSpeakers(null);
      setParseMessage(
        "형식을 인식하지 못했습니다. 모바일(시간 뒤 표시이름·메시지), PC(날짜, 이름 : 메시지), 「이름: 말」 등을 지원합니다. 줄마다 시간과 이름이 보이게 붙여 넣어 주세요."
      );
      return;
    }
    setLastParsed(p);
    const a = assignMeAndThem(p, undefined);
    if (a.ok) {
      setPickSpeakers(null);
      applyParsedSides(a.mine, a.theirs, { me: a.meLabel, them: a.themLabel });
      return;
    }
    if (a.reason === "need_pick" && a.speakers.length >= 2) {
      setPickSpeakers(a.speakers);
      setParseMessage("어느 쪽이 나인지 아래에서 고르세요.");
      return;
    }
    setPickSpeakers(null);
    setParseMessage("말한 사람이 둘으로 나뉘지 않았습니다. 대화를 더 넣거나 형식을 확인해 주세요.");
  }

  function confirmSpeakerIsMe(name: string) {
    if (!lastParsed) return;
    const a = assignWithPickedMe(lastParsed, name);
    if (a?.ok) {
      setPickSpeakers(null);
      setParseMessage(null);
      applyParsedSides(a.mine, a.theirs, { me: a.meLabel, them: a.themLabel });
    }
  }

  async function runAiAnalysis(mine: string, theirs: string) {
    setAiLoading(true);
    setAiHint(null);
    try {
      const res = await fetch("/api/analyze-chat-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myText: mine,
          theirText: theirs,
          situationBrief: situationBrief.trim() || undefined,
          curiosityBrief: curiosityNote.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reason?: string;
        detail?: string;
        plainSummary?: string | null;
        together?: { headline: string; paragraphs: string[] };
        mineOneLiner?: string | null;
        theirOneLiner?: string | null;
        clinicalImpression?: string | null;
        clinicalImpressionConfidence?: number | null;
        diagnosticHypotheses?: { claim: string; confidence: number }[] | null;
        defenseAndTransference?: string | null;
        relationshipMoodScore?: number | null;
        unconscious?: { mine: string; theirs: string; relation: string } | null;
        theirDeepRead?: {
          estimatedRealThought: string;
          estimatedUnconscious: string;
        } | null;
        factAudit?: { whatIsWrong: string[]; whatMustFix: string[] } | null;
        curiosityAnswer?: string | null;
      };
      if (data.ok && data.together?.paragraphs?.length) {
        setLoadProgress(100);
        setAiPlainSummary(data.plainSummary?.trim() ?? null);
        setAiCuriosityAnswer(
          typeof data.curiosityAnswer === "string" && data.curiosityAnswer.trim()
            ? data.curiosityAnswer.trim()
            : null
        );
        setAiTogether(data.together);
        setAiOneLiners({
          mine: data.mineOneLiner ?? null,
          theirs: data.theirOneLiner ?? null,
        });
        const hasClinical =
          (data.clinicalImpression && data.clinicalImpression.trim()) ||
          (data.diagnosticHypotheses && data.diagnosticHypotheses.length > 0) ||
          (data.defenseAndTransference && data.defenseAndTransference.trim()) ||
          (typeof data.clinicalImpressionConfidence === "number" &&
            !Number.isNaN(data.clinicalImpressionConfidence));
        setAiClinical(
          hasClinical
            ? {
                impression: data.clinicalImpression?.trim() ?? null,
                impressionConfidence:
                  typeof data.clinicalImpressionConfidence === "number"
                    ? data.clinicalImpressionConfidence
                    : null,
                hypotheses: data.diagnosticHypotheses?.length
                  ? data.diagnosticHypotheses
                  : null,
                defense: data.defenseAndTransference?.trim() ?? null,
              }
            : null
        );
        if (typeof data.relationshipMoodScore === "number" && !Number.isNaN(data.relationshipMoodScore)) {
          setAiMoodScore(
            Math.max(0, Math.min(100, Math.round(data.relationshipMoodScore)))
          );
        } else {
          setAiMoodScore(null);
        }
        if (
          data.unconscious &&
          (data.unconscious.mine || data.unconscious.theirs || data.unconscious.relation)
        ) {
          setAiUnconscious(data.unconscious);
        } else {
          setAiUnconscious(null);
        }
        if (
          data.theirDeepRead &&
          (data.theirDeepRead.estimatedRealThought?.trim() ||
            data.theirDeepRead.estimatedUnconscious?.trim())
        ) {
          setAiTheirDeepRead({
            estimatedRealThought: data.theirDeepRead.estimatedRealThought?.trim() ?? "",
            estimatedUnconscious: data.theirDeepRead.estimatedUnconscious?.trim() ?? "",
          });
        } else {
          setAiTheirDeepRead(null);
        }
        if (
          data.factAudit &&
          (data.factAudit.whatIsWrong?.length || data.factAudit.whatMustFix?.length)
        ) {
          setAiFactAudit({
            whatIsWrong: data.factAudit.whatIsWrong ?? [],
            whatMustFix: data.factAudit.whatMustFix ?? [],
          });
        } else {
          setAiFactAudit(null);
        }
        return;
      }
      if (data.reason === "no_key") {
        setAiHint(
          "분석 기능이 아직 설정되지 않았습니다. 관리자에게 문의하거나, 잠시 후 다시 시도해 주세요."
        );
      } else if (data.detail) {
        const d = data.detail;
        const short = d.length > 520 ? `${d.slice(0, 520)}…` : d;
        if (data.reason === "upstream") {
          const isQuota =
            /429|quota|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(
              data.detail ?? ""
            );
          setAiHint(
            isQuota
              ? "요청 한도에 도달했습니다. 잠시 후 다시 시도하거나, 이용 환경의 할당량·요금제를 확인해 주세요."
              : /404|NOT_FOUND|is not found for API version/i.test(data.detail ?? "")
                ? `분석 모델을 불러오지 못했습니다(404). 환경 설정의 모델 이름을 확인해 주세요. (${short.slice(0, 100)}…)`
                : `연결 오류: ${short.slice(0, 380)} 터미널 로그·.env의 GEMINI_API_KEY·모델 이름을 확인해 주세요.`
          );
        } else if (data.reason === "empty" || data.reason === "parse_error") {
          setAiHint(`${short} 잠시 후 다시 시도하세요.`);
        } else {
          setAiHint(`오류: ${short}`);
        }
      } else {
        setAiHint("응답을 가져오지 못했습니다. 잠시 후 다시 시도하세요.");
      }
    } catch {
      setAiHint("네트워크 오류가 났습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  const moodForUi =
    aiTogether && aiMoodScore != null ? aiMoodScore : aiTogether ? 52 : null;
  const isLanding = !aiTogether;
  const moodBright =
    !isLanding && moodForUi != null && moodForUi > 66;
  const moodDark = !isLanding && moodForUi != null && moodForUi < 36;
  const ink = isLanding
    ? "text-slate-900"
    : moodBright
      ? "text-slate-900"
      : "text-zinc-100";
  const inkMuted = isLanding
    ? "text-slate-500"
    : moodBright
      ? "text-slate-500"
      : "text-zinc-500";

  const pageBackground: CSSProperties = isLanding
    ? { backgroundColor: "#ffffff", minHeight: "100%" }
    : {
        background: buildPageGradient(moodForUi ?? 52),
        minHeight: "100%",
      };

  const panelSurface = isLanding
    ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/90 border border-slate-100"
    : moodBright
      ? "bg-white/92 text-slate-800 shadow-sm ring-1 ring-slate-200/90 border border-slate-200/70"
      : moodDark
        ? "bg-zinc-950/55 text-zinc-100 ring-1 ring-white/10 border border-white/10"
        : "bg-white/95 text-slate-800 shadow-md ring-1 ring-slate-200/80 border border-white/70";

  const inputSurface =
    isLanding || moodBright
      ? "bg-white text-slate-800 placeholder:text-slate-400 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-700/25"
      : moodDark
        ? "bg-black/25 text-zinc-100 placeholder:text-zinc-500 ring-1 ring-white/12 focus:ring-2 focus:ring-teal-500/20"
        : "bg-white/90 text-slate-800 placeholder:text-slate-500 ring-1 ring-slate-200/80 focus:ring-2 focus:ring-teal-600/25";

  const btnPrimary =
    "rounded-xl bg-teal-800 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-40 sm:py-4 sm:text-base";

  return (
    <div
      className={`min-h-full antialiased px-4 py-10 transition-[background-color,background] duration-700 ease-out ${ink}`}
      style={pageBackground}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-8 sm:gap-10">
        <header className="text-center sm:text-left sm:max-w-none">
          <div className="mb-6 flex flex-col items-center sm:items-start sm:mb-8">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-lg border sm:h-12 sm:w-12 ${
                isLanding || moodBright
                  ? "border-slate-200 bg-white shadow-sm"
                  : "border-zinc-600/80 bg-zinc-900/80 shadow-inner"
              }`}
              aria-hidden
            >
              <span
                className={`font-display text-[15px] font-semibold tracking-tight ${
                  isLanding || moodBright ? "text-slate-800" : "text-zinc-100"
                }`}
              >
                Y·M
              </span>
            </div>
            <p
              className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] ${inkMuted}`}
            >
              {"You&Me"}
            </p>
            <h1 className="font-display mt-1 text-2xl font-medium tracking-tight text-balance sm:text-3xl">
              대화 속 관계 해석
            </h1>
            <p
              className={`mt-3 max-w-xl text-sm leading-relaxed sm:text-[15px] ${
                isLanding || moodBright ? "text-slate-600" : "text-zinc-400"
              }`}
            >
              내보낸 대화로 발화를 나누고, 톤·역동·맥락을 정리합니다. 의료·법적 판단이 아닌
              참고용입니다.
            </p>
          </div>
        </header>

        <section className={`rounded-2xl p-6 backdrop-blur-sm sm:rounded-3xl sm:p-8 ${panelSurface}`}>
          <label
            className={`block text-sm font-medium ${isLanding || moodBright ? "text-slate-800" : "text-zinc-200"}`}
          >
            대화 붙여넣기
          </label>
          <textarea
            value={bulkPaste}
            onChange={(e) => {
              setBulkPaste(e.target.value);
              setLastParsed(null);
              setPickSpeakers(null);
              setParseMessage(null);
              setMyChat("");
              setTheirChat("");
              setSpeakerLabels(null);
              setSituationBrief("");
              setCuriosityNote("");
              setAiPlainSummary(null);
              setAiTogether(null);
              setAiOneLiners(null);
              setAiUnconscious(null);
              setAiClinical(null);
              setAiMoodScore(null);
              setAiTheirDeepRead(null);
              setAiFactAudit(null);
              setAiCuriosityAnswer(null);
              setAiHint(null);
            }}
            placeholder={`카카오톡 등에서 내보낸 대화를 그대로 붙여 넣어 주세요.\n예) 오전 7:32, 표시이름 메시지 한 줄\n예) 2024. 3. 28 오후 4:21, 표시이름 : 메시지`}
            rows={10}
            className={`mt-3 w-full resize-y rounded-xl px-4 py-3 text-sm leading-[1.65] outline-none sm:text-[15px] ${inputSurface}`}
            autoComplete="off"
          />
          <p
            className={`mt-3 text-xs leading-relaxed sm:text-sm ${isLanding || moodBright ? "text-slate-600" : "text-zinc-500"}`}
          >
            모바일·PC 내보내기 형식을 지원합니다. 두 명으로 잡히면 자동 분리하고, 필요하면
            아래에서 본인 발화 쪽을 선택합니다.
          </p>
          {parseMessage && (
            <p
              className={`mt-2 text-xs sm:text-sm ${
                isLanding || moodBright ? "text-amber-800" : "text-amber-200/95"
              }`}
            >
              {parseMessage}
            </p>
          )}
          {pickSpeakers && pickSpeakers.length >= 2 && (
            <div
              className={`mt-4 rounded-2xl p-4 ring-1 ${
                isLanding || moodBright
                  ? "bg-rose-50/90 ring-rose-200/80"
                  : "bg-black/25 ring-white/15"
              }`}
            >
              <p
                className={`text-center text-sm font-medium ${isLanding || moodBright ? "text-slate-800" : "text-white"}`}
              >
                나는 누구인가요?
              </p>
              <p
                className={`mt-2 text-center text-xs leading-relaxed sm:text-sm ${
                  isLanding || moodBright ? "text-slate-600" : "text-white/75"
                }`}
              >
                채팅에서 잡힌 표시 이름:{" "}
                <span className={`font-semibold ${isLanding || moodBright ? "text-slate-900" : "text-white"}`}>
                  {pickSpeakers.map((n, i) => (
                    <span key={`${n}-${i}`}>
                      {i > 0 ? " · " : null}
                      {n.trim() || `발화자 ${i + 1}`}
                    </span>
                  ))}
                </span>
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {pickSpeakers.map((name, i) => {
                  const label = name.trim() || `발화자 ${i + 1}`;
                  return (
                    <button
                      key={`${name}-${i}`}
                      type="button"
                      onClick={() => confirmSpeakerIsMe(name)}
                      className={`w-full rounded-xl border py-3 text-center text-sm font-semibold transition ${
                        isLanding || moodBright
                          ? "border-rose-200/80 bg-white text-rose-800 hover:bg-rose-50"
                          : "border-white/30 bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      <span
                        className={`block text-[11px] font-normal uppercase tracking-wide ${
                          isLanding || moodBright ? "text-rose-600/80" : "text-white/60"
                        }`}
                      >
                        내가 보낸 쪽이 이 이름이면 누르세요
                      </span>
                      <span className="mt-1 block text-base">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={tryParseAndAnalyze}
            className={`mt-6 w-full font-semibold ${btnPrimary}`}
            disabled={bulkPaste.trim().length < 40}
          >
            {bulkPaste.trim().length < 40
              ? "대화를 조금 더 붙여 넣어 주세요 (40자 이상)"
              : "발화자 구분하기"}
          </button>
        </section>

        {myChat.length >= 20 && theirChat.length >= 20 && (
          <>
            <section className={`rounded-2xl p-6 backdrop-blur-sm sm:rounded-3xl sm:p-8 ${panelSurface}`}>
              <p className={`text-sm font-semibold ${isLanding || moodBright ? "text-slate-800" : "text-zinc-200"}`}>
                1. 상황 설명
              </p>
              <p
                className={`mt-1 text-xs leading-relaxed sm:text-sm ${isLanding || moodBright ? "text-slate-600" : "text-zinc-500"}`}
              >
                관계(연인·직장 동료 등), 최근 있었던 일, 이 대화가 나온 배경을 짧게 적어 주세요.
                비워도 됩니다.
              </p>
              <textarea
                value={situationBrief}
                onChange={(e) => setSituationBrief(e.target.value)}
                placeholder={`예: 최근 관계 변화나 갈등 맥락.\n예: 면담·성과 논의 직전에 주고받은 메시지입니다.`}
                rows={4}
                disabled={aiLoading}
                className={`mt-3 w-full resize-y rounded-xl px-4 py-3 text-sm leading-[1.65] outline-none disabled:opacity-60 sm:text-[15px] ${inputSurface}`}
                autoComplete="off"
              />
              <p className={`mt-6 text-sm font-semibold ${isLanding || moodBright ? "text-slate-800" : "text-zinc-200"}`}>
                2. 특히 궁금한 점
              </p>
              <p
                className={`mt-1 text-xs leading-relaxed sm:text-sm ${isLanding || moodBright ? "text-slate-600" : "text-zinc-500"}`}
              >
                이 대화에서 알고 싶은 질문·초점을 적어 주세요. 분석이 그 부분을 더 의식하도록
                반영합니다. 비워도 됩니다.
              </p>
              <textarea
                value={curiosityNote}
                onChange={(e) => setCuriosityNote(e.target.value)}
                placeholder={`예: 상대가 진심으로 이해하려는지, 회피하는지\n예: 내가 말한 ○○에 대한 반응이 궁금합니다`}
                rows={3}
                maxLength={2000}
                disabled={aiLoading}
                className={`mt-3 w-full resize-y rounded-xl px-4 py-3 text-sm leading-[1.65] outline-none disabled:opacity-60 sm:text-[15px] ${inputSurface}`}
                autoComplete="off"
              />
              <p className={`mt-1 text-right text-[11px] ${isLanding || moodBright ? "text-slate-400" : "text-zinc-500"}`}>
                {curiosityNote.length}/2000
              </p>
              <button
                type="button"
                onClick={() => runAiAnalysis(myChat, theirChat)}
                disabled={aiLoading}
                className={`mt-5 w-full font-semibold ${btnPrimary}`}
              >
                {aiLoading
                  ? "분석 중…"
                  : aiTogether
                    ? "이 설명·대화로 다시 분석하기"
                    : "3. 분석하기"}
              </button>
            </section>

            {aiLoading && (
              <div
                className={`rounded-2xl border px-6 py-10 text-center backdrop-blur-sm sm:rounded-3xl ${
                  isLanding || moodBright
                    ? "border-slate-200/80 bg-white/90 text-slate-800 shadow-sm"
                    : moodDark
                      ? "border-white/10 bg-zinc-950/50 text-zinc-100"
                      : "border-zinc-700/50 bg-zinc-900/40 text-zinc-100"
                }`}
              >
                <p className="text-base font-medium sm:text-lg">대화를 분석하고 있습니다</p>
                <p className={`mt-2 text-sm ${isLanding || moodBright ? "text-slate-600" : "text-zinc-500"}`}>
                  모델이 텍스트를 읽고 JSON으로 정리하는 중입니다.
                </p>
                <div className="mx-auto mt-6 max-w-xs">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span
                      className={`font-mono text-3xl font-semibold tabular-nums ${
                        isLanding || moodBright ? "text-teal-800" : "text-teal-300"
                      }`}
                    >
                      {Math.round(loadProgress)}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        isLanding || moodBright ? "text-slate-500" : "text-zinc-500"
                      }`}
                    >
                      %
                    </span>
                  </div>
                  <div
                    className={`mt-3 h-2.5 w-full overflow-hidden rounded-full ${
                      isLanding || moodBright ? "bg-slate-200/90" : "bg-white/10"
                    }`}
                    role="progressbar"
                    aria-valuenow={Math.round(loadProgress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 ease-out ${
                        isLanding || moodBright ? "bg-teal-700" : "bg-teal-500"
                      }`}
                      style={{ width: `${Math.min(100, loadProgress)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {!aiLoading && !aiTogether && aiHint && (
              <div
                className={`rounded-2xl border px-6 py-6 text-center ring-1 sm:rounded-3xl ${
                  isLanding
                    ? "border-amber-200/90 bg-amber-50 ring-amber-100"
                    : "border-amber-500/25 bg-amber-950/30 ring-amber-500/15"
                }`}
              >
                <p
                  className={`text-sm leading-relaxed ${isLanding ? "text-amber-950" : "text-amber-50/95"}`}
                >
                  {aiHint}
                </p>
                <button
                  type="button"
                  onClick={() => runAiAnalysis(myChat, theirChat)}
                  className="mt-4 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
                >
                  다시 시도
                </button>
              </div>
            )}

            {!aiLoading && aiTogether && (
              <>
                <StoryReveal show={storyBeat >= 1}>
                  <div
                    className={`rounded-2xl border px-4 py-3.5 text-sm shadow-sm ring-1 sm:px-5 ${
                      moodBright
                        ? "border-teal-200/80 bg-teal-50/95 text-teal-950 ring-teal-100/80"
                        : moodDark
                          ? "border-teal-500/25 bg-teal-950/40 text-teal-50 ring-teal-500/15"
                          : "border-teal-400/35 bg-teal-900/30 text-teal-50 ring-teal-500/20"
                    }`}
                  >
                    <p className="font-medium">한 장씩 펼쳐 볼게요</p>
                    <p
                      className={`mt-1 text-xs leading-relaxed ${
                        moodBright ? "text-teal-800/95" : "text-teal-100/85"
                      }`}
                    >
                      톤 점수 → 요약 → 궁금했던 점 → 본문 → 한 줄·심층 순입니다. 탭에서 나만·상대만
                      골라 볼 수 있어요.
                    </p>
                  </div>
                </StoryReveal>

                {moodForUi != null && (
                  <StoryReveal show={storyBeat >= 2}>
                    <div
                      className={`rounded-2xl border px-4 py-3 sm:px-5 ${
                        moodBright
                          ? "border-slate-200/90 bg-white/85 text-slate-800 shadow-sm"
                          : moodDark
                            ? "border-white/12 bg-zinc-950/50 text-zinc-100"
                            : "border-zinc-700/45 bg-zinc-900/35 text-zinc-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs font-medium sm:text-sm">
                        <span>관계 톤 점수</span>
                        <span
                          className={`font-mono text-base tabular-nums sm:text-lg ${
                            moodBright ? "text-rose-600" : "text-rose-300"
                          }`}
                        >
                          {moodForUi}
                          <span className="text-[10px] font-sans opacity-70">/100</span>
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-[11px] leading-snug sm:text-xs ${
                          moodBright ? "text-slate-500" : "text-white/65"
                        }`}
                      >
                        낮을수록 긴장·충돌에 가깝고, 높을수록 완화·유연에 가깝게 해석했습니다.
                      </p>
                      <div className={`mt-2 ${moodBright ? "text-rose-500" : "text-rose-300"}`}>
                        <ScoreBar value={moodForUi} />
                      </div>
                    </div>
                  </StoryReveal>
                )}

                <StoryReveal show={storyBeat >= 3}>
                  <div
                    className={`flex rounded-xl p-1 ring-1 ${
                      moodBright
                        ? "bg-slate-200/70 ring-slate-200/80"
                        : moodDark
                          ? "bg-black/30 ring-white/10"
                          : "bg-zinc-800/50 ring-zinc-700/50"
                    }`}
                  >
                  {(
                    [
                      ["together", "전체 보기", null] as const,
                      ["me", "나", speakerLabels?.me ?? null] as const,
                      ["them", "상대", speakerLabels?.them ?? null] as const,
                    ] as const
                  ).map(([key, short, nick]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setChatView(key)}
                      title={nick ? `${short} (${nick})` : short}
                      className={`min-w-0 flex-1 rounded-lg px-1 py-2.5 text-sm font-medium transition ${
                        chatView === key
                          ? moodBright
                            ? "bg-white text-teal-900 shadow-sm"
                            : "bg-white text-teal-950 shadow-sm"
                          : moodBright
                            ? "text-slate-600"
                            : "text-zinc-400"
                      }`}
                    >
                      <span className="block truncate">
                        {nick ? `${short} (${nick})` : short}
                      </span>
                    </button>
                  ))}
                </div>
                </StoryReveal>

                {chatView === "together" && (
                  <section className="flex flex-col gap-5 sm:gap-6">
                    {aiPlainSummary ? (
                      <StoryReveal show={storyBeat >= 4}>
                        <div className="rounded-3xl bg-white p-6 text-zinc-800 shadow-xl ring-1 ring-emerald-500/20">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            한눈에 보기
                          </p>
                          <p className="mt-3 text-base leading-relaxed text-zinc-700 whitespace-pre-line">
                            {aiPlainSummary}
                          </p>
                        </div>
                      </StoryReveal>
                    ) : null}

                    {(aiCuriosityAnswer || curiosityNote.trim()) && (
                      <StoryReveal show={storyBeat >= 5}>
                        <div className="rounded-3xl border border-indigo-200/90 bg-white p-6 text-slate-800 shadow-xl ring-1 ring-indigo-100/80 sm:p-7">
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
                            궁금했던 점에 답하기
                          </p>
                          {curiosityNote.trim() ? (
                            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/80">
                              <p className="text-[11px] font-medium text-slate-500">적어 주신 질문</p>
                              <p className="mt-1.5 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                                {curiosityNote.trim()}
                              </p>
                            </div>
                          ) : null}
                          {aiCuriosityAnswer ? (
                            <div className={curiosityNote.trim() ? "mt-5" : "mt-3"}>
                              <p className="text-[11px] font-semibold text-indigo-700">해석</p>
                              <p className="mt-2 text-[15px] leading-[1.75] text-slate-800 whitespace-pre-line">
                                {aiCuriosityAnswer}
                              </p>
                            </div>
                          ) : curiosityNote.trim() ? (
                            <p className="mt-4 text-sm text-slate-600">
                              직접 답변 필드가 비었습니다. 아래 본문·심층 블록을 함께 참고해 주세요.
                            </p>
                          ) : null}
                        </div>
                      </StoryReveal>
                    )}

                    <StoryReveal show={storyBeat >= 6}>
                    <div className="rounded-3xl border border-slate-200/90 bg-white p-6 text-slate-800 shadow-xl ring-1 ring-slate-200/70 sm:p-7">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        관계·대화 흐름 (상세)
                      </p>
                      <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-900">
                        {aiTogether.headline}
                      </h2>
                      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
                        {aiTogether.paragraphs.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    </div>
                    </StoryReveal>

                    {(aiOneLiners?.mine || aiOneLiners?.theirs) && (
                      <StoryReveal show={storyBeat >= 7}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {aiOneLiners?.mine ? (
                          <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 text-slate-800 shadow-md ring-1 ring-slate-100/90">
                            <p className="text-xs font-medium text-slate-500">
                              나{speakerLabels?.me ? ` · ${speakerLabels.me}` : ""}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-800">{aiOneLiners.mine}</p>
                          </div>
                        ) : null}
                        {aiOneLiners?.theirs ? (
                          <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 text-slate-800 shadow-md ring-1 ring-slate-100/90">
                            <p className="text-xs font-medium text-slate-500">
                              상대{speakerLabels?.them ? ` · ${speakerLabels.them}` : ""}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-800">
                              {aiOneLiners.theirs}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      </StoryReveal>
                    )}

                    {aiTheirDeepRead &&
                    (aiTheirDeepRead.estimatedRealThought ||
                      aiTheirDeepRead.estimatedUnconscious) ? (
                      <StoryReveal show={storyBeat >= 8}>
                      <div className="rounded-3xl border border-amber-200/90 bg-amber-50 p-6 text-amber-950 shadow-lg ring-1 ring-amber-100/90 sm:p-7">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/90">
                          상대 심층 추정
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-900/75">
                          겉말·태도 뒤의 진짜 생각·무의식을 대화에 맞춰 추정한 것입니다. 사실이 아닙니다.
                        </p>
                        {aiTheirDeepRead.estimatedRealThought ? (
                          <div className="mt-4 rounded-2xl border border-amber-200/80 bg-white px-4 py-3">
                            <p className="text-xs font-semibold text-amber-900/90">
                              추정되는 실제 생각·의도
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                              {aiTheirDeepRead.estimatedRealThought}
                            </p>
                          </div>
                        ) : null}
                        {aiTheirDeepRead.estimatedUnconscious ? (
                          <div className="mt-4 rounded-2xl border border-amber-200/80 bg-white px-4 py-3">
                            <p className="text-xs font-semibold text-amber-900/90">무의식 층 추정</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                              {aiTheirDeepRead.estimatedUnconscious}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      </StoryReveal>
                    ) : null}

                    {aiClinical &&
                    (aiClinical.impression ||
                      (aiClinical.hypotheses && aiClinical.hypotheses.length > 0) ||
                      aiClinical.defense ||
                      aiClinical.impressionConfidence != null) ? (
                      <StoryReveal show={storyBeat >= 9}>
                      <div className="rounded-3xl border border-rose-200/90 bg-rose-50 p-6 text-rose-950 shadow-lg ring-1 ring-rose-100/80 sm:p-7">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-900/90">
                          전문가 관점 (확신도 있는 가설만)
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-rose-900/75">
                          확신도가 낮은 가설은 제외했습니다. 진단·채용·법적 판단에 쓸 수 없습니다.
                        </p>
                        {aiClinical.impression ? (
                          <div className="mt-4 rounded-2xl border border-rose-200/80 bg-white px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-rose-900/90">임상가 인상</p>
                              {aiClinical.impressionConfidence != null ? (
                                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-mono text-[11px] text-rose-900">
                                  {aiClinical.impressionConfidence}%
                                </span>
                              ) : null}
                            </div>
                            {aiClinical.impressionConfidence != null ? (
                              <div className="mt-2 text-rose-700">
                                <ScoreBar value={aiClinical.impressionConfidence} />
                              </div>
                            ) : null}
                            <p className="mt-3 text-sm leading-[1.7] text-slate-800">
                              {aiClinical.impression}
                            </p>
                          </div>
                        ) : null}
                        {aiClinical.hypotheses && aiClinical.hypotheses.length > 0 ? (
                          <div className="mt-5 space-y-3">
                            <p className="text-xs font-semibold text-rose-900/90">가설 (점수 순)</p>
                            {aiClinical.hypotheses.map((h, i) => (
                              <div
                                key={i}
                                className="rounded-2xl border border-rose-200/80 bg-white px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px] text-rose-800/90">
                                  <span>모델 확신도</span>
                                  <span className="font-mono font-semibold tabular-nums text-rose-900">
                                    {h.confidence}%
                                  </span>
                                </div>
                                <div className="mt-1.5 text-rose-600">
                                  <ScoreBar value={h.confidence} />
                                </div>
                                <p className="mt-3 text-sm leading-[1.7] text-slate-800">{h.claim}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {aiClinical.defense ? (
                          <div className="mt-4">
                            <p className="text-xs font-semibold text-rose-900/90">
                              방어기제 · 전이
                            </p>
                            <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-800">
                              {aiClinical.defense
                                .split(/\n\n+/)
                                .filter((p) => p.trim())
                                .map((p, i) => (
                                  <p key={i}>{p.trim()}</p>
                                ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      </StoryReveal>
                    ) : null}

                    {aiUnconscious ? (
                      <StoryReveal show={storyBeat >= 10}>
                      <div className="rounded-3xl border border-violet-200/90 bg-violet-50 p-6 text-violet-950 shadow-lg ring-1 ring-violet-100/80">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-900/90">
                          무의식·역동 (나 / 상대 / 둘 사이)
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-violet-900/75">
                          말 뒤에 숨은 동기를 분석한 것입니다. 검사·진단이 아닙니다.
                        </p>
                        {aiUnconscious.mine ? (
                          <div className="mt-4 rounded-xl border border-violet-200/80 bg-white px-4 py-3">
                            <p className="text-xs font-semibold text-violet-900">나</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-800">
                              {aiUnconscious.mine}
                            </p>
                          </div>
                        ) : null}
                        {aiUnconscious.theirs ? (
                          <div className="mt-4 rounded-xl border border-violet-200/80 bg-white px-4 py-3">
                            <p className="text-xs font-semibold text-violet-900">상대</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-800">
                              {aiUnconscious.theirs}
                            </p>
                          </div>
                        ) : null}
                        {aiUnconscious.relation ? (
                          <div className="mt-4 rounded-xl border border-violet-200/80 bg-white px-4 py-3">
                            <p className="text-xs font-semibold text-violet-900">둘 사이</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-800">
                              {aiUnconscious.relation}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      </StoryReveal>
                    ) : null}

                    {aiFactAudit &&
                    (aiFactAudit.whatIsWrong.length > 0 ||
                      aiFactAudit.whatMustFix.length > 0) ? (
                      <StoryReveal show={storyBeat >= 11}>
                      <div className="rounded-3xl border border-slate-200/90 bg-slate-100 p-6 text-slate-900 shadow-lg ring-1 ring-slate-200/80">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                          팩트 점검 (잘못된 점 · 고쳐야 할 것)
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                          맥락을 이해한 뒤 논리적으로 짚은 것입니다. 위로·책임 누르기 없이 씁니다.
                        </p>
                        {aiFactAudit.whatIsWrong.length > 0 ? (
                          <div className="mt-4">
                            <p className="text-xs font-semibold text-slate-800">문제·틀어진 점</p>
                            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
                              {aiFactAudit.whatIsWrong.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {aiFactAudit.whatMustFix.length > 0 ? (
                          <div className="mt-5">
                            <p className="text-xs font-semibold text-slate-800">고쳐야 할 것</p>
                            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
                              {aiFactAudit.whatMustFix.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      </StoryReveal>
                    ) : null}

                    <StoryReveal show={storyBeat >= 12}>
                      <button
                        type="button"
                        onClick={() => runAiAnalysis(myChat, theirChat)}
                        disabled={aiLoading}
                        className={`w-full rounded-xl border py-3 text-sm font-medium transition disabled:opacity-50 ${
                          moodBright
                            ? "border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
                            : "border-zinc-600 bg-zinc-900/35 text-zinc-200 hover:bg-zinc-800/50"
                        }`}
                      >
                        {aiLoading ? "다시 분석 중…" : "이 대화로 다시 분석하기"}
                      </button>
                      <p className="text-center text-[10px] leading-relaxed text-zinc-500 sm:text-[11px]">
                        해석 규칙은 배포 환경에 맞게 조정할 수 있습니다.
                      </p>
                    </StoryReveal>
                  </section>
                )}

                {chatView === "me" && (
                  <StoryReveal show={storyBeat >= 6}>
                    <section className="flex flex-col gap-4">
                      <div className="rounded-3xl bg-white p-6 text-zinc-800 shadow-xl ring-1 ring-black/5">
                        <p className="text-xs font-semibold text-emerald-700">
                          나{speakerLabels?.me ? ` (${speakerLabels.me})` : ""}
                        </p>
                        <p className="mt-3 text-base leading-relaxed text-zinc-700">
                          {aiOneLiners?.mine ?? "—"}
                        </p>
                      </div>
                      {aiUnconscious?.mine ? (
                        <div className="rounded-3xl border border-violet-400/35 bg-violet-950/25 p-6 ring-1 ring-violet-400/20">
                          <p className="text-xs font-semibold text-violet-200">무의식·역동 (나)</p>
                          <p className="mt-2 text-sm leading-relaxed text-white/90">
                            {aiUnconscious.mine}
                          </p>
                        </div>
                      ) : null}
                    </section>
                  </StoryReveal>
                )}

                {chatView === "them" && (
                  <StoryReveal show={storyBeat >= 6}>
                  <section className="flex flex-col gap-4">
                    <div className="rounded-3xl bg-white p-6 text-zinc-800 shadow-xl ring-1 ring-black/5">
                      <p className="text-xs font-semibold text-emerald-700">
                        상대{speakerLabels?.them ? ` (${speakerLabels.them})` : ""}
                      </p>
                      <p className="mt-3 text-base leading-relaxed text-zinc-700">
                        {aiOneLiners?.theirs ?? "—"}
                      </p>
                    </div>
                    {aiUnconscious?.theirs ? (
                      <div className="rounded-3xl border border-violet-400/35 bg-violet-950/25 p-6 ring-1 ring-violet-400/20">
                        <p className="text-xs font-semibold text-violet-200">무의식·역동 (상대)</p>
                        <p className="mt-2 text-sm leading-relaxed text-white/90">
                          {aiUnconscious.theirs}
                        </p>
                      </div>
                    ) : null}
                    {aiTheirDeepRead?.estimatedRealThought ||
                    aiTheirDeepRead?.estimatedUnconscious ? (
                      <div className="rounded-3xl border border-amber-400/35 bg-amber-950/25 p-6 ring-1 ring-amber-400/20">
                        <p className="text-xs font-semibold text-amber-200/95">심층 추정 (상대)</p>
                        {aiTheirDeepRead.estimatedRealThought ? (
                          <p className="mt-3 text-sm leading-relaxed text-white/90 whitespace-pre-line">
                            {aiTheirDeepRead.estimatedRealThought}
                          </p>
                        ) : null}
                        {aiTheirDeepRead.estimatedUnconscious ? (
                          <p className="mt-3 text-sm leading-relaxed text-white/85 whitespace-pre-line">
                            {aiTheirDeepRead.estimatedUnconscious}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                  </StoryReveal>
                )}
              </>
            )}
          </>
        )}

        <footer
          className={`flex flex-col items-center gap-3 pb-4 text-center text-[11px] leading-relaxed sm:text-xs ${
            isLanding || moodBright ? "text-slate-500" : "text-white/65"
          }`}
        >
          <p className="max-w-md">
            본 서비스는 붙여 넣은 텍스트만 처리합니다. 발화자 구분은 형식에 따라 달라질 수
            있으며, 결과는 참고용이며 의료·법적 효력이 없습니다.
          </p>
          {siteLocked && (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/site-logout", {
                  method: "POST",
                  credentials: "include",
                });
                window.location.href = "/login";
              }}
              className={
                isLanding || moodBright
                  ? "text-slate-400 underline decoration-slate-300 hover:text-slate-700"
                  : "text-white/50 underline decoration-white/30 hover:text-white/80"
              }
            >
              잠금 화면으로 나가기
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
