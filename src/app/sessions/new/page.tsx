
"use client";

import { NewJobDialog } from "@/components/new-job-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function NewJobPage() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");

  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl space-y-8">
          {!apiKey && (
            <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>API Key Not Set</AlertTitle>
              <AlertDescription>
                Please set your Jules API key in the settings menu to create jobs.
              </AlertDescription>
            </Alert>
          )}
          <NewJobDialog isPage />
        </div>
      </main>
    </div>
  );
}

    