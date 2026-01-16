
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Session, Job, PredefinedPrompt } from "@/lib/types";
import { RefreshCw, Briefcase, X, Loader2, MessageSquare, Hand, CheckCircle2, MessageSquareReply } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { MessageDialog } from "./message-dialog";
import { JobAccordionItem } from "./job-accordion-item";
import { SessionTable } from "./session-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandItem, CommandList } from "./ui/command";

type SessionListProps = {
  sessions: Session[];
  jobs: Job[];
  unknownSessions: Session[];
  quickReplies: PredefinedPrompt[];
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  isActionPending?: boolean;
  onApprovePlan: (sessionIds: string[]) => void;
  onSendMessage: (sessionId: string, message: string) => void;
  onBulkSendMessage: (sessionIds: string[], message: string) => void;
  countdown: number;
  pollInterval: number;
  jobIdParam: string | null;
  statusFilter: string;
  children: React.ReactNode;
  titleTruncateLength: number;
  
  // Job pagination
  jobPage: number;
  totalJobPages: number;
  onJobPageChange: (page: number) => void;
  progressCurrent?: number;
  progressTotal?: number;
  pendingBackgroundWork?: { pendingJobs: number, retryingSessions: number };
};

export function SessionList({
  sessions,
  jobs,
  unknownSessions,
  quickReplies,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
  isActionPending,
  onApprovePlan,
  onSendMessage,
  onBulkSendMessage,
  countdown,
  pollInterval,
  jobIdParam,
  statusFilter,
  children,
  titleTruncateLength,
  jobPage,
  totalJobPages,
  onJobPageChange,
  progressCurrent = 0,
  progressTotal = 0,
  pendingBackgroundWork,
}: SessionListProps) {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(jobIdParam ? [jobIdParam] : []);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!isActionPending) {
        setActiveJobId(null);
    }
  }, [isActionPending]);
  
  const [sessionsPerPage] = useLocalStorage<number>("jules-session-items-per-page", 10);
  const [sessionPages, setSessionPages] = useState<Record<string, number>>({});

  const sessionMap = useMemo(() => {
    return new Map(sessions.map(s => [s.id, s]));
  }, [sessions]);

  const getDetails = useCallback((sessionIds: string[]) => {
      let completed = 0;
      let working = 0;
      const pending: string[] = [];
      for (const sessionId of sessionIds) {
        const session = sessionMap.get(sessionId);
        if (session) {
          switch (session.state) {
            case 'COMPLETED':
              completed++;
              break;
            case 'AWAITING_PLAN_APPROVAL':
            case 'AWAITING_USER_FEEDBACK':
              pending.push(session.id);
              break;
            case 'FAILED':
              break; 
            default:
              working++;
              break;
          }
        }
      }
      return { completed, working, pending, total: sessionIds.length };
  }, [sessionMap]);

  const jobDetailsMap = useMemo(() => {
    const map = new Map<string, { completed: number; working: number; pending: string[]; total: number }>();
    for (const job of jobs) {
      map.set(job.id, getDetails(job.sessionIds));
    }
    return map;
  }, [jobs, getDetails]);
  
  const unknownSessionsDetails = useMemo(() => {
    return getDetails(unknownSessions.map(s => s.id));
  }, [unknownSessions, getDetails]);

  // Handle selection logic
  const handleSelectAllForJob = useCallback((jobId: string, checked: boolean) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const sessionsForJob = job.sessionIds
      .map(id => sessionMap.get(id))
      .filter((s): s is Session => !!s)
      .filter(s => statusFilter === 'all' || s.state === statusFilter);

    const filteredSessionIds = sessionsForJob.map(s => s.id);

    if (checked) {
      setSelectedSessionIds(ids => [...new Set([...ids, ...filteredSessionIds])]);
    } else {
      setSelectedSessionIds(ids => ids.filter(id => !filteredSessionIds.includes(id)));
    }
  }, [jobs, sessionMap, statusFilter]);

  const handleSelectAllForUnknown = useCallback((checked: boolean) => {
    const unknownSessionIds = unknownSessions.map(s => s.id);
    if (checked) {
        setSelectedSessionIds(ids => [...new Set([...ids, ...unknownSessionIds])]);
    } else {
        setSelectedSessionIds(ids => ids.filter(id => !unknownSessionIds.includes(id)));
    }
  }, [unknownSessions]);

  const handleSelectRow = useCallback((sessionId: string, checked: boolean) => {
    if (checked) {
      setSelectedSessionIds(ids => [...ids, sessionId]);
    } else {
      setSelectedSessionIds(ids => ids.filter(id => id !== sessionId));
    }
  }, []);

  const selectedSessions = useMemo(() => {
    return selectedSessionIds.map(id => sessionMap.get(id)).filter((s): s is Session => !!s);
  }, [selectedSessionIds, sessionMap]);
  
  const selectedPendingIds = useMemo(() => {
    return selectedSessions
      .filter(s => s.state === 'AWAITING_PLAN_APPROVAL')
      .map(s => s.id);
  }, [selectedSessions]);

  // Auto-open job from URL param
  useEffect(() => {
    if (jobIdParam && !openAccordionItems.includes(jobIdParam)) {
      setOpenAccordionItems(prev => [...prev, jobIdParam]);
    }
  }, [jobIdParam, openAccordionItems]);
  
  const truncate = (str: string, length: number) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + "..." : str;
  }

  const handleSessionPageChange = useCallback((jobId: string, newPage: number) => {
    setSessionPages(prev => ({ ...prev, [jobId]: newPage }));
  }, []);
  
  const unknownSessionIds = unknownSessions.map(s => s.id);
  const isAllUnknownSelected = unknownSessionIds.length > 0 && unknownSessionIds.every(id => selectedSessionIds.includes(id));
  const isSomeUnknownSelected = unknownSessionIds.some(id => selectedSessionIds.includes(id));
  const selectAllUnknownState = isAllUnknownSelected ? true : (isSomeUnknownSelected ? 'indeterminate' : false);

  const quickReplyOptions = quickReplies.map(reply => ({
    value: reply.id,
    label: reply.title,
    content: reply.prompt,
  }));

  return (
    <>
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                  <Briefcase className="h-6 w-6" />
                  <CardTitle>Jobs & Sessions</CardTitle>
                  <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh job list" disabled={isRefreshing}>
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  </Button>
              </div>
              <div className="mt-2">
                  <CardDescription>
                      A list of your jobs and their sessions.
                  </CardDescription>
                  {pendingBackgroundWork && (pendingBackgroundWork.pendingJobs > 0 || pendingBackgroundWork.retryingSessions > 0) && (
                    <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>
                            Pending / Running: {pendingBackgroundWork.pendingJobs} Jobs, {pendingBackgroundWork.retryingSessions} Retrying Sessions
                        </span>
                    </div>
                  )}
              </div>
            </div>
            {lastUpdatedAt && (
              <div className="text-sm text-muted-foreground text-right flex-shrink-0">
                <div>
                  Last updated:{" "}
                  {new Date(lastUpdatedAt).toLocaleTimeString()}
                </div>
                {pollInterval > 0 && (
                  <div>
                    Next poll in: {countdown}s
                  </div>
                )}
              </div>
            )}
          </div>

          {children}

        </CardHeader>
        <CardContent>
          {(jobs.length === 0 && unknownSessions.length === 0) ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
              <Briefcase className="h-12 w-12 mb-4" />
              <p className="font-semibold text-lg">No jobs found</p>
              <p className="text-sm">
                Create a new job to see jobs and sessions here.
              </p>
            </div>
          ) : (
            <Accordion 
                type="multiple" 
                className="w-full space-y-2"
                value={openAccordionItems}
                onValueChange={setOpenAccordionItems}
              >
              <TooltipProvider>
                {jobs.map(job => (
                    <JobAccordionItem
                      key={job.id}
                      job={job}
                      details={jobDetailsMap.get(job.id)}
                      sessionMap={sessionMap}
                      statusFilter={statusFilter}
                      selectedSessionIds={selectedSessionIds}
                      sessionsPerPage={sessionsPerPage}
                      sessionPages={sessionPages}
                      isRefreshing={isRefreshing}
                      activeJobId={activeJobId}
                      isActionPending={isActionPending}
                      progressCurrent={progressCurrent}
                      progressTotal={progressTotal}
                      titleTruncateLength={titleTruncateLength}
                      quickReplies={quickReplies}
                      onSelectAllForJob={handleSelectAllForJob}
                      onSelectRow={handleSelectRow}
                      onSessionPageChange={handleSessionPageChange}
                      onApprovePlan={onApprovePlan}
                      onBulkSendMessage={onBulkSendMessage}
                      onSendMessage={onSendMessage}
                      setActiveJobId={setActiveJobId}
                      jobIdParam={jobIdParam}
                    />
                ))}

                {unknownSessions.length > 0 && (
                  <AccordionItem value="uncategorized" className="border rounded-lg bg-card">
                    <div className="flex items-center gap-4 px-4 data-[state=open]:border-b">
                       <Checkbox
                          checked={selectAllUnknownState}
                          onCheckedChange={(checked) => handleSelectAllForUnknown(!!checked)}
                          aria-label={`Select all uncategorized sessions`}
                        />
                      <AccordionTrigger className="hover:no-underline flex-1 py-4">
                        <div className="flex-1 text-left">
                            <p className="font-semibold">Uncategorized Sessions</p>
                            <p className="text-xs text-muted-foreground">{unknownSessions.length} session(s)</p>
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground ml-auto px-4">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <div
                                    className="flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                                    tabIndex={0}
                                    role="status"
                                    aria-label={`${unknownSessionsDetails.completed} completed sessions`}
                                  >
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  <span>{unknownSessionsDetails.completed}</span>
                                  </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>{unknownSessionsDetails.completed} Completed</p>
                              </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <div
                                    className="flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                                    tabIndex={0}
                                    role="status"
                                    aria-label={`${unknownSessionsDetails.working} sessions in progress`}
                                  >
                                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                  <span>{unknownSessionsDetails.working}</span>
                                  </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>{unknownSessionsDetails.working} In Progress</p>
                              </TooltipContent>
                          </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex items-center gap-1 h-auto p-0"
                                      onClick={(e) => { e.stopPropagation(); onApprovePlan(unknownSessionsDetails.pending); }}
                                      disabled={!unknownSessionsDetails.pending.length || isActionPending}
                                    >
                                      <Hand className="h-4 w-4 text-yellow-500" />
                                      <span>{unknownSessionsDetails.pending.length}</span>
                                    </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>Approve {unknownSessionsDetails.pending.length} pending session(s)</p>
                              </TooltipContent>
                          </Tooltip>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                           <MessageDialog
                              trigger={
                                  <Button variant="ghost" size="icon" disabled={isActionPending}><MessageSquare className="h-4 w-4" /></Button>
                              }
                              tooltip="Send Message to all uncategorized sessions"
                              storageKey={`jules-job-message-uncategorized`}
                              onSendMessage={(message) => onBulkSendMessage(unknownSessionIds, message)}
                              dialogTitle={`Send Message to Uncategorized Sessions`}
                              dialogDescription={`This message will be sent to all ${unknownSessionIds.length} uncategorized sessions.`}
                              isActionPending={isActionPending}
                              quickReplies={quickReplies}
                          />
                           <Popover>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                     <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isActionPending} onClick={(e) => e.stopPropagation()}>
                                          <MessageSquareReply className="h-4 w-4" />
                                        </Button>
                                     </PopoverTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Send Quick Reply to all sessions</p></TooltipContent>
                                </Tooltip>
                                <PopoverContent className="p-0 w-80" onClick={(e) => e.stopPropagation()}>
                                  <Command>
                                    <CommandInput placeholder="Search replies..." />
                                    <CommandList>
                                      <CommandEmpty>No replies found.</CommandEmpty>
                                      <CommandGroup>
                                        {quickReplyOptions.map((option) => (
                                          <CommandItem
                                            key={option.value}
                                            onSelect={() => {
                                              onBulkSendMessage(unknownSessionIds, option.content);
                                              document.body.click(); // Close popover
                                            }}
                                          >
                                            <span className="truncate" title={option.content}>
                                              {option.label}
                                              <span className="ml-2 text-muted-foreground font-light">
                                                  [{truncate(option.content, 20)}]
                                              </span>
                                            </span>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                      </div>
                    </div>
                    <AccordionContent className="p-0">
                      <SessionTable
                        sessions={unknownSessions}
                        isUncategorized={true}
                        selectedSessionIds={selectedSessionIds}
                        onSelectRow={handleSelectRow}
                        titleTruncateLength={titleTruncateLength}
                        isActionPending={isActionPending}
                        onApprovePlan={onApprovePlan}
                        onSendMessage={onSendMessage}
                        quickReplies={quickReplies}
                        jobIdParam={jobIdParam}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )}
                </TooltipProvider>
              </Accordion>
          )}
        </CardContent>
        {totalJobPages > 1 && (
            <CardFooter>
                 <div className="flex justify-center items-center gap-2 w-full">
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => onJobPageChange(jobPage - 1)}
                        disabled={jobPage === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {jobPage} of {totalJobPages}
                    </span>
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => onJobPageChange(jobPage + 1)}
                        disabled={jobPage === totalJobPages}
                    >
                        Next
                    </Button>
                </div>
            </CardFooter>
        )}
      </Card>
      
       {(selectedSessionIds.length > 0 || selectedPendingIds.length > 0) && (
            <div className="fixed bottom-4 inset-x-4 flex justify-center z-20">
                <Card className="flex items-center gap-4 p-3 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-5">
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">{selectedSessionIds.length} session(s) selected</div>
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedSessionIds([])}>
                            <X className="h-4 w-4"/>
                            <span className="sr-only">Clear selection</span>
                        </Button>
                    </div>
                     <MessageDialog
                        trigger={
                            <Button size="sm" disabled={isActionPending}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Send Bulk Message
                            </Button>
                        }
                        storageKey="jules-bulk-session-message"
                        onSendMessage={(message) => onBulkSendMessage(selectedSessionIds, message)}
                        dialogTitle="Send Bulk Message"
                        dialogDescription={`This message will be sent to all ${selectedSessionIds.length} selected sessions.`}
                        isActionPending={isActionPending}
                        quickReplies={quickReplies}
                    />
                    {selectedPendingIds.length > 0 && (
                        <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => onApprovePlan(selectedPendingIds)}
                            disabled={isActionPending}
                        >
                             {isActionPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Hand className="h-4 w-4 mr-2" />}
                            Approve {selectedPendingIds.length} pending plan(s)
                        </Button>
                    )}
                </Card>
            </div>
        )}
    </>
  );
}
