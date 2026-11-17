"use client";

import type { Account, Category } from "@/types/finance";
import { defaultAccountId, defaultAccountName, defaultCategories } from "@/lib/finance-storage";
import { useFinance } from "./finance-provider";
import { useI18n } from "./i18n-provider";

const originalCategoryNames = new Map(defaultCategories.map(({ id, name }) => [id, name]));

export function useFinanceLabels() {
  const { data } = useFinance();
  const { t, categoryName: translateCategory } = useI18n();
  const accounts = new Map(data.accounts.map((item) => [item.id, item]));
  const categories = new Map(data.categories.map((item) => [item.id, item]));

  function accountLabel(account: Account) {
    return account.id === defaultAccountId && account.name === defaultAccountName ? t("defaultAccount") : account.name;
  }

  function categoryLabel(category: Category) {
    return originalCategoryNames.get(category.id) === category.name ? translateCategory(category.name) : category.name;
  }

  function accountName(id: string) {
    const account = accounts.get(id);
    return account ? accountLabel(account) : "—";
  }

  function categoryName(id: string) {
    const category = categories.get(id);
    return category ? categoryLabel(category) : "—";
  }

  return {
    accountLabel,
    categoryLabel,
    accountName,
    categoryName,
    accountCurrency: (id: string) => accounts.get(id)?.currency ?? "KZT",
  };
}
