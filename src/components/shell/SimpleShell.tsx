"use client";
// The employee's chrome (SHELL[role] === "simple"): the logo, Raise | Dashboard, and a profile
// button. No rail, no search, no counts - the whole point is that there is nothing to learn.
// Shares the overlays with AppShell (input sheet, toast, dev panel) so every action still works.
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SIMPLE } from "@/config/nav";
import { SITE } from "@/config/site";
import { useDemo } from "@/components/dashboard/DemoProvider";
import { mineRows } from "@/components/dashboard/derive";
import { DevPanel } from "./DevPanel";
import { InputSheet } from "./InputSheet";
import styles from "./SimpleShell.module.css";

export function SimpleShell({ children }: { children: React.ReactNode }) {
  const ctx = useDemo();
  const { tenant, persona, actor, email, pop, setPop, togglePop, sheet, toast, logout } = ctx;
  const pathname = usePathname();
  const who = persona.who;
  const anon = actor !== who.name; // the employee posts under a handle
  const mine = mineRows(ctx);
  const shipped = mine.filter((m) => m.status === "Shipped").length;

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <Link href={"/" + tenant.slug + "/raise"} className={styles.brand} onClick={() => setPop(null)}>
          <Image src="/brand/logo.png" alt="" width={26} height={26} className={styles.logo} />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{SITE.name}</span>
            <span className={styles.brandTenant}>{tenant.name}</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV_SIMPLE.map((n) => {
            const href = "/" + tenant.slug + n.href;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={n.href} href={href} className={styles.navItem} data-active={active ? "true" : undefined} aria-current={active ? "page" : undefined} onClick={() => setPop(null)}>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.right}>
          <button type="button" className={styles.avatar} data-open={pop === "me" ? "true" : undefined} onClick={() => togglePop("me")} aria-label="Profile" title={who.name + " · " + who.line}>
            {who.ini}
          </button>
          {pop === "me" && (
            <div className={styles.me} role="dialog" aria-label="Profile">
              <div className={styles.meHead}>
                <span className={styles.meAvatar}>{who.ini}</span>
                <span className={styles.meText}>
                  <span className={styles.meName}>{who.name}</span>
                  <span className={styles.meLine}>{who.line}</span>
                  {email && <span className={styles.meLine}>{email}</span>}
                </span>
              </div>
              <div className={styles.meStats}>
                <span><strong>{mine.length}</strong> raised</span>
                <span><strong>{shipped}</strong> shipped</span>
              </div>
              <div className={styles.mePreview}>
                <span className={styles.mePreviewLabel}>How others see you</span>
                <span className={styles.mePreviewName}>{actor}</span>
                <span className={styles.meLine}>{anon ? "Anonymous · name and role hidden" : who.line}</span>
              </div>
              <div className={styles.meFoot}>
                <Link href={"/" + tenant.slug + "/team"} className={styles.meLink} onClick={() => setPop(null)}>What happened to what I sent →</Link>
                <button type="button" className={styles.logout} onClick={logout}>Log out</button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </main>

      {pop && <div className={styles.backdrop} onClick={() => setPop(null)} />}
      {sheet && <InputSheet />}
      {toast && <div className={styles.toast} role="status">{toast}</div>}
      <DevPanel />
    </div>
  );
}
