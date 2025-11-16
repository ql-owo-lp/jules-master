export type JobStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed';

export type Job = {
  id: string;
  title: string;
  prompt: string;
  status: JobStatus;
  createdAt: string; // ISO string
};
