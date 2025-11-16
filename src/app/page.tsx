"use client";

import { useState, useEffect, useTransition } from "react";
import { Header } from "@/components/header";
import { JobCreationForm } from "@/components/job-creation-form";
import { SessionList } from "@/components/session-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, JobStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listSessions } from "./sessions/actions";
import { useToast } from "@/hooks/use-toast";


export default function Home() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, startFetching] = useTransition();
  const { toast } = useToast();

  const fetchSessions = () => {
    if (!apiKey) return;
    startFetching(async () => {
      const fetchedSessions = await listSessions(apiKey);
      setSessions(fetchedSessions);
      setLastUpdatedAt(new Date());
    });
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch sessions on initial load (if apiKey is present)
  useEffect(() => {
    if (isClient && apiKey) {
      fetchSessions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKey]);


  const handleSessionsCreated = (newSessions: Session[]) => {
    // Add new sessions to the top and refetch the list to get latest status
    setSessions((prevSessions) => [...newSessions, ...prevSessions]);
    fetchSessions();
  };

  const handleRefresh = () => {
    fetchSessions();
    toast({
      title: "Refreshing sessions...",
      description: "Fetching the latest session data.",
    });
  };

  if (!isClient) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="bg-card border-b">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="container mx-auto max-w-4xl space-y-8">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl space-y-8">
          {!apiKey && (
            <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>API Key Not Set</AlertTitle>
              <AlertDescription>
                Please set your Jules API key in the settings menu (top right
                corner) to create and view sessions.
              </AlertDescription>
            </Alert>
          )}
          <JobCreationForm
            onJobsCreated={handleSessionsCreated}
            disabled={!apiKey}
          />
          <SessionList
            sessions={sessions}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={handleRefresh}
            isRefreshing={isFetching}
          />
        </div>
      </main>
    </div>
  );
}
