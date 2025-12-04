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
      const idSource = `${jobName}-${sortedSessionIds.join('-')}`;

      // Basic hash function for uniqueness
      let hash = 0;
      for (let i = 0; i < idSource.length; i++) {
        const char = idSource.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
      }

      const slug = jobName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
