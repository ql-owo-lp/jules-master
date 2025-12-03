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
    return Array.from(groupedSessions.entries()).map(([jobName, sessions]) => {
      const latestSession = sessions.reduce((latest, current) => {
         return (new Date(current.createTime || 0) > new Date(latest.createTime || 0)) ? current : latest;
      }, sessions[0]);
      const repo = latestSession.sourceContext?.source || 'unknown';
      const branch = latestSession.sourceContext?.githubRepoContext?.startingBranch || 'unknown';

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
