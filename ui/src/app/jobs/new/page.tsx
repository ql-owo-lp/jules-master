
"use client";

import React, { useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Terminal } from "lucide-react";
import { useEnv } from "@/components/env-provider";
import { NewJobDialog } from "@/components/new-job-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function NewJobPage() {
  const env = useEnv();
  const [currentProfileId] = useLocalStorage<string>("jules-current-profile-id", "default");
  const [apiKey] = useLocalStorage<string | null>(`jules-api-key-${currentProfileId}`, null);
  
  // No isClient check here to avoid getting stuck in skeleton state
  // Next.js will handle the hydration
  const hasJulesApiKey = env?.hasJulesApiKey || false;
  const hasKey = !!(apiKey || hasJulesApiKey);

  return (
    <div className="flex flex-col flex-1 bg-background" data-testid="new-job-page">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8" data-testid="new-job-content">
        <div className="space-y-8 px-4 sm:px-6 lg:px-8">
          {!hasKey ? (
            <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>API Key Not Set</AlertTitle>
              <AlertDescription>
                You need a Jules API key to create new jobs. Please set it in the settings menu or provide it via environment variable.
              </AlertDescription>
            </Alert>
          ) : (
            <NewJobDialog isPage />
          )}
        </div>
      </main>
    </div>
  );
}