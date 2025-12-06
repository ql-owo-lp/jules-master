
import { useState, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { Profile } from '@/lib/types';

const defaultProfileSettings = {
  apiKey: '',
  githubToken: '',
  idlePollInterval: 120,
  activePollInterval: 30,
  titleTruncateLength: 50,
  lineClamp: 1,
  sessionItemsPerPage: 10,
  jobsPerPage: 5,
  defaultSessionCount: 10,
  prStatusPollInterval: 60,
  historyPromptsCount: 10,
  autoApprovalInterval: 60,
  autoRetryEnabled: true,
  autoRetryMessage: 'You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution',
  autoContinueEnabled: true,
  autoContinueMessage: 'Sounds good. Now go ahead finish the work',
  debugMode: false,
  sessionCacheInProgressInterval: 60,
  sessionCacheCompletedNoPrInterval: 1800,
  sessionCachePendingApprovalInterval: 300,
  sessionCacheMaxAgeDays: 3,
  autoDeleteStaleBranches: false,
  autoDeleteStaleBranchesAfterDays: 3,
};

export function useProfiles() {
  const [profiles, setProfiles] = useLocalStorage<Profile[]>('jules-profiles', []);
  const [activeProfileId, setActiveProfileId] = useLocalStorage<string | null>('jules-active-profile-id', null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (profiles.length === 0) {
      const defaultProfile: Profile = {
        id: crypto.randomUUID(),
        name: 'Default',
        settings: defaultProfileSettings,
      };
      setProfiles([defaultProfile]);
      setActiveProfileId(defaultProfile.id);
    } else if (!activeProfileId || !profiles.some(p => p.id === activeProfileId)) {
      setActiveProfileId(profiles[0].id);
    }
    setIsInitialized(true);
  }, [profiles, setProfiles, activeProfileId, setActiveProfileId]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;

  const createProfile = (name: string) => {
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name,
      settings: activeProfile?.settings || defaultProfileSettings,
    };
    setProfiles([...profiles, newProfile]);
    setActiveProfileId(newProfile.id);
  };

  const updateProfile = (id: string, updatedProfile: Partial<Profile>) => {
    setProfiles(profiles.map(p => (p.id === id ? { ...p, ...updatedProfile } : p)));
  };

  const deleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      // Cannot delete the last profile
      return;
    }
    const newProfiles = profiles.filter(p => p.id !== id);
    setProfiles(newProfiles);
    if (activeProfileId === id) {
      setActiveProfileId(newProfiles[0].id);
    }
  };

  const switchProfile = (id: string) => {
    setActiveProfileId(id);
  };

  return {
    profiles,
    activeProfile,
    isInitialized,
    createProfile,
    updateProfile,
    deleteProfile,
    switchProfile,
  };
}
