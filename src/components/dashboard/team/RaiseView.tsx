"use client";
// TEAM MEMBER home: the raise box. Problem or idea, one line, optional screenshots and the
// people it also hits, then "Send to NextHub". NextHub evaluates it against the company context
// (org chart, routing map, goals, spend rule, known problems) - features/evaluate - and the box
// shows that evaluation step by step before the case is raised. Demo: the steps are timed, the
// facts are real; the screenshots stay in this browser (src/lib/shots.ts, keyed by case id), only
// their count becomes an event fact.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDemo } from "@/components/dashboard/DemoProvider";
import type { CaseKind } from "@/features/cases/events";
import { evaluate, type Evaluation } from "@/features/evaluate";
import { saveShots, shrinkImage, type Shot } from "@/lib/shots";
import styles from "./RaiseView.module.css";

const KINDS: { id: CaseKind; label: string; placeholder: string }[] = [
  { id: "problem", label: "Problem", placeholder: "What is getting in the way?" },
  { id: "idea", label: "Idea", placeholder: "What could we do better?" },
];
const STEP_MS = 1100; // one step per ~1.1 s -> about 9 s for eight steps
const MAX_SHOTS = 4;

type Phase = { at: "edit" } | { at: "thinking"; ev: Evaluation; done: number } | { at: "done"; ev: Evaluation; id: string };

