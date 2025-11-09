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

// Default stocks to be available on initialization
const DEFAULT_STOCKS: SavedStock[] = [
  { symbol: 'BANDIPUR', stockId: 491, isin: 'NPE491A00008', companyName: 'BANDIPUR CABLE C TOURISM LIMITED' },
  { symbol: 'SWASTIKP', stockId: 489, isin: 'NPE489A40008', companyName: 'SWASTHUBITTA BITTIYA SANSTHA LIMITED - PROMOTER SHARE' },
  { symbol: 'SBID2090', stockId: 7, isin: 'NPE007A11066', companyName: '7% NEPAL SBI BANK DEBEN090' },
  { symbol: 'SHINED', stockId: 97, isin: 'NPE097A11000', companyName: '8% SHINE RESUNGA DEB' },
  { symbol: 'CSY', stockId: 313, isin: 'NPE313A30001', companyName: 'CITIZENS SADABAHAR YOJANA ENDED MUTUAL FUND)' },
  { symbol: 'SWASTIK', stockId: 489, isin: 'NPE489A00002', companyName: 'SWASGHUBITTA BITTIYA SANSTHA LIMITED - ORDINARY SHARE' },
  { symbol: 'DHEL', stockId: 486, isin: 'NPE486A00008', companyName: 'DARAMKHOLA HYDRO ENERGY LIMITED' },
  { symbol: 'SAGAR', stockId: 488, isin: 'NPE488A00004', companyName: 'SAGAR DISTILLERY LIMITED' },
];

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
      savedStocks: DEFAULT_STOCKS,

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
