"use client";

import React, { createContext, useContext, ReactNode } from 'react';

interface EnvContextType {
  julesApiKey?: string;
  githubToken?: string;
  activeProfileSettings?: { [key: string]: any };
}

const EnvContext = createContext<EnvContextType>({});

export const useEnv = () => useContext(EnvContext);

export function EnvProvider({
  julesApiKey,
  githubToken,
  activeProfileSettings,
  children
}: EnvContextType & { children: ReactNode }) {
  return (
    <EnvContext.Provider value={{ julesApiKey, githubToken, activeProfileSettings }}>
      {children}
    </EnvContext.Provider>
  );
}
