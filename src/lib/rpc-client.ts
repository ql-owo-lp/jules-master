import { createChannel, createClient, Client } from 'nice-grpc';
import { JobServiceDefinition, SessionServiceDefinition, SettingsServiceDefinition } from './proto/jules';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const channel = createChannel(BACKEND_URL);

export const jobClient = createClient(JobServiceDefinition, channel);
export const sessionClient = createClient(SessionServiceDefinition, channel);
export const settingsClient = createClient(SettingsServiceDefinition, channel);
