
import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type Profile = {
  id: string;
  name: string;
  isActive: boolean;
  settings: Record<string, any>;
};

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  const fetchProfiles = useCallback(async () => {
    const response = await fetch('/api/profiles');
    const data = await response.json();
    setProfiles(data);
    const active = data.find((p: Profile) => p.isActive);
    setActiveProfile(active || data[0]);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const addProfile = async (name: string) => {
    const response = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const newProfile = await response.json();
    setProfiles([...profiles, newProfile]);
  };

  const updateProfile = async (id: string, name: string) => {
    const response = await fetch('/api/profiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    const updatedProfile = await response.json();
    const updatedProfiles = profiles.map(p =>
      p.id === id ? updatedProfile : p
    );
    setProfiles(updatedProfiles);
  };

  const deleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      return; // Cannot delete the last profile
    }
    await fetch('/api/profiles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const updatedProfiles = profiles.filter(p => p.id !== id);
    if (!updatedProfiles.some(p => p.isActive)) {
      updatedProfiles[0].isActive = true;
    }
    setProfiles(updatedProfiles);
  };

  const switchProfile = async (id: string) => {
    const response = await fetch('/api/profiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: true }),
    });
    const updatedProfile = await response.json();
    const updatedProfiles = profiles.map(p => ({
      ...p,
      isActive: p.id === id,
    }));
    setProfiles(updatedProfiles);
    setActiveProfile(updatedProfile);
  };

  return {
    profiles,
    activeProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    switchProfile,
  };
}
