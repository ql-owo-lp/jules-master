
"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import type { Session, Job, Activity } from "@/lib/types";
import { getSession, approvePlan, sendMessage, listActivities } from "./actions";
import { ActivityFeed } from "@/components/activity-feed";

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
  Play,
  Share,
  Zap,
  Briefcase,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [pollIntervalSetting] = useLocalStorage<number>("jules-poll-interval", 120);
  const [jobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [session, setSession] = useState<Session | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [titleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const activityFeedRef = useRef<HTMLDivElement>(null);

  // Adjust poll interval based on session state
  const isSessionDone = session?.state === 'COMPLETED' || session?.state === 'FAILED';
  const pollInterval = isSessionDone ? pollIntervalSetting * 2 : pollIntervalSetting;
  const [countdown, setCountdown] = useState(pollInterval);
  
  const fetchSessionData = useCallback(async (options: { showToast?: boolean } = {}) => {
    const id = params.id;
    if (!apiKey || !id) return;
    
    if (options.showToast) {
        toast({ title: "Refreshing session..." });
    }

    startFetching(async () => {
      const [fetchedSession, fetchedActivities] = await Promise.all([
        getSession(apiKey, id),
        listActivities(apiKey, id)
      ]);
      
      if (fetchedSession) {
        setSession(fetchedSession);
        setActivities(fetchedActivities.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime()));
        setLastUpdatedAt(new Date());
        
        // Reset countdown with the potentially new interval
        const currentIsDone = fetchedSession.state === 'COMPLETED' || fetchedSession.state === 'FAILED';
        const newInterval = currentIsDone ? pollIntervalSetting * 2 : pollIntervalSetting;
        setCountdown(newInterval);
        
      } else {
        notFound();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, params.id, pollIntervalSetting]);

  useEffect(() => {
    if (apiKey && params.id) {
      fetchSessionData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, params.id]);

  // Set up polling interval
  useEffect(() => {
    if (apiKey && pollInterval > 0) {
      const intervalId = setInterval(() => fetchSessionData(), pollInterval * 1000);
      return () => clearInterval(intervalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, pollInterval]);

  // Countdown timer
  useEffect(() => {
    if (!apiKey || pollInterval <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [apiKey, pollInterval, lastUpdatedAt]);
  
  // Auto-scroll activity feed
  useEffect(() => {
    if (activityFeedRef.current) {
        activityFeedRef.current.scrollTop = activityFeedRef.current.scrollHeight;
    }
  }, [activities]);


  const handleApprovePlan = () => {
    if (!session) return;
    startActionTransition(async () => {
      const result = await approvePlan(apiKey, session.id);
      if (result) {
        setSession(result);
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
      const result = await sendMessage(apiKey, session.id, message);
      if (result) {
        setSession(result);
        setMessage("");
        toast({ title: "Message Sent", description: "Your message has been sent to the session." });
        
        // Refresh activities
        const fetchedActivities = await listActivities(apiKey, params.id);
        setActivities(fetchedActivities.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime()));

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

  const truncateTitle = (title: string, maxLength: number) => {
    if (title.length <= maxLength) {
      return title;
    }
    return title.substring(0, maxLength) + "...";
  };
  
  const job = jobs.find(j => session && j.sessionIds.includes(session.id));


  if (isFetching && !session) {
    return (
      <div className="container mx-auto max-w-4xl space-y-8 p-4 sm:p-6 md:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  if (!session) {
     return (
       <div className="container mx-auto max-w-4xl space-y-8 p-4 sm:p-6 md:p-8">
        <p>No session found. Make sure your API key is set correctly.</p>
      </div>
     )
  }

  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl space-y-8">
          <div className="flex items-center gap-4">
             <Button variant="outline" size="icon" asChild>
                <Link href="/">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to list</span>
                </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight" title={session.title}>{truncateTitle(session.title, titleTruncateLength)}</h1>
            {session.state && <JobStatusBadge status={session.state} />}
          </div>

          {session.state === "AWAITING_PLAN_APPROVAL" && (
            <Card>
              <CardHeader>
                <CardTitle>Plan Approval Required</CardTitle>
                <CardDescription>
                  The session has generated a plan and is awaiting your approval to proceed.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={handleApprovePlan} disabled={isActionPending}>
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hand className="mr-2 h-4 w-4" />}
                  Approve Plan
                </Button>
              </CardFooter>
            </Card>
          )}

          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Session Details</TabsTrigger>
              <TabsTrigger value="activity">Session Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Session Details</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
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
                        <div className="flex items-start gap-3">
                            <Code className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-semibold">Prompt</p>
                                <p className="text-muted-foreground bg-muted p-3 rounded-md mt-1">{session.prompt}</p>
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
                    </div>

                    {session.outputs && session.outputs.length > 0 && (
                        <div className="col-span-full space-y-4 pt-4 border-t">
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
                                                <p className="text-muted-foreground mt-1">{output.pullRequest.description}</p>
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
              <div className="mt-4">
                <ActivityFeed 
                    activities={activities} 
                    ref={activityFeedRef}
                    lastUpdatedAt={lastUpdatedAt}
                    onRefresh={() => fetchSessionData({ showToast: true })}
                    isRefreshing={isFetching}
                    countdown={countdown}
                    pollInterval={pollInterval}
                />

                {session.state === "AWAITING_USER_FEEDBACK" && (
                  <Card className="mt-8">
                    <CardHeader>
                      <CardTitle>User Feedback Required</CardTitle>
                      <CardDescription>
                        The session is waiting for your input to continue.
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
                    <CardFooter>
                      <Button onClick={handleSendMessage} disabled={isActionPending || !message.trim()}>
                        {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                        Send Message
                      </Button>
                    </CardFooter>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

    