
import { vi } from 'vitest';

export const dbThen = vi.fn();

export const db = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnValue({ then: dbThen }),
};
