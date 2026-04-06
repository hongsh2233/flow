"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { User } from "lucide-react";
import { getAuthHeaders } from "@/lib/config/api";
import { pickWeightedByMaster } from "@/lib/jubti/jubtiMasters";
import { useJubtiMasterName } from "@/lib/hooks/useJubtiMasterName";
import styles from "./random-master-quote.module.css";

type QuoteItem = {
  id?: number;
  name?: string;
  title?: string;
  image_url?: string | null;
  quote?: string;
};

function getJuGuestId(): string {
  if (typeof window === "undefined") return "";
  let g = localStorage.getItem("ju_guest_id");
  if (!g) {
    g = "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("ju_guest_id", g);
  }
  return g;
}

function itemKey(it: QuoteItem): string {
  if (it.id != null) return `id:${it.id}`;
  return `q:${(it.quote ?? "").slice(0, 40)}`;
}

export function RandomMasterQuote() {
  const { data: session } = useSession();
  const jubtiMasterName = useJubtiMasterName();
  const [pool, setPool] = useState<QuoteItem[]>([]);
  const [item, setItem] = useState<QuoteItem | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const loadPool = useCallback(async () => {
    try {
      const email = (session?.user as { email?: string })?.email;
      const params = new URLSearchParams();
      if (email) params.set("email", email);
      else params.set("guest_id", getJuGuestId());
      const qs = params.toString();
      const res = await fetch(`/api/master-quotes?${qs}`, {
        method: "GET",
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data?.items as QuoteItem[]) ?? [];
      const withQuote = items.filter((x) => x.quote?.trim());
      if (!withQuote.length) {
        setPool([]);
        setItem(null);
        return;
      }
      setPool(withQuote);
      setItem(pickWeightedByMaster(withQuote, null, jubtiMasterName, itemKey));
      setImgFailed(false);
    } catch {
      setPool([]);
      setItem(null);
    }
  }, [session?.user, jubtiMasterName]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  useEffect(() => {
    setImgFailed(false);
  }, [item]);

  /* 주톡과 동일: 10초마다 다른 명언 1개로 교체 */
  useEffect(() => {
    if (pool.length < 2) return;
    const id = window.setInterval(() => {
      setItem((prev) => pickWeightedByMaster(pool, prev, jubtiMasterName, itemKey));
    }, 10_000);
    return () => window.clearInterval(id);
  }, [pool, jubtiMasterName]);

  if (!item?.quote?.trim()) return null;

  const name = item.name?.trim() || "투자 대가";
  const title = item.title?.trim() || "";
  const url = item.image_url?.trim() ?? "";

  return (
    <section className={styles.wrap} aria-label="대가들의 명언">
      <h2 className={styles.header}>대가들의 명언</h2>
      <div className={styles.card} key={itemKey(item)}>
        {url && !imgFailed ? (
          <img
            src={url}
            alt={`${name} 프로필`}
            className={styles.avatar}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className={styles.avatarPh} aria-hidden>
            <User size={20} strokeWidth={1.75} />
          </div>
        )}
        <div className={styles.body}>
          <p className={styles.name}>{name}</p>
          {title ? <p className={styles.title}>{title}</p> : null}
          <p className={styles.quote}>&ldquo;{item.quote.trim()}&rdquo;</p>
        </div>
      </div>
    </section>
  );
}
