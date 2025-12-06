import { logEmitter, LogEntry } from '@/lib/logger';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onLog = (entry: LogEntry) => {
        try {
          const data = JSON.stringify(entry);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (e) {
          console.error('Error sending log to stream', e);
        }
      };

      logEmitter.on('log', onLog);

      // Keep the connection open and handle cleanup
      req.signal.addEventListener('abort', () => {
        logEmitter.off('log', onLog);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
