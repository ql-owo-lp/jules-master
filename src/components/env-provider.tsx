"use client";

import { createContext, useContext, ReactNode } from 'react';

interface EnvContextType {
  hasJulesApiKey: boolean;
  hasGithubToken: boolean;
}

const EnvContext = createContext<EnvContextType>({ hasJulesApiKey: false, hasGithubToken: false });

export const useEnv = () => useContext(EnvContext);

export function EnvProvider({
  hasJulesApiKey,
  hasGithubToken,
  children
}: EnvContextType & { children: ReactNode }) {
  return (
    <EnvContext.Provider value={{ hasJulesApiKey, hasGithubToken }}>
      {children}
    </EnvContext.Provider>
  );
}
