"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const panelSurface =
  "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/90 border border-slate-100";
const inputSurface =
  "bg-white text-slate-800 placeholder:text-slate-400 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-700/25";
const btnPrimary =
  "rounded-xl bg-teal-800 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-40 sm:py-4 sm:text-base";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((r) => r.json() as Promise<{ locked?: boolean }>)
      .then((d) => {
        if (d.locked === false) router.replace("/");
      });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/site-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "로그인 실패");
        return;
      }
      router.replace(from.startsWith("/login") ? "/" : from);
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-full text-slate-900 antialiased transition-[background-color] duration-700 ease-out"
      style={{ backgroundColor: "#ffffff", minHeight: "100%" }}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:py-12">
        <header className="text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            You&Me
          </p>
          <h1 className="font-display mt-2 text-2xl font-medium tracking-tight text-balance sm:text-3xl">
            비공개 접속
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            이 사이트는 관리자가 설정한 암호가 있을 때만 열립니다. 암호를 입력한 뒤 서비스를
            이용할 수 있습니다.
          </p>
        </header>

        <section className={`rounded-2xl p-6 backdrop-blur-sm sm:rounded-3xl sm:p-8 ${panelSurface}`}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label
              htmlFor="site-password"
              className="block text-sm font-medium text-slate-800"
            >
              암호
            </label>
            <input
              id="site-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="암호를 입력하세요"
              className={`w-full rounded-xl px-4 py-3 text-sm outline-none sm:text-[15px] ${inputSurface}`}
              autoComplete="current-password"
            />
            {error && (
              <p className="text-center text-sm text-rose-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className={`w-full ${btnPrimary}`}
            >
              {loading ? "확인 중…" : "들어가기"}
            </button>
          </form>
        </section>

        <footer className="flex flex-col items-center gap-4 pb-4 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link
              href="/privacy"
              className="underline decoration-slate-300 hover:text-slate-800"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/terms"
              className="underline decoration-slate-300 hover:text-slate-800"
            >
              이용안내
            </Link>
          </div>
          <p className="max-w-md">
            붙여 넣는 대화는 참고용 분석에만 쓰이며, 의료·법적 판단이 아닙니다.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-full flex-col items-center justify-center text-slate-500"
          style={{ backgroundColor: "#ffffff", minHeight: "100%" }}
        >
          로딩 중…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
