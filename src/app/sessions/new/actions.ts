
"use server";

import type { Session, AutomationMode } from "@/lib/types";
import { fetchWithRetry } from "@/lib/fetch-client";

// The partial session type for the create request body
type CreateSessionBody = Pick<Session, "prompt" | "sourceContext"> & {
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
};

export async function createSession(
  sessionData: CreateSessionBody,
  apiKey?: string | null,
  throwOnError: boolean = false
): Promise<Session | null> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    if (throwOnError) throw new Error("Jules API key is not configured.");
    return null;
  }
  
  const body: Partial<CreateSessionBody> = { ...sessionData };
  if (!sessionData.requirePlanApproval) {
    delete body.requirePlanApproval;
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
      const errorMessage = `Failed to create session: ${response.status} ${response.statusText}`;
      console.error(
        errorMessage,
        errorBody
      );
      if (throwOnError) {
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).body = errorBody;
        throw error;
      }
      return null;
    }

    const newSession: Session = await response.json();
    return newSession;
  } catch (error: any) {
    console.error("Error creating session:", error);
    if (throwOnError) {
        throw error;
    }
    return null;
  }
}
