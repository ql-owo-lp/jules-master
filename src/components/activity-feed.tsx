
"use client";

import type { Activity, Plan, GitPatch } from "@/lib/types";
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
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, forwardRef } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { CollapsibleMessage } from "./collapsible-message";

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
  countdown: number;
  pollInterval: number;
};

export const ActivityFeed = forwardRef<HTMLDivElement, ActivityFeedProps>(({ 
    activities, 
    lastUpdatedAt,
    onRefresh,
    isRefreshing,
    countdown,
    pollInterval
}, ref) => {
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
                            Next poll in: {countdown}s
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[700px] pr-4" ref={ref}>
            <div className="space-y-8">
            {activities.map((activity, index) => (
                <div key={activity.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                    <span
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
                    title={`Originated by: ${activity.originator}`}
                    >
                    {originatorIcons[activity.originator] || (
                        <MessageSquare className="h-5 w-5" />
                    )}
                    </span>
                    {index < activities.length - 1 && (
                       <div className="flex-1 w-px bg-border my-2"></div>
                    )}
                </div>
                <div className="flex-1 space-y-1 mt-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                    <p className="font-semibold text-sm break-words">{activity.description}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap pl-4">
                        {formatDistanceToNow(new Date(activity.createTime), {
                        addSuffix: true,
                        })}
                    </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                    <ActivityContent activity={activity} />
                    </div>
                </div>
                </div>
            ))}
            </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});
ActivityFeed.displayName = 'ActivityFeed';


function ActivityContent({ activity }: { activity: Activity }) {
  if (activity.agentMessaged?.agentMessage) {
    return <CollapsibleMessage content={activity.agentMessaged.agentMessage} />;
  }
  if (activity.userMessaged?.userMessage) {
    return <CollapsibleMessage content={activity.userMessaged.userMessage} />;
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
  if (activity.progressUpdated?.description) {
    return (
      <div className="mt-2 space-y-1">
        <p className="font-medium">{activity.progressUpdated.title}</p>
        <CollapsibleMessage content={activity.progressUpdated.description} />
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
  if (activity.sessionFailed?.reason) {
    return (
       <div className="flex items-center gap-2 mt-2">
         <XCircle className="h-4 w-4 text-red-500" />
         <CollapsibleMessage content={activity.sessionFailed.reason} />
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
                <div className="p-2 bg-muted rounded-md font-mono text-xs">
                    <p className="font-semibold mb-2 flex items-center gap-2"><ChevronsRight className="h-4 w-4" /> <span>{artifact.bashOutput.command}</span></p>
                    <CollapsibleMessage content={artifact.bashOutput.output} isPreformatted />
                    <p className="mt-2 text-xs">Exit Code: {artifact.bashOutput.exitCode}</p>
                </div>
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
        <div className="relative">
             <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <FileCode className="h-4 w-4" />
                <span>Code Changes</span>
             </div>
             <CollapsibleMessage content={patch.unidiffPatch} isPreformatted />
             <Button
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-7 w-7"
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
      </div>
  );
}
