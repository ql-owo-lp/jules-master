
import { NextResponse } from 'next/server';
import { clearCronJobHistory } from '@/app/settings/actions';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        await clearCronJobHistory(params.id);
        return NextResponse.json({ message: 'Cron job history cleared' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to clear cron job history' }, { status: 500 });
    }
}
