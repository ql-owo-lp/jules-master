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
      const jobName = match[1];
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
      const repo = sessions[0].sourceContext?.source || 'unknown';
      const branch = sessions[0].sourceContext?.githubRepoContext?.startingBranch || 'unknown';
      const latestSession = sessions.reduce((latest, current) => {
        const latestTime = new Date(latest.createTime || 0);
        const currentTime = new Date(current.createTime || 0);

        if (isNaN(latestTime.getTime())) return current;
        if (isNaN(currentTime.getTime())) return latest;

        return currentTime > latestTime ? current : latest;
      }, sessions[0]);

      return {
        id: `dynamic-${jobName}`,
        name: jobName,
        sessionIds: sessions.map(s => s.id),
        createdAt: latestSession.createTime || new Date().toISOString(),
        repo: repo,
        branch: branch,
      };
    });
}
