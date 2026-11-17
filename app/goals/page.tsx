"use client";

import { useState, type FormEvent } from "react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { EmptyState, Modal, PageHeading } from "@/components/ui";
import { goalProgress, parseMoney, validDate } from "@/lib/finance";
import { createRecordId } from "@/lib/record-id";
import type { MessageKey, MessageParams } from "@/lib/i18n";
import type { SavingsGoal } from "@/types/finance";

function GoalForm({ goal, suggestion, onClose }: {
  goal: SavingsGoal | null; suggestion?: string; onClose: () => void;
}) {
  const { data, save, notify } = useFinance();
  const { t } = useI18n();
  const [name, setName] = useState(goal?.name ?? suggestion ?? "");
  const [target, setTarget] = useState(goal ? (goal.targetAmount / 100).toFixed(2) : "");
  const [saved, setSaved] = useState(goal ? (goal.savedAmount / 100).toFixed(2) : "");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const minDate = goal?.deadline && goal.deadline < data.today ? undefined : data.today;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const deadline = String(new FormData(event.currentTarget).get("deadline") ?? "");
    const targetAmount = parseMoney(target);
    const savedAmount = saved === "" ? 0 : parseMoney(saved);
    if (!name.trim()) return setError("goalNameRequired");
    if (targetAmount === null || targetAmount <= 0 || savedAmount === null) return setError("goalMoneyError");
    if (savedAmount > targetAmount) return setError("goalInitialError");
    if (deadline && (!validDate(deadline) || (deadline < data.today && deadline !== goal?.deadline))) {
      return setError("goalDateError");
    }

    const now = new Date().toISOString();
    const next: SavingsGoal = {
      id: goal?.id ?? createRecordId(), name: name.trim(), targetAmount, savedAmount, deadline,
      createdAt: goal?.createdAt ?? now, updatedAt: goal && goal.updatedAt > now ? goal.updatedAt : now,
    };
    setPending(true);
    const failure = await save({ collection: "goals", previous: goal ?? undefined, next });
    setPending(false);
    if (failure) return setError(failure);
    onClose();
    notify(t(goal ? "goalUpdated" : "goalAdded"));
  }

  return (
    <Modal open onClose={onClose} title={t(goal ? "editGoal" : "goalNewModal")}>
      <form className="form-stack" onSubmit={submit}>
        <label>{t("goalTitle")}
          <input required value={name} maxLength={80} placeholder={t("goalPlaceholder")}
            onChange={(event) => setName(event.target.value)}/>
        </label>
        <label>{t("goalTarget")}
          <input required inputMode="decimal" value={target} placeholder={t("amountPlaceholder")} maxLength={15}
            onChange={(event) => setTarget(event.target.value)}/>
        </label>
        <label>{t("goalSaved")}
          <input inputMode="decimal" value={saved} placeholder="0" maxLength={15}
            onChange={(event) => setSaved(event.target.value)}/>
        </label>
        <label>{t("goalDeadline")} <span className="optional">({t("optional")})</span>
          <input type="date" name="deadline" min={minDate} defaultValue={goal?.deadline ?? ""}/>
        </label>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" disabled={pending} className="button button-primary">
            <Icon name={goal ? "check" : "arrow"} size={17}/>{t(goal ? "save" : "createGoal")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ContributionForm({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const { save, notify } = useFinance();
  const { t, money } = useI18n();
  const [value, setValue] = useState("");
  const [error, setError] = useState<{ key: MessageKey; params?: MessageParams } | null>(null);
  const [pending, setPending] = useState(false);
  const remaining = goal.targetAmount - goal.savedAmount;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoney(value);
    if (amount === null || amount <= 0) return setError({ key: "contributionError" });
    if (amount > remaining) return setError({ key: "contributionLimit", params: { amount: money(remaining) } });

    const now = new Date().toISOString();
    const next = {
      ...goal, savedAmount: goal.savedAmount + amount,
      updatedAt: goal.updatedAt > now ? goal.updatedAt : now,
    };
    setPending(true);
    const failure = await save({ collection: "goals", previous: goal, next });
    setPending(false);
    if (failure) return setError({ key: failure });
    onClose();
    notify(t(amount === remaining ? "goalReached" : "goalContributed"));
  }

  return (
    <Modal open onClose={onClose} title={t("goalAdd")} description={goal.name}>
      <form className="form-stack" onSubmit={submit}>
        <p className="contribution-note">{t("remaining", { amount: money(remaining) })}</p>
        <label>{t("contributionAmount")}
          <input required inputMode="decimal" value={value} placeholder={t("amountPlaceholder")} maxLength={15}
            onChange={(event) => setValue(event.target.value)}/>
        </label>
        {error && <p className="form-error" role="alert">{t(error.key, error.params)}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" disabled={pending} className="button button-primary">
            <Icon name="plus" size={17}/>{t("contribute")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function GoalsPage() {
  const { data } = useFinance();
  const { t, money, date } = useI18n();
  const [editor, setEditor] = useState<{ goal: SavingsGoal | null; suggestion?: string } | null>(null);
  const [adding, setAdding] = useState<SavingsGoal | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const savedTotal = data.goals.reduce((sum, goal) => sum + goal.savedAmount, 0);
  const targetTotal = data.goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const completed = data.goals.filter((goal) => goal.savedAmount === goal.targetAmount).length;

  return (
    <div className="space-y-7">
      <PageHeading title={t("goals")} description={t("goalFirstBody")}>
        <button className="button button-primary" disabled={!data.initialized} onClick={() => setEditor({ goal: null })}>
          <Icon name="plus" size={18}/>{t("goalNew")}
        </button>
      </PageHeading>
      {!data.initialized ? <p className="panel loading-panel" role="status">{t("loading")}</p> : (
        <>
          <section className="goals-overview">
            <div><span className="soft-icon mint"><Icon name="target" size={24}/></span>
              <div><p>{t("goalTotalSaved")}</p><strong>{money(savedTotal)}</strong></div>
            </div>
            <div><p>{t("goalTotalTarget")}</p><strong>{money(targetTotal)}</strong></div>
            <div><p>{t("goalCompleted")}</p><strong>{completed} <span>/ {data.goals.length}</span></strong></div>
          </section>
          {data.goals.length ? (
            <div className="goals-grid">
              {data.goals.map((goal, index) => {
                const progress = goalProgress(goal);
                const complete = goal.savedAmount === goal.targetAmount;
                return (
                  <article key={goal.id} className="panel goal-card">
                    <div className="flex items-center justify-between">
                      <span className={`goal-icon ${["mint", "peach", "lilac", "butter"][index % 4]}`}>
                        <Icon name={complete ? "check" : "target"} size={25}/>
                      </span>
                      <div className="flex gap-1">
                        <button className="icon-button" onClick={() => setEditor({ goal })}
                          aria-label={t("namedAction", { action: t("editGoal"), name: goal.name })}><Icon name="edit" size={17}/></button>
                        <button className="icon-button danger-button" onClick={() => setDeleting(goal)}
                          aria-label={t("deleteGoalAria", { title: goal.name })}><Icon name="trash" size={17}/></button>
                      </div>
                    </div>
                    <h2>{goal.name}</h2>
                    <p className="goal-deadline"><Icon name="clock" size={15}/>
                      {goal.deadline ? date(goal.deadline, true) : t("noDeadline")}
                      {goal.deadline && !complete && goal.deadline < data.today && ` · ${t("overdue")}`}
                    </p>
                    <div className="goal-amount"><strong>{money(goal.savedAmount)}</strong><span>/ {money(goal.targetAmount)}</span></div>
                    <div className="progress-track" role="progressbar" aria-label={goal.name}
                      aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }}/></div>
                    <div className="goal-progress-caption">
                      <span>{complete ? t("goalReached") : t("remaining", { amount: money(goal.targetAmount - goal.savedAmount) })}</span>
                      <strong>{progress}%</strong>
                    </div>
                    <button className={`button w-full ${complete ? "button-complete" : "button-outline"}`} disabled={complete}
                      onClick={() => setAdding(goal)}>
                      <Icon name={complete ? "check" : "plus"} size={17}/>{t(complete ? "goalComplete" : "goalAdd")}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="panel goals-empty">
              <EmptyState icon="target" title={t("goalFirstTitle")} description={t("goalFirstBody")}>
                <button className="button button-primary" onClick={() => setEditor({ goal: null })}>
                  <Icon name="plus" size={18}/>{t("createGoal")}
                </button>
              </EmptyState>
              <div className="goal-suggestions">
                <span>{t("goalExamples")}</span>
                {(["emergencyFund", "newLaptop", "travel"] as const).map((key) => (
                  <button key={key} onClick={() => setEditor({ goal: null, suggestion: t(key) })}>
                    {t(key)}<Icon name="plus" size={14}/>
                  </button>
                ))}
              </div>
            </section>
          )}
          <p className="info-note"><Icon name="target" size={19}/><span>{t("goalNote")}</span></p>
        </>
      )}
      {editor && <GoalForm {...editor} onClose={() => setEditor(null)}/>}
      {adding && <ContributionForm goal={adding} onClose={() => setAdding(null)}/>}
      {deleting && <DeleteRecordDialog action={{ collection: "goals", previous: deleting, next: null }}
        title="deleteGoal" done="goalDeleted" onClose={() => setDeleting(null)}>
        {t("deleteGoalPrompt", { title: deleting.name })}
      </DeleteRecordDialog>}
    </div>
  );
}
