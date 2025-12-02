
import type { Session, AutomationMode, Source } from "@/lib/types";

export type BackgroundJob = {
  id: string;
  type: 'CREATE_SESSION';
  data: {
    title: string;
    prompt: string;
    source: Source;
    branch: string;
    requirePlanApproval: boolean;
    automationMode: AutomationMode;
    apiKey: string;
    jobId: string; // The parent job ID
  };
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  retries: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  nextRetryAt?: number;
};
