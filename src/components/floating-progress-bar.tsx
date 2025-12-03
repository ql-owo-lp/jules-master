
"use client";

import * as React from "react"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FloatingProgressBarProps {
  current: number
  total: number
  label: string
  isVisible: boolean
  className?: string
}

export function FloatingProgressBar({
  current,
  total,
  label,
  isVisible,
  className,
}: FloatingProgressBarProps) {
  if (!isVisible || total === 0) return null

  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className={cn("fixed bottom-4 inset-x-4 flex justify-center z-50 pointer-events-none", className)}>
      <Card className="w-full max-w-md p-4 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {label}
            </div>
            <div className="text-muted-foreground">
              {current} / {total}
            </div>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      </Card>
    </div>
  )
}
