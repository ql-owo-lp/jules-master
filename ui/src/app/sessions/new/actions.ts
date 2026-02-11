
"use server";

import type { Session, AutomationMode } from "@/lib/types";
import { fetchWithRetry } from "@/lib/fetch-client";
import { createSessionSchema } from "@/lib/validation";

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
  apiKey?: string | null,
  profileId: string = "default"
): Promise<Session | null> {
  if (process.env.MOCK_API === 'true') {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     const globalForMocks = globalThis as unknown as { MOCK_SESSIONS: Session[] };
     const sessions = globalForMocks.MOCK_SESSIONS || [];

     const newSession: Session = {
        id: crypto.randomUUID(),
        name: `sessions/${crypto.randomUUID()}`,
        title: sessionData.title || 'New Mock Session',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        state: 'CREATED',
        prompt: sessionData.prompt,
        sourceContext: sessionData.sourceContext,
        profileId,
        url: '',
        lastUpdated: Date.now(),
        lastInteractionAt: Date.now(),
        retryCount: 0,
        lastError: '',
        requirePlanApproval: sessionData.requirePlanApproval ?? false,
        automationMode: sessionData.automationMode || 'AUTOMATION_MODE_UNSPECIFIED',
     };
     sessions.push(newSession);
     return newSession;
  }

  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return null;
  }

  const validation = createSessionSchema.safeParse(sessionData);

  if (!validation.success) {
    console.error("Invalid session data:", validation.error);
    return null;
  }

  const validatedData = validation.data;
  
  // Cast validatedData to match CreateSessionBody type mostly for TS happiness,
  // though Zod ensures runtime correctness.
  // We use validatedData to construct the body.
  const body: Partial<CreateSessionBody> = { ...validatedData } as unknown as Partial<CreateSessionBody>;

  if (!validatedData.requirePlanApproval) {
    delete body.requirePlanApproval;
  }
  // Delete these fields as they are not supported by the Jules API
  delete body.autoContinueEnabled;
  delete body.autoRetryEnabled;


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

    // Ensure ID is populated from name if missing
    if (!newSession.id && newSession.name) {
      const parts = newSession.name.split('/');
      if (parts.length > 1) {
        newSession.id = parts[parts.length - 1];
      }
    }

    newSession.profileId = profileId;
    return newSession;
  } catch (error) {
    console.error("Error creating session:", error);
    return null;
  }
}
