"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { JobCreationForm } from "@/components/job-creation-form";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


export default function NewSessionPage() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const router = useRouter();
  const { toast } = useToast();


  const handleSessionsCreated = (newSessions: Session[]) => {
    toast({
      title: "Sessions submitted!",
      description: `${newSessions.length} new session(s) have been created.`,
    });
    router.push('/');
  };


  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl space-y-8">
          {!apiKey && (
            <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>API Key Not Set</AlertTitle>
              <AlertDescription>
                Please set your Jules API key in the settings menu to create sessions.
              </AlertDescription>
            </Alert>
          )}
          <JobCreationForm
            onJobsCreated={handleSessionsCreated}
            disabled={!apiKey}
            apiKey={apiKey}
          />
        </div>
      </main>
    </div>
  );
}
