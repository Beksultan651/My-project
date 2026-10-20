"use client";

import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { Icon } from "@/components/icons";
import { Modal, PageHeading } from "@/components/ui";
import { lessons } from "@/lib/finance";

export default function LearnPage() {
  const { data, update, notify } = useFinance();
  const [selected, setSelected] = useState<(typeof lessons)[number] | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const completed = data.completedLessons.length;
  function finish() {
    if (!selected || answer !== selected.correct) return;
    update((s) => ({ ...s, completedLessons: [...new Set([...s.completedLessons, selected.id])] }));
    setSelected(null); notify("Сабақ аяқталды. Біліміңізге тағы бір қадам!");
  }
  return <div className="space-y-7"><PageHeading eyebrow="ӨЗІҢІЗГЕ ИНВЕСТИЦИЯ" title="Қаржылық білім" description="Түсінікті тілмен жазылған қысқаша сабақтар. Бір сабақ — бір пайдалы дағды."/><section className="learning-banner"><div className="learning-banner-icon"><Icon name="book" size={32}/></div><div><h2>Білімнен — сенімді шешімге</h2><p>Өз қарқыныңызбен оқыңыз. Әр сабақтың соңында біліміңізді тексеріңіз.</p></div><div className="learning-progress"><strong>{completed}<span> / {lessons.length}</span></strong><small>сабақ аяқталды</small><div className="progress-track"><span style={{ width: `${completed / lessons.length * 100}%` }}/></div></div></section><div className="section-heading"><h2>Сіздің оқу жолыңыз</h2><span className="neutral-pill">Бастапқы деңгей</span></div><div className="lessons-grid">{lessons.map((lesson, i) => { const complete = data.completedLessons.includes(lesson.id); return <article key={lesson.id} id={lesson.id} className="panel lesson-card"><div className="flex justify-between items-start"><span className={`lesson-card-icon ${lesson.color}`}><Icon name={lesson.icon} size={27}/></span><span className={`lesson-status ${complete ? "is-complete" : ""}`}>{complete ? <><Icon name="check" size={14}/>Аяқталды</> : `САБАҚ ${String(i + 1).padStart(2, "0")}`}</span></div><p className="lesson-category">{lesson.category}</p><h2>{lesson.title}</h2><p className="lesson-description">{lesson.description}</p><div className="lesson-card-bottom"><span><Icon name="clock" size={15}/>{lesson.duration}</span><button className="text-link" disabled={!data.initialized} onClick={() => { setSelected(lesson); setAnswer(null); }}>{complete ? "Қайталау" : "Сабақты оқу"}<Icon name="arrow" size={17}/></button></div></article>; })}</div><p className="info-note"><Icon name="book" size={19}/><span>Қосымша оқу үшін: <a href="https://fingramota.kz/index.php/kk" target="_blank" rel="noopener noreferrer">Fingramota.kz — қазақ тіліндегі қаржылық білім</a>. Сабақтар жалпы білім беруге арналған.</span></p>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? "Сабақ"} description={selected ? `${selected.category} · ${selected.duration}` : undefined}>{selected && <div className="lesson-reader">{selected.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="lesson-quiz"><p className="eyebrow">ӨЗІҢІЗДІ ТЕКСЕРІҢІЗ</p><h3>{selected.question}</h3><fieldset><legend className="sr-only">Жауапты таңдаңыз</legend>{selected.answers.map((option, i) => <label key={option} className={`quiz-option ${answer === i ? (i === selected.correct ? "correct" : "incorrect") : ""}`}><input type="radio" name="lesson-answer" value={i} checked={answer === i} onChange={() => setAnswer(i)}/>{option}{answer === i && <Icon name={i === selected.correct ? "check" : "close"} size={17}/>}</label>)}</fieldset>{answer !== null && <p className={answer === selected.correct ? "quiz-success" : "form-error"} role="status">{answer === selected.correct ? "Дұрыс! Сабақты аяқтай аласыз." : "Қайта ойланып көріңіз. Жауап сабақ мәтінінде бар."}</p>}</div><a className="lesson-source" href="https://fingramota.kz/index.php/kk" target="_blank" rel="noopener noreferrer">Қосымша дереккөз: Fingramota.kz<Icon name="up" size={14}/></a><button className="button button-primary w-full" disabled={answer !== selected.correct || !data.initialized} onClick={finish}><Icon name="check" size={17}/>Сабақты аяқтау</button></div>}</Modal>
  </div>;
}
