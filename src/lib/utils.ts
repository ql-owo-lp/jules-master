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

export function createDynamicJobs(groupedSessions: Map<string, Session[]>): Job[] {
  return Array.from(groupedSessions.entries())
    .filter(([, sessions]) => sessions.length > 0)
    .map(([jobName, sessions]) => {
      const repo = sessions[0].sourceContext?.source || 'unknown';
      const branch = sessions[0].sourceContext?.githubRepoContext?.startingBranch || 'unknown';
      const latestSession = sessions.reduce((latest, current) => {
        const latestTime = new Date(latest.createTime || 0);
        const currentTime = new Date(current.createTime || 0);

        if (isNaN(currentTime.getTime())) return latest;
        if (isNaN(latestTime.getTime())) return current;

        return currentTime > latestTime ? current : latest;
      }, sessions[0]);

      const createdAtTime = new Date(latestSession.createTime || 0);
      const createdAt = isNaN(createdAtTime.getTime())
        ? new Date().toISOString()
        : latestSession.createTime!;

      // Combine timestamp and a random string to ensure the ID is unique
      const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
      return {
        id: `dynamic-${jobName}-${uniqueSuffix}`,
        name: jobName,
        sessionIds: sessions.map(s => s.id),
        createdAt: createdAt,
        repo: repo,
        branch: branch,
      };
    });
}
