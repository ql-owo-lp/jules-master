"use client";

import { createContext, useContext, ReactNode, useState, useEffect }
from 'react';
import { getSelectedProfile } from '@/app/settings/profiles';
import { Profile } from '@/lib/types';

interface EnvContextType {
  julesApiKey?: string;
  githubToken?: string;
  profile?: Profile | null;
}

const EnvContext = createContext<EnvContextType>({});

export const useEnv = () => useContext(EnvContext);

export function EnvProvider({
  julesApiKey: initialJulesApiKey,
  githubToken: initialGithubToken,
  children
}: {
  julesApiKey?: string;
  githubToken?: string;
  children: ReactNode
}) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const selectedProfile = await getSelectedProfile();
      setProfile(selectedProfile);
    }
    fetchProfile();
  }, []);

  const julesApiKey = profile?.julesApiKey ?? initialJulesApiKey;
  const githubToken = profile?.githubToken ?? initialGithubToken;

  return (
    <EnvContext.Provider value={{ julesApiKey, githubToken, profile }}>
      {children}
    </EnvContext.Provider>
  );
}
