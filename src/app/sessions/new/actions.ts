
"use server";

import type { Session, AutomationMode } from "@/lib/types";

// The partial session type for the create request body
type CreateSessionBody = Pick<Session, "prompt" | "sourceContext"> & {
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
};

function getApiKey(): string {
    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        throw new Error("JULES_API_KEY environment variable not set.");
    }
    return apiKey;
}

export async function createSession(
  sessionData: CreateSessionBody
): Promise<Session | null> {
  const apiKey = getApiKey();

  try {
    const response = await fetch(
      "https://jules.googleapis.com/v1alpha/sessions",
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionData),
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
