
"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageDialog } from "./message-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Bot, Hand, Loader2, MessageSquare, MessageSquareReply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { JobStatusBadge } from "./job-status-badge";
import { PrStatus } from "./pr-status";
import { useRouter } from "next/navigation";
import type { Session, PredefinedPrompt } from "@/lib/types";

interface SessionTableProps {
  sessions: Session[];
  isUncategorized: boolean;
  jobId?: string;
  selectedSessionIds: string[];
  onSelectRow: (sessionId: string, checked: boolean) => void;
  titleTruncateLength: number;
  isActionPending?: boolean;
  onApprovePlan: (sessionIds: string[]) => void;
  onSendMessage: (sessionId: string, message: string) => void;
  quickReplies: PredefinedPrompt[];
  jobIdParam: string | null;
}

export function SessionTable({
  sessions,
  isUncategorized,
  jobId,
  selectedSessionIds,
  onSelectRow,
  titleTruncateLength,
  isActionPending,
  onApprovePlan,
  onSendMessage,
  quickReplies,
  jobIdParam
}: SessionTableProps) {
  const router = useRouter();

  const getPullRequestUrl = (session: Session): string | null => {
    if (session.outputs && session.outputs.length > 0) {
      for (const output of session.outputs) {
        if (output.pullRequest?.url) {
          return output.pullRequest.url;
        }
      }
    }
    return null;
  };

  const truncate = (str: string, length: number) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + "..." : str;
  };

  const quickReplyOptions = quickReplies.map(reply => ({
    value: reply.id,
    label: reply.title,
    content: reply.prompt,
  }));

  return (
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
        {sessions.map(session => {
          const prUrl = getPullRequestUrl(session);
          const backPath = isUncategorized ? '' : `?jobId=${jobId || jobIdParam}`;

          return (
            <TableRow
              key={session.id}
              className="cursor-pointer"
              onClick={() => router.push(`/sessions/${session.id}${backPath}`)}
              data-state={selectedSessionIds.includes(session.id) ? "selected" : undefined}
            >
                <TableCell onClick={(e) => e.stopPropagation()} className="p-2">
                  <Checkbox
                    checked={selectedSessionIds.includes(session.id)}
                    onCheckedChange={(checked) => onSelectRow(session.id, !!checked)}
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
                    {session.createTime ? formatDistanceToNow(new Date(session.createTime), { addSuffix: true }) : 'N/A'}
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
                           <MessageDialog
                              trigger={
                                  <Button variant="ghost" size="icon" disabled={isActionPending}><MessageSquare className="h-4 w-4" /></Button>
                              }
                              tooltip="Send Message"
                              storageKey={`jules-session-message-${session.id}`}
                              onSendMessage={(message) => onSendMessage(session.id, message)}
                              dialogTitle={`Send Message to Session`}
                              dialogDescription={truncate(session.title, titleTruncateLength)}
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
                                <TooltipContent><p>Send Quick Reply</p></TooltipContent>
                              </Tooltip>
                            <PopoverContent className="p-0 w-60" onClick={(e) => e.stopPropagation()}>
                              <Command>
                                <CommandInput placeholder="Search replies..." />
                                <CommandList>
                                  <CommandEmpty>No replies found.</CommandEmpty>
                                  <CommandGroup>
                                    {quickReplyOptions.map((option) => (
                                      <CommandItem
                                        key={option.value}
                                        onSelect={() => {
                                          onSendMessage(session.id, option.content);
                                          document.body.click(); // Close popover
                                        }}
                                      >
                                        <span className="truncate" title={option.content}>
                                          {option.label}
                                        </span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
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
  );
}
