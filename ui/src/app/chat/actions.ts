'use server';

import { chatClient } from "@/lib/grpc-client";
import { ChatConfig, ChatMessage } from "@/lib/types";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    client.sendChatMessage({
      jobId,
      content,
      isHuman,
      senderName,
      apiKey: '', // Not needed for human
      recipient: recipient || ""
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    }, (err: any, _response: any) => {
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
    client.listChatMessages({
      jobId,
      since: since || "",
      limit: limit || 50,
      viewerName: "User" // Identify as "User" to see messages for/from User, while respecting privacy of agent-to-agent messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
