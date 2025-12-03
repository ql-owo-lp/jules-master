'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { toast } = useToast()

  useEffect(() => {
    // Check if the error message indicates a missing server action (version mismatch)
    if (error.message.includes('Failed to find Server Action')) {
      window.location.href = '/'
      return
    }

    toast({
      variant: "destructive",
      title: "Something went wrong!",
      description: error.message,
    })
  }, [error, toast])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 py-20 bg-background text-foreground">
       <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
