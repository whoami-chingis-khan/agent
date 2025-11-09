import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ClientSession } from '../types/client';

interface ClientStore {
  // Multi-client state
  clients: Map<string, ClientSession>;
  activeClientId: string | null;
  
  // Actions
  addClient: (session: ClientSession) => void;
  removeClient: (clientId: string) => void;
  switchClient: (clientId: string) => void;
  updateClientSession: (clientId: string, updates: Partial<ClientSession>) => void;
  
  // Getters
  getActiveClient: () => ClientSession | null;
  getClient: (clientId: string) => ClientSession | null;
  getAllClients: () => ClientSession[];
  
  // Bulk operations
  clearAllClients: () => void;
}

export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      clients: new Map(),
      activeClientId: null,
      
      addClient: (session: ClientSession) => {
        set((state) => {
          const newClients = new Map(state.clients);
          newClients.set(session.id, session);
          
          return {
            clients: newClients,
            // Auto-select if first client
            activeClientId: state.activeClientId || session.id,
          };
        });
      },
      
      removeClient: (clientId: string) => {
        set((state) => {
          const newClients = new Map(state.clients);
          newClients.delete(clientId);
          
          // If removed client was active, switch to first available
          let newActiveClientId = state.activeClientId;
          if (state.activeClientId === clientId) {
            const remainingClients = Array.from(newClients.keys());
            newActiveClientId = remainingClients.length > 0 ? remainingClients[0] : null;
          }
          
          return {
            clients: newClients,
            activeClientId: newActiveClientId,
          };
        });
      },
      
      switchClient: (clientId: string) => {
        set({ activeClientId: clientId });
      },
      
      updateClientSession: (clientId: string, updates: Partial<ClientSession>) => {
        set((state) => {
          const client = state.clients.get(clientId);
          if (!client) return state;
          
          const newClients = new Map(state.clients);
          newClients.set(clientId, {
            ...client,
            ...updates,
          });
          
          return { clients: newClients };
        });
      },
      
      getActiveClient: () => {
        const state = get();
        if (!state.activeClientId) return null;
        return state.clients.get(state.activeClientId) || null;
      },
      
      getClient: (clientId: string) => {
        return get().clients.get(clientId) || null;
      },
      
      getAllClients: () => {
        return Array.from(get().clients.values());
      },
      
      clearAllClients: () => {
        set({ clients: new Map(), activeClientId: null });
      },
    }),
    {
      name: 'nepse-clients',
      // Custom serialization for Map
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);
          return {
            state: {
              ...state,
              clients: new Map(state.clients || []),
            },
          };
        },
        setItem: (name, value) => {
          const str = JSON.stringify({
            state: {
              ...value.state,
              clients: Array.from(value.state.clients.entries()),
            },
          });
          localStorage.setItem(name, str);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
