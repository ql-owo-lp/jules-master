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
      className: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100",
    },
    Running: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      className:
        "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
    },
    Succeeded: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className:
        "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
    },
    Failed: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      className:
        "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
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
