"use client";

import { useState, type FormEvent } from "react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { useFinanceLabels } from "@/components/finance-labels";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { EmptyState, Modal, PageHeading } from "@/components/ui";
import type { Transaction } from "@/types/finance";
import { createRecordId } from "@/lib/record-id";
import type { MessageKey } from "@/lib/i18n";
import type { Category } from "@/types/finance";

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { data, save, notify } = useFinance();
  const { t } = useI18n();
  const { categoryLabel } = useFinanceLabels();
  const originalLabel = category ? categoryLabel(category) : "";
  const [label, setLabel] = useState(originalLabel);
  const [type, setType] = useState<Category["type"]>(category?.type ?? "expense");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const linked = category && data.transactions.some((entry) => entry.categoryId === category.id);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) return setError("nameRequired");
    const name = category && label.trim() === originalLabel ? category.name : label.trim();
    const next: Category = { id: category?.id ?? createRecordId(), name, type };
    setPending(true);
    const failure = await save({ collection: "categories", previous: category ?? undefined, next });
    setPending(false);
    if (failure) return setError(failure);
    onClose();
    notify(t("categorySaved"));
  }

  return (
    <Modal open onClose={onClose} title={t(category ? "editCategory" : "addCategory")}>
      <form className="form-stack" onSubmit={submit}>
        <label>{t("categoryName")}
          <input required maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)}/>
        </label>
        <label>{t("transactionType")}
          <select value={type} disabled={!!linked} onChange={(event) => {
            if (event.target.value === "income" || event.target.value === "expense") setType(event.target.value);
          }}>
            <option value="income">{t("income")}</option>
            <option value="expense">{t("expense")}</option>
          </select>
        </label>
        {linked && <p className="contribution-note">{t("categoryInUse")}</p>}
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" disabled={pending} className="button button-primary">
            <Icon name="check" size={17}/>{t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const { data } = useFinance();
  const { t, money } = useI18n();
  const { categoryLabel, accountCurrency } = useFinanceLabels();
  const [editor, setEditor] = useState<{ category: Category | null } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const history = new Map<string, Transaction[]>();
  for (const entry of [...data.transactions].sort((a, b) => b.date.localeCompare(a.date))) {
    const entries = history.get(entry.categoryId);
    if (entries) entries.push(entry);
    else history.set(entry.categoryId, [entry]);
  }

  return (
    <div className="space-y-7">
      <PageHeading title={t("categories")} description={t("categoriesSubtitle")}>
        <button className="button button-primary" disabled={!data.initialized} onClick={() => setEditor({ category: null })}>
          <Icon name="plus" size={18}/>{t("addCategory")}
        </button>
      </PageHeading>
      {!data.initialized ? <p className="panel loading-panel" role="status">{t("loading")}</p> : (
        <div className="dashboard-bottom-grid">
          {(["income", "expense"] as const).map((type) => {
            const categories = data.categories.filter((category) => category.type === type);
            return (
              <section key={type} className="panel">
                <div className="section-heading"><h2>{t(type === "income" ? "incomes" : "expenses")}</h2></div>
                {!categories.length && <EmptyState icon="exchange" title={t("noCategories")} description={t("noCategoriesBody")}/>}
                {categories.map((category) => {
                  const name = categoryLabel(category);
                  const entries = history.get(category.id) ?? [];
                  return (
                    <div className="transaction-row" key={category.id}>
                      <span className={`transaction-icon ${type === "income" ? "mint" : "peach"}`}>
                        <Icon name={type === "income" ? "down" : "up"} size={17}/>
                      </span>
                      <div className="transaction-info">
                        <strong>{name}</strong>
                        {entries.length ? (
                          <details>
                            <summary className="text-link cursor-pointer">{t("operationCount", { count: entries.length })} ▾</summary>
                            <ul className="space-y-2 py-2">
                              {entries.map(entry => (
                                <li key={entry.id} className="text-sm">
                                  <time dateTime={entry.date}>{entry.date}</time> · {entry.description} · {money(entry.amount, accountCurrency(entry.accountId))}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : <span>{t("operationCount", { count: 0 })}</span>}
                      </div>
                      <div className="transaction-row-actions">
                        <button className="icon-button" aria-label={t("namedAction", { action: t("editCategory"), name })}
                          onClick={() => setEditor({ category })}><Icon name="edit" size={17}/></button>
                        <button className="icon-button danger-button"
                          aria-label={t("namedAction", { action: t("deleteCategory"), name })}
                          onClick={() => setDeleting(category)}><Icon name="trash" size={17}/></button>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
      {editor && <CategoryForm category={editor.category} onClose={() => setEditor(null)}/>}
      {deleting && <DeleteRecordDialog action={{ collection: "categories", previous: deleting, next: null }}
        title="deleteCategory" done="categoryDeleted" onClose={() => setDeleting(null)}>
        {t("deleteNamed", { name: categoryLabel(deleting) })}
      </DeleteRecordDialog>}
    </div>
  );
}
