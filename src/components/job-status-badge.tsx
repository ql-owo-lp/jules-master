import React from 'react';
import { Badge } from "@/components/ui/badge";
import type { State } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Loader2, HelpCircle, PauseCircle, Hand, MessageSquare, PlayCircle } from "lucide-react";

type JobStatusBadgeProps = {
  status: State;
};

type StatusConfig = {
    icon: React.ReactNode;
    className: string;
    label: string;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const statusConfig: Record<State, StatusConfig> = {
    // API States
    QUEUED: {
        icon: <Clock className="h-3.5 w-3.5" />,
        className: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
        label: "Queued"
    },
    PLANNING: {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
        label: "Planning"
    },
    AWAITING_PLAN_APPROVAL: {
        icon: <Hand className="h-3.5 w-3.5" />,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
        label: "Awaiting Plan Approval"
    },
    AWAITING_USER_FEEDBACK: {
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
        label: "Awaiting User Feedback"
    },
    IN_PROGRESS: {
        icon: <PlayCircle className="h-3.5 w-3.5" />,
        className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
        label: "In Progress"
    },
    PAUSED: {
        icon: <PauseCircle className="h-3.5 w-3.5" />,
        className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-200 dark:border-gray-800",
        label: "Paused"
    },
    FAILED: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      className: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
      label: "Failed",
    },
    COMPLETED: {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:text-green-200 dark:border-green-800",
        label: "Completed"
    },
    // Default/Unknown
    STATE_UNSPECIFIED: {
      icon: <HelpCircle className="h-3.5 w-3.5" />,
      className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-200 dark:border-gray-800",
      label: "Unknown",
    }
  };

  const config = statusConfig[status] || statusConfig.STATE_UNSPECIFIED;

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 w-fit font-medium",
        config.className
      )}
      title={config.label}
    >
      {config.icon}
      <span className="truncate">{config.label}</span>
    </Badge>
  );
}
