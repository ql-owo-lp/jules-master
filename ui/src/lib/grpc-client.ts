import { credentials, Metadata } from '@grpc/grpc-js';
import { 
    SettingsServiceClient, 
    ProfileServiceClient, 
    LogServiceClient, 
    CronJobServiceClient,
    JobServiceClient,
    PromptServiceClient,
    SessionServiceClient,
    ChatServiceClient
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

function safeCreateClient<T>(ClientClass: new (target: string, creds: any) => T, name: string): T {
    try {
        return new ClientClass(TARGET, creds);
    } catch (error) {
        console.warn(`Failed to create ${name} gRPC client:`, error);
        // Return a proxy that throws on access to help debugging at runtime if needed,
        // or just a mock that allows build to pass if it's just import side-effects.
        return new Proxy({}, {
            get: (_target, prop) => {
                console.warn(`Accessing ${String(prop)} on failed ${name} client`);
                return () => { throw new Error(`${name} client failed to initialize`); }
            }
        }) as T;
    }
}

export const settingsClient = safeCreateClient(SettingsServiceClient, 'SettingsServiceClient');
export const profileClient = safeCreateClient(ProfileServiceClient, 'ProfileServiceClient');
export const logClient = safeCreateClient(LogServiceClient, 'LogServiceClient');
export const cronJobClient = safeCreateClient(CronJobServiceClient, 'CronJobServiceClient');
export const jobClient = safeCreateClient(JobServiceClient, 'JobServiceClient');
export const promptClient = safeCreateClient(PromptServiceClient, 'PromptServiceClient');
export const sessionClient = safeCreateClient(SessionServiceClient, 'SessionServiceClient');
export const chatClient = safeCreateClient(ChatServiceClient, 'ChatServiceClient');
export function getChatClient() { return chatClient; }
