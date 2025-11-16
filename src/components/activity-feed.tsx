
"use client";

import type { Activity, Plan, GitPatch } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
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

const originatorIcons: Record<string, React.ReactNode> = {
  user: <User className="h-5 w-5 text-blue-500" />,
  agent: <Bot className="h-5 w-5 text-green-500" />,
  system: <Bot className="h-5 w-5 text-purple-500" />,
};

export const ActivityFeed = forwardRef<HTMLDivElement, { activities: Activity[] }>(({ activities }, ref) => {
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
        <CardTitle>Activity Feed</CardTitle>
        <CardDescription>
          A timeline of events that have occurred during this session.
        </CardDescription>
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
  if (activity.agentMessaged) {
    return <p className="whitespace-pre-wrap break-words">{activity.agentMessaged.agentMessage}</p>;
  }
  if (activity.userMessaged) {
    return <p className="whitespace-pre-wrap break-words">{activity.userMessaged.userMessage}</p>;
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
  if (activity.progressUpdated) {
    return (
      <div className="mt-2 space-y-1">
        <p className="font-medium">{activity.progressUpdated.title}</p>
        <p>{activity.progressUpdated.description}</p>
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
  if (activity.sessionFailed) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <p>Session failed: {activity.sessionFailed.reason}</p>
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
            {artifact.bashOutput && (
                <div className="p-4 bg-muted rounded-md font-mono text-xs">
                    <div className="flex items-center gap-2 mb-2">
                        <ChevronsRight className="h-4 w-4"/>
                        <span className="font-semibold">{artifact.bashOutput.command}</span>
                    </div>
                    <pre className="whitespace-pre-wrap bg-background p-2 rounded-md"><code>{artifact.bashOutput.output}</code></pre>
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
      <AccordionItem value="plan">
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
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="patch">
        <AccordionTrigger>
          <div className="flex items-center gap-2 text-sm">
            <FileCode className="h-4 w-4" />
            <span>View Code Changes</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 mt-2">
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
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
                <code>{patch.unidiffPatch}</code>
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

    