export function RaiseView() {
  const ctx = useDemo();
  const { seed, S, persona, act, ready, href, tenant, showToast } = ctx;
  const [kind, setKind] = useState<CaseKind>("problem");
  const [draft, setDraft] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [affected, setAffected] = useState<string[]>([]);
  const [person, setPerson] = useState("");
  const [askPeople, setAskPeople] = useState(false);
  const [reading, setReading] = useState(0); // files still being shrunk
  const [phase, setPhase] = useState<Phase>({ at: "edit" });
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The evaluation plays out one step at a time; the case is raised once the last step lands.
  useEffect(() => {
    if (phase.at !== "thinking") return;
    const { ev, done } = phase;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      if (done < ev.steps.length) setPhase({ at: "thinking", ev, done: done + 1 });
      else {
        const id = act.raise(ev.payload);
        if (!saveShots(tenant.slug, id, shots)) showToast("Case raised — the screenshots did not fit in this browser's storage.");
        setPhase({ at: "done", ev, id });
      }
    }, reduced ? 150 : STEP_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [phase, act, shots, tenant.slug, showToast]); // shots cannot change while thinking: the edit box is gone

  if (!ready) return <div className={styles.loading} />;

  const who = persona.who;
  const current = KINDS.find((k) => k.id === kind) ?? KINDS[0];
  const canSend = draft.trim().length >= 8;
  const names = seed.people.map((p) => p.name).filter((n) => n !== who.name && !affected.includes(n));

  // Picked files are shrunk to small data URLs right away, so the preview and what gets stored are the same bytes.
  const addShots = (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, MAX_SHOTS - shots.length);
    if (fileRef.current) fileRef.current.value = ""; // after the snapshot: clearing empties the FileList; same file again must fire change
    if (!picked.length) return;
    setReading((n) => n + picked.length);
    picked.forEach((f) => shrinkImage(f)
      .then((shot) => setShots((s) => (s.length < MAX_SHOTS ? [...s, shot] : s)), () => showToast("Could not read " + f.name + " as an image."))
      .finally(() => setReading((n) => n - 1)));
  };
  const removeShot = (url: string) => setShots((s) => s.filter((x) => x.url !== url));
  const addPerson = () => {
    const n = person.trim();
    if (!n || affected.includes(n)) { setPerson(""); return; }
    setAffected((a) => [...a, n]); setPerson("");
  };
  const send = () => {
    if (!canSend) return;
    const ev = evaluate({ kind, text: draft, affected, attachments: shots.length, who }, { ...seed, cases: S.cases });
    setPhase({ at: "thinking", ev, done: 0 });
  };
  const reset = () => {
    setDraft(""); setShots([]); setAffected([]); setPerson(""); setAskPeople(false); setPhase({ at: "edit" });
  };

  if (phase.at === "thinking" || phase.at === "done") {
    const ev = phase.ev, done = phase.at === "done" ? ev.steps.length + 1 : phase.done;
    return (
      <div className={styles.page}>
        <div className={styles.box} data-kind={ev.payload.kind} data-phase={phase.at}>
          <div className={styles.thinkHead}>
            <span className={styles.orb} data-live={phase.at === "thinking" ? "true" : undefined} aria-hidden="true" />
            <span className={styles.thinkTitle}>{phase.at === "thinking" ? "NextHub is evaluating" : "Evaluated"}</span>
            <span className={styles.thinkWhat}>{ev.payload.title}</span>
          </div>
          <ol className={styles.steps} aria-live="polite">
            {ev.steps.map((s, i) => {
              const state = i < done ? "done" : i === done ? "now" : "todo";
              return (
                <li key={s.id} className={styles.step} data-state={state}>
                  <span className={styles.mark} aria-hidden="true">{state === "done" ? "✓" : ""}</span>
                  <span className={styles.stepText}>
                    <span className={styles.stepTitle}>{s.title}</span>
                    {state === "done" && <span className={styles.stepDetail}>{s.detail}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          {phase.at === "done" && (
            <div className={styles.banner} role="status">
              <div className={styles.bannerHead}>
                <span className={styles.bannerMark} aria-hidden="true">✓</span>
                <span className={styles.bannerTitle}>Evaluated successfully</span>
                <span className={styles.bannerScore}>Score <strong>{ev.score.value}</strong></span>
              </div>
              <p className={styles.bannerSub}>
                On <strong>{ev.lead}</strong>’s desk{ev.passesTo ? <>, passed to <strong>{ev.passesTo}</strong> if it is theirs</> : null}. Answer owed in {seed.promiseDays} d — it stays on the dashboard until then.
              </p>
              <div className={styles.bannerRow}>
                <Link href={href("/dashboard")} className="nh-btn nh-btn-primary nh-btn-sm">See it on the dashboard</Link>
                <Link href={href("/cases/" + phase.id)} className="nh-btn nh-btn-ghost nh-btn-sm">Open the case</Link>
                <button type="button" className={styles.again} onClick={reset}>Raise another</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.box} data-kind={kind}>
        <div className={styles.kinds} role="group" aria-label="What are you raising?">
          {KINDS.map((k) => (
            <button key={k.id} type="button" className={styles.kind} data-kind={k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
          ))}
        </div>

        <textarea className={styles.field} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus placeholder={current.placeholder} aria-label={current.label} />

        {shots.length > 0 && (
          <div className={styles.shots}>
            {shots.map((s) => (
              <span key={s.url} className={styles.shot}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, never fetched */}
                <img src={s.url} alt={s.name} />
                <button type="button" className={styles.shotX} onClick={() => removeShot(s.url)} aria-label={"Remove " + s.name}>×</button>
              </span>
            ))}
          </div>
        )}
        {affected.length > 0 && (
          <div className={styles.people}>
            <span className={styles.peopleL}>Also affected</span>
            {affected.map((n) => (
              <span key={n} className={styles.chip}>{n}<button type="button" className={styles.chipX} onClick={() => setAffected((a) => a.filter((x) => x !== n))} aria-label={"Remove " + n}>×</button></span>
            ))}
          </div>
        )}
        {askPeople && (
          <div className={styles.personRow}>
            <input className={styles.person} list="nh-people" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Name of someone this also hits" aria-label="Also affected"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPerson(); } if (e.key === "Escape") setAskPeople(false); }} autoFocus />
            <datalist id="nh-people">{names.map((n) => <option key={n} value={n} />)}</datalist>
            <button type="button" className="nh-btn nh-btn-ghost nh-btn-sm" onClick={addPerson} disabled={!person.trim()}>Add</button>
          </div>
        )}

        <div className={styles.foot}>
          <div className={styles.adds}>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addShots(e.target.files)} />
            <button type="button" className={styles.add} onClick={() => fileRef.current?.click()} disabled={shots.length + reading >= MAX_SHOTS} aria-busy={reading > 0 || undefined}>
              {reading > 0 ? "adding…" : shots.length ? "+ another screenshot" : "+ screenshot"}
            </button>
            <button type="button" className={styles.add} onClick={() => setAskPeople((v) => !v)} aria-expanded={askPeople}>+ also affected</button>
          </div>
          <button type="button" className={`nh-btn nh-btn-primary ${styles.send}`} disabled={!canSend} onClick={send}>Send to NextHub</button>
        </div>
      </div>
    </div>
  );
}
