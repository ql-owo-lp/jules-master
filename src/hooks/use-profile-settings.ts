
import { useProfiles } from './use-profiles';

export function useProfileSettings<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const { activeProfile, setProfiles, profiles } = useProfiles();

  const setValue = (value: T) => {
    if (activeProfile) {
      const updatedSettings = { ...activeProfile.settings, [key]: value };
      const updatedProfile = { ...activeProfile, settings: updatedSettings };
      const updatedProfiles = profiles.map(p => p.id === activeProfile.id ? updatedProfile : p);
      setProfiles(updatedProfiles);
    }
  };

  const value = activeProfile?.settings?.[key] ?? defaultValue;

  return [value, setValue];
}
