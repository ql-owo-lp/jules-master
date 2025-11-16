"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import type { Session } from "@/lib/types";
import { getSession, approvePlan, sendMessage } from "./actions";

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
  ArrowLeft,
  Calendar,
  Clock,
  Code,
  ExternalLink,
  GitMerge,
  Github,
  Hand,
  Loader2,
  MessageSquare,
  Play,
  Share,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [session, setSession] = useState<Session | null>(null);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchSession = async () => {
      if (!apiKey || !params.id) return;
      startFetching(async () => {
        const fetchedSession = await getSession(apiKey, params.id);
        if (fetchedSession) {
          setSession(fetchedSession);
        } else {
          notFound();
        }
      });
    };

    if (apiKey) {
      fetchSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, params.id]);

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

  if (isFetching || !session) {
    return (
      <div className="container mx-auto max-w-4xl space-y-8 p-4 sm:p-6 md:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
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
            <h1 className="text-3xl font-bold tracking-tight">{session.title}</h1>
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

          {session.state === "AWAITING_USER_FEEDBACK" && (
             <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
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
                </div>

                 <div className="space-y-4">
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
        </div>
      </main>
    </div>
  );
}
