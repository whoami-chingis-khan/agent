import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Stock, type LivePrice } from '../types/stock';

export interface SavedStock {
  symbol: string;
  stockId: number;
  isin: string;
  companyName?: string;
  lastUsed?: string;
}

interface StocksState {
  selectedStock: Stock | null;
  livePrice: LivePrice | null;
  savedStocks: SavedStock[];
  setSelectedStock: (stock: Stock | null) => void;
  setLivePrice: (price: LivePrice | null) => void;
  addSavedStock: (stock: SavedStock) => void;
  removeSavedStock: (symbol: string) => void;
  updateSavedStock: (symbol: string, updates: Partial<SavedStock>) => void;
  getSavedStock: (symbol: string) => SavedStock | undefined;
  clearSavedStocks: () => void;
}

export const useStocksStore = create<StocksState>()(
  persist(
    (set, get) => ({
      selectedStock: null,
      livePrice: null,
      savedStocks: [],

      setSelectedStock: (stock) => set({ selectedStock: stock }),
      setLivePrice: (price) => set({ livePrice: price }),

      addSavedStock: (stock) =>
        set((state) => {
          // Check if stock already exists
          const existingIndex = state.savedStocks.findIndex(
            (s) => s.symbol === stock.symbol
          );

          if (existingIndex >= 0) {
            // Update existing stock
            const updated = [...state.savedStocks];
            updated[existingIndex] = { ...stock, lastUsed: new Date().toISOString() };
            return { savedStocks: updated };
          }

          // Add new stock
          return {
            savedStocks: [
              ...state.savedStocks,
              { ...stock, lastUsed: new Date().toISOString() },
            ],
          };
        }),

      removeSavedStock: (symbol) =>
        set((state) => ({
          savedStocks: state.savedStocks.filter((s) => s.symbol !== symbol),
        })),

      updateSavedStock: (symbol, updates) =>
        set((state) => ({
          savedStocks: state.savedStocks.map((s) =>
            s.symbol === symbol ? { ...s, ...updates } : s
          ),
        })),

      getSavedStock: (symbol) => {
        return get().savedStocks.find((s) => s.symbol === symbol);
      },

      clearSavedStocks: () => set({ savedStocks: [] }),
    }),
    {
      name: 'stocks-storage', // localStorage key
      partialize: (state) => ({ savedStocks: state.savedStocks }), // Only persist savedStocks
    }
  )
);
