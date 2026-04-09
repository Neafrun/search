import type { MetadataRoute } from "next";

/** 기본: 검색 엔진 색인 비활성(민감한 성격의 서비스). 공개 색인이 필요하면 .env에 NEXT_PUBLIC_ALLOW_INDEXING=1 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING === "1") {
    return { rules: { userAgent: "*", allow: "/", disallow: ["/api/"] } };
  }
  return { rules: { userAgent: "*", disallow: "/" } };
}
