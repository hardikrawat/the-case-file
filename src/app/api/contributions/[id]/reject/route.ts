import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boards, contributions } from '@/lib/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const params = await props.params;
    const contributionId = params.id;

    try {
        // 1. Fetch contribution
        const contribution = await db.query.contributions.findFirst({
            where: eq(contributions.id, contributionId),
        });

        if (!contribution) {
            return new NextResponse('Contribution not found', { status: 404 });
        }

        if (contribution.status !== 'open') {
            return new NextResponse('Contribution is not open', { status: 400 });
        }

        // 2. Fetch target board to verify ownership
        const targetBoard = await db.query.boards.findFirst({
            where: eq(boards.id, contribution.boardId),
        });

        if (!targetBoard) {
            return new NextResponse('Target board not found', { status: 404 });
        }

        // Check if user owns the target board
        if (targetBoard.userId !== session.user.id) {
            return new NextResponse('Forbidden: Only board owner can reject', { status: 403 });
        }

        // 3. Update status to rejected
        await db.update(contributions)
            .set({ status: 'rejected' })
            .where(eq(contributions.id, contributionId));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Reject error:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
