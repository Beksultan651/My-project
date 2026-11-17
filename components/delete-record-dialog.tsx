"use client";

import { useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { FinanceAction } from "@/lib/finance-records";
import { useFinance } from "./finance-provider";
import { useI18n } from "./i18n-provider";
import { Icon } from "./icons";
import { Modal } from "./ui";

export function DeleteRecordDialog({ action, title, done, children, onClose }: {
  action: FinanceAction & { next: null };
  title: MessageKey;
  done: MessageKey;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { save, notify } = useFinance();
  const { t } = useI18n();
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const failure = await save(action);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
    notify(t(done));
  }

  return (
    <Modal open onClose={onClose} title={t(title)} description={t("deleteIrreversible")}>
      <p className="delete-description">{children}</p>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="modal-actions">
        <button className="button button-outline" onClick={onClose}>{t("cancel")}</button>
        <button className="button button-danger" disabled={pending || error === "recordChanged"} onClick={remove}>
          <Icon name="trash" size={17}/>{t("delete")}
        </button>
      </div>
    </Modal>
  );
}
