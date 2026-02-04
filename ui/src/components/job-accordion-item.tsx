
"use client";

import React, { memo, useState, useMemo } from "react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageDialog } from "./message-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Clock, Loader2, CheckCircle2, Hand, MessageSquare, MessageSquareReply, Clipboard, ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { SessionTable } from "./session-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Job, Session, PredefinedPrompt } from "@/lib/types";

interface JobAccordionItemProps {
  job: Job;
  details: { completed: number; working: number; pending: string[]; total: number } | undefined;
  sessionMap: Map<string, Session>;
  statusFilter: string;
  selectedSessionIds: string[];
  sessionsPerPage: number;
  page: number;
  isRefreshing?: boolean;
  activeJobId: string | null;
  isActionPending?: boolean;
  progressCurrent?: number;
  progressTotal?: number;
  titleTruncateLength: number;
  quickReplies: PredefinedPrompt[];
  onSelectAllForJob: (jobId: string, checked: boolean) => void;
  onSelectRow: (sessionId: string, checked: boolean) => void;
  onSessionPageChange: (jobId: string, page: number) => void;
  onApprovePlan: (sessionIds: string[]) => void;
  onBulkSendMessage: (sessionIds: string[], message: string) => void;
  onSendMessage: (sessionId: string, message: string) => void;
  setActiveJobId: (id: string | null) => void;
  jobIdParam: string | null;
}

