
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { profiles, jobs, cronJobs, sessions } from '@/lib/db/schema';

export type Profile = InferSelectModel<typeof profiles>;
export type NewProfile = InferInsertModel<typeof profiles>;

export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;

export type CronJob = InferSelectModel<typeof cronJobs>;
export type NewCronJob = InferInsertModel<typeof cronJobs>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
