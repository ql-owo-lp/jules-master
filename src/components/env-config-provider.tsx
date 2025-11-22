
"use client";

import { createContext, useContext, ReactNode } from "react";

type EnvConfigContextType = {
  hasEnvApiKey: boolean;
  hasEnvGithubToken: boolean;
};

const EnvConfigContext = createContext<EnvConfigContextType>({
  hasEnvApiKey: false,
  hasEnvGithubToken: false,
});

export function EnvConfigProvider({
  children,
  hasEnvApiKey,
  hasEnvGithubToken,
}: {
  children: ReactNode;
  hasEnvApiKey: boolean;
  hasEnvGithubToken: boolean;
}) {
  return (
    <EnvConfigContext.Provider value={{ hasEnvApiKey, hasEnvGithubToken }}>
      {children}
    </EnvConfigContext.Provider>
  );
}

export function useEnvConfig() {
  return useContext(EnvConfigContext);
}
