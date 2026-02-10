import { credentials, Metadata } from '@grpc/grpc-js';
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
const TARGET = `0.0.0.0:${PORT}`;

let creds = credentials.createInsecure();

const token = process.env.JULES_INTERNAL_TOKEN;
if (token) {
    const authCreds = credentials.createFromMetadataGenerator((args, callback) => {
        const metadata = new Metadata();
        metadata.add('authorization', 'Bearer ' + token);
        callback(null, metadata);
    });
    creds = credentials.combineChannelCredentials(creds, authCreds);
}

export const settingsClient = new SettingsServiceClient(TARGET, creds);
export const profileClient = new ProfileServiceClient(TARGET, creds);
export const logClient = new LogServiceClient(TARGET, creds);
export const cronJobClient = new CronJobServiceClient(TARGET, creds);
export const jobClient = new JobServiceClient(TARGET, creds);
export const promptClient = new PromptServiceClient(TARGET, creds);
export const sessionClient = new SessionServiceClient(TARGET, creds);
