import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SniperInstance, SniperConfig, SniperStats } from '../types/sniper';

interface SniperStore {
  // Multi-sniper state
  snipers: Map<string, SniperInstance>;
  
  // Actions
  createSniper: (clientId: string, config: SniperConfig) => string;  // returns sniperId
  removeSniper: (sniperId: string) => void;
  startSniper: (sniperId: string) => void;
  stopSniper: (sniperId: string) => void;
  
  updateSniperInstance: (sniperId: string, updates: Partial<SniperInstance>) => void;
  updateSniperStats: (sniperId: string, stats: Partial<SniperStats>) => void;
  
  // Getters
  getSniperInstance: (sniperId: string) => SniperInstance | null;
  getSnipersByClient: (clientId: string) => SniperInstance[];
  getSnipersByStock: (symbol: string) => SniperInstance[];
  getActiveSnipers: () => SniperInstance[];
  getAllSnipers: () => SniperInstance[];
  
  // Bulk operations
  clearAllSnipers: () => void;
  stopAllSnipers: () => void;
}

const createDefaultStats = (): SniperStats => ({
  totalOrders: 0,
  successfulOrders: 0,
  failedOrders: 0,
  gatewayErrors: 0,
  successRate: 0,
  currentDelay: 50,  // Start with minimum delay
  optimalDelay: null,
  isDelayLocked: false,
  avgResponseTime: 0,
  totalDuration: 0,
  orders: [],
});

export const useSniperStore = create<SniperStore>()(
  persist(
    (set, get) => ({
      snipers: new Map(),
      
      createSniper: (clientId: string, config: SniperConfig) => {
        const sniperId = `sniper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newSniper: SniperInstance = {
          id: sniperId,
          clientId,
          symbol: config.symbol,
          stockId: config.stockId,
          isin: config.isin,
          config: {
            targetZone: config.targetZone,
            triggerPrice: config.triggerPrice,
            totalQuantity: config.totalQuantity,
            numOrders: config.numOrders,
            orderType: config.orderType,
            cancelOnFirstFill: config.cancelOnFirstFill,
          },
          status: 'idle',
          isActive: false,
          currentPrice: null,
          currentZone: null,
          stats: createDefaultStats(),
          createdAt: new Date(),
          triggeredAt: null,
          completedAt: null,
        };
        
        set((state) => {
          const newSnipers = new Map(state.snipers);
          newSnipers.set(sniperId, newSniper);
          return { snipers: newSnipers };
        });
        
        console.log('[Sniper Store] Created sniper:', sniperId, 'for client:', clientId, 'stock:', config.symbol);
        
        return sniperId;
      },
      
      removeSniper: (sniperId: string) => {
        set((state) => {
          const newSnipers = new Map(state.snipers);
          newSnipers.delete(sniperId);
          return { snipers: newSnipers };
        });
        
        console.log('[Sniper Store] Removed sniper:', sniperId);
      },
      
      startSniper: (sniperId: string) => {
        set((state) => {
          const sniper = state.snipers.get(sniperId);
          if (!sniper) return state;
          
          const newSnipers = new Map(state.snipers);
          newSnipers.set(sniperId, {
            ...sniper,
            status: 'monitoring',
            isActive: true,
          });
          
          return { snipers: newSnipers };
        });
        
        console.log('[Sniper Store] Started sniper:', sniperId);
      },
      
      stopSniper: (sniperId: string) => {
        set((state) => {
          const sniper = state.snipers.get(sniperId);
          if (!sniper) return state;
          
          const newSnipers = new Map(state.snipers);
          newSnipers.set(sniperId, {
            ...sniper,
            status: 'stopped',
            isActive: false,
          });
          
          return { snipers: newSnipers };
        });
        
        console.log('[Sniper Store] Stopped sniper:', sniperId);
      },
      
      updateSniperInstance: (sniperId: string, updates: Partial<SniperInstance>) => {
        set((state) => {
          const sniper = state.snipers.get(sniperId);
          if (!sniper) return state;
          
          const newSnipers = new Map(state.snipers);
          newSnipers.set(sniperId, {
            ...sniper,
            ...updates,
          });
          
          return { snipers: newSnipers };
        });
      },
      
      updateSniperStats: (sniperId: string, stats: Partial<SniperStats>) => {
        set((state) => {
          const sniper = state.snipers.get(sniperId);
          if (!sniper) return state;
          
          const newSnipers = new Map(state.snipers);
          newSnipers.set(sniperId, {
            ...sniper,
            stats: {
              ...sniper.stats,
              ...stats,
            },
          });
          
          return { snipers: newSnipers };
        });
      },
      
      getSniperInstance: (sniperId: string) => {
        return get().snipers.get(sniperId) || null;
      },
      
      getSnipersByClient: (clientId: string) => {
        return Array.from(get().snipers.values()).filter(
          (sniper) => sniper.clientId === clientId
        );
      },
      
      getSnipersByStock: (symbol: string) => {
        return Array.from(get().snipers.values()).filter(
          (sniper) => sniper.symbol === symbol
        );
      },
      
      getActiveSnipers: () => {
        return Array.from(get().snipers.values()).filter(
          (sniper) => sniper.isActive
        );
      },
      
      getAllSnipers: () => {
        return Array.from(get().snipers.values());
      },
      
      clearAllSnipers: () => {
        set({ snipers: new Map() });
        console.log('[Sniper Store] Cleared all snipers');
      },
      
      stopAllSnipers: () => {
        set((state) => {
          const newSnipers = new Map(state.snipers);
          newSnipers.forEach((sniper, id) => {
            if (sniper.isActive) {
              newSnipers.set(id, {
                ...sniper,
                status: 'stopped',
                isActive: false,
              });
            }
          });
          return { snipers: newSnipers };
        });
        console.log('[Sniper Store] Stopped all snipers');
      },
    }),
    {
      name: 'nepse-snipers',
      // Custom storage to handle Map serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);
          return {
            state: {
              ...state,
              snipers: new Map(state.snipers || []),
            },
          };
        },
        setItem: (name, value) => {
          const str = JSON.stringify({
            state: {
              ...value.state,
              snipers: Array.from(value.state.snipers.entries()),
            },
          });
          localStorage.setItem(name, str);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
