
"use server";

import type { Session, Activity } from "@/lib/types";
import { revalidatePath } from "next/cache";

type ListActivitiesResponse = {
  activities: Activity[];
  nextPageToken?: string;
};

export async function getSession(
  apiKey: string,
  sessionId: string
): Promise<Session | null> {
  if (!apiKey) {
    return null;
  }
  try {
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
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
  apiKey: string,
  sessionId: string
): Promise<Activity[]> {
  if (!apiKey) {
    return [];
  }
  try {
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}/activities`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
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
  apiKey: string,
  sessionId: string
): Promise<Session | null> {
  if (!apiKey) {
    return null;
  }
  try {
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}:approvePlan`,
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": apiKey,
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
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/`);
    return updatedSession;
  } catch (error) {
    console.error("Error approving plan:", error);
    return null;
  }
}

export async function sendMessage(
  apiKey: string,
  sessionId: string,
  message: string
): Promise<Session | null> {
  if (!apiKey) {
    return null;
  }
  try {
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions/${sessionId}:sendMessage`,
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": apiKey,
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
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/`);
    return updatedSession;
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
}
