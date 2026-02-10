
import { describe, it, expect, vi } from 'vitest';
import { areJobAccordionItemPropsEqual } from './job-accordion-item';
import type { Job, Session } from '@/lib/types';

describe('areJobAccordionItemPropsEqual', () => {
  const mockJob: Job = {
    id: 'job-1',
    name: 'Test Job',
    sessionIds: ['session-1'],
    createdAt: new Date().toISOString(),
    repo: 'test-repo',
    branch: 'main',
  };

  const mockSession1: Session = {
    id: 'session-1',
    name: 'sessions/session-1',
    title: 'Session 1',
    prompt: 'Prompt 1',
    state: 'IN_PROGRESS',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  };

  const baseProps = {
    job: mockJob,
    details: { completed: 0, working: 1, pending: [], total: 1 },
    sessionMap: new Map([['session-1', mockSession1]]),
    statusFilter: 'all',
    selectedSessionIds: [],
    sessionsPerPage: 10,
    page: 1,
    isRefreshing: false,
    activeJobId: null,
    isActionPending: false,
    progressCurrent: 0,
    progressTotal: 0,
    titleTruncateLength: 50,
    quickReplies: [],
    onSelectAllForJob: vi.fn(),
    onSelectRow: vi.fn(),
    onSessionPageChange: vi.fn(),
    onApprovePlan: vi.fn(),
    onBulkSendMessage: vi.fn(),
    onSendMessage: vi.fn(),
    setActiveJobId: vi.fn(),
    jobIdParam: null,
  };

  it('should return true for identical props', () => {
    expect(areJobAccordionItemPropsEqual(baseProps, baseProps)).toBe(true);
  });

  it('should return TRUE when sessionMap reference changes but data is same (optimized behavior)', () => {
    // This test confirms the optimized behavior
    const newSessionMap = new Map([['session-1', mockSession1]]);
    const newProps = { ...baseProps, sessionMap: newSessionMap };

    // AFTER OPTIMIZATION, this should be TRUE
    expect(areJobAccordionItemPropsEqual(baseProps, newProps)).toBe(true);
  });

  it('should return TRUE when details reference changes but data is same (optimized behavior)', () => {
      const newDetails = { ...baseProps.details };
      const newProps = { ...baseProps, details: newDetails };

      // AFTER OPTIMIZATION, this should be TRUE
      expect(areJobAccordionItemPropsEqual(baseProps, newProps)).toBe(true);
  });

  it('should return false if relevant session data changes', () => {
    const updatedSession1 = { ...mockSession1, state: 'COMPLETED' as const };
    const newSessionMap = new Map([['session-1', updatedSession1]]);
    const newProps = { ...baseProps, sessionMap: newSessionMap };

    expect(areJobAccordionItemPropsEqual(baseProps, newProps)).toBe(false);
  });
});
