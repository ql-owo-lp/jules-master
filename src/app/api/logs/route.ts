import { logBuffer, LogEntry } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Check for security env var
  if (process.env.SHOW_LOG_PAGE !== 'true') {
      return new NextResponse('Forbidden', { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const since = searchParams.get('since');

  let logsToSend = logBuffer;

  if (since) {
      const sinceTime = new Date(since).getTime();
      if (!isNaN(sinceTime)) {
          logsToSend = logBuffer.filter(log => new Date(log.timestamp).getTime() > sinceTime);
      }
  }

  return NextResponse.json(logsToSend);
}
