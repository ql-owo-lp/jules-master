

"use client";

import { useState, useEffect, useTransition, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { notFound, useSearchParams, useParams } from "next/navigation";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import type { Session, Job, Activity, PredefinedPrompt } from "@/lib/types";
import { getSession, approvePlan, sendMessage, listActivities } from "./actions";
import { getJobs, getQuickReplies } from "@/app/config/actions";
import { ActivityFeed } from "@/components/activity-feed";
import { PrStatus } from "@/components/pr-status";
import { useEnv } from "@/components/env-provider";
import { NewJobDialog } from "@/components/new-job-dialog";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Copy,
  Calendar,
  CheckSquare,
  Clock,
  Code,
  ExternalLink,
  GitMerge,
  Github,
  Hand,
  Hash,
  Loader2,
  MessageSquare,
  Package,
  Zap,
  Briefcase,
  ChevronDown,
  MessageSquareReply
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { hasJulesApiKey } = useEnv();
  const [currentProfileId] = useLocalStorage<string>("jules-current-profile-id", "default");
  const [apiKey] = useLocalStorage<string | null>(`jules-api-key-${currentProfileId}`, null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [githubToken] = useLocalStorage<string | null>(`jules-github-token-${currentProfileId}`, null);
  const [idlePollInterval] = useLocalStorage<number>("jules-idle-poll-interval", 120);
  const [activePollInterval] = useLocalStorage<number>("jules-active-poll-interval", 30);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quickReplies, setQuickReplies] = useState<PredefinedPrompt[]>([]);
  
  const [session, setSession] = useLocalStorage<Session | null>(`jules-session-${id}`, null);
  const [activities, setActivities] = useLocalStorage<Activity[]>(`jules-activities-${id}`, []);
  
  const [isClient, setIsClient] = useState(false);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const activityFeedRef = useRef<HTMLDivElement>(null);
  const [showScroll, setShowScroll] = useState(false);
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [isPollingActive, setIsPollingActive] = useState(false);
  const [activeTab, setActiveTab] = useLocalStorage<string>(`jules-session-detail-tab-${id}`, "details");
  
  // Determine current poll interval
  const isSessionDone = session?.state === 'COMPLETED' || session?.state === 'FAILED';
  const currentPollInterval = isSessionDone ? idlePollInterval : (isPollingActive ? activePollInterval : idlePollInterval);
  
  useEffect(() => {
    setIsClient(true);
    getJobs().then(setJobs);
    getQuickReplies().then(setQuickReplies);
  }, []);

  const fetchSessionData = useCallback(async (options: { showToast?: boolean } = {}) => {
    if (!id) return;
    
    if (options.showToast) {
        toast({ title: "Refreshing session..." });
    }

    startFetching(async () => {
      const [fetchedSession, fetchedActivities] = await Promise.all([
        getSession(id, apiKey || null),
        listActivities(id, apiKey || null)
      ]);
      
      if (fetchedSession) {
        const wasDone = session?.state === 'COMPLETED' || session?.state === 'FAILED';
        const isNowDone = fetchedSession.state === 'COMPLETED' || fetchedSession.state === 'FAILED';
        
        setSession(fetchedSession);
        setActivities(fetchedActivities.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime()));
        setLastUpdatedAt(new Date());
        
        // If the session just finished, deactivate active polling
        if (isNowDone && !wasDone) {
            setIsPollingActive(false);
        }

      } else {
        // If fetch fails, we don't call notFound(), we rely on the cached version if it exists.
        // We could show a toast here to indicate the fetch failed but we're showing cached data.
        if (!session) {
            notFound();
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, hasJulesApiKey, id, idlePollInterval, activePollInterval, isPollingActive, toast, setSession, setActivities]);

  useEffect(() => {
    if (apiKey || hasJulesApiKey) {
      if (id) {
        fetchSessionData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, hasJulesApiKey, id]);

  // Set up polling interval
  useEffect(() => {
    if ((apiKey || hasJulesApiKey) && currentPollInterval > 0) {
      const intervalId = setInterval(() => fetchSessionData(), currentPollInterval * 1000);
      return () => clearInterval(intervalId);
    }
  }, [apiKey, hasJulesApiKey, currentPollInterval, fetchSessionData]);

  
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (activityFeedRef.current) {
        const viewport = activityFeedRef.current.querySelector('[data-radix-scroll-area-viewport]') || activityFeedRef.current;
        viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    }
  };

  const handleScroll = useCallback(() => {
    if (activityFeedRef.current) {
      // We need to find the actual scrollable viewport inside Radix ScrollArea
      // Radix ScrollArea Viewport has [data-radix-scroll-area-viewport] attribute
      const viewport = activityFeedRef.current.querySelector('[data-radix-scroll-area-viewport]') || activityFeedRef.current;
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      
      // If user is within 20px of bottom, consider it "at bottom"
      const isAtBottom = scrollTop >= scrollHeight - clientHeight - 20;
      setShowScroll(!isAtBottom);
    }
  }, []);

  // Auto-scroll activity feed and add scroll listener
  useEffect(() => {
    const currentRef = activityFeedRef.current;
    if (currentRef) {
        const viewport = currentRef.querySelector('[data-radix-scroll-area-viewport]') || currentRef;
        
        // Auto-scroll on new activities, but only if user isn't trying to scroll up
        // AND not selecting text
        const hasSelection = window.getSelection()?.toString() !== "";
        if (!showScroll && !hasSelection) {
          scrollToBottom('auto');
        }
        
        viewport.addEventListener('scroll', handleScroll);
        return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, [activities, showScroll, handleScroll]);


  const handleApprovePlan = () => {
    if (!session) return;
    startActionTransition(async () => {
      const result = await approvePlan(session.id, apiKey || null);
      if (result) {
        setSession(result);
        setIsPollingActive(true); // Start active polling
        toast({ title: "Plan Approved", description: "The session will now proceed." });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to approve plan",
        });
      }
    });
  };

  const handleSendMessage = () => {
    if (!session || !message.trim()) return;
    startActionTransition(async () => {
      const success = await sendMessage(session.id, message, apiKey || null);
      if (success) {
        setMessage("");
        toast({ title: "Message Sent", description: "Your message has been sent to the session." });
        
        // Activate faster polling and refresh data immediately
        setIsPollingActive(true);
        fetchSessionData();

      } else {
        toast({
          variant: "destructive",
          title: "Failed to send message",
        });
      }
    });
  };
  
  const repoContext = session?.sourceContext?.githubRepoContext;
  const repoName = session?.sourceContext?.source.split("/").slice(-2).join("/");
  
  const job = jobs.find(j => session && j.sessionIds.includes(session.id));
  const backPath = jobId ? `/?jobId=${jobId}` : (job ? `/?jobId=${job.id}` : '/');

  const getPullRequestUrl = (session: Session | null): string | null => {
    if (session?.outputs && session.outputs.length > 0) {
      for (const output of session.outputs) {
        if (output.pullRequest?.url) {
          return output.pullRequest.url;
        }
      }
    }
    return null;
  }
  const prUrl = getPullRequestUrl(session);

  const quickReplyOptions = quickReplies.map(reply => ({
    value: reply.id,
    label: reply.title,
    content: reply.prompt,
  }));

  const getRepoNameFromSource = (source: string | undefined): string | undefined => {
      if (!source) return undefined;
      // source format: sources/github/owner/repo
      const parts = source.split('/');
      if (parts.length >= 4) {
          return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return undefined;
  };

  const duplicateInitialValues = useMemo(() => {
    if (!session) return undefined;
    return {
        prompt: session.prompt,
        repo: getRepoNameFromSource(session.sourceContext?.source),
        branch: session.sourceContext?.githubRepoContext?.startingBranch,
        jobName: job?.name
    };
  }, [session, job]);


  if (!isClient || (isFetching && !session)) {
    return (
      <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="space-y-8 px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }
  
  if (!session) {
     return (
      <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
           <div className="space-y-8 px-4 sm:px-6 lg:px-8">
            <p>No session found. Make sure your API key is set correctly.</p>
          </div>
        </main>
      </div>
     )
  }

  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="space-y-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href={backPath}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back to list</span>
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight" title={session.title}>{job?.name || session.title}</h1>
                {session.state && <JobStatusBadge status={session.state} />}
             </div>
             <NewJobDialog initialValues={duplicateInitialValues}>
                <Button variant="outline">
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                </Button>
             </NewJobDialog>
          </div>

          {session.state === "AWAITING_PLAN_APPROVAL" && (
            <Card>
              <CardHeader>
                <CardTitle>Plan Approval Required</CardTitle>
                <CardDescription>
                  The session has generated a plan and is awaiting your approval to proceed.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-end">
                <Button onClick={handleApprovePlan} disabled={isActionPending}>
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hand className="mr-2 h-4 w-4" />}
                  Approve Plan
                </Button>
              </CardFooter>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="details">Session Details</TabsTrigger>
              <TabsTrigger value="activity">Session Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Session Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="space-y-4">
                            {job && (
                                <div className="flex items-start gap-3">
                                    <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Job Name</p>
                                        <p className="text-muted-foreground">{job.name}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-3">
                                <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-semibold">Session Name</p>
                                    <p className="text-muted-foreground font-mono text-xs">{session.name}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-semibold">Session ID</p>
                                    <p className="text-muted-foreground font-mono text-xs">{session.id}</p>
                                </div>
                            </div>
                            {repoContext && (
                                <div className="flex items-start gap-3">
                                    <Github className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Repository</p>
                                        <p className="text-muted-foreground">{repoName}</p>
                                    </div>
                                </div>
                            )}
                            {repoContext?.startingBranch && (
                                <div className="flex items-start gap-3">
                                    <GitMerge className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Starting Branch</p>
                                        <p className="text-muted-foreground">{repoContext.startingBranch}</p>
                                    </div>
                                </div>
                            )}
                             {session.sourceContext?.source && (
                                <div className="flex items-start gap-3">
                                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Full Source</p>
                                        <p className="text-muted-foreground font-mono text-xs">{session.sourceContext.source}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <CheckSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-semibold">Requires Plan Approval</p>
                                    <p className="text-muted-foreground">{session.requirePlanApproval ? 'Yes' : 'No'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Zap className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-semibold">Automation Mode</p>
                                    <p className="text-muted-foreground">{session.automationMode || 'Unspecified'}</p>
                                </div>
                            </div>
                            {session.createTime && (
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Created</p>
                                        <p className="text-muted-foreground" title={new Date(session.createTime).toISOString()}>
                                            {format(new Date(session.createTime), "PPP p")} ({formatDistanceToNow(new Date(session.createTime), { addSuffix: true })})
                                        </p>
                                    </div>
                                </div>
                            )}
                            {session.updateTime && (
                                <div className="flex items-start gap-3">
                                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Last Updated</p>
                                        <p className="text-muted-foreground" title={new Date(session.updateTime).toISOString()}>
                                            {format(new Date(session.updateTime), "PPP p")} ({formatDistanceToNow(new Date(session.updateTime), { addSuffix: true })})
                                        </p>
                                    </div>
                                </div>
                            )}
                            {session.url && (
                                <div className="flex items-start gap-3">
                                    <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Jules UI Link</p>
                                        <a href={session.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                            View Session in Jules
                                        </a>
                                    </div>
                                </div>
                            )}
                            {prUrl && (
                                 <div className="flex items-center gap-3">
                                    <Github className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold">Pull Request:</p>
                                        <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                                            {prUrl}
                                        </a>
                                        <PrStatus prUrl={prUrl} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t">
                         <div className="flex items-start gap-3">
                            <Code className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-semibold">Prompt</p>
                                <p className="text-muted-foreground bg-muted p-3 rounded-md mt-1 whitespace-pre-wrap">{session.prompt}</p>
                            </div>
                        </div>
                    </div>

                    {session.outputs && session.outputs.length > 0 && (
                        <div className="space-y-4 pt-4 mt-4 border-t">
                            <h3 className="text-lg font-semibold">Outputs</h3>
                            {session.outputs.map((output, index) => (
                                <div key={index}>
                                    {output.pullRequest && (
                                        <div className="flex items-start gap-3">
                                            <Github className="h-5 w-5 text-muted-foreground mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Pull Request</p>
                                                <a href={output.pullRequest.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block">
                                                    {output.pullRequest.title}
                                                </a>
                                                {output.pullRequest.description && (
                                                    <p className="text-muted-foreground bg-muted p-3 rounded-md mt-1 whitespace-pre-wrap">{output.pullRequest.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
                <div className="mt-4 relative">
                    <ActivityFeed 
                        activities={activities} 
                        ref={activityFeedRef}
                        lastUpdatedAt={lastUpdatedAt}
                        onRefresh={() => fetchSessionData({ showToast: true })}
                        isRefreshing={isFetching}
                        pollInterval={currentPollInterval}
                    />

                    <Card className="mt-8">
                        <CardHeader>
                        <CardTitle>Send a Message</CardTitle>
                        <CardDescription>
                            Send a message or notes to this session.
                        </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2">
                                <Label htmlFor="message">Your Message</Label>
                                <Textarea
                                    id="message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type your message here..."
                                    rows={4}
                                    disabled={isActionPending}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center">
                           {quickReplies.length > 0 ? (
                                <div className="w-1/2">
                                    <Combobox
                                        options={quickReplyOptions}
                                        onValueChange={(val) => {
                                            const selectedReply = quickReplies.find(r => r.id === val);
                                            if (selectedReply) {
                                                setMessage(selectedReply.prompt);
                                            }
                                        }}
                                        selectedValue={null}
                                        placeholder="Select a quick reply..."
                                        searchPlaceholder="Search replies..."
                                        icon={<MessageSquareReply className="h-4 w-4 text-muted-foreground" />}
                                    />
                                </div>
                            ) : <div></div>}
                            <Button onClick={handleSendMessage} disabled={isActionPending || !message.trim()}>
                                {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                Send Message
                            </Button>
                        </CardFooter>
                    </Card>

                    <Button 
                        size="icon" 
                        className={cn(
                            "fixed bottom-8 right-8 rounded-full shadow-lg transition-opacity",
                            showScroll ? "opacity-100" : "opacity-0 pointer-events-none"
                        )}
                        onClick={() => scrollToBottom('smooth')}
                        aria-label="Scroll to bottom"
                        >
                        <ChevronDown className="h-6 w-6" />
                    </Button>

                </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
