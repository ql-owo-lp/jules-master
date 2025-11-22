
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Session, Job, PredefinedPrompt, PullRequestStatus } from "@/lib/types";
import { JobStatusBadge } from "./job-status-badge";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Hand, Loader2, MessageSquare, Briefcase, X, CheckCircle2, Bot } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { PrStatus } from "./pr-status";
import { Checkbox } from "./ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Skeleton } from "./ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { MessageDialog } from "./message-dialog";


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
  prStatuses: Record<string, PullRequestStatus | null>;
  statusFilter: string;
  children: React.ReactNode;
  titleTruncateLength: number;
  
  // Job pagination
  jobPage: number;
  totalJobPages: number;
  onJobPageChange: (page: number) => void;
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
  prStatuses,
  statusFilter,
  children,
  titleTruncateLength,
  jobPage,
  totalJobPages,
  onJobPageChange,
}: SessionListProps) {
  const router = useRouter();
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(jobIdParam ? [jobIdParam] : []);
  
  const [sessionsPerPage] = useLocalStorage<number>("jules-session-items-per-page", 10);
  const [sessionPages, setSessionPages] = useState<Record<string, number>>({});

  const sessionMap = useMemo(() => {
    return new Map(sessions.map(s => [s.id, s]));
  }, [sessions]);

  const jobDetailsMap = useMemo(() => {
    const map = new Map<string, { completed: number; working: number; pending: number; total: number }>();
    for (const job of jobs) {
      let completed = 0;
      let working = 0;
      let pending = 0;
      for (const sessionId of job.sessionIds) {
        const session = sessionMap.get(sessionId);
        if (session) {
          switch (session.state) {
            case 'COMPLETED':
              completed++;
              break;
            case 'AWAITING_PLAN_APPROVAL':
            case 'AWAITING_USER_FEEDBACK':
              pending++;
              break;
            case 'FAILED':
              break; 
            default:
              working++;
              break;
          }
        }
      }
      map.set(job.id, { completed, working, pending, total: job.sessionIds.length });
    }
    return map;
  }, [jobs, sessionMap]);

  // Handle selection logic
  const handleSelectAllForJob = (jobId: string, checked: boolean) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const jobSessionIds = job.sessionIds;
    if (checked) {
      setSelectedSessionIds(ids => [...new Set([...ids, ...jobSessionIds])]);
    } else {
      setSelectedSessionIds(ids => ids.filter(id => !jobSessionIds.includes(id)));
    }
  };

  const handleSelectAllForUnknown = (checked: boolean) => {
    const unknownSessionIds = unknownSessions.map(s => s.id);
    if (checked) {
        setSelectedSessionIds(ids => [...new Set([...ids, ...unknownSessionIds])]);
    } else {
        setSelectedSessionIds(ids => ids.filter(id => !unknownSessionIds.includes(id)));
    }
  };

  const handleSelectRow = (sessionId: string, checked: boolean) => {
    if (checked) {
      setSelectedSessionIds(ids => [...ids, sessionId]);
    } else {
      setSelectedSessionIds(ids => ids.filter(id => id !== sessionId));
    }
  };

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
  
  const truncate = (str: string, length: number) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + "..." : str;
  }

  const handleSessionPageChange = (jobId: string, newPage: number) => {
    setSessionPages(prev => ({ ...prev, [jobId]: newPage }));
  };
  
  const unknownSessionIds = unknownSessions.map(s => s.id);
  const isAllUnknownSelected = unknownSessionIds.length > 0 && unknownSessionIds.every(id => selectedSessionIds.includes(id));
  const isSomeUnknownSelected = unknownSessionIds.some(id => selectedSessionIds.includes(id));
  const selectAllUnknownState = isAllUnknownSelected ? true : (isSomeUnknownSelected ? 'indeterminate' : false);


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
                    </div>
                   <AccordionContent className="p-0">
                     <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Session Title</TableHead>
                            <TableHead className="w-[180px]">Status</TableHead>
                            <TableHead className="w-[150px]">Created</TableHead>
                            <TableHead className="w-[80px] text-center">Jules</TableHead>
                            <TableHead className="w-[80px] text-center">GitHub</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unknownSessions.map(session => {
                             const prUrl = getPullRequestUrl(session);
                             return (
                               <TableRow key={session.id} className="cursor-pointer" onClick={() => router.push(`/sessions/${session.id}`)}>
                                  <TableCell onClick={(e) => e.stopPropagation()} className="p-2">
                                    <Checkbox
                                      checked={selectedSessionIds.includes(session.id)}
                                      onCheckedChange={(checked) => handleSelectRow(session.id, !!checked)}
                                      aria-label={`Select session ${session.id}`}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium truncate" title={session.title}>
                                      {truncate(session.title, titleTruncateLength)}
                                    </TableCell>
                                    <TableCell>
                                      <JobStatusBadge status={session.state || 'STATE_UNSPECIFIED'} />
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {session.createdAt ? formatDistanceToNow(new Date(session.createdAt), { addSuffix: true }) : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                        {session.url && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <a href={session.url} target="_blank" rel="noopener noreferrer">
                                                        <Button variant="ghost" size="icon" aria-label="View Session on Jules UI">
                                                            <Bot className="h-5 w-5 text-primary" />
                                                        </Button>
                                                    </a>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>View on Jules UI</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <PrStatus prUrl={prUrl} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            {session.state === 'AWAITING_PLAN_APPROVAL' && (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onApprovePlan([session.id])}
                                                    disabled={isActionPending}
                                                    aria-label="Approve Plan"
                                                  >
                                                    {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Approve Plan</p></TooltipContent>
                                              </Tooltip>
                                            )}
                                            <Popover>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <PopoverTrigger asChild>
                                                     <Button variant="ghost" size="icon" disabled={isActionPending}>
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                  </PopoverTrigger>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Send a Quick Reply</p></TooltipContent>
                                              </Tooltip>
                                              <PopoverContent className="p-0 w-64" align="end">
                                                  <Command>
                                                    <CommandInput placeholder="Search replies..." />
                                                    <CommandList>
                                                      <ScrollArea className="h-[200px]">
                                                        <CommandEmpty>No replies found.</CommandEmpty>
                                                        <CommandGroup>
                                                          {quickReplies.map(option => (
                                                            <CommandItem
                                                              key={option.id}
                                                              onSelect={() => {
                                                                onSendMessage(session.id, option.prompt);
                                                                document.body.click(); 
                                                              }}
                                                              className="flex justify-between cursor-pointer"
                                                            >
                                                              <span className="truncate flex-1 font-medium">{option.title}</span>
                                                              <span className="text-xs text-muted-foreground ml-2 truncate">
                                                                [{truncate(option.prompt, 20)}]
                                                              </span>
                                                            </CommandItem>
                                                          ))}
                                                        </CommandGroup>
                                                      </ScrollArea>
                                                    </CommandList>
                                                  </Command>
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                    </TableCell>
                               </TableRow>
                             )
                          })}
                        </TableBody>
                     </Table>
                   </AccordionContent>
                </AccordionItem>
              )}
              
                {jobs.map(job => {
                  const details = jobDetailsMap.get(job.id);
                  const sessionsForJob = job.sessionIds
                    .map(id => sessionMap.get(id))
                    .filter((s): s is Session => !!s)
                    .filter(s => statusFilter === 'all' || s.state === statusFilter);

                  const jobSessionIds = job.sessionIds;
                  const isAllSelected = jobSessionIds.length > 0 && jobSessionIds.every(id => selectedSessionIds.includes(id));
                  const isSomeSelected = jobSessionIds.some(id => selectedSessionIds.includes(id));
                  const selectAllState = isAllSelected ? true : (isSomeSelected ? 'indeterminate' : false);
                  
                  const currentPage = sessionPages[job.id] || 1;
                  const totalPages = Math.ceil(sessionsForJob.length / sessionsPerPage);
                  const paginatedSessions = sessionsForJob.slice(
                    (currentPage - 1) * sessionsPerPage,
                    currentPage * sessionsPerPage
                  );

                  if (statusFilter !== 'all' && sessionsForJob.length === 0) {
                    return null;
                  }
                  
                  return (
                    <AccordionItem value={job.id} key={job.id} className="border rounded-lg bg-card">
                        <div className="flex items-center gap-4 px-4 data-[state=open]:border-b">
                             <Checkbox 
                                checked={selectAllState}
                                onCheckedChange={(checked) => handleSelectAllForJob(job.id, !!checked)}
                                aria-label={`Select all sessions for job ${job.name}`}
                            />
                            <AccordionTrigger className="hover:no-underline flex-1 py-4">
                                <div className="flex items-center gap-4 w-full">
                                    <div className="flex-1 text-left">
                                        <p className="font-semibold truncate" title={job.name}>{job.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{job.repo} / {job.branch}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1">
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
                                            <div className="flex items-center gap-1">
                                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                            <span>{details?.working || 0}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{details?.working || 0} In Progress</p>
                                        </TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1">
                                            <Hand className="h-4 w-4 text-yellow-500" />
                                            <span>{details?.pending || 0}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{details?.pending || 0} Pending Input</p>
                                        </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                            </AccordionTrigger>
                        </div>
                      <AccordionContent className="p-0">
                        {isRefreshing && sessionsForJob.length === 0 ? (
                          <div className="p-4 space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                          </div>
                        ) : sessionsForJob.length > 0 ? (
                          <>
                            <div className="border-t">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Session Title</TableHead>
                                    <TableHead className="w-[180px]">Status</TableHead>
                                    <TableHead className="w-[150px]">Created</TableHead>
                                    <TableHead className="w-[80px] text-center">Jules</TableHead>
                                    <TableHead className="w-[80px] text-center">GitHub</TableHead>
                                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {paginatedSessions.map(session => {
                                    const prUrl = getPullRequestUrl(session);
                                    return (
                                      <TableRow 
                                        key={session.id} 
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/sessions/${session.id}?jobId=${job.id}`)}
                                        data-state={selectedSessionIds.includes(session.id) ? "selected" : undefined}
                                      >
                                        <TableCell onClick={(e) => e.stopPropagation()} className="p-2">
                                          <Checkbox
                                            checked={selectedSessionIds.includes(session.id)}
                                            onCheckedChange={(checked) => handleSelectRow(session.id, !!checked)}
                                            aria-label={`Select session ${session.id}`}
                                          />
                                        </TableCell>
                                        <TableCell className="font-medium truncate" title={session.title}>
                                          {truncate(session.title, titleTruncateLength)}
                                        </TableCell>
                                        <TableCell>
                                          <JobStatusBadge status={session.state || 'STATE_UNSPECIFIED'} />
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {session.createdAt ? formatDistanceToNow(new Date(session.createdAt), { addSuffix: true }) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            {session.url && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a href={session.url} target="_blank" rel="noopener noreferrer">
                                                            <Button variant="ghost" size="icon" aria-label="View Session on Jules UI">
                                                                <Bot className="h-5 w-5 text-primary" />
                                                            </Button>
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>View on Jules UI</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <PrStatus prUrl={prUrl} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            {session.state === 'AWAITING_PLAN_APPROVAL' && (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onApprovePlan([session.id])}
                                                    disabled={isActionPending}
                                                    aria-label="Approve Plan"
                                                  >
                                                    {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Approve Plan</p></TooltipContent>
                                              </Tooltip>
                                            )}
                                            <Popover>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <PopoverTrigger asChild>
                                                     <Button variant="ghost" size="icon" disabled={isActionPending}>
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                  </PopoverTrigger>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Send a Quick Reply</p></TooltipContent>
                                              </Tooltip>
                                              <PopoverContent className="p-0 w-64" align="end">
                                                  <Command>
                                                    <CommandInput placeholder="Search replies..." />
                                                    <CommandList>
                                                      <ScrollArea className="h-[200px]">
                                                        <CommandEmpty>No replies found.</CommandEmpty>
                                                        <CommandGroup>
                                                          {quickReplies.map(option => (
                                                            <CommandItem
                                                              key={option.id}
                                                              onSelect={() => {
                                                                onSendMessage(session.id, option.prompt);
                                                                document.body.click(); 
                                                              }}
                                                              className="flex justify-between cursor-pointer"
                                                            >
                                                              <span className="truncate flex-1 font-medium">{option.title}</span>
                                                              <span className="text-xs text-muted-foreground ml-2 truncate">
                                                                [{truncate(option.prompt, 20)}]
                                                              </span>
                                                            </CommandItem>
                                                          ))}
                                                        </CommandGroup>
                                                      </ScrollArea>
                                                    </CommandList>
                                                  </Command>
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                            {totalPages > 1 && (
                              <div className="flex justify-center items-center gap-2 p-2 border-t">
                                  <Button 
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSessionPageChange(job.id, currentPage - 1)}
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
                                      onClick={() => handleSessionPageChange(job.id, currentPage + 1)}
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
                  )
                })}
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
                        triggerButton={
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
