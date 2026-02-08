
import { describe, it, expect, vi } from 'vitest';
import { areJobAccordionItemPropsEqual } from './job-accordion-item';
import { Job, Session } from '@/lib/types';

describe('areJobAccordionItemPropsEqual', () => {
  const mockJob: Job = {
    id: 'job-1',
    name: 'Test Job',
    sessionIds: ['session-1'],
    repo: 'repo',
    branch: 'main',
    createdAt: new Date().toISOString(),
  };

  const mockSession: Session = {
    id: 'session-1',
    state: 'RUNNING',
    createTime: new Date().toISOString(),
  } as Session;

  const mockSession2: Session = {
    id: 'session-2',
    state: 'RUNNING',
    createTime: new Date().toISOString(),
  } as Session;

  const baseProps = {
    job: mockJob,
    details: { completed: 0, working: 1, pending: [], total: 1 },
    sessionMap: new Map([['session-1', mockSession], ['session-2', mockSession2]]),
    statusFilter: 'all',
    selectedSessionIds: [],
    sessionsPerPage: 10,
    page: 1,
    activeJobId: null,
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

  it('should return TRUE when sessionMap reference changes but relevant sessions are identical', () => {
    // Scenario: session-2 updates, but job-1 only cares about session-1.
    // Optimization goal: return TRUE to avoid re-render.

    const nextSessionMap = new Map([
        ['session-1', mockSession], // Same object reference for session-1
        ['session-2', { ...mockSession2, state: 'COMPLETED' } as Session] // New object for session-2
    ]);

    const prevProps = { ...baseProps };
    const nextProps = { ...baseProps, sessionMap: nextSessionMap };

    const isEqual = areJobAccordionItemPropsEqual(prevProps, nextProps);

    expect(isEqual).toBe(true);
  });

  it('should return TRUE when details prop reference changes but content is identical', () => {
    // Details object is recreated on every render in parent
    const nextDetails = { ...baseProps.details };

    const prevProps = { ...baseProps };
    const nextProps = { ...baseProps, details: nextDetails };

    const isEqual = areJobAccordionItemPropsEqual(prevProps, nextProps);

    expect(isEqual).toBe(true);
  });
});
