import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boards, contributions, boardVersions, notifications } from '@/lib/schema';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { BoardContent } from '@/lib/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { awardPoints } from '@/lib/reputation';
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

        // 2. Fetch target board
        const targetBoard = await db.query.boards.findFirst({
            where: eq(boards.id, contribution.boardId),
        });

        if (!targetBoard) {
            return NextResponse.json({ error: 'Target board not found' }, { status: 404 });
        }

        // Check if user has owner clearance for the target board per specification
        const access = await getBoardAccess(targetBoard.id, session.user.id);
        if (!access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only board owners can accept and merge suggestions' }, { status: 403 });
        }

        // 3. Perform Merge
        const targetContent = (targetBoard.content || {}) as unknown as BoardContent;
        const snapshotContent = (contribution.snapshot || {}) as unknown as BoardContent;

        const targetNodes = Array.isArray(targetContent.nodes) ? targetContent.nodes : [];
        const snapshotNodes = Array.isArray(snapshotContent.nodes) ? snapshotContent.nodes : [];

        const targetEdges = Array.isArray(targetContent.edges) ? targetContent.edges : [];
        const snapshotEdges = Array.isArray(snapshotContent.edges) ? snapshotContent.edges : [];

        // Create a map of snapshot nodes for O(1) lookup
        const snapshotNodeMap = new Map((snapshotNodes as Record<string, unknown>[]).map((n) => [n.id as string, n]));

        // Start with target nodes, replace with snapshot version if modified
        const mergedNodes = (targetNodes as Record<string, unknown>[]).map((n) => {
            if (snapshotNodeMap.has(n.id as string)) {
                return snapshotNodeMap.get(n.id as string);
            }
            return n;
        });

        const targetNodeIds = new Set((targetNodes as Record<string, unknown>[]).map((n) => n.id as string));
        (snapshotNodes as Record<string, unknown>[]).forEach((n) => {
            if (!targetNodeIds.has(n.id as string)) {
                mergedNodes.push(n);
            }
        });

        // Edge deduplication by unordered pair of nodes to prevent duplicate parallel strings
        const allEdges = [...(targetEdges as Record<string, unknown>[]), ...(snapshotEdges as Record<string, unknown>[])];
        const seenPairs = new Set<string>();
        const uniqueEdges: Record<string, unknown>[] = [];

        allEdges.forEach((e) => {
            const edge = e as { id: string; source: string; target: string };
            if (!edge.source || !edge.target) return;
            const pairKey = [edge.source, edge.target].sort().join(':::');
            if (!seenPairs.has(pairKey)) {
                seenPairs.add(pairKey);
                uniqueEdges.push(e);
            }
        });
        
        // Clean up any dangling edges that connect to non-existent nodes
        const validNodeIds = new Set(mergedNodes.map((n) => (n as { id: string }).id));
        const mergedEdges = uniqueEdges.filter((e) => {
            const edge = e as { source: string; target: string };
            return validNodeIds.has(edge.source) && validNodeIds.has(edge.target);
        });

        const newContent = {
            ...targetContent,
            nodes: mergedNodes,
            edges: mergedEdges,
        };

        const currentVersion = typeof targetBoard.version === 'number' ? targetBoard.version : 1;
        const nextVersion = currentVersion + 1;
        const now = new Date();

        // 4. Update Board with optimistic concurrency lock and verify affected row
        const updatedBoards = await db.update(boards)
            .set({ 
                content: newContent,
                version: nextVersion,
                updatedAt: now,
            })
            .where(and(eq(boards.id, targetBoard.id), eq(boards.version, currentVersion)))
            .returning();

        if (updatedBoards.length === 0) {
            return NextResponse.json({ error: 'Conflict: Case file was modified concurrently. Please reload and try again.' }, { status: 409 });
        }

        await db.update(contributions)
            .set({ 
                status: 'merged',
                rejectionReason: null,
                updatedAt: now,
            })
            .where(eq(contributions.id, contributionId));

        // Create version snapshot for the merge with metadata note
        try {
            await db.insert(boardVersions).values({
                id: createId(),
                boardId: targetBoard.id,
                content: {
                    ...newContent,
                    _metadata: {
                        notes: `Merged investigation suggestions: "${contribution.message || 'Contributor proposal'}"`,
                        isManual: true,
                    }
                },
                createdBy: session.user.id,
                createdAt: now,
            });
        } catch (verErr) {
            console.warn('Failed to snapshot merged board version:', verErr);
        }

        // Award reputation points to contributor
        try {
            await awardPoints(contribution.userId, 'contribution_accepted');
        } catch (repErr) {
            console.warn('Failed to award points for contribution_accepted:', repErr);
        }

        // Dispatch notification to contributor
        try {
            await db.insert(notifications).values({
                id: createId(),
                recipientId: contribution.userId,
                actorId: session.user.id,
                type: 'contribution_merged',
                referenceId: targetBoard.id,
                referenceType: 'board',
                message: `Your suggestions for "${targetBoard.title}" were accepted and merged into the case file! (+25 Points)`,
                isRead: false,
                createdAt: now,
            });
        } catch (notifErr) {
            console.warn('Failed to dispatch merged notification:', notifErr);
        }

        return NextResponse.json({ success: true, mergedNodesCount: mergedNodes.length, version: nextVersion });

    } catch (error) {
        console.error('Merge error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
