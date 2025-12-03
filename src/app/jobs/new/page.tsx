"use client";

import React, { useState, useEffect } from "react";
import { NewJobDialog } from "@/components/new-job-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewJobPage() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="space-y-8 px-4 sm:px-6 lg:px-8">
          {!isClient ? (
             <div className="space-y-8">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : (
            <>
              {!apiKey && (
                <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                  <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle>API Key Not Set</AlertTitle>
                  <AlertDescription>
                    Please set your Jules API key in the settings menu to create jobs.
                  </AlertDescription>
                </Alert>
              )}
               {apiKey && <NewJobDialog isPage />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

    