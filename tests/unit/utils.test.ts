
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session } from '@/lib/types';

describe('utils', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Job 1)', title: 'Session 1', state: 'COMPLETED' },
      { id: '2', prompt: '[TOPIC]: # (Job 1)', title: 'Session 2', state: 'COMPLETED' },
      { id: '3', prompt: '[TOPIC]: # (Job 2)', title: 'Session 3', state: 'COMPLETED' },
      { id: '4', prompt: 'No topic', title: 'Session 4', state: 'COMPLETED' },
    ];

    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

    expect(groupedSessions.get('Job 1')).toHaveLength(2);
    expect(groupedSessions.get('Job 2')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(1);
  });

  it('should create dynamic jobs from grouped sessions', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Job 1)', title: 'Session 1', state: 'COMPLETED', createTime: new Date().toISOString() },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const dynamicJobs = createDynamicJobs(groupedSessions);

    expect(dynamicJobs).toHaveLength(1);
    expect(dynamicJobs[0].name).toBe('Job 1');
    expect(dynamicJobs[0].sessionIds).toEqual(['1']);
  });
});
