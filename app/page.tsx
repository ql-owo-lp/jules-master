

"use client";

import { useState, useEffect, useTransition, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SessionList } from "@/components/session-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, Job, State, PredefinedPrompt, PullRequestStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, X, Briefcase, GitMerge, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listSessions } from "@/app/sessions/actions";
import { approvePlan, sendMessage } from "@/app/sessions/[id]/actions";
import { getJobs } from "@/app/config/actions";
import { getPullRequestStatus } from "@/app/github/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/combobox";

function HomePageContent() {
  const [apiKey] = useLocalStorage<string | null>("jules-api-key", null);
  const [githubToken] = useLocalStorage<string | null>("jules-github-token", null);

  const [sessionListPollInterval] = useLocalStorage<number>("jules-idle-poll-interval", 120);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sessions, setSessions] = useLocalStorage<Session[]>("jules-sessions", []);
  
  const [isClient, setIsClient] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(sessionListPollInterval);
  const [titleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);

  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdParam = searchParams.get("jobId");

  const [jobFilter, setJobFilter] = useState<string | null>(jobIdParam);
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [prStatuses, setPrStatuses] = useState<Record<string, PullRequestStatus | null>>({});
  const [isFetchingPrStatus, setIsFetchingPrStatus] = useState(false);

  // Effect to sync job filter with URL param
  useEffect(() => {
    setJobFilter(jobIdParam);
  }, [jobIdParam]);

  
  const filteredJob = jobFilter ? jobs.find(j => j.id === jobFilter) : null;
  
  const sessionToJobMap = useMemo(() => {
    const map = new Map<string, Job>();
    for (const job of jobs) {
      for (const sessionId of job.sessionIds) {
        map.set(sessionId, job);
      }
    }
    return map;
  }, [jobs]);

  const getPullRequestUrl = (session: Session): string | null => {
    if (session.outputs && session.outputs.length > 0) {
      for (const output of session.outputs) {
        if (output.pullRequest?.url) {
          return output.pullRequest.url;
        }
      }
    }
    return null;
  }
  
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const repoName = s.sourceContext?.source.split('/').slice(2).join('/');
      
      const jobMatch = !jobFilter || (sessionToJobMap.has(s.id) && sessionToJobMap.get(s.id)?.id === jobFilter);
      const repoMatch = repoFilter === 'all' || repoName === repoFilter;
      const statusMatch = statusFilter === 'all' || s.state === statusFilter;

      return jobMatch && repoMatch && statusMatch;
    });
  }, [sessions, sessionToJobMap, jobFilter, repoFilter, statusFilter]);
  

  const fetchSessions = useCallback(async () => {
    startFetching(async () => {
      const [fetchedSessions, fetchedJobs] = await Promise.all([
        listSessions(apiKey),
        getJobs()
      ]);
      const validSessions = fetchedSessions.filter(s => s);
      setSessions(validSessions);
      setJobs(fetchedJobs);
      setLastUpdatedAt(new Date());
      setCountdown(sessionListPollInterval);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, sessionListPollInterval, setSessions]);


  // Effect to fetch PR statuses for visible sessions
  useEffect(() => {
    const fetchStatuses = async () => {
        const effectiveToken = githubToken || process.env.GITHUB_TOKEN;
        if (!effectiveToken) {
            return;
        }
        if (filteredSessions.length === 0) {
            return;
        }

        setIsFetchingPrStatus(true);
        const urlsToFetch = filteredSessions
            .map(getPullRequestUrl)
            .filter((url): url is string => !!url && prStatuses[url] === undefined);

        if (urlsToFetch.length > 0) {
            const newStatuses: Record<string, PullRequestStatus | null> = {};
            const promises = urlsToFetch.map(async (prUrl) => {
                const status = await getPullRequestStatus(prUrl, effectiveToken);
                newStatuses[prUrl] = status;
            });
            
            await Promise.all(promises);

            setPrStatuses(prev => ({ ...prev, ...newStatuses }));
        }
        setIsFetchingPrStatus(false);
    };

    fetchStatuses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSessions, githubToken]);



  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initial fetch and set up polling interval
  useEffect(() => {
    if (isClient) {
      if (apiKey || process.env.JULES_API_KEY) {
        if (sessions.length === 0) {
          startFetching(async () => {
            const [fetchedSessions, fetchedJobs] = await Promise.all([
                listSessions(apiKey),
                getJobs()
            ]);
            const validSessions = fetchedSessions.filter(s => s);
            setSessions(validSessions);
            setJobs(fetchedJobs);
            setLastUpdatedAt(new Date());
            setCountdown(sessionListPollInterval);
          });
        } else {
          setLastUpdatedAt(new Date());
          setCountdown(sessionListPollInterval);
        }
  
        const intervalInMs = sessionListPollInterval * 1000;
        if (intervalInMs > 0) {
          const intervalId = setInterval(fetchSessions, intervalInMs);
          return () => clearInterval(intervalId);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKey, sessionListPollInterval]);
  

  // Countdown timer
  useEffect(() => {
    if (!isClient || (!apiKey && !process.env.JULES_API_KEY) || sessionListPollInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isClient, apiKey, sessionListPollInterval, lastUpdatedAt]);


  const handleRefresh = () => {
    fetchSessions();
    toast({
      title: "Refreshing sessions...",
      description: "Fetching the latest session data.",
    });
  };

  const handleApprovePlan = (sessionId: string) => {
    startActionTransition(async () => {
      const result = await approvePlan(sessionId, apiKey);
       if (result) {
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

  const handleSendMessage = (sessionId: string, message: string) => {
    startActionTransition(async () => {
      const result = await sendMessage(sessionId, message, apiKey);
      if (result) {
        fetchSessions();
        toast({ title: "Message Sent", description: "Your message has been sent to the session." });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to send message",
        });
      }
    });
  };

  const handleBulkSendMessage = (sessionIds: string[], message: string) => {
    startActionTransition(async () => {
      const messagePromises = sessionIds.map(id => sendMessage(id, message, apiKey));
        try {
            const results = await Promise.all(messagePromises);
            const successfulMessages = results.filter(r => r).length;
            toast({
                title: "Bulk Message Sent",
                description: `Successfully sent message to ${successfulMessages} of ${sessionIds.length} sessions.`,
            });
            fetchSessions();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Bulk Message Failed",
                description: "An error occurred while sending messages.",
            });
        }
    });
  }

  const handleClearFilters = () => {
    onJobFilterChange(null);
    onRepoFilterChange('all');
    onStatusFilterChange('all');
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
  
  const repoOptions = useMemo(() => [
    { value: 'all', label: 'All Repositories'}, 
    ...Array.from(new Set(sessions.map(s => s.sourceContext?.source.split('/').slice(2).join('/')).filter((r): r is string => !!r))).map(r => ({ value: r, label: r }))
  ], [sessions]);
  
  const jobOptions = useMemo(() => [
    { value: 'all', label: 'All Jobs' },
    ...[...jobs].reverse().map(j => ({ value: j.id, label: j.name }))
  ], [jobs]);

  const statusOptions = useMemo(() => [
    { value: 'all', label: 'All Statuses' },
    ...Array.from(new Set(sessions.map(s => s.state).filter((s): s is State => !!s))).map(s => ({ value: s, label: s }))
  ], [sessions]);
  
  const isAnyFilterActive = jobFilter || repoFilter !== 'all' || statusFilter !== 'all';

  if (!isClient) {
    return (
      <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="space-y-8 px-4 sm:px-6 lg:px-8">
             <div className="space-y-8">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const hasJulesApiKey = !!(process.env.JULES_API_KEY || apiKey);
  const hasGithubToken = !!(process.env.GITHUB_TOKEN || githubToken);

  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="space-y-8 px-4 sm:px-6 lg:px-8">
          {!hasJulesApiKey && (
            <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <Terminal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>API Key Not Set</AlertTitle>
              <AlertDescription>
                Please set your Jules API key in the settings menu (top right
                corner) to create and view sessions.
              </AlertDescription>
            </Alert>
          )}
           {!hasGithubToken && (
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
            onSendMessage={handleSendMessage}
            onBulkSendMessage={handleBulkSendMessage}
            countdown={countdown}
            pollInterval={sessionListPollInterval}
            titleTruncateLength={titleTruncateLength}
            jobFilter={jobFilter}
            prStatuses={prStatuses}
            isFetchingPrStatus={isFetchingPrStatus}
          >
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-repo">Repository</Label>
                  <Combobox 
                    options={repoOptions}
                    selectedValue={repoFilter}
                    onValueChange={(val) => onRepoFilterChange(val || 'all')}
                    placeholder="Filter by repository..."
                    searchPlaceholder="Search repositories..."
                    name="filter-repo"
                    icon={<GitMerge className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Session Status</Label>
                  <Combobox 
                    options={statusOptions}
                    selectedValue={statusFilter}
                    onValueChange={(val) => onStatusFilterChange(val || 'all')}
                    placeholder="Filter by status..."
                    searchPlaceholder="Search statuses..."
                    name="filter-status"
                    icon={<Activity className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-job">Job Name</Label>
                   <Combobox 
                    options={jobOptions}
                    selectedValue={jobFilter || 'all'}
                    onValueChange={(val) => onJobFilterChange(val === 'all' ? null : val)}
                    placeholder="Filter by job..."
                    searchPlaceholder="Search jobs..."
                    name="filter-job"
                    icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
                  />
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
