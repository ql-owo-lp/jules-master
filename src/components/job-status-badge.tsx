
import React from 'react';
import { Badge } from "@/components/ui/badge";
import type { State } from "@/lib/types";
import {
    CheckCircle2, AlertTriangle, XCircle, Loader2, PlayCircle,
    PauseCircle, HelpCircle, Hand, Clock, UserCheck, TimerOff, FileQuestion
} from "lucide-react";

type StatusConfig = {
    [key in State]: {
        icon: React.ReactNode;
        className: string;
        label: string;
    }
}

const statusConfig: StatusConfig = {
    // API States
    QUEUED: {
       icon:  <Clock className="h-3.5 w-3.5" />,
       className: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/80",
       label: "Queued",
    },
    RUNNING: {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/80",
        label: "Running",
    },
    COMPLETED: {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/80",
        label: "Completed",
    },
    FAILED: {
        icon: <XCircle className="h-3.5 w-3.5" />,
        className: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800/80",
        label: "Failed",
    },
    AWAITING_USER_FEEDBACK: {
        icon: <UserCheck className="h-3.5 w-3.5" />,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800/80",
        label: "Awaiting Feedback",
    },
    TIMED_OUT: {
        icon: <TimerOff className="h-3.5 w-3.5" />,
        className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800/80",
        label: "Timed Out",
    },

    // Frontend States
    AWAITING_PLAN_APPROVAL: {
        icon: <Hand className="h-3.5 w-3.5" />,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800/80",
        label: "Awaiting Plan Approval",
    },
    STATE_UNSPECIFIED: {
        icon: <HelpCircle className="h-3.5 w-3.5" />,
        className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800/80",
        label: "Unspecified",
    },
     UNKNOWN: {
        icon: <FileQuestion className="h-3.5 w-3.5" />,
        className: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800/80",
        label: "Unknown",
    }
};

type JobStatusBadgeProps = {
  status: State;
};

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.STATE_UNSPECIFIED;

  return (
    <Badge variant="outline" className={config.className}>
        <div className="flex items-center gap-1.5">
            {config.icon}
            <span className="font-mono text-xs">{config.label}</span>
        </div>
    </Badge>
  );
}
