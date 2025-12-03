
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Session, Job } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getPullRequestUrls = (session: Session): string[] => {
  const urls: string[] = [];
  if (session.outputs && session.outputs.length > 0) {
    for (const output of session.outputs) {
      if (output.pullRequest?.url) {
        urls.push(output.pullRequest.url);
      }
    }
  }
  return urls;
};

// It is a lib function
export const groupSessionsByTopic = (
  sessions: Session[],
): {
  groupedSessions: Map<string, Session[]>;
  remainingUnknown: Session[];
} => {
  const groupedSessions = new Map<string, Session[]>();
  const remainingUnknown: Session[] = [];

  sessions.forEach(session => {
    if (session.prompt) {
      const match = session.prompt.match(/\[TOPIC\]: # \((.+)\)/);
      if (match && match[1]) {
        const topic = match[1];
        if (!groupedSessions.has(topic)) {
          groupedSessions.set(topic, []);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        groupedSessions.get(topic)!.push(session);
      } else {
        remainingUnknown.push(session);
      }
    } else {
      remainingUnknown.push(session);
    }
  });

  return { groupedSessions, remainingUnknown };
};

// It is a lib function
export const createDynamicJobs = (
  groupedSessions: Map<string, Session[]>,
): Job[] => {
  return Array.from(groupedSessions.entries()).map(([topic, sessions]) => {
    const sortedSessions = [...sessions].sort((a, b) => {
      if (!a.createTime) return 1;
      if (!b.createTime) return -1;
      return (
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      );
    });

    const latestSession = sortedSessions[0];
    const repo = latestSession?.sourceContext?.source ?? 'unknown';
    const branch =
      (latestSession?.sourceContext as any)?.githubRepoContext
        ?.startingBranch ?? 'unknown';

    return {
      id: `dynamic-${topic}`,
      name: topic,
      repo,
      branch,
      status: 'COMPLETED',
      sessionIds: sortedSessions.map(s => s.id),
      createdAt: latestSession?.createTime ?? new Date().toISOString(),
    };
  });
};
