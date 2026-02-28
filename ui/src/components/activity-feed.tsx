
"use client";

import type { Activity, Plan, GitPatch, BashOutput } from "@/lib/types";
import { areActivitiesEqual } from "@/lib/activity-utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bot,
  User,
  List,
  Check,
  FileCode,
  GitMerge,
  MessageSquare,
  XCircle,
  PartyPopper,
  ChevronsRight,
  Clipboard,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import React, { useState, forwardRef, useEffect, memo } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";

const originatorIcons: Record<string, React.ReactNode> = {
  user: <User className="h-5 w-5 text-blue-500" />,
  agent: <Bot className="h-5 w-5 text-green-500" />,
  system: <Bot className="h-5 w-5 text-purple-500" />,
};

type ActivityFeedProps = {
  activities: Activity[];
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  pollInterval: number;
};

// Isolates the countdown timer to avoid re-rendering the entire parent component every second
function PollCountdown({ pollInterval, lastUpdatedAt }: { pollInterval: number, lastUpdatedAt: Date | null }) {
  const [secondsLeft, setSecondsLeft] = useState(pollInterval);

  useEffect(() => {
    setSecondsLeft(pollInterval);
  }, [lastUpdatedAt, pollInterval]);

  useEffect(() => {
    if (pollInterval <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [pollInterval]);

  return <>{secondsLeft}</>;
}

// ActivityItem component handles the container and timestamp updates
const ActivityItem = memo(({ activity, isLast }: { activity: Activity, isLast: boolean }) => {
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label={`Originated by: ${activity.originator}`}
                  tabIndex={0}
                >
                  {originatorIcons[activity.originator] || (
                    <MessageSquare className="h-5 w-5" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Originated by: {activity.originator}</p>
              </TooltipContent>
            </Tooltip>
            {!isLast && (
                <div className="flex-1 w-px bg-border my-2"></div>
            )}
        </div>
        <div className="flex-1 space-y-1 min-w-0 pt-1">
            <div className="flex justify-between items-start gap-4">
            <p className="font-semibold text-sm break-words">{activity.description}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground whitespace-nowrap pl-4 pt-0.5 cursor-help">
                  {formatDistanceToNow(new Date(activity.createTime), {
                    addSuffix: true,
                  })}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                {format(new Date(activity.createTime), "PPpp")}
              </TooltipContent>
            </Tooltip>
            </div>
            <div className="text-sm text-muted-foreground">
            <MemoizedActivityContent activity={activity} />
            </div>
        </div>
        </div>
    );
}, (prev, next) => {
    return prev.isLast === next.isLast && areActivitiesEqual(prev.activity, next.activity);
});
ActivityItem.displayName = 'ActivityItem';

// Extracted and memoized list component
const ActivityFeedList = memo(({ activities }: { activities: Activity[] }) => {
    return (
        <div className="space-y-8">
            {activities.map((activity, index) => (
                <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isLast={index === activities.length - 1}
                />
            ))}
        </div>
    );
});
ActivityFeedList.displayName = 'ActivityFeedList';

export const ActivityFeed = forwardRef<HTMLDivElement, ActivityFeedProps>(({ 
    activities, 
    lastUpdatedAt,
    onRefresh,
    isRefreshing,
    pollInterval
}, ref) => {
  const [debugMode] = useLocalStorage<boolean>("jules-debug-mode", false);

  useEffect(() => {
    if (debugMode && isRefreshing) {
      console.log("Refreshing activity feed...");
    }
  }, [debugMode, isRefreshing]);

  if (activities.length === 0) {
     return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>
            A timeline of events that have occurred during this session will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
                <p className="font-semibold text-lg">No Activities Yet</p>
                <p className="text-sm">
                    As the session progresses, its activities will be shown here.
                </p>
            </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
            <div>
                <CardTitle>Activity Feed</CardTitle>
                <CardDescription>
                    A timeline of events that have occurred during this session.
                </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                 <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh session data" disabled={isRefreshing}>
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
                {lastUpdatedAt && (
                    <div className="text-right">
                        <div>
                            Last updated:{" "}
                            {format(lastUpdatedAt, "h:mm:ss a")}
                        </div>
                        {pollInterval > 0 && (
                            <div>
                            Next poll in: <PollCountdown pollInterval={pollInterval} lastUpdatedAt={lastUpdatedAt} />s
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[700px] pr-4" ref={ref}>
            <ActivityFeedList activities={activities} />
        </ScrollArea>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
});
ActivityFeed.displayName = 'ActivityFeed';

// Memoized ActivityContent to prevent unnecessary re-renders of heavy content
// when the parent list updates but the activity content itself hasn't changed.
const MemoizedActivityContent = memo(ActivityContent, (prev, next) => {
    return areActivitiesEqual(prev.activity, next.activity);
});

function ActivityContent({ activity }: { activity: Activity }) {
  const agentMessage = activity.agentMessaged?.agentMessage;
  const userMessage = activity.userMessaged?.userMessage;

  if (agentMessage || userMessage) {
    return (
      <Accordion type="single" collapsible defaultValue="message" className="w-full">
            <AccordionItem value="message" className="border-b-0">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4" />
                      <span>View Message</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                    <pre className="whitespace-pre-wrap bg-muted text-foreground p-2 rounded-md font-mono text-xs overflow-auto">
                        <code>{agentMessage || userMessage}</code>
                    </pre>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
  }

  if (activity.planGenerated) {
    return (
      <div className="mt-2">
        <PlanDetails plan={activity.planGenerated.plan} />
      </div>
    );
  }
  if (activity.planApproved) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <Check className="h-4 w-4 text-green-500" />
        <p>Plan approved: {activity.planApproved.planId}</p>
      </div>
    );
  }
  
  const progressDescription = activity.progressUpdated?.description;
  if (progressDescription) {
    return (
      <div className="mt-2 space-y-2">
        <p className="font-medium">{activity.progressUpdated!.title}</p>
         <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="progress" className="border-b-0">
                <AccordionTrigger>
                <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    <span>View Details</span>
                </div>
                </AccordionTrigger>
                <AccordionContent>
                    <pre className="whitespace-pre-wrap bg-muted text-foreground p-2 rounded-md font-mono text-xs overflow-auto">
                        <code>{progressDescription}</code>
                    </pre>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </div>
    );
  }
  if (activity.sessionCompleted) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <PartyPopper className="h-4 w-4 text-green-500" />
        <p>Session completed successfully.</p>
      </div>
    );
  }

  const failureReason = activity.sessionFailed?.reason;
  if (failureReason) {
    return (
       <div className="flex items-center gap-2 mt-2">
         <XCircle className="h-4 w-4 text-red-500" />
         <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="failure" className="border-b-0">
                <AccordionTrigger>
                <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    <span>View Reason</span>
                </div>
                </AccordionTrigger>
                <AccordionContent>
                    <pre className="whitespace-pre-wrap bg-muted text-foreground p-2 rounded-md font-mono text-xs overflow-auto">
                        <code>{failureReason}</code>
                    </pre>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
       </div>
    );
  }

  if (activity.artifacts && activity.artifacts.length > 0) {
    return (
      <div className="mt-2 space-y-4">
        {activity.artifacts.map((artifact, index) => (
          <div key={index}>
            {artifact.changeSet?.gitPatch && (
              <GitPatchDetails patch={artifact.changeSet.gitPatch} />
            )}
            {artifact.bashOutput?.output && (
              <BashOutputDetails bashOutput={artifact.bashOutput} index={index} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return null; // Return null if there's no specific content to render
}

function PlanDetails({ plan }: { plan: Plan }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="plan" className="border-b-0">
        <AccordionTrigger>
          <div className="flex items-center gap-2 text-sm">
            <List className="h-4 w-4" />
            <span>View Plan ({plan.steps.length} steps)</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ol className="list-decimal list-inside space-y-4 pl-2 mt-2">
            {plan.steps.map((step) => (
              <li key={step.id}>
                <p className="font-semibold">{step.title}</p>
                <p className="text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function BashOutputDetails({ bashOutput, index }: { bashOutput: BashOutput, index: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={`bash-${index}`} className="border-b-0">
        <AccordionTrigger>
          <div className="flex items-center gap-2 text-sm font-mono">
            <ChevronsRight className="h-4 w-4" />
            <span>{bashOutput.command}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="relative group">
            <pre className="whitespace-pre-wrap bg-muted text-foreground p-2 rounded-md font-mono text-xs overflow-auto max-h-[300px]">
              <code>{bashOutput.output}</code>
            </pre>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-background/80 hover:bg-background shadow-sm"
                    aria-label="Copy output"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(bashOutput.output);
                    }}
                  >
                    {copied ? (
                      <ClipboardCheck className="h-3 w-3 text-green-500" />
                    ) : (
                      <Clipboard className="h-3 w-3" />
                    )}
                    <span className="sr-only">Copy output</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy output</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Exit Code: {bashOutput.exitCode}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function GitPatchDetails({ patch }: { patch: GitPatch }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
      <div className="space-y-2 mt-2">
        <div className="flex items-start gap-2">
          <GitMerge className="h-4 w-4 mt-1 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Suggested Commit Message
            </p>
            <p className="font-mono text-sm bg-background p-2 rounded-md">
              {patch.suggestedCommitMessage}
            </p>
          </div>
        </div>
        
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="patch" className="border-b-0">
                <AccordionTrigger>
                    <div className="flex items-center gap-2 text-sm">
                        <FileCode className="h-4 w-4" />
                        <span>View Code Changes</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="relative">
                        <pre className="whitespace-pre-wrap bg-muted text-foreground p-2 rounded-md font-mono text-xs overflow-auto">
                            <code>{patch.unidiffPatch}</code>
                        </pre>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-0 right-0 h-7 w-7"
                            aria-label="Copy patch"
                            onClick={() => handleCopy(patch.unidiffPatch)}
                            >
                            {copied ? (
                                <ClipboardCheck className="h-4 w-4" />
                            ) : (
                                <Clipboard className="h-4 w-4" />
                            )}
                            <span className="sr-only">Copy patch</span>
                        </Button>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </div>
  );
}
