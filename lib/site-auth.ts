const COOKIE_NAME = "site_private";
const TOKEN_MSG = "private-v1";

const enc = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufToHex(sig);
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

/** AUTH_SECRET이 빈 문자열이면 ?? 로는 SITE_PASSWORD로 넘어가지 않아 쿠키 서명이 깨집니다. */
function signingSecret(): string {
  const auth = process.env.AUTH_SECRET?.trim();
  if (auth) return auth;
  return process.env.SITE_PASSWORD?.trim() ?? "";
}

export async function makeSessionToken(): Promise<string> {
  const s = signingSecret();
  if (!s) return "";
  return hmacSha256Hex(s, TOKEN_MSG);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await makeSessionToken();
  if (!expected || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function isPasswordProtectionEnabled(): boolean {
  return Boolean(process.env.SITE_PASSWORD?.trim());
}
