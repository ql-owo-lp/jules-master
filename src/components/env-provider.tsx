"use client";

import React, { createContext, useContext, ReactNode } from 'react';

interface EnvContextType {
  julesApiKey?: string;
  githubToken?: string;
}

const EnvContext = createContext<EnvContextType>({});

export const useEnv = () => useContext(EnvContext);

export function EnvProvider({
  julesApiKey,
  githubToken,
  children
}: EnvContextType & { children: ReactNode }) {
  return (
    <EnvContext.Provider value={{ julesApiKey, githubToken }}>
      {children}
    </EnvContext.Provider>
  );
}
