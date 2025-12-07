
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfiles } from '@/hooks/use-profiles';
import { vi } from 'vitest';

describe('useProfiles', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation((url, options) => {
      if (url === '/api/profiles') {
        if (options?.method === 'POST') {
          const { name } = JSON.parse(options.body as string);
          return Promise.resolve(new Response(JSON.stringify({ id: '2', name, isActive: false, settings: {} })));
        }
        if (options?.method === 'PUT') {
          const { id, name, isActive } = JSON.parse(options.body as string);
          return Promise.resolve(new Response(JSON.stringify({ id, name: name || 'Work', isActive, settings: {} })));
        }
        return Promise.resolve(new Response(JSON.stringify([{ id: '1', name: 'Default', isActive: true, settings: {} }])));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with a default profile', async () => {
    const { result } = renderHook(() => useProfiles());
    await waitFor(() => expect(result.current.profiles.length).toBe(1));
    expect(result.current.profiles[0].name).toBe('Default');
    expect(result.current.profiles[0].isActive).toBe(true);
    expect(result.current.activeProfile?.name).toBe('Default');
  });

  it('should add a new profile', async () => {
    const { result } = renderHook(() => useProfiles());
    await waitFor(() => expect(result.current.profiles.length).toBe(1));
    await act(async () => {
      await result.current.addProfile('Work');
    });
    expect(result.current.profiles.length).toBe(2);
    expect(result.current.profiles[1].name).toBe('Work');
    expect(result.current.profiles[1].isActive).toBe(false);
  });

  it('should not delete the last profile', async () => {
    const { result } = renderHook(() => useProfiles());
    await waitFor(() => expect(result.current.profiles.length).toBe(1));
    await act(async () => {
      await result.current.deleteProfile(result.current.profiles[0].id);
    });
    expect(result.current.profiles.length).toBe(1);
  });

  it('should switch the active profile', async () => {
    const { result } = renderHook(() => useProfiles());
    await waitFor(() => expect(result.current.profiles.length).toBe(1));
    await act(async () => {
      await result.current.addProfile('Work');
    });
    await act(async () => {
      await result.current.switchProfile('2');
    });
    expect(result.current.activeProfile?.name).toBe('Work');
  });
});
