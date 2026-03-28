"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] px-4 py-16 text-white">
      <div className="w-full max-w-sm rounded-3xl bg-white/15 p-8 shadow-2xl ring-1 ring-white/30 backdrop-blur-md">
        <h1 className="text-center text-xl font-bold">비공개 접속</h1>
        <p className="mt-2 text-center text-sm text-white/80">
          이 사이트는 설정된 암호가 있을 때만 열립니다.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="암호"
            className="rounded-2xl border border-white/30 bg-black/20 px-4 py-3 text-white placeholder:text-white/40 outline-none ring-white/40 focus:ring-2"
            autoComplete="current-password"
          />
          {error && (
            <p className="text-center text-sm text-amber-100">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="rounded-2xl bg-white py-3 text-sm font-semibold text-[#bc1888] shadow-lg transition hover:bg-white/95 disabled:opacity-50"
          >
            {loading ? "확인 중…" : "들어가기"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-[#f09433] to-[#bc1888] text-white">
          로딩 중…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
