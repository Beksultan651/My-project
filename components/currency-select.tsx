"use client";

import { useState } from "react";
import { currencies } from "@/lib/finance-storage";
import type { Account, Currency } from "@/types/finance";
import { useI18n } from "./i18n-provider";

export function useReportingCurrency(accounts: Account[]) {
  const [preferred, setCurrency] = useState<Currency>("KZT");
  const available = currencies.filter((currency) => accounts.some((account) => account.currency === currency));
  const currency = available.find((item) => item === preferred) ?? available[0] ?? "KZT";
  return { currency, available, setCurrency };
}

export function CurrencySelect({ currency, available, setCurrency }: ReturnType<typeof useReportingCurrency>) {
  const { t } = useI18n();
  if (available.length < 2) return null;
  return (
    <select className="language-select" aria-label={t("currencyTotals")} value={currency}
      onChange={(event) => {
        const selected = available.find((item) => item === event.target.value);
        if (selected) setCurrency(selected);
      }}>
      {available.map((item) => <option key={item}>{item}</option>)}
    </select>
  );
}
