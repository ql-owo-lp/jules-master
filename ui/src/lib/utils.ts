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
    const prompt = session.prompt || '';

    // Optimization: avoid slow RegExp on every session
    if (prompt.startsWith('[TOPIC]: # (')) {
      const newlineIndex = prompt.indexOf('\n');
      const firstLine = newlineIndex !== -1 ? prompt.substring(0, newlineIndex) : prompt;

      const endParenIndex = firstLine.lastIndexOf(')');
      if (endParenIndex !== -1 && endParenIndex > 12) {
        const jobName = firstLine.substring(12, endParenIndex).trim();
        if (!groupedSessions.has(jobName)) {
          groupedSessions.set(jobName, []);
        }
        groupedSessions.get(jobName)!.push(session);
        return;
      }
    }

    remainingUnknown.push(session);
  });

  return { groupedSessions, remainingUnknown };
}

export function createDynamicJobs(groupedSessions: Map<string, Session[]>): Job[] {
  return Array.from(groupedSessions.entries())
    .filter(([, sessions]) => sessions.length > 0)
    .map(([jobName, sessions]) => {
      const latestSession = sessions.reduce((latest, current) => {
        // Optimization: ISO 8601 strings can be safely compared lexicographically.
        // This avoids expensive Date parsing in a hot loop when processing many sessions.
        const latestTime = latest.createTime || "";
        const currentTime = current.createTime || "";

        // Fast path: if both are strings of reasonable length and match basic ISO structure
        // checking the first char is '2' avoids trying to parse things like "invalid-date"
        if (latestTime.length > 10 && currentTime.length > 10 && latestTime.startsWith('2') && currentTime.startsWith('2')) {
           return currentTime > latestTime ? current : latest;
        }

        const latestTimeObj = new Date(latestTime || 0);
        const currentTimeObj = new Date(currentTime || 0);

        if (isNaN(latestTimeObj.getTime())) return current;
        if (isNaN(currentTimeObj.getTime())) return latest;

        return currentTimeObj > latestTimeObj ? current : latest;
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
 * Deep equality check for two values.
 * Handles primitives, arrays, objects, and Dates.
 * Optimized to avoid string allocations unlike JSON.stringify.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }

  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Checks if data has changed between two arrays of objects.
 * Uses `updateTime` for fast comparison if available and valid (string).
 * Falls back to deep equality otherwise.
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

  // Fast path: Check for identical order
  // Most polling updates return data in the same order (e.g. by creation time),
  // so we can avoid creating the Map in the common case.
  let reordered = false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id) {
      reordered = true;
      break;
    }

    const prevItem = prev[i];
    const item = next[i];

    // Optimization: Use updateTime if available on both items
    // This avoids expensive deep comparison for large objects like Sessions
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

    if (!deepEqual(prevItem, item)) return true;
  }

  if (!reordered) return false;

  const prevMap = new Map(prev.map(item => [item.id, item]));

  for (const item of next) {
    const prevItem = prevMap.get(item.id);
    if (!prevItem) return true;

    // Optimization: Use updateTime if available on both items
    // This avoids expensive deep comparison for large objects like Sessions
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

    if (!deepEqual(prevItem, item)) return true;
  }

  return false;
}
