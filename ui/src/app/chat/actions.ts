'use server';

import { chatClient } from "@/lib/grpc-client";
import { ChatConfig, ChatMessage } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForMocks = globalThis as unknown as { MOCK_CHAT_MESSAGES: ChatMessage[] };
const MOCK_CHAT_MESSAGES: ChatMessage[] = globalForMocks.MOCK_CHAT_MESSAGES || [];
globalForMocks.MOCK_CHAT_MESSAGES = MOCK_CHAT_MESSAGES;

// Helper to map gRPC message to our type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapChatMessage(m: any): ChatMessage {
  return {
    id: m.getId(),
    jobId: m.getJobId(),
    sender: m.getSenderName(),
    role: m.getIsHuman() ? 'user' : 'agent',
    content: m.getContent(),
    createdAt: m.getCreatedAt(),
    recipient: m.getRecipient(),
  };
}

export async function createChatConfig(jobId: string, agentName: string): Promise<ChatConfig> {
  const client = chatClient;
  return new Promise((resolve, reject) => {
    if (process.env.MOCK_API === 'true') {
        const config: ChatConfig = {
            jobId,
            agentName,
            apiKey: `mock-key-${crypto.randomUUID()}`,
            createdAt: new Date().toISOString()
        };
        return resolve(config);
    }

    client.createChatConfig({ jobId, agentName }, (err: any, response: any) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          jobId: response.getJobId(),
          agentName: response.getAgentName(),
          apiKey: response.getApiKey(),
          createdAt: response.getCreatedAt(),
        });
      }
    });
  });
}

export async function sendChatMessage(jobId: string, content: string, isHuman: boolean, senderName: string, recipient?: string): Promise<void> {
  const client = chatClient;
  return new Promise((resolve, reject) => {
    if (process.env.MOCK_API === 'true') {
         const msg: ChatMessage = {
             id: crypto.randomUUID(),
             jobId,
             content,
             role: isHuman ? 'user' : 'agent',
             sender: senderName,
             recipient,
             createdAt: new Date().toISOString()
         };
         MOCK_CHAT_MESSAGES.push(msg);
         return resolve();
    }

    client.sendChatMessage({
      jobId,
      content,
      isHuman,
      senderName,
      apiKey: '', // Not needed for human
      recipient: recipient || ""
    }, (err: any, response: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function listChatMessages(jobId: string, since?: string, limit?: number): Promise<ChatMessage[]> {
  const client = chatClient;
  return new Promise((resolve, reject) => {
    if (process.env.MOCK_API === 'true') {
        const messages = MOCK_CHAT_MESSAGES.filter(m => m.jobId === jobId);
        // Implement simple since filtering if needed, but for E2E usually not critical unless testing poller
        // For polling, we might want to respect 'since' if we want to simulate incremental updates,
        // but for now, returning all for the job is simpler and safe for small tests.
        return resolve(messages);
    }

    client.listChatMessages({
      jobId,
      since: since || "",
      limit: limit || 50,
      viewerName: "" // Default to empty (admin/all) or handle properly if we want to filter for human
    }, (err: any, response: any) => {
      if (err) {
        reject(err);
      } else {
        const messages = response.getMessagesList().map(mapChatMessage);
        resolve(messages);
      }
    });
  });
}
