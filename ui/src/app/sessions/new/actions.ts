
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
  apiKey?: string | null,
  profileId: string = "default"
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
