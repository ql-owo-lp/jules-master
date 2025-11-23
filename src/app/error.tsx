'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Check if the error message indicates a missing server action (version mismatch)
    if (error.message.includes('Failed to find Server Action')) {
      window.location.href = '/'
    }
  }, [error])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 py-20 bg-background text-foreground">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
