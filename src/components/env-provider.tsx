"use client";

import { createContext, useContext, ReactNode } from 'react';

interface Profile {
    id: string;
    name: string;
    isActive: boolean;
}

interface EnvContextType {
  julesApiKey?: string;
  githubToken?: string;
  activeProfile?: Profile;
}

const EnvContext = createContext<EnvContextType>({});

export const useEnv = () => useContext(EnvContext);

export function EnvProvider({
  julesApiKey,
  githubToken,
  activeProfile,
  children
}: EnvContextType & { children: ReactNode }) {
  return (
    <EnvContext.Provider value={{ julesApiKey, githubToken, activeProfile }}>
      {children}
    </EnvContext.Provider>
  );
}
