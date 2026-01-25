import { credentials } from '@grpc/grpc-js';
import { 
    SettingsServiceClient, 
    ProfileServiceClient, 
    LogServiceClient, 
    CronJobServiceClient,
    JobServiceClient,
    PromptServiceClient,
    SessionServiceClient
} from '@/proto/jules';

const PORT = 50051;
// In production, this should be configurable
const TARGET = `127.0.0.1:${PORT}`;

const creds = credentials.createInsecure();

export const settingsClient = new SettingsServiceClient(TARGET, creds);
export const profileClient = new ProfileServiceClient(TARGET, creds);
export const logClient = new LogServiceClient(TARGET, creds);
export const cronJobClient = new CronJobServiceClient(TARGET, creds);
export const jobClient = new JobServiceClient(TARGET, creds);
export const promptClient = new PromptServiceClient(TARGET, creds);
export const sessionClient = new SessionServiceClient(TARGET, creds);
