'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
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
    <html>
      <body className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-foreground">
        <h2 className="text-2xl font-bold">Something went wrong!</h2>
        <Button onClick={() => reset()}>Try again</Button>
      </body>
    </html>
  )
}
