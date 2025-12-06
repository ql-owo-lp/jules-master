"use client";

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useProfiles } from '@/hooks/use-profiles';

interface EnvContextType {
  julesApiKey?: string;
  githubToken?: string;
}

const EnvContext = createContext<EnvContextType>({});

export const useEnv = () => useContext(EnvContext);

export function EnvProvider({
  julesApiKey: julesApiKeyFromEnv,
  githubToken: githubTokenFromEnv,
  children
}: EnvContextType & { children: ReactNode }) {
  const { activeProfile } = useProfiles();

  const value = useMemo(() => {
    return {
      julesApiKey: activeProfile?.settings.apiKey || julesApiKeyFromEnv,
      githubToken: activeProfile?.settings.githubToken || githubTokenFromEnv,
    };
  }, [activeProfile, julesApiKeyFromEnv, githubTokenFromEnv]);

  return (
    <EnvContext.Provider value={value}>
      {children}
    </EnvContext.Provider>
  );
}
