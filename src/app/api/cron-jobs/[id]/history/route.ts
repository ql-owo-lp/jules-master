
import { NextResponse } from 'next/server';
import { getCronJobHistory } from '@/app/settings/actions';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status') || 'all';

    try {
        const { jobs, totalPages } = await getCronJobHistory(params.id, page, limit, status);
        return NextResponse.json({ jobs, totalPages });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch cron job history' }, { status: 500 });
    }
}
