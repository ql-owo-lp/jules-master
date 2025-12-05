
import { listSessions } from '@/app/sessions/actions';
import { getCachedSessions, syncStaleSessions } from '@/lib/session-service';
import { MOCK_SESSIONS } from './mock-data';

vi.mock('@/lib/session-service', () => ({
  getCachedSessions: vi.fn(),
  syncStaleSessions: vi.fn(),
}));

describe('listSessions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return cached sessions and trigger a background sync', async () => {
    (getCachedSessions as vi.Mock).mockResolvedValueOnce(MOCK_SESSIONS).mockResolvedValueOnce(MOCK_SESSIONS);

    const { sessions, error } = await listSessions('test-api-key');

    expect(sessions).toEqual(MOCK_SESSIONS);
    expect(error).toBeUndefined();
    expect(syncStaleSessions).toHaveBeenCalledWith('test-api-key');
    expect(getCachedSessions).toHaveBeenCalledTimes(2);
  });

  it('should return an error if no API key is provided', async () => {
    const { sessions, error } = await listSessions(null);

    expect(sessions).toEqual([]);
    expect(error).toBe('Jules API key is not configured. Please set it in the settings.');
  });
});
