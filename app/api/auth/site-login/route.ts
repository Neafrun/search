import { NextResponse } from "next/server";
import { getCookieName, isPasswordProtectionEnabled, makeSessionToken } from "@/lib/site-auth";

export const runtime = "nodejs";

/** 프로덕션에서 HTTP로 접속하면 Secure 쿠키는 브라우저가 저장하지 않습니다. 요청 스킴을 본 뒤 설정합니다. */
function shouldUseSecureCookie(req: Request): boolean {
  if (process.env.COOKIE_SECURE === "1") return true;
  if (process.env.COOKIE_SECURE === "0") return false;
  if (process.env.NODE_ENV !== "production") return false;
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0].trim() === "https";
  }
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!isPasswordProtectionEnabled()) {
    return NextResponse.json(
      { error: "SITE_PASSWORD가 설정되지 않아 잠금을 사용하지 않습니다." },
      { status: 400 }
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const pw = typeof body.password === "string" ? body.password : "";
  const expected = (process.env.SITE_PASSWORD ?? "").trim();
  const pwTrimmed = pw.trim();
  if (!pwTrimmed || pwTrimmed !== expected) {
    return NextResponse.json({ error: "암호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = await makeSessionToken();
  if (!token) {
    return NextResponse.json({ error: "서버 설정 오류(AUTH_SECRET 또는 SITE_PASSWORD)" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    secure: shouldUseSecureCookie(req),
  });
  return res;
}
