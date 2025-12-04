import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// More accurate mock for drizzle-orm chained calls
const selectWhereMock = vi.fn();
const updateSetWhereMock = vi.fn();

// Add limit mock to the chain
const limitMock = vi.fn();
selectWhereMock.mockReturnValue({ limit: limitMock });


vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: selectWhereMock,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values) => ({ // Make set chainable for where
        where: updateSetWhereMock,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to a default good state before each test
    limitMock.mockClear();
    updateSetWhereMock.mockClear();
  });

  describe('GET', () => {
    it('should fetch and return existing settings', async () => {
      const mockSettings = { id: 1, debugMode: true };
      limitMock.mockResolvedValue([mockSettings]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSettings);
      expect(db.select).toHaveBeenCalled();
      expect(limitMock).toHaveBeenCalledWith(1);
    });

    it('should return default settings if none are found', async () => {
      limitMock.mockResolvedValue([]); // Simulate no settings in DB

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      // Check a default value from the route handler
      expect(data.debugMode).toBe(false);
      expect(data.titleTruncateLength).toBe(50);
    });
  });

  describe('POST', () => {
    it('should save debug mode setting correctly when settings exist', async () => {
      const mockExistingSettings = { id: 1, debugMode: false };
      limitMock.mockResolvedValue([mockExistingSettings]);
      updateSetWhereMock.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({ debugMode: true }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Settings updated successfully.');
      expect(db.update).toHaveBeenCalled();

      // Get the mock implementation of the db.update call to inspect its chain
      const updateCall = vi.mocked(db.update).mock.results[0].value;
      const setCall = vi.mocked(updateCall.set).mock.calls[0][0];
      expect(setCall).toHaveProperty('debugMode', true);
    });

    it('should create new settings if none exist', async () => {
      limitMock.mockResolvedValue([]); // No existing settings

        const request = new NextRequest('http://localhost/api/settings', {
          method: 'POST',
          body: JSON.stringify({ debugMode: true }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe('Settings updated successfully.');
        expect(db.insert).toHaveBeenCalled();

        const insertCall = vi.mocked(db.insert).mock.results[0].value;
        const valuesCall = vi.mocked(insertCall.values).mock.calls[0][0];
        expect(valuesCall).toHaveProperty('debugMode', true);
        expect(valuesCall).toHaveProperty('id', 1); // Should always set id to 1
      });

    it('should return a 400 error if the request body is empty', async () => {
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('At least one setting must be provided.');
    });

    it('should return a 400 error for invalid data type', async () => {
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({ debugMode: 'not-a-boolean' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.debugMode).toBeDefined();
    });
  });
});
