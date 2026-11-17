"use client";

import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { Modal, PageHeading } from "@/components/ui";
import { lessons } from "@/lib/finance";
import { localizeLessons } from "@/lib/lesson-translations";

export default function LearnPage() {
  const { data, update, notify } = useFinance(); const { t, locale } = useI18n();
  const localizedLessons = localizeLessons(lessons, locale);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [answer, setAnswer] = useState<number | null>(null);
  const selected = localizedLessons.find((lesson) => lesson.id === selectedId);
  const completed = data.completedLessons.length;
  async function finish() {
    if (!selected || answer !== selected.correct) return;
    if (!(await update((state) => ({ ...state, completedLessons: [...new Set([...state.completedLessons, selected.id])] })))) return;
    setSelectedId(null); notify(t("lessonFinished"));
  }
  return <div className="space-y-7"><PageHeading title={t("learn")} description={t("learnSubtitle")}/><section className="learning-banner"><div className="learning-banner-icon"><Icon name="book" size={32}/></div><div><h2>{t("learningTitle")}</h2><p>{t("learningBody")}</p></div><div className="learning-progress"><strong>{completed}<span> / {localizedLessons.length}</span></strong><small>{t("lessonsCompleted")}</small><div className="progress-track"><span style={{ width: `${completed / localizedLessons.length * 100}%` }}/></div></div></section><div className="section-heading"><h2>{t("coursePath")}</h2><span className="neutral-pill">{t("beginner")}</span></div>
    <div className="lessons-grid">{localizedLessons.map((lesson, index) => { const complete = data.completedLessons.includes(lesson.id); return <article key={lesson.id} id={lesson.id} className="panel lesson-card"><div className="flex justify-between items-start"><span className={`lesson-card-icon ${lesson.color}`}><Icon name={lesson.icon} size={27}/></span><span className={`lesson-status ${complete ? "is-complete" : ""}`}>{complete ? <><Icon name="check" size={14}/>{t("complete")}</> : t("lessonNumber", { number: String(index + 1).padStart(2,"0") })}</span></div><p className="lesson-category">{lesson.category}</p><h2>{lesson.title}</h2><p className="lesson-description">{lesson.description}</p><div className="lesson-card-bottom"><span><Icon name="clock" size={15}/>{lesson.duration}</span><button className="text-link" disabled={!data.initialized} onClick={() => { setSelectedId(lesson.id); setAnswer(null); }}>{t(complete ? "repeatLesson" : "readLesson")}<Icon name="arrow" size={17}/></button></div></article>; })}</div>
    <p className="lesson-source">{t("source")}: <a href="https://fingramota.kz/index.php/kk" target="_blank" rel="noopener noreferrer">Fingramota.kz<Icon name="up" size={14}/></a></p>
    <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected?.title ?? t("lesson")} description={selected ? `${selected.category} · ${selected.duration}` : undefined}>{selected && <div className="lesson-reader">{selected.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="lesson-quiz"><p className="eyebrow">{t("selfTest")}</p><h3>{selected.question}</h3><fieldset><legend className="sr-only">{t("chooseAnswer")}</legend>{selected.answers.map((option, index) => <label key={option} className={`quiz-option ${answer === index ? (index === selected.correct ? "correct" : "incorrect") : ""}`}><input type="radio" name="lesson-answer" value={index} checked={answer === index} onChange={() => setAnswer(index)}/>{option}{answer === index && <Icon name={index === selected.correct ? "check" : "close"} size={17}/>}</label>)}</fieldset>{answer !== null && <p className={answer === selected.correct ? "quiz-success" : "form-error"} role="status">{t(answer === selected.correct ? "correctAnswer" : "wrongAnswer")}</p>}</div><button className="button button-primary w-full mt-5" disabled={answer !== selected.correct || !data.initialized} onClick={finish}><Icon name="check" size={17}/>{t("finishLesson")}</button></div>}</Modal>
  </div>;
}
