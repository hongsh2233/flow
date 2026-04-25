"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  LineChart,
  ListFilter,
  FlaskConical,
  Bot,
} from "lucide-react";
import styles from "./AdminKiwoomShell.module.css";

const KIWOOM_NAV = [
  { href: "/admin/kiwoom/quotes", label: "시세조회", Icon: LineChart },
  { href: "/admin/kiwoom/screening", label: "검색식", Icon: ListFilter },
  { href: "/admin/kiwoom/mock", label: "모의매매", Icon: FlaskConical },
  { href: "/admin/kiwoom/auto", label: "자동매매", Icon: Bot },
] as const;

export default function AdminKiwoomShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="관리자 메뉴">
        <div className={styles.brand}>
          <Link href="/admin/kiwoom" className={styles.brandLink}>
            내부 관리
          </Link>
          <span className={styles.brandSub}>운영 도구</span>
        </div>
        <nav className={styles.nav} aria-label="메인 내비게이션">
          <section className={styles.navGroup} aria-labelledby="nav-group-kiwoom">
            <h2 id="nav-group-kiwoom" className={styles.navGroupTitle}>
              키움
            </h2>
            <ul className={styles.navList}>
              {KIWOOM_NAV.map(({ href, label, Icon }) => {
                const active =
                  pathname === href || pathname?.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={active ? styles.navLinkActive : styles.navLink}
                    >
                      <Icon className={styles.navIcon} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </nav>
        <div className={styles.footer}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft className={styles.backIcon} aria-hidden />
            앱으로 돌아가기
          </Link>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
