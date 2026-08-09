'use client';

import * as React from 'react';
import {
  getStoredTabSession,
  storeTabSession,
  clearTabSession,
  verifyTabSession,
  type TabSessionPayload,
} from '@/lib/tab-session';

interface TabSessionContextValue {
  user: TabSessionPayload | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const TabSessionContext = React.createContext<TabSessionContextValue | null>(null);

export function TabSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<TabSessionPayload | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const stored = getStoredTabSession();
      if (!stored) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }
      const payload = await verifyTabSession(stored);
      if (!cancelled) {
        if (payload) {
          setUser(payload);
          setToken(stored);
        } else {
          clearTabSession();
        }
        setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const loginValue = React.useCallback(async (newToken: string) => {
    storeTabSession(newToken);
    setToken(newToken);
    const payload = await verifyTabSession(newToken);
    setUser(payload);
  }, []);

  const logoutValue = React.useCallback(() => {
    clearTabSession();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <TabSessionContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login: loginValue,
        logout: logoutValue,
      }}
    >
      {children}
    </TabSessionContext.Provider>
  );
}

export function useTabSession() {
  const ctx = React.useContext(TabSessionContext);
  if (!ctx) throw new Error('useTabSession must be used within TabSessionProvider');
  return ctx;
}
