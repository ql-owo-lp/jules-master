
import type { Job, PredefinedPrompt } from './types';

export interface Dao {
  // Jobs
  getJobs(): Promise<Job[]>;
  addJob(job: Job): Promise<void>;

  // Predefined Prompts
  getPredefinedPrompts(): Promise<PredefinedPrompt[]>;
  savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void>;

  // Quick Replies
  getQuickReplies(): Promise<PredefinedPrompt[]>;
  saveQuickReplies(replies: PredefinedPrompt[]): Promise<void>;

  // Global Prompt
  getGlobalPrompt(): Promise<string>;
  saveGlobalPrompt(prompt: string): Promise<void>;
}
