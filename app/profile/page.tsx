"use client";

import { Complaints } from "@/components/complaints";
import Link from "next/link";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageHeading } from "@/components/ui";

export default function ProfilePage() {
  const { data } = useFinance();
  const { t } = useI18n();
  const sections = [
    { href: "/accounts", label: t("accounts"), count: data.accounts.length },
    { href: "/transactions", label: t("transactionsShort"), count: data.transactions.length },
    { href: "/goals", label: t("goals"), count: data.goals.length },
  ];

  return (
    <div className="space-y-7">
      <PageHeading title={t("myProfile")} />
      {data.initialized && data.user ? (
        <>
        <section className="panel space-y-5">
          <div>
            <p className="text-muted text-sm">{t("authUsername")}</p>
            <h2>{data.user.username}</h2>
          </div>
          <dl className="space-y-3">
            {sections.map(({ href, label, count }) => (
              <div className="flex items-center justify-between gap-3" key={href}>
                <dt><Link className="text-link" href={href}>{label}</Link></dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </section>
        <Complaints key={data.user.id}/>
        </>
      ) : <p className="panel loading-panel" role="status">{t("loading")}</p>}
    </div>
  );
}
