"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getFavoriteStocks } from "@/lib/services/authService";
import { fetchFscStockPrice } from "@/lib/services/fscService";
import type { FscStockPrice } from "@/lib/types/api";
import { useFavoriteStore } from "@/lib/stores/useFavoriteStore";
import type { FavoriteStockItem } from "@/lib/types/home";

/**
 * 관심종목 관리 훅
 * BO: /api/auth/favorites (관심종목 코드)
 * BO: /api/fsc-stock-price (전체 시세 → 관심종목 필터링)
 */
export function useFavoriteStocks() {
  const { data: session } = useSession();
  const { favCodes, setFavCodes } = useFavoriteStore();

  const [allStockData, setAllStockData] = useState<FscStockPrice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const mapToFavoriteItem = useCallback(
    (item: FscStockPrice, idx: number): FavoriteStockItem => {
      const price = Number(item.clpr ?? 0);
      const fltRt = Number(item.flt_rt ?? 0);
      return {
        id: item.srtn_cd ?? String(idx),
        name: item.itms_nm ?? "-",
        code: item.srtn_cd ?? "-",
        price,
        change: fltRt,
      };
    },
    []
  );

  const loadFavCodes = useCallback(async () => {
    if (!session?.user?.email) {
      setFavCodes([]);
      return;
    }

    try {
      const result = await getFavoriteStocks(session.user.email);
      if (result.success && result.data?.favorite_stocks) {
        setFavCodes(result.data.favorite_stocks);
      } else {
        setFavCodes([]);
      }
    } catch (error) {
      console.error("관심종목 조회 오류:", error);
      setFavCodes([]);
    }
  }, [session?.user?.email, setFavCodes]);

  useEffect(() => {
    const loadStockData = async () => {
      setIsLoading(true);
      try {
        const response = await fetchFscStockPrice({ limit: 1000 });
        if (response.success && response.data && response.data.length > 0) {
          setAllStockData(response.data);
        } else {
          setAllStockData([]);
        }
      } catch (error) {
        console.error("주식 데이터 로딩 실패:", error);
        setAllStockData([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadStockData();
  }, []);

  useEffect(() => {
    loadFavCodes();

    const handleUpdate = () => {
      loadFavCodes();
    };

    window.addEventListener("favoritesUpdated", handleUpdate);
    return () => {
      window.removeEventListener("favoritesUpdated", handleUpdate);
    };
  }, [loadFavCodes]);

  const favoriteStocks = useMemo(() => {
    if (allStockData.length === 0 || favCodes.size === 0) {
      return [];
    }

    return allStockData
      .filter((item) => item.srtn_cd && favCodes.has(item.srtn_cd))
      .map((item, idx) => mapToFavoriteItem(item, idx));
  }, [allStockData, favCodes, mapToFavoriteItem]);

  return {
    favCodes,
    favoriteStocks,
    isLoading,
  };
}
