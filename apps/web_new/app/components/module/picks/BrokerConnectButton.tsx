"use client";

import { useCallback, useEffect, useState } from "react";
import { BrokerSelectSheet, type BrokerItem } from "./BrokerSelectSheet";
import styles from "./Picks.module.css";

const STORAGE_KEY = "selected_broker";

export function BrokerConnectButton() {
  const [brokers, setBrokers] = useState<BrokerItem[]>([]);
  const [selected, setSelected] = useState<BrokerItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch("/api/picks/brokers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list = (j.brokers ?? []) as BrokerItem[];
        setBrokers(Array.isArray(list) ? list : []);
      })
      .catch(() => setBrokers([]));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as BrokerItem;
      if (parsed?.id) setSelected(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((b: BrokerItem) => {
    setSelected(b);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    } catch {
      /* ignore */
    }
  }, []);

  const goBroker = useCallback(async (b: BrokerItem) => {
    const tryNative = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const target = b.deep_link || b.mobile_web || b.android_store;
          if (target) {
            window.location.href = target;
            return true;
          }
        }
      } catch {
        /* no capacitor */
      }
      return false;
    };

    const native = await tryNative();
    if (native) return;

    const url = b.mobile_web || b.android_store;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <>
      <div className={styles.brokerActions}>
        <button type="button" className={styles.btnSm} onClick={() => setSheetOpen(true)}>
          {selected ? "변경" : "증권사 선택"}
        </button>
        {selected && (
          <button type="button" className={styles.btnGo} onClick={() => goBroker(selected)}>
            바로가기
          </button>
        )}
      </div>

      <BrokerSelectSheet
        open={sheetOpen}
        brokers={brokers}
        onClose={() => setSheetOpen(false)}
        onSelect={persist}
      />
    </>
  );
}
