
import type { Job, PredefinedPrompt } from '@/lib/types';

export interface Dao {
  getJobs(): Promise<Job[]>;
  addJob(job: Job): Promise<void>;
  getPredefinedPrompts(): Promise<PredefinedPrompt[]>;
  savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void>;
  getQuickReplies(): Promise<PredefinedPrompt[]>;
  saveQuickReplies(replies: PredefinedPrompt[]): Promise<void>;
  getGlobalPrompt(): Promise<string>;
  saveGlobalPrompt(prompt: string): Promise<void>;
}
