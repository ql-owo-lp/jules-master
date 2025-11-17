
"use client";

import { useState, useEffect, useTransition, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SessionList } from "@/components/session-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, Job, State } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listSessions, revalidateSessions } from "./sessions/actions";
import { approvePlan } from "./sessions/[id]/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

function HomePageContent() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [githubToken] = useLocalStorage<string>("jules-github-token", "");
  const [idlePollInterval] = useLocalStorage<number>("jules-idle-poll-interval", 120);
  const [jobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(idlePollInterval);
  const [titleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);

  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdParam = searchParams.get("jobId");

  const [jobFilter, setJobFilter] = useState<string | null>(jobIdParam);
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');


  // Effect to sync job filter with URL param
  useEffect(() => {
    setJobFilter(jobIdParam);
  }, [jobIdParam]);

  
  const filteredJob = jobFilter ? jobs.find(j => j.id === jobFilter) : null;

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const job = jobs.find(j => j.sessionIds.includes(s.id));
      
      const jobMatch = !jobFilter || (job && job.id === jobFilter);
      const repoMatch = repoFilter === 'all' || (job && job.repo === repoFilter);
      const statusMatch = statusFilter === 'all' || s.state === statusFilter;

      return jobMatch && repoMatch && statusMatch;
    });
  }, [sessions, jobs, jobFilter, repoFilter, statusFilter]);
  

  const fetchSessions = useCallback(async () => {
    if (!apiKey) return;
    startFetching(async () => {
      // Invalidate the cache first
      await revalidateSessions();
      // Then fetch the latest data
      const fetchedSessions = await listSessions(apiKey);
      const validSessions = fetchedSessions.filter(s => s);
      setSessions(validSessions);
      setLastUpdatedAt(new Date());
      setCountdown(idlePollInterval);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, idlePollInterval]);

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
        setCountdown(idlePollInterval);
      });

      const intervalInMs = idlePollInterval * 1000;
      if (intervalInMs > 0) {
        const intervalId = setInterval(fetchSessions, intervalInMs);
        return () => clearInterval(intervalId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKey, idlePollInterval, fetchSessions]);
  

  // Countdown timer
  useEffect(() => {
    if (!isClient || !apiKey || idlePollInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isClient, apiKey, idlePollInterval, lastUpdatedAt]);


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

  const handleClearFilters = () => {
    onJobFilterChange(null);
    onRepoFilterChange('all');
    onStatusFilterChange('all');
    router.push('/');
  }

  const onJobFilterChange = (value: string | null) => {
    setJobFilter(value);
    const newParams = new URLSearchParams(searchParams.toString());
    if (value) {
      newParams.set('jobId', value);
    } else {
      newParams.delete('jobId');
    }
    router.push(`?${newParams.toString()}`);
  }

  const onRepoFilterChange = (value: string) => setRepoFilter(value);
  const onStatusFilterChange = (value: string) => setStatusFilter(value);
  
  const uniqueRepos = useMemo(() => ['all', ...Array.from(new Set(jobs.map(j => j.repo)))], [jobs]);
  const uniqueJobNames = useMemo(() => ['all', ...Array.from(new Set(jobs.map(j => j.id)))], [jobs]);
  const uniqueStatuses = useMemo(() => ['all', ...Array.from(new Set(sessions.map(s => s.state).filter((s): s is State => !!s)))], [sessions]);
  const jobMap = useMemo(() => new Map(jobs.map(j => [j.id, j.name])), [jobs]);
  const isAnyFilterActive = jobFilter || repoFilter !== 'all' || statusFilter !== 'all';

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
           {!githubToken && (
            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
              <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle>GitHub Token Not Set</AlertTitle>
              <AlertDescription>
                To see pull request statuses, please set your GitHub Personal Access Token in the settings menu.
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
            pollInterval={idlePollInterval}
            titleTruncateLength={titleTruncateLength}
            jobFilter={jobFilter}
            githubTokenSet={!!githubToken}
          >
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="filter-repo">Repository</Label>
                <Select value={repoFilter} onValueChange={onRepoFilterChange}>
                  <SelectTrigger id="filter-repo">
                    <SelectValue placeholder="Filter by repository..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueRepos.map((repo, index) => (
                      <SelectItem key={`${repo}-${index}`} value={repo}>{repo === 'all' ? 'All Repositories' : repo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-status">Session Status</Label>
                <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                  <SelectTrigger id="filter-status">
                    <SelectValue placeholder="Filter by status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueStatuses.map((status, index) => (
                      <SelectItem key={`${status}-${index}`} value={status}>{status === 'all' ? 'All Statuses' : status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-job">Job Name</Label>
                <Select value={jobFilter || 'all'} onValueChange={(value) => onJobFilterChange(value === 'all' ? null : value)}>
                  <SelectTrigger id="filter-job">
                    <SelectValue placeholder="Filter by job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueJobNames.map((jobId, index) => (
                      <SelectItem key={`${jobId}-${index}`} value={jobId}>{jobId === 'all' ? 'All Jobs' : jobMap.get(jobId) || jobId}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isAnyFilterActive && (
              <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-4">
                  <X className="mr-2 h-4 w-4" />
                  Clear All Filters
              </Button>
            )}
          </SessionList>
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
