"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { SessionList } from "@/components/session-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listSessions } from "./sessions/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [pollInterval] = useLocalStorage<number>("jules-poll-interval", 120);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, startFetching] = useTransition();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(pollInterval);


  const fetchSessions = () => {
    if (!apiKey) return;
    startFetching(async () => {
      const fetchedSessions = await listSessions(apiKey);
      // Filter out any sessions that might be null or undefined from the API response
      const validSessions = fetchedSessions.filter(s => s);
      setSessions(validSessions);
      setLastUpdatedAt(new Date());
      setCountdown(pollInterval);
    });
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!isClient || !apiKey || pollInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isClient, apiKey, pollInterval]);

  // Fetch sessions on initial load and set up polling
  useEffect(() => {
    if (isClient && apiKey) {
      fetchSessions(); // Initial fetch

      const intervalInMs = pollInterval * 1000;
      if (intervalInMs > 0) {
        const intervalId = setInterval(fetchSessions, intervalInMs);
        return () => clearInterval(intervalId); // Cleanup on unmount
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKey, pollInterval]);


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
            <Skeleton className="h-96 w-full" />
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
            sessions={sessions}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={handleRefresh}
            isRefreshing={isFetching}
            countdown={countdown}
            pollInterval={pollInterval}
          />
        </div>
      </main>
       <div className="fixed bottom-8 right-8">
        <Button asChild size="lg" className="rounded-lg shadow-lg w-16 h-16 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/sessions/new">
            <Plus className="h-8 w-8" />
            <span className="sr-only">New Session</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
