
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface LabelWithTooltipProps {
  label: string;
  htmlFor?: string;
  helpText: string;
}

export function LabelWithTooltip({ label, htmlFor, helpText }: LabelWithTooltipProps) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={`More info about ${label}`}
          >
            <HelpCircle className="h-4 w-4 cursor-help" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{helpText}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
