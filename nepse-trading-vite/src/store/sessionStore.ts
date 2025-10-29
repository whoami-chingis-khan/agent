import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import tmsApi from '../services/tmsApi';
import { type SessionData, type SessionStatus } from '../types/session';

interface SessionState {
  isAuthenticated: boolean;
  sessionData: SessionStatus | null;
  updateHeaders: (headers: SessionData) => void;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      sessionData: null,

      updateHeaders: (headers: SessionData) => {
        console.log('[Session Store] Updating headers:', headers);
        tmsApi.updateSession(headers);
        set({
          isAuthenticated: true,
          sessionData: tmsApi.getSessionStatus()
        });
      },

      refreshSession: async () => {
        await tmsApi.refreshSession();
        set({ sessionData: tmsApi.getSessionStatus() });
      },

      clearSession: () => {
        set({ isAuthenticated: false, sessionData: null });
      },
    }),
    {
      name: 'nepse-session-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        sessionData: state.sessionData,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydrating from localStorage, restore session in TMS API
        console.log('[Session Store] Rehydration starting...', {
          hasState: !!state,
          isAuthenticated: state?.isAuthenticated,
          hasSessionData: !!state?.sessionData,
        });

        if (state?.sessionData && state.isAuthenticated) {
          console.log('[Session Store] Rehydrating session from localStorage:', state.sessionData);
          // Reconstruct session data for TMS API
          const sessionData = {
            'x-xsrf-token': state.sessionData.xsrfToken || '',
            'host-session-id': state.sessionData.sessionId || '',
            'membercode': state.sessionData.memberCode || '',
            'request-owner': state.sessionData.requestOwner || '',
            'cookie': state.sessionData.aid && state.sessionData.rid
              ? `XSRF-TOKEN=${state.sessionData.xsrfToken}; _aid=${state.sessionData.aid}; _rid=${state.sessionData.rid}`
              : '',
          };
          tmsApi.updateSession(sessionData);
          console.log('[Session Store] Session restored to TMS API successfully');
        } else {
          console.log('[Session Store] No session to rehydrate');
        }
      },
    }
  )
);
