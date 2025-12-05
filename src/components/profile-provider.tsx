
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";

type Profile = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

type ProfileContextType = {
  activeProfile: Profile | null;
  profiles: Profile[];
  isLoading: boolean;
  refreshProfiles: () => Promise<void>;
  createProfile: (name: string) => Promise<void>;
  updateProfile: (id: string, name: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setActiveProfile: (id: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
        const active = data.find((p: Profile) => p.isActive);
        setActiveProfileState(active || null);
      }
    } catch (error) {
      console.error("Failed to fetch profiles", error);
    }
  };

  const refreshProfiles = async () => {
    setIsLoading(true);
    await fetchProfiles();
    setIsLoading(false);
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  const createProfile = async (name: string) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create profile');
      await refreshProfiles();
      toast({ title: "Profile created" });
    } catch (error) {
       toast({ title: "Error creating profile", variant: "destructive" });
       throw error;
    }
  };

  const updateProfile = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      await refreshProfiles();
      toast({ title: "Profile updated" });
    } catch (error) {
       toast({ title: "Error updating profile", variant: "destructive" });
       throw error;
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to delete profile');
      }
      await refreshProfiles();
      toast({ title: "Profile deleted" });
    } catch (error: any) {
       toast({ title: "Error deleting profile", description: error.message, variant: "destructive" });
       throw error;
    }
  };

  const setActiveProfile = async (id: string) => {
    try {
      const res = await fetch('/api/profiles/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to set active profile');
      await refreshProfiles();

      // We should also trigger a refresh of other data (jobs, settings, etc.)
      // Since those components likely fetch data on mount or via server actions that revalidatePath,
      // switching profile here might need a page reload or router.refresh() if active profile affects server rendered content.
      // But since we are using client components in settings, and server actions revalidate, it might be okay.
      // However, client-side cached data (like in useLocalStorage or useState) won't update automatically unless we tell it.
      // We will handle this in the components using this context.

      // Force reload to ensure all app state is fresh for the new profile
      window.location.reload();

      toast({ title: "Profile switched" });
    } catch (error) {
       toast({ title: "Error switching profile", variant: "destructive" });
       throw error;
    }
  };

  return (
    <ProfileContext.Provider value={{
      activeProfile,
      profiles,
      isLoading,
      refreshProfiles,
      createProfile,
      updateProfile,
      deleteProfile,
      setActiveProfile
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
