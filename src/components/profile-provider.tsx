"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";

export type Profile = {
  id: string;
  name: string;
  createdAt: string;
};

type ProfileContextType = {
  currentProfileId: string | null;
  setCurrentProfileId: (id: string) => void;
  profiles: Profile[];
  refreshProfiles: () => Promise<void>;
  isLoading: boolean;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfileId, setCurrentProfileId] = useLocalStorage<string>("jules-current-profile-id", "");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles');
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);

        // If no profile is selected or selected profile doesn't exist, select the first one (usually 'default')
        if (data.length > 0) {
           const profileExists = data.some((p: Profile) => p.id === currentProfileId);
           if (!currentProfileId || !profileExists) {
               // Prefer 'default' if it exists, otherwise first one
               const defaultProfile = data.find((p: Profile) => p.id === 'default');
               setCurrentProfileId(defaultProfile ? defaultProfile.id : data[0].id);
           }
        }
      }
    } catch (error) {
      console.error("Failed to fetch profiles", error);
      toast({
          title: "Error",
          description: "Failed to load profiles.",
          variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return (
    <ProfileContext.Provider value={{
      currentProfileId,
      setCurrentProfileId,
      profiles,
      refreshProfiles: fetchProfiles,
      isLoading
    }}>
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
