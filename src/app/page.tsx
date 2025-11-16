"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { JobCreationForm } from "@/components/job-creation-form";
import { SessionList } from "@/components/session-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, JobStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [pollInterval] = useLocalStorage<number>("jules-poll-interval", 5);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setIsClient(true);
    setLastUpdatedAt(new Date());
  }, []);

  const handleSessionsCreated = (newSessions: Session[]) => {
    setSessions((prevSessions) => [...newSessions, ...prevSessions]);
    setLastUpdatedAt(new Date());
  };

  const handleRefresh = () => {
    // In a real app, this would re-fetch sessions.
    // Here, we'll just update the timestamp.
    setLastUpdatedAt(new Date());
    // And we can re-trigger the status simulation for pending sessions
    // by creating a new array reference for the sessions state.
    setSessions(prevSessions => [...prevSessions]); 
  };

  // Effect to simulate session status progression
  useEffect(() => {
    if (pollInterval <= 0 || !isClient) return;

    const timers: NodeJS.Timeout[] = [];
    sessions.forEach((session) => {
      if (session.status === "Pending") {
        const timer1 = setTimeout(() => {
          setSessions((prevSessions) =>
            prevSessions.map((s) =>
              s.id === session.id ? { ...s, status: "Running" } : s
            )
          );
          setLastUpdatedAt(new Date());
        }, Math.random() * (pollInterval * 1000 * 0.6) + (pollInterval * 1000 * 0.2)); // Start running after 20-80% of interval
        timers.push(timer1);
      } else if (session.status === "Running") {
        const timer2 = setTimeout(() => {
          const newStatus: JobStatus =
            Math.random() > 0.2 ? "Succeeded" : "Failed";
          setSessions((prevSessions) =>
            prevSessions.map((s) =>
              s.id === session.id ? { ...s, status: newStatus } : s
            )
          );
          setLastUpdatedAt(new Date());
        }, Math.random() * (pollInterval * 1000) + (pollInterval * 1000 * 0.5)); // Finish after 50-150% of interval
        timers.push(timer2);
      }
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [sessions, pollInterval, isClient]);

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
                corner) to create sessions.
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
          />
        </div>
      </main>
    </div>
  );
}