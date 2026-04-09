import type { Metadata } from "next";
import { SiteLegalShell } from "@/components/site-legal-shell";

export const metadata: Metadata = {
  title: "개인정보처리방침 — You&Me",
  description: "You&Me 대화 속 관계 해석 서비스의 개인정보 처리 방침입니다.",
};

export default function PrivacyPage() {
  return (
    <SiteLegalShell title="개인정보처리방침">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">1. 목적</h2>
          <p>
            You&Me(이하 ‘서비스’)는 이용자가 붙여 넣은 대화 텍스트를 분석해 관계 맥락을
            정리하는 도구입니다. 본 방침은 개인정보 보호법 등에 따라 처리하는 정보를
            안내합니다.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">
            2. 수집·이용하는 정보
          </h2>
          <ul className="list-inside list-disc space-y-1 text-slate-700">
            <li>
              <strong className="text-slate-800">입력 정보:</strong> 이용자가 입력한 대화
              문구, 상황 설명, 궁금한 점 등 분석에 필요한 텍스트.
            </li>
            <li>
              <strong className="text-slate-800">기술 정보:</strong> 서비스 운영·보안을 위해
              서버 로그(접속 시각, 오류 등)가 생성될 수 있습니다.
            </li>
            <li>
              <strong className="text-slate-800">접속 잠금(선택):</strong> 사이트 비밀번호
              잠금을 켠 경우, 세션 유지를 위한 쿠키(HTTP-only)가 사용될 수 있습니다.
            </li>
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">
            3. 처리 목적 및 위탁
          </h2>
          <p>
            입력 텍스트는 <strong className="text-slate-800">관계 분석 결과 생성</strong>을
            위해 처리됩니다. 분석에는 Google Gemini 등 외부 AI API가 연결될 수 있으며, 이
            경우 해당 구간의 텍스트가 API 제공자의 정책에 따라 처리됩니다.
          </p>
          <p className="text-slate-600">
            운영자는 서비스 설정에 따라 저장·보관 기간을 달리할 수 있습니다. 장기 보관이
            필요 없다면 붙여 넣기 전에 민감한 내용을 가리는 것을 권장합니다.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">
            4. 이용자의 권리
          </h2>
          <p>
            개인정보 열람·정정·삭제 요청은 운영자가 정한 연락 방법으로 가능합니다. 다만
            서비스에 회원가입이 없는 형태라면, 서버에 남지 않은 정보는 요청 대상이
            아닐 수 있습니다.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">
            5. 방침 변경
          </h2>
          <p>
            법령·서비스 변경에 따라 본 방침을 수정할 수 있으며, 중요한 변경 시 서비스 내
            공지 등 합리적인 방법으로 안내합니다.
          </p>
        </section>
        <p className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
          본 문서는 일반적인 안내 예시입니다. 실제 운영 주체·서버 위치·보관 정책에 맞게
          법무 검토를 권장합니다.
        </p>
      </div>
    </SiteLegalShell>
  );
}
