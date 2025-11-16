import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

type JobStatusBadgeProps = {
  status: JobStatus;
};

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const statusConfig = {
    Pending: {
      icon: <Clock className="h-3.5 w-3.5" />,
      className: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800 dark:hover:bg-amber-950",
    },
    Running: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      className:
        "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800 dark:hover:bg-blue-950",
    },
    Succeeded: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className:
        "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:text-green-200 dark:border-green-800 dark:hover:bg-green-950",
    },
    Failed: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      className:
        "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:text-red-200 dark:border-red-800 dark:hover:bg-red-950",
    },
  };

  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 w-fit font-medium capitalize",
        config.className
      )}
    >
      {config.icon}
      <span>{status}</span>
    </Badge>
  );
}
