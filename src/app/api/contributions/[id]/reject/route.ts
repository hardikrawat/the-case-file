import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boards, contributions, notifications } from '@/lib/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { checkRateLimit } from '@/lib/rate-limit';
import { getBoardAccess } from '@/lib/auth-checks';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`contributions:${session.user.id}`, 30, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    const params = await props.params;
    const contributionId = params.id;

    try {
        const body = await req.json().catch(() => ({}));
        const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

        // 1. Fetch contribution
        const contribution = await db.query.contributions.findFirst({
            where: eq(contributions.id, contributionId),
        });

        if (!contribution) {
            return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
        }

        if (contribution.status === 'merged') {
            return NextResponse.json({ error: 'Contribution has already been merged' }, { status: 400 });
        }

        if (contribution.status === 'rejected') {
            return NextResponse.json({ error: 'Contribution has already been rejected' }, { status: 400 });
        }

        // 2. Fetch target board
        const targetBoard = await db.query.boards.findFirst({
            where: eq(boards.id, contribution.boardId),
        });

        if (!targetBoard) {
            return NextResponse.json({ error: 'Target board not found' }, { status: 404 });
        }

        // Check if user is either the author (withdrawing) or has edit access on the target board
        const isAuthor = contribution.userId === session.user.id;
        const access = await getBoardAccess(targetBoard.id, session.user.id);

        if (!isAuthor && !access.canEdit) {
            return NextResponse.json({ error: 'Forbidden: Only board editors or the suggestion author can reject or withdraw this suggestion' }, { status: 403 });
        }

        // 3. Update status to rejected or withdrawn
        const finalReason = reason || (isAuthor ? 'Withdrawn by author' : null);
        await db.update(contributions)
            .set({ 
                status: 'rejected',
                rejectionReason: finalReason,
                updatedAt: new Date(),
            })
            .where(eq(contributions.id, contributionId));

        // 4. Send notification if rejected by reviewer (not self-withdrawn)
        if (!isAuthor) {
            try {
                const feedbackSuffix = reason ? `: "${reason}"` : '.';
                await db.insert(notifications).values({
                    id: createId(),
                    recipientId: contribution.userId,
                    actorId: session.user.id,
                    type: 'contribution_rejected',
                    referenceId: targetBoard.id,
                    referenceType: 'board',
                    message: `Your suggestion for "${targetBoard.title}" was not merged${feedbackSuffix}`,
                    isRead: false,
                    createdAt: new Date(),
                });
            } catch (notifErr) {
                console.warn('Failed to send rejection notification:', notifErr);
            }
        }

        return NextResponse.json({ 
            success: true, 
            status: 'rejected',
            withdrawn: isAuthor 
        });

    } catch (error) {
        console.error('Reject error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

