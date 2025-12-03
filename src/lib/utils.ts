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
    const match = firstLine.match(/^\[TOPIC\]: # \((.+)\)$/);
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

// A simple hash function to generate a deterministic ID from a string.
// Not for cryptographic use.
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function createDynamicJobs(groupedSessions: Map<string, Session[]>): Job[] {
  return Array.from(groupedSessions.entries())
    .filter(([, sessions]) => sessions.length > 0)
    .map(([jobName, sessions]) => {
      const repo = sessions[0].sourceContext?.source || 'unknown';
      const branch = sessions[0].sourceContext?.githubRepoContext?.startingBranch || 'unknown';
      const latestSession = sessions.reduce((latest, current) => {
        const latestTime = new Date(latest.createTime || 0);
        const currentTime = new Date(current.createTime || 0);

        if (isNaN(latestTime.getTime())) return current;
        if (isNaN(currentTime.getTime())) return latest;

        return currentTime > latestTime ? current : latest;
      }, sessions[0]);

      // Generate a deterministic ID based on the job name and session IDs
      const sessionIds = sessions.map(s => s.id).sort();
      const idSource = `${jobName}:${sessionIds.join(',')}`;
      // Using a simple hash function for deterministic ID generation.
      const hashedId = simpleHash(idSource);

      return {
        // Using jobName in the ID for readability and to avoid collisions.
        id: `dynamic-${jobName.replace(/\s+/g, '-')}-${hashedId}`,
        name: jobName,
        sessionIds: sessions.map(s => s.id),
        createdAt: latestSession.createTime || new Date().toISOString(),
        repo: repo,
        branch: branch,
      };
    });
}
