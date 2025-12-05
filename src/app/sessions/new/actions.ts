
"use server";

import type { Session, AutomationMode } from "@/lib/types";
import { fetchWithRetry } from "@/lib/fetch-client";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// The partial session type for the create request body
type CreateSessionBody = Pick<Session, "prompt" | "sourceContext"> & {
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
  autoContinueEnabled?: boolean;
  autoRetryEnabled?: boolean;
  profileId?: string; // Add profileId
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
  
  // Extract profileId to avoid sending it to external API
  const { profileId, ...requestData } = sessionData;

  const body: Partial<Omit<CreateSessionBody, 'profileId'>> = { ...requestData };
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

    // We need to associate the new session with the profile in our local DB.
    // However, session sync might happen via other means (e.g., polling).
    // If the polling logic fetches sessions from API and inserts them into DB,
    // it won't know about the profileId unless we store it now or map it somehow.
    // BUT, the polling logic usually matches sessions by ID.
    // If we insert it here with profileId, subsequent updates should respect it.

    // Check if session service handles creation. Currently `createSession` just calls API.
    // We should probably insert into DB here to establish profile ownership.

    if (profileId && newSession.id) {
         try {
             // We insert a placeholder or the session data into our DB with the profileId.
             // The fields match schema.sessions.
             await db.insert(sessions).values({
                 id: newSession.id,
                 name: newSession.name,
                 title: newSession.title,
                 prompt: newSession.prompt,
                 sourceContext: newSession.sourceContext,
                 createTime: newSession.createTime,
                 updateTime: newSession.updateTime,
                 state: newSession.state,
                 url: newSession.url,
                 outputs: newSession.outputs,
                 requirePlanApproval: newSession.requirePlanApproval,
                 automationMode: newSession.automationMode,
                 lastUpdated: Date.now(),
                 profileId: profileId
             });
         } catch (dbError) {
             console.error("Failed to save session with profileId to DB:", dbError);
             // Verify if it failed because it already exists (unlikely for new session)
         }
    }

    return newSession;
  } catch (error) {
    console.error("Error creating session:", error);
    return null;
  }
}
