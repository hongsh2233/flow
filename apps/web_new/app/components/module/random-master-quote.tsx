"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { User } from "lucide-react";
import { getAuthHeaders } from "@/lib/config/api";
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

export function RandomMasterQuote() {
  const { data: session } = useSession();
  const [item, setItem] = useState<QuoteItem | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const pickRandom = useCallback(async () => {
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
      if (!items.length) {
        setItem(null);
        return;
      }
      const pick = items[Math.floor(Math.random() * items.length)];
      setItem(pick);
      setImgFailed(false);
    } catch {
      setItem(null);
    }
  }, [session?.user]);

  useEffect(() => {
    void pickRandom();
  }, [pickRandom]);

  if (!item?.quote?.trim()) return null;

  const name = item.name?.trim() || "투자 대가";
  const title = item.title?.trim() || "";
  const url = item.image_url?.trim() ?? "";

  return (
    <section className={styles.wrap} aria-label="대가들의 명언">
      <h2 className={styles.header}>대가들의 명언</h2>
      <div className={styles.card}>
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
