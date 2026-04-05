"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { JUBTI_MASTER_BY_TYPE, isJubtiDimension } from "@/lib/jubti/jubtiMasters";

/** 로그인 사용자의 저장된 주BTI에 대응하는 「나와 닮은 투자 대가」 이름. 미로그인·미설정 시 null */
export function useJubtiMasterName(): string | null {
  const { data: session, status } = useSession();
  const [master, setMaster] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) {
      queueMicrotask(() => setMaster(null));
      return;
    }
    let cancelled = false;
    fetch("/api/auth/member/jubti", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { success?: boolean; jubti_type?: string }) => {
        if (cancelled) return;
        queueMicrotask(() => {
          if (cancelled) return;
          const t = data?.jubti_type;
          if (data?.success && t && isJubtiDimension(t)) {
            setMaster(JUBTI_MASTER_BY_TYPE[t]);
          } else {
            setMaster(null);
          }
        });
      })
      .catch(() => {
        if (!cancelled) queueMicrotask(() => setMaster(null));
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email]);

  return master;
}
