import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { Session, Job } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function groupSessionsByTopic(sessions: Session[]): { groupedSessions: Map<string, Session[]>, remainingUnknown: Session[] } {
  const groupedSessions = new Map<string, Session[]>();
  const remainingUnknown: Session[] = [];

  sessions.forEach(session => {
    const firstLine = session.prompt?.split('\n')[0] || '';
    const match = firstLine.match(/^\[TOPIC\]: # \((.+)\)\s*$/);
    if (match) {
      const jobName = match[1].trim();
      if (!groupedSessions.has(jobName)) {
        groupedSessions.set(jobName, []);
      }
      groupedSessions.get(jobName)!.push(session);
    } else {
      remainingUnknown.push(session);
    }
  });

  return { groupedSessions, remainingUnknown };
}

export function createDynamicJobs(groupedSessions: Map<string, Session[]>): Job[] {
  return Array.from(groupedSessions.entries())
    .filter(([, sessions]) => sessions.length > 0)
    .map(([jobName, sessions]) => {
      const latestSession = sessions.reduce((latest, current) => {
        const latestTime = new Date(latest.createTime || 0);
        const currentTime = new Date(current.createTime || 0);

        if (isNaN(latestTime.getTime())) return current;
        if (isNaN(currentTime.getTime())) return latest;

        return currentTime > latestTime ? current : latest;
      }, sessions[0]);

      const repo = latestSession.sourceContext?.source || 'unknown';
      const branch = latestSession.sourceContext?.githubRepoContext?.startingBranch || 'unknown';

      // Sort session IDs to ensure a consistent order
      const sortedSessionIds = sessions.map(s => s.id).sort();

      // Combine job name and sorted session IDs to create a stable hash
      // Optimized to avoid creating a large string allocation
      let hash = 0;

      // Hash jobName
      for (let i = 0; i < jobName.length; i++) {
        const char = jobName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }

      // Hash sortedSessionIds incrementally
      for (const id of sortedSessionIds) {
        // Add separator '-'
        hash = ((hash << 5) - hash) + 45; // 45 is char code for '-'
        hash |= 0;

        for (let i = 0; i < id.length; i++) {
          const char = id.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash |= 0;
        }
      }

      let slug = jobName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (!slug) {
        slug = Array.from(new TextEncoder().encode(jobName)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return {
        id: `dynamic-${slug}-${Math.abs(hash).toString(36)}`,
        name: jobName,
        sessionIds: sessions.map(s => s.id),
        createdAt: latestSession.createTime || new Date().toISOString(),
        repo: repo,
        branch: branch,
      };
    });
}

/**
 * Checks if data has changed between two arrays of objects.
 * Uses `updateTime` for fast comparison if available and valid (string).
 * Falls back to deep equality (via JSON.stringify) otherwise.
 *
 * Note: If `updateTime` matches, it assumes the object is unchanged.
 * This works well for server-synced entities but may miss local client-side mutations
 * that don't update the timestamp.
 */
export function hasDataChanged<T extends { id: string }>(
  prev: T[],
  next: T[]
): boolean {
  if (prev.length !== next.length) return true;

  const prevMap = new Map(prev.map(item => [item.id, item]));

  for (const item of next) {
    const prevItem = prevMap.get(item.id);
    if (!prevItem) return true;

    // Optimization: Use updateTime if available on both items
    // This avoids expensive JSON.stringify for large objects like Sessions
    if (
      'updateTime' in item &&
      'updateTime' in prevItem &&
      typeof (item as Record<string, unknown>).updateTime === 'string' &&
      typeof (prevItem as Record<string, unknown>).updateTime === 'string'
    ) {
      const itemTime = (item as Record<string, unknown>).updateTime;
      const prevTime = (prevItem as Record<string, unknown>).updateTime;
      if (itemTime !== prevTime) return true;
      // If timestamps match, we assume content is same.
      continue;
    }

    if (JSON.stringify(prevItem) !== JSON.stringify(item)) return true;
  }

  return false;
}