const JobAccordionItemComponent = ({
  job,
  details,
  sessionMap,
  statusFilter,
  selectedSessionIds,
  sessionsPerPage,
  page,
  isRefreshing,
  activeJobId,
  isActionPending,
  progressCurrent = 0,
  progressTotal = 0,
  titleTruncateLength,
  quickReplies,
  onSelectAllForJob,
  onSelectRow,
  onSessionPageChange,
  onApprovePlan,
  onBulkSendMessage,
  onSendMessage,
  setActiveJobId,
  jobIdParam
}: JobAccordionItemProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!job.prompt) return;
    navigator.clipboard.writeText(job.prompt)
        .then(() => {
            setCopied(true);
            toast({ title: "Prompt copied to clipboard" });
            setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
            console.error("Failed to copy prompt:", err);
            toast({
                variant: "destructive",
                title: "Failed to copy",
                description: "Could not copy prompt to clipboard."
            });
        });
  };

  // Memoize filtering sessions to avoid recalculation on every render (e.g. when selection changes)
  const sessionsForJob = useMemo(() => {
    return job.sessionIds
      .map(id => sessionMap.get(id))
      .filter((s): s is Session => !!s)
      .filter(s => statusFilter === 'all' || s.state === statusFilter);
  }, [job.sessionIds, sessionMap, statusFilter]);

  // Memoize derived list of IDs for selection logic
  const filteredSessionIds = useMemo(() => sessionsForJob.map(s => s.id), [sessionsForJob]);

  // Memoize selection state calculation to avoid iteration on every render
  const { selectAllState } = useMemo(() => {
      const isAll = filteredSessionIds.length > 0 && filteredSessionIds.every(id => selectedSessionIds.includes(id));
      const isSome = filteredSessionIds.some(id => selectedSessionIds.includes(id));
      const state: boolean | 'indeterminate' = isAll ? true : (isSome ? 'indeterminate' : false);
      return { isAllSelected: isAll, isSomeSelected: isSome, selectAllState: state };
  }, [filteredSessionIds, selectedSessionIds]);

  const currentPage = page;
  const totalPages = Math.ceil(sessionsForJob.length / sessionsPerPage);

  // Memoize pagination slice to provide stable reference to SessionTable and avoid slice on every render
  const paginatedSessions = useMemo(() => {
      return sessionsForJob.slice(
        (currentPage - 1) * sessionsPerPage,
        currentPage * sessionsPerPage
      );
  }, [sessionsForJob, currentPage, sessionsPerPage]);

  const isJobProcessing = job.status === 'PROCESSING' || job.status === 'PENDING';
  const createdSessionsCount = job.sessionIds.length;
  const totalSessionsCount = job.sessionCount || 0;

  // Memoize progress calculation
  const creationProgress = useMemo(() => {
      return totalSessionsCount > 0 ? (createdSessionsCount / totalSessionsCount) * 100 : 0;
  }, [totalSessionsCount, createdSessionsCount]);

  // Memoize quick reply options mapping
  const quickReplyOptions = useMemo(() => {
      return quickReplies.map(reply => ({
        value: reply.id,
        label: reply.title,
        content: reply.prompt,
      }));
  }, [quickReplies]);

  const truncate = (str: string, length: number) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + "..." : str;
  };

  return (
    <AccordionItem value={job.id} className="border rounded-lg bg-card">
       <div className="flex items-center gap-4 px-4 data-[state=open]:border-b">
         <Checkbox
            checked={selectAllState}
            onCheckedChange={(checked) => onSelectAllForJob(job.id, !!checked)}
            aria-label={`Select all sessions for job ${job.name}`}
         />
        <AccordionTrigger className="hover:no-underline flex-1 py-4">
            <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate" title={job.name}>{job.name}</p>
                  {job.cronJobId && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                                onClick={(e) => { e.stopPropagation(); router.push('/settings'); }}
                                aria-label="Created by Cron Job, go to settings"
                            >
                                <Clock className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent><p>Created by Cron Job</p></TooltipContent>
                     </Tooltip>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{job.repo} / {job.branch}</p>
            </div>
        </AccordionTrigger>
        <div className="flex items-center gap-4 text-sm text-muted-foreground ml-auto px-4" >
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className="flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        tabIndex={0}
                        role="status"
                        aria-label={`${details?.completed || 0} completed sessions`}
                    >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{details?.completed || 0}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{details?.completed || 0} Completed</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className="flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        tabIndex={0}
                        role="status"
                        aria-label={`${details?.working || 0} sessions in progress`}
                    >
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    <span>{details?.working || 0}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{details?.working || 0} In Progress</p>
                </TooltipContent>
            </Tooltip>
             {activeJobId === job.id && isActionPending && progressTotal > 0 ? (
                <div className="flex items-center gap-2 w-32" onClick={(e) => e.stopPropagation()}>
                    <Progress value={(progressCurrent / progressTotal) * 100} className="h-2" />
                    <span className="text-xs text-muted-foreground w-12 text-right">
                        {Math.round((progressCurrent / progressTotal) * 100)}%
                    </span>
                </div>
             ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1 h-auto p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (details?.pending.length) {
                                    setActiveJobId(job.id);
                                    onApprovePlan(details.pending);
                                }
                            }}
                            disabled={!details?.pending.length || isActionPending}
                        >
                            <Hand className="h-4 w-4 text-yellow-500" />
                            <span>{details?.pending.length || 0}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Approve {details?.pending.length || 0} pending session(s)</p>
                    </TooltipContent>
                </Tooltip>
             )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
             {job.prompt && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleCopyPrompt} disabled={isActionPending} aria-label="Copy Prompt">
                            {copied ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy Prompt</p>
                    </TooltipContent>
                </Tooltip>
             )}
             <MessageDialog
                trigger={
                    <Button variant="ghost" size="icon" disabled={isActionPending} aria-label="Send Message"><MessageSquare className="h-4 w-4" /></Button>
                }
                tooltip="Send Message to all sessions in this job"
                storageKey={`jules-job-message-${job.id}`}
                onSendMessage={(message) => onBulkSendMessage(job.sessionIds, message)}
                dialogTitle={`Send Message to Job: ${job.name}`}
                dialogDescription={`This message will be sent to all ${job.sessionIds.length} sessions in this job.`}
                isActionPending={isActionPending}
                quickReplies={quickReplies}
            />
             <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isActionPending} onClick={(e) => e.stopPropagation()} aria-label="Send Quick Reply">
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
                              onBulkSendMessage(job.sessionIds, option.content);
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
        {isJobProcessing && totalSessionsCount > 0 && (
            <div className="px-4 py-3 bg-muted/20 border-b">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            {job.status === 'PENDING' ? 'Pending Start...' : 'Creating Sessions...'}
                            {job.status === 'PROCESSING' && <Loader2 className="h-3 w-3 animate-spin" />}
                        </span>
                        <span>{createdSessionsCount} / {totalSessionsCount}</span>
                    </div>
                    <Progress value={creationProgress} className="h-1.5" />
                </div>
            </div>
        )}
        {isRefreshing && sessionsForJob.length === 0 ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : sessionsForJob.length > 0 ? (
          <>
            <div>
              <SessionTable
                sessions={paginatedSessions}
                isUncategorized={false}
                jobId={job.id}
                selectedSessionIds={selectedSessionIds}
                onSelectRow={onSelectRow}
                titleTruncateLength={titleTruncateLength}
                isActionPending={isActionPending}
                onApprovePlan={onApprovePlan}
                onSendMessage={onSendMessage}
                quickReplies={quickReplies}
                jobIdParam={jobIdParam}
              />
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 p-2 border-t">
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSessionPageChange(job.id, currentPage - 1)}
                      disabled={currentPage === 1}
                  >
                      Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                  </span>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSessionPageChange(job.id, currentPage + 1)}
                      disabled={currentPage === totalPages}
                  >
                      Next
                  </Button>
              </div>
            )}
          </>
        ) : (
          <p className="p-4 text-sm text-muted-foreground text-center">No sessions match the current filter.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

function areJobAccordionItemPropsEqual(prev: JobAccordionItemProps, next: JobAccordionItemProps) {
  // 1. Check strict equality for all props except 'selectedSessionIds', progress props, 'sessionMap', and 'job'
  const keys = Object.keys(prev) as (keyof JobAccordionItemProps)[];
  for (const key of keys) {
      if (key === 'selectedSessionIds') continue;
      if (key === 'progressCurrent') continue;
      if (key === 'progressTotal') continue;
      if (key === 'sessionMap') continue;
      if (key === 'job') continue;
      if (prev[key] !== next[key]) return false;
  }

  // Check 'job' deep equality (since useLocalStorage creates new objects on update)
  if (JSON.stringify(prev.job) !== JSON.stringify(next.job)) return false;

  // Check 'sessionMap' - only compare sessions relevant to THIS job
  if (prev.sessionMap !== next.sessionMap) {
      const prevSessions = prev.job.sessionIds.map(id => prev.sessionMap.get(id));
      const nextSessions = next.job.sessionIds.map(id => next.sessionMap.get(id));

      if (prevSessions.length !== nextSessions.length) return false;

      for (let i = 0; i < prevSessions.length; i++) {
          const s1 = prevSessions[i];
          const s2 = nextSessions[i];

          if (s1 === s2) continue; // Same reference
          if (!s1 || !s2) return false; // One is undefined (and not equal)

          // Fast path: check updateTime if available
          if (s1.updateTime && s2.updateTime && s1.updateTime === s2.updateTime) continue;

          // Deep compare as fallback
          if (JSON.stringify(s1) !== JSON.stringify(s2)) return false;
      }
  }

  // 2. Check 'progressCurrent' and 'progressTotal' ONLY if this job is active.
  // If the job is NOT active, changes to these props don't affect the render.
  // Note: activeJobId change is caught in the loop above.
  if (next.activeJobId === next.job.id) {
      if (prev.progressCurrent !== next.progressCurrent) return false;
      if (prev.progressTotal !== next.progressTotal) return false;
  }

  // 3. Check 'selectedSessionIds'
  if (prev.selectedSessionIds === next.selectedSessionIds) return true;

  // If array refs differ, check if it affects THIS job.
  const prevSelectedSet = new Set(prev.selectedSessionIds);
  const nextSelectedSet = new Set(next.selectedSessionIds);

  // We use next.job.sessionIds (assuming job didn't change, checked above)
  for (const sessionId of next.job.sessionIds) {
      if (prevSelectedSet.has(sessionId) !== nextSelectedSet.has(sessionId)) {
          return false;
      }
  }

  return true;
}

export const JobAccordionItem = memo(JobAccordionItemComponent, areJobAccordionItemPropsEqual);
