
"use server";

import type { Session, Activity } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { fetchWithRetry } from "@/lib/fetch-client";
import { updateSessionInCache } from "@/lib/session-cache";

type ListActivitiesResponse = {
  activities: Activity[];
  nextPageToken?: string;
};

export async function getSession(
  sessionId: string,
  apiKey?: string | null
): Promise<Session | null> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return null;
  }
  try {
    const response = await fetchWithRetry(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}`,
      {
        headers: {
          "X-Goog-Api-Key": effectiveApiKey,
        },
        cache: "no-store", // Always fetch latest for session details
      }
    );
    if (!response.ok) {
      console.error(
        `Failed to fetch session: ${response.status} ${response.statusText}`
      );
      return null;
    }
    const session: Session = await response.json();
    return session;
  } catch (error) {
    console.error("Error fetching session:", error);
    return null;
  }
}

export async function listActivities(
  sessionId: string,
  apiKey?: string | null
): Promise<Activity[]> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return [];
  }
  try {
    const response = await fetchWithRetry(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}/activities`,
      {
        headers: {
          "X-Goog-Api-Key": effectiveApiKey,
        },
        cache: "no-store",
      }
    );
    if (!response.ok) {
      console.error(
        `Failed to fetch activities: ${response.status} ${response.statusText}`
      );
      const errorBody = await response.text();
      console.error("Error body:", errorBody);
      return [];
    }
    const data: ListActivitiesResponse = await response.json();
    return data.activities || [];
  } catch (error) {
    console.error("Error fetching activities:", error);
    return [];
  }
}


export async function approvePlan(
  sessionId: string,
  apiKey?: string | null
): Promise<Session | null> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return null;
  }
  try {
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}:approvePlan`,
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": effectiveApiKey,
        },
      }
    );
    if (!response.ok) {
        console.error(
            `Failed to approve plan: ${response.status} ${response.statusText}`
        );
        const errorBody = await response.text();
        console.error("Error body:", errorBody);
      return null;
    }
    const updatedSession: Session = await response.json();

    // Update cache
    await updateSessionInCache(updatedSession);

    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/`);
    return updatedSession;
  } catch (error) {
    console.error("Error approving plan:", error);
    return null;
  }
}

export async function sendMessage(
  sessionId: string,
  message: string,
  apiKey?: string | null
): Promise<Session | null> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return null;
  }
  try {
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}:sendMessage`,
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": effectiveApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: message }),
      }
    );
     if (!response.ok) {
        console.error(
            `Failed to send message: ${response.status} ${response.statusText}`
        );
        const errorBody = await response.text();
        console.error("Error body:", errorBody);
      return null;
    }
    const updatedSession: Session = await response.json();

    // Update cache
    await updateSessionInCache(updatedSession);

    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/`);
    return updatedSession;
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
}
