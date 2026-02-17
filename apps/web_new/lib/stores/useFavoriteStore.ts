/**
 * 관심종목 전역 상태 (Zustand)
 */

import { create } from "zustand";

interface FavoriteState {
  favCodes: Set<string>;
  setFavCodes: (codes: string[] | Set<string>) => void;
}

export const useFavoriteStore = create<FavoriteState>((set) => ({
  favCodes: new Set<string>(),
  setFavCodes: (codes) => {
    const newSet = codes instanceof Set ? new Set(codes) : new Set(codes);
    set({ favCodes: newSet });
  },
}));
