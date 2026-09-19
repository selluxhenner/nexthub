"use client";
// TEAM MEMBER home: the raise box. Three things and nothing else - which kind (problem or idea),
// one line of text, send. While you type, the routing table says whose desk it lands on and the
// date they owe you an answer; it proposes, the team lead confirms. Same act.raise as MyCasesView.
import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/components/dashboard/DemoProvider";
import { Avatar } from "@/components/dashboard/shared/primitives";
import type { CaseKind } from "@/features/cases/events";
import { propose } from "@/features/routing";
import styles from "./RaiseView.module.css";

const KINDS: { id: CaseKind; label: string; hint: string; placeholder: string }[] = [
  { id: "problem", label: "Problem", hint: "something is in the way", placeholder: "What is getting in the way? e.g. We wait days for a €300 part on night shift because nobody there can sign the order" },
  { id: "idea", label: "Idea", hint: "something could be better", placeholder: "What could we do better? e.g. One shared fixture library so the 4-series team stops rebuilding the same jigs" },
];

type Sent = { id: string; kind: CaseKind; lead: string; due: string; passesTo: string | null };

export function RaiseView() {
  const ctx = useDemo();
  const { seed, S, persona, act, ready, f, href } = ctx;
  const [kind, setKind] = useState<CaseKind>("problem");
  const [draft, setDraft] = useState("");
  const [detail, setDetail] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  if (!ready) return <div className={styles.loading} />;

  const who = persona.who, P = seed.promiseDays, O = seed.outcomeDays;
  const current = KINDS.find((k) => k.id === kind) ?? KINDS[0];
  const proposal = propose(draft, seed.routes);
  const pr = proposal?.route ?? null;
  const canSend = draft.trim().length >= 8;
  const due = f(S.day + P);
  // A case always lands with your own team lead first (org chart: who you report to); the map's
  // owner is the proposal they pass it on to. Forwarded, never dropped on a stranger's desk.
  const lead = seed.people.find((p) => p.name === who.name)?.reportsTo ?? seed.personas.find((r) => r.id === "leader")?.who.name ?? "Triage desk";
  const passesOn = !!pr && pr.owner.name !== lead;

  const send = () => {
    if (!canSend) return;
    const id = act.raise({ kind, title: draft.trim(), body: detail.trim(), routeId: pr ? pr.id : null, assignee: lead, fromDept: who.line, reason: pr ? "triage" : "not responsible" });
    setSent({ id, kind, lead, due, passesTo: passesOn && pr ? pr.owner.name : null });
    setDraft(""); setDetail(""); setMoreOpen(false);
  };
  const again = () => setSent(null);

  const promises = [
    { n: P + " d", label: "to a yes, a no or a question — from a named person" },
    { n: O + " d", label: "after launch, the outcome is measured and sent back to you" },
    { n: "100%", label: "of shipped work names everyone who contributed" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.headText}>
        <h1 className={styles.title}>Raise a problem or an idea</h1>
        <p className={styles.sub}>One field. It lands on a named desk with a date, and stays visible until it is answered.</p>
      </div>

      {sent ? (
        <div className={styles.box} data-kind={sent.kind} role="status">
          <div className={styles.doneMark} aria-hidden="true">✓</div>
          <div className={styles.doneTitle}>Sent to {sent.lead}</div>
          <p className={styles.doneSub}>
            They owe you a yes, a no or a question by <strong>{sent.due}</strong>.
            {sent.passesTo && <> If it is not theirs, they pass it to {sent.passesTo} — and the clock keeps running.</>}
          </p>
          <div className={styles.doneRow}>
            <Link href={href("/cases/" + sent.id)} className="nh-btn nh-btn-primary nh-btn-sm">Follow it</Link>
            <button type="button" className="nh-btn nh-btn-ghost nh-btn-sm" onClick={again}>Raise another</button>
          </div>
        </div>
      ) : (
        <div className={styles.box} data-kind={kind}>
          <div className={styles.kinds} role="group" aria-label="What are you raising?">
            {KINDS.map((k) => (
              <button key={k.id} type="button" className={styles.kind} data-kind={k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                <span className={styles.kindLabel}>{k.label}</span>
                <span className={styles.kindHint}>{k.hint}</span>
              </button>
            ))}
          </div>

          <textarea className={styles.field} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus
            placeholder={current.placeholder} aria-label={current.label} />

          {moreOpen ? (
            <textarea className={`${styles.field} ${styles.fieldMore}`} value={detail} onChange={(e) => setDetail(e.target.value)} rows={3}
              placeholder="Anything that helps whoever picks it up: where, since when, who else notices it." aria-label="Detail" />
          ) : (
            <button type="button" className={styles.more} onClick={() => setMoreOpen(true)}>+ add detail</button>
          )}

          <div className={styles.route} data-state={pr ? "match" : proposal ? "none" : "idle"} aria-live="polite">
            {pr ? (
              <>
                <Avatar name={lead} size="sm" />
                <span className={styles.routeText}>
                  <span className={styles.routeMain}>Goes to <strong>{lead}</strong> · answer owed by <strong>{due}</strong></span>
                  <span className={styles.routeSub}>
                    {passesOn ? <>They pass it to {pr.owner.name} ({pr.owner.role}) if it is theirs — matched “{pr.type}”.</>
                      : <>{pr.owner.role} — matched “{pr.type}”, deputy {pr.deputy}.</>}
                  </span>
                </span>
              </>
            ) : proposal ? (
              <span className={styles.routeSub}>No row in the map matches yet — it goes to {lead}, who routes it within a day and adds the gap to the map.</span>
            ) : (
              <span className={styles.routeSub}>Start typing — you will see whose desk it lands on before you send it.</span>
            )}
          </div>

          <div className={styles.foot}>
            <span className={styles.as}>as {who.handle ?? who.name}</span>
            <button type="button" className={`nh-btn nh-btn-primary ${styles.send}`} disabled={!canSend} onClick={send}>
              {canSend ? "Send to " + lead : "Send"}
            </button>
          </div>
        </div>
      )}

      <div className={styles.promises}>
        {promises.map((p) => (
          <div key={p.n} className={styles.promise}>
            <span className={styles.promiseN}>{p.n}</span>
            <span className={styles.promiseL}>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
