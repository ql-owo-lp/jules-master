
import { renderHook, act } from '@testing-library/react';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useProfiles } from '@/hooks/use-profiles';

vi.mock('@/hooks/use-profiles');

describe('useProfileSettings', () => {
  const mockUseProfiles = useProfiles as vi.Mock;

  it('should return the default value if no profile is active', () => {
    mockUseProfiles.mockReturnValue({ activeProfile: null });
    const { result } = renderHook(() => useProfileSettings('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('should return the value from the active profile', () => {
    const activeProfile = {
      id: '1',
      name: 'Default',
      isActive: true,
      settings: { 'test-key': 'profile-value' },
    };
    mockUseProfiles.mockReturnValue({ activeProfile });
    const { result } = renderHook(() => useProfileSettings('test-key', 'default'));
    expect(result.current[0]).toBe('profile-value');
  });

  it('should set the value in the active profile', () => {
    const setProfiles = vi.fn();
    const activeProfile = {
      id: '1',
      name: 'Default',
      isActive: true,
      settings: {},
    };
    const profiles = [activeProfile];
    mockUseProfiles.mockReturnValue({ activeProfile, profiles, setProfiles });

    const { result } = renderHook(() => useProfileSettings('test-key', 'default'));
    act(() => {
      result.current[1]('new-value');
    });

    expect(setProfiles).toHaveBeenCalledWith([
      {
        ...activeProfile,
        settings: { 'test-key': 'new-value' },
      },
    ]);
  });
});
