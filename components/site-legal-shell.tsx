import Link from "next/link";
import type { ReactNode } from "react";

/** 메인 랜딩과 동일한 톤의 법률·안내 페이지 래퍼 */
export function SiteLegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-full text-slate-900 antialiased"
      style={{ backgroundColor: "#ffffff", minHeight: "100%" }}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          You&Me
        </p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl font-medium tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-teal-800 underline decoration-teal-800/30 underline-offset-4 hover:text-teal-700"
          >
            ← 서비스로
          </Link>
        </div>
        <article
          className={`mt-8 rounded-2xl border border-slate-100 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-200/90 sm:rounded-3xl sm:p-8 sm:text-[15px] sm:leading-relaxed`}
        >
          {children}
        </article>
        <footer className="mt-8 text-center text-[11px] text-slate-500 sm:text-xs">
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
        </footer>
      </div>
    </div>
  );
}
