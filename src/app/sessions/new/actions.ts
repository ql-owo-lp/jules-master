
"use server";

import type { Session, AutomationMode } from "@/lib/types";
import { fetchWithRetry } from "@/lib/fetch-client";

// The partial session type for the create request body
type CreateSessionBody = Pick<Session, "prompt" | "sourceContext"> & {
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
  autoContinueEnabled?: boolean;
  autoRetryEnabled?: boolean;
};

export async function createSession(
  sessionData: CreateSessionBody,
  apiKey?: string | null
): Promise<Session | null> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return null;
  }
  
  const body: Partial<CreateSessionBody> = { ...sessionData };
  if (!sessionData.requirePlanApproval) {
    delete body.requirePlanApproval;
  }
  if (!sessionData.autoContinueEnabled) {
    delete body.autoContinueEnabled;
  }
  if (!sessionData.autoRetryEnabled) {
    delete body.autoRetryEnabled;
  }

  // Check for mock flag
  if (process.env.MOCK_API === 'true') {
    const mockSession: Session = {
        name: `sessions/mock-${crypto.randomUUID()}`,
        id: `session-${crypto.randomUUID()}`,
        title: sessionData.title || 'Mock Created Session',
        state: 'WORKING',
        createTime: new Date().toISOString(),
        sourceContext: sessionData.sourceContext,
        prompt: sessionData.prompt,
    };
    return mockSession;
  }

  try {
    const response = await fetchWithRetry(
      "https://jules.googleapis.com/v1alpha/sessions",
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": effectiveApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Failed to create session: ${response.status} ${response.statusText}`,
        errorBody
      );
      return null;
    }

    const newSession: Session = await response.json();
    return newSession;
  } catch (error) {
    console.error("Error creating session:", error);
    return null;
  }
}
