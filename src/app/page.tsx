

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
import { getJobs, getQuickReplies } from "@/app/config/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/combobox";
import { groupSessionsByTopic, createDynamicJobs } from "@/lib/utils";
import { useEnv } from "@/components/env-provider";
import { FloatingProgressBar } from "@/components/floating-progress-bar";

function HomePageContent() {
  const { julesApiKey, githubToken: envGithubToken } = useEnv();
  const [apiKey] = useLocalStorage<string | null>("jules-api-key", null);
  const [githubToken] = useLocalStorage<string | null>("jules-github-token", null);

  const [sessionListPollInterval] = useLocalStorage<number>("jules-idle-poll-interval", 120);
  const [jobs, setJobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [sessions, setSessions] = useLocalStorage<Session[]>("jules-sessions", []);
  const [quickReplies, setQuickReplies] = useLocalStorage<PredefinedPrompt[]>("jules-quick-replies", []);
  const [lastUpdatedAt, setLastUpdatedAt] = useLocalStorage<number | null>("jules-last-updated-at", null);
  
  const [isClient, setIsClient] = useState(false);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(sessionListPollInterval);
  const [titleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);
  const [jobsPerPage] = useLocalStorage<number>("jules-jobs-per-page", 5);

  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdParam = searchParams.get("jobId");
  const jobPageParam = searchParams.get("jobPage");

  const [jobFilter, setJobFilter] = useState<string | null>(jobIdParam);
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [jobPage, setJobPage] = useState(jobPageParam ? parseInt(jobPageParam, 10) : 1);

  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  
  // Effect to sync job filter with URL param
  useEffect(() => {
    setJobFilter(jobIdParam);
  }, [jobIdParam]);

  const { filteredJobs, unknownSessions } = useMemo(() => {
    const allJobSessionIds = new Set(jobs.flatMap(j => j.sessionIds));
    let unknown = sessions.filter(s => !allJobSessionIds.has(s.id));

    // Logic to extract job name from prompt and group unknown sessions
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(unknown);
    const dynamicJobs = createDynamicJobs(groupedSessions);

    let j = [...jobs, ...dynamicJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (jobFilter) {
      j = j.filter(job => job.id === jobFilter);
    }
    if (repoFilter !== 'all') {
      j = j.filter(job => job.repo === repoFilter);
    }
    return { filteredJobs: j, unknownSessions: remainingUnknown };
  }, [jobs, sessions, jobFilter, repoFilter]);

  const totalJobPages = Math.ceil(filteredJobs.length / jobsPerPage);
  const paginatedJobs = filteredJobs.slice((jobPage - 1) * jobsPerPage, jobPage * jobsPerPage);

  const handleJobPageChange = (page: number) => {
    if (page < 1 || page > totalJobPages) return;
    setJobPage(page);
     const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('jobPage', page.toString());
    router.push(`?${newParams.toString()}`);
  }

  const fetchAllData = useCallback(async (options: {isRefresh: boolean} = {isRefresh: false}) => {
    if (options.isRefresh) {
        toast({
            title: "Refreshing sessions...",
            description: "Fetching the latest session data.",
        });
    }

    startFetching(async () => {
      const [fetchedSessions, fetchedJobs, fetchedQuickReplies] = await Promise.all([
        listSessions(apiKey),
        getJobs(),
        getQuickReplies()
      ]);
      const validSessions = fetchedSessions.filter(s => s);
      setSessions(validSessions);
      setJobs(fetchedJobs);
      setQuickReplies(fetchedQuickReplies);
      setLastUpdatedAt(Date.now());
      setCountdown(sessionListPollInterval);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, sessionListPollInterval, setSessions, setJobs, setQuickReplies, toast]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initial fetch and set up polling interval
  useEffect(() => {
    if (isClient) {
      if (apiKey || julesApiKey) {
        const now = Date.now();
        const intervalInMs = sessionListPollInterval * 1000;

        // Check if cache is fresh
        const isCacheFresh = lastUpdatedAt && (now - lastUpdatedAt < intervalInMs);

        if (!isCacheFresh) {
          fetchAllData();
        }

        if (intervalInMs > 0) {
          const intervalId = setInterval(() => fetchAllData(), intervalInMs);
          return () => clearInterval(intervalId);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKey, sessionListPollInterval]);
  

  // Countdown timer
  useEffect(() => {
    if (!isClient || (!apiKey && !julesApiKey) || sessionListPollInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isClient, apiKey, sessionListPollInterval, lastUpdatedAt]);


  const handleRefresh = () => {
    fetchAllData({ isRefresh: true });
  };

  const handleApprovePlan = (sessionIds: string[]) => {
    startActionTransition(async () => {
      if (sessionIds.length > 1) {
        setProgressLabel("Approving plans...");
        setProgressTotal(sessionIds.length);
        setProgressCurrent(0);
      }

      let successfulApprovals = 0;
      let completedCount = 0;

      const approvalPromises = sessionIds.map(async (id) => {
        try {
            const result = await approvePlan(id, apiKey);
            if (result) successfulApprovals++;
        } catch (e) {
           console.error(`Failed to approve plan for session ${id}`, e);
        } finally {
            completedCount++;
            if (sessionIds.length > 1) {
                setProgressCurrent(completedCount);
            }
        }
      });

      try {
        await Promise.all(approvalPromises);

        toast({
            title: "Bulk Approval Complete",
            description: `Successfully approved ${successfulApprovals} of ${sessionIds.length} pending sessions.`,
        });

        // Refresh data to reflect new states
        fetchAllData();
      } catch (error) {
          toast({
              variant: "destructive",
              title: "Bulk Approval Failed",
              description: "An error occurred while approving sessions.",
          });
      } finally {
        setProgressCurrent(0);
        setProgressTotal(0);
      }
    });
  };

  const handleSendMessage = (sessionId: string, message: string) => {
    startActionTransition(async () => {
      const result = await sendMessage(sessionId, message, apiKey);
      if (result) {
        fetchAllData();
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
      if (sessionIds.length > 1) {
        setProgressLabel("Sending messages...");
        setProgressTotal(sessionIds.length);
        setProgressCurrent(0);
      }

      let successfulMessages = 0;
      let completedCount = 0;

      const messagePromises = sessionIds.map(async (id) => {
        try {
            const result = await sendMessage(id, message, apiKey);
            if (result) {
                successfulMessages++;
            }
        } catch (e) {
            console.error(`Failed to send message to session ${id}`, e);
        } finally {
            completedCount++;
            if (sessionIds.length > 1) {
                setProgressCurrent(completedCount);
            }
        }
      });

        try {
            await Promise.all(messagePromises);

            toast({
                title: "Bulk Message Sent",
                description: `Successfully sent message to ${successfulMessages} of ${sessionIds.length} sessions.`,
            });
            fetchAllData();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Bulk Message Failed",
                description: "An error occurred while sending messages.",
            });
        } finally {
            setProgressCurrent(0);
            setProgressTotal(0);
        }
    });
  }

  const handleClearFilters = () => {
    onJobFilterChange(null);
    onRepoFilterChange('all');
    onStatusFilterChange('all');
    setJobPage(1);
  }

  const onJobFilterChange = (value: string | null) => {
    setJobFilter(value);
    setJobPage(1);
    const newParams = new URLSearchParams(searchParams.toString());
    if (value) {
      newParams.set('jobId', value);
    } else {
      newParams.delete('jobId');
    }
    newParams.delete('jobPage');
    router.push(`?${newParams.toString()}`);
  }

  const onRepoFilterChange = (value: string) => {
    setRepoFilter(value);
    setJobPage(1);
  };
  const onStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setJobPage(1);
  }
  
  const repoOptions = useMemo(() => [
    { value: 'all', label: 'All Repositories'}, 
    ...Array.from(new Set(jobs.map(j => j.repo).filter((r): r is string => !!r))).map(r => ({ value: r, label: r }))
  ], [jobs]);
  
  const allJobOptions = useMemo(() => [
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

  const hasJulesApiKey = !!(julesApiKey || apiKey);
  const hasGithubToken = !!(envGithubToken || githubToken);

  return (
    <div className="flex flex-col flex-1 bg-background">
      <FloatingProgressBar
        current={progressCurrent}
        total={progressTotal}
        label={progressLabel}
        isVisible={isActionPending && progressTotal > 1}
      />
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
            sessions={sessions}
            jobs={paginatedJobs}
            unknownSessions={unknownSessions}
            quickReplies={quickReplies}
            lastUpdatedAt={lastUpdatedAt ? new Date(lastUpdatedAt) : null}
            onRefresh={handleRefresh}
            isRefreshing={isFetching}
            isActionPending={isActionPending}
            onApprovePlan={handleApprovePlan}
            onSendMessage={handleSendMessage}
            onBulkSendMessage={handleBulkSendMessage}
            countdown={countdown}
            pollInterval={sessionListPollInterval}
            jobIdParam={jobIdParam}
            statusFilter={statusFilter}
            titleTruncateLength={titleTruncateLength}
            jobPage={jobPage}
            totalJobPages={totalJobPages}
            onJobPageChange={handleJobPageChange}
            progressCurrent={progressCurrent}
            progressTotal={progressTotal}
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
                    options={allJobOptions}
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

    

    