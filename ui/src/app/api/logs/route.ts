import { NextRequest, NextResponse } from 'next/server';
import { logClient } from '@/lib/grpc-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Check for security env var
  if (process.env.SHOW_LOG_PAGE !== 'true') {
      return new NextResponse('Forbidden', { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const since = searchParams.get('since') || new Date(0).toISOString();

  try {
      const logs = await new Promise((resolve, reject) => {
          logClient.getLogs({ since }, (err, res) => {
              if (err) return reject(err);
              resolve(res.logs);
          });
      });
      return NextResponse.json(logs);
  } catch (err) {
      console.error("Failed to fetch logs from backend:", err);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
