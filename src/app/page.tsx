
"use client";

import { useState, useEffect, useTransition, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SessionList } from "@/components/session-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, Job } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listSessions, revalidateSessions } from "./sessions/actions";
import { approvePlan } from "./sessions/[id]/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

function HomePageContent() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [pollInterval] = useLocalStorage<number>("jules-poll-interval", 120);
  const [jobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(pollInterval);
  const [titleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);

  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  
  const filteredJob = jobId ? jobs.find(j => j.id === jobId) : null;

  const filteredSessions = jobId 
    ? sessions.filter(s => filteredJob?.sessionIds.includes(s.id))
    : sessions;


  const fetchSessions = useCallback(() => {
    if (!apiKey) return;
    startFetching(async () => {
      // Invalidate the cache first
      await revalidateSessions();
      // Then fetch the latest data
      const fetchedSessions = await listSessions(apiKey);
      const validSessions = fetchedSessions.filter(s => s);
      setSessions(validSessions);
      setLastUpdatedAt(new Date());
      setCountdown(pollInterval);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, pollInterval]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initial fetch and set up polling interval
  useEffect(() => {
    if (isClient && apiKey) {
      // Fetch initial data (will use cache if available and not stale)
      startFetching(async () => {
        const fetchedSessions = await listSessions(apiKey);
        const validSessions = fetchedSessions.filter(s => s);
        setSessions(validSessions);
        setLastUpdatedAt(new Date());
        setCountdown(pollInterval);
      });

      const intervalInMs = pollInterval * 1000;
      if (intervalInMs > 0) {
        const intervalId = setInterval(fetchSessions, intervalInMs);
        return () => clearInterval(intervalId);
      }
    }
  }, [isClient, apiKey, pollInterval, fetchSessions]);
  

  // Countdown timer
  useEffect(() => {
    if (!isClient || !apiKey || pollInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isClient, apiKey, pollInterval, lastUpdatedAt]);


  const handleRefresh = () => {
    fetchSessions();
    toast({
      title: "Refreshing sessions...",
      description: "Fetching the latest session data.",
    });
  };

  const handleApprovePlan = (sessionId: string) => {
    startActionTransition(async () => {
      const result = await approvePlan(apiKey, sessionId);
       if (result) {
        // Refresh the list to show the updated status
        fetchSessions();
        toast({ title: "Plan Approved", description: "The session will now proceed." });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to approve plan",
        });
      }
    });
  };

  if (!isClient) {
    return (
      <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="container mx-auto max-w-4xl space-y-8">
             <div className="space-y-8">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-background">
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
          <SessionList
            sessions={filteredSessions}
            jobs={jobs}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={handleRefresh}
            isRefreshing={isFetching}
            isActionPending={isActionPending}
            onApprovePlan={handleApprovePlan}
            countdown={countdown}
            pollInterval={pollInterval}
            titleTruncateLength={titleTruncateLength}
            filteredJobName={filteredJob?.name}
          />
        </div>
      </main>
       <div className="fixed bottom-8 right-8">
        <Button asChild size="lg" className="rounded-lg shadow-lg w-16 h-16 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/jobs/new">
            <Plus className="h-8 w-8" />
            <span className="sr-only">New Job</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageContent />
    </Suspense>
  )
}
