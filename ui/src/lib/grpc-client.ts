import * as grpc from '@grpc/grpc-js';
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

let cachedCreds: grpc.ChannelCredentials;
let cachedOptions: grpc.ClientOptions;

function getCredsAndOptions() {
    if (cachedCreds && cachedOptions) return { creds: cachedCreds, clientOptions: cachedOptions };

    cachedCreds = grpc.credentials.createInsecure();

    const interceptor = (options: grpc.InterceptorOptions, nextCall: grpc.NextCall) => {
        return new grpc.InterceptingCall(nextCall(options), {
            start: function (metadata: grpc.Metadata, listener: grpc.InterceptorListener, next: (metadata: grpc.Metadata, listener: grpc.InterceptorListener | grpc.ListenerBuilder) => void) {
                const token = process.env.JULES_INTERNAL_TOKEN;
                if (token) {
                    metadata.add('authorization', 'Bearer ' + token);
                }
                next(metadata, listener);
            }
        });
    };

    cachedOptions = {
        interceptors: [interceptor]
    };

    return { creds: cachedCreds, clientOptions: cachedOptions };
}

function createLazyClient<T extends object>(ClientClass: any): T {
    let instance: T | null = null;
    return new Proxy({} as T, {
        get(target, prop, receiver) {
            if (!instance) {
                const { creds, clientOptions } = getCredsAndOptions();
                instance = new ClientClass(TARGET, creds, clientOptions) as T;
            }
            const value = (instance as any)[prop];
            if (typeof value === 'function') {
                return value.bind(instance);
            }
            return value;
        }
    });
}

export const settingsClient = createLazyClient<SettingsServiceClient>(SettingsServiceClient);
export const profileClient = createLazyClient<ProfileServiceClient>(ProfileServiceClient);
export const logClient = createLazyClient<LogServiceClient>(LogServiceClient);
export const cronJobClient = createLazyClient<CronJobServiceClient>(CronJobServiceClient);
export const jobClient = createLazyClient<JobServiceClient>(JobServiceClient);
export const promptClient = createLazyClient<PromptServiceClient>(PromptServiceClient);
export const sessionClient = createLazyClient<SessionServiceClient>(SessionServiceClient);
export const chatClient = createLazyClient<ChatServiceClient>(ChatServiceClient);
export function getChatClient() { return chatClient; }
