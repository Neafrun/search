import type { Metadata } from "next";
import { SiteLegalShell } from "@/components/site-legal-shell";

export const metadata: Metadata = {
  title: "이용안내 — You&Me",
  description: "You&Me 대화 속 관계 해석 서비스의 이용 안내 및 면책입니다.",
};

export default function TermsPage() {
  return (
    <SiteLegalShell title="이용안내">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">서비스 성격</h2>
          <p>
            본 서비스는 붙여 넣은 대화를 바탕으로 톤·역동·맥락을 정리한 <strong className="text-slate-800">참고용</strong>{" "}
            결과를 제공합니다. 발화자 구분은 내보내기 형식에 따라 달라질 수 있습니다.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">면책</h2>
          <p>
            결과는 <strong className="text-slate-800">의료·심리 상담·법률 자문을 대체하지 않습니다.</strong>{" "}
            중요한 결정은 전문가와 상담하시기 바랍니다. AI·파싱 오류로 인한 손해에 대해
            운영자는 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">이용 금지</h2>
          <p>
            타인의 대화를 동의 없이 무단으로 유포하거나, 불법·타인의 권리를 침해하는
            목적으로 서비스를 사용해서는 안 됩니다.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">운영 변경</h2>
          <p>
            서비스는 예고 없이 중단·변경될 수 있습니다. API 한도·장애 등으로 분석이
            되지 않을 수 있습니다.
          </p>
        </section>
      </div>
    </SiteLegalShell>
  );
}
