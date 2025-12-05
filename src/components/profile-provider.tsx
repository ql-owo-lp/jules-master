
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Profile } from "@/lib/db/types";
import Cookies from 'js-cookie';

interface ProfileContextType {
  currentProfileId: string | null;
  setCurrentProfileId: (id: string) => void;
  currentProfile: Profile | null;
  profiles: Profile[];
  refreshProfiles: () => Promise<void>;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfileId, setCurrentProfileId] = useLocalStorage<string>("jules-current-profile-id", "");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfiles = async () => {
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);

        // If no current profile or current profile not in list, select the first one
        if (data.length > 0) {
            if (!currentProfileId || !data.find((p: Profile) => p.id === currentProfileId)) {
                setCurrentProfileId(data[0].id);
            }
        }
      }
    } catch (error) {
      console.error("Failed to fetch profiles", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      // Set cookie for server-side access (expires in 365 days)
      Cookies.set('jules-current-profile-id', currentProfileId, { expires: 365 });
    } else {
        Cookies.remove('jules-current-profile-id');
    }
  }, [currentProfileId]);

  const currentProfile = profiles.find((p) => p.id === currentProfileId) || null;

  return (
    <ProfileContext.Provider
      value={{
        currentProfileId,
        setCurrentProfileId,
        currentProfile,
        profiles,
        refreshProfiles,
        isLoading,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
