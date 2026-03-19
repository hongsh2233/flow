/**
 * 관심종목 전역 상태 (Zustand)
 */

import { create } from "zustand";

interface FavoriteState {
  favCodes: Set<string>;
  setFavCodes: (codes: string[] | Set<string>) => void;
  addFavCode: (code: string) => void;
  removeFavCode: (code: string) => void;
}

export const useFavoriteStore = create<FavoriteState>((set) => ({
  favCodes: new Set<string>(),
  setFavCodes: (codes) => {
    const newSet = codes instanceof Set ? new Set(codes) : new Set(codes);
    set({ favCodes: newSet });
  },
  addFavCode: (code) =>
    set((state) => ({ favCodes: new Set([...state.favCodes, code]) })),
  removeFavCode: (code) =>
    set((state) => {
      const next = new Set(state.favCodes);
      next.delete(code);
      return { favCodes: next };
    }),
}));
