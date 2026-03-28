import { NextResponse } from "next/server";
import { isPasswordProtectionEnabled } from "@/lib/site-auth";

export function GET() {
  return NextResponse.json({ locked: isPasswordProtectionEnabled() });
}
