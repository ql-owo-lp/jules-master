export type JobStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed';

// Based on the Jules API documentation for a Session
export type Session = {
  name: string; // e.g., "sessions/31415926535897932384"
  id: string;
  title: string;
  prompt: string;
  // This is a simplification. The real API has a complex sourceContext.
  source?: string;
  createdAt: string; // ISO string
  status: JobStatus; // This is a client-side concept for now to track progress
};
