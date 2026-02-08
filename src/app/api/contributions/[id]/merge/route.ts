import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boards, contributions } from '@/lib/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { BoardContent } from '@/lib/types';

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

        if (contribution.status === 'merged') {
            return new NextResponse('Already merged', { status: 400 });
        }

        // 2. Fetch target board
        const targetBoard = await db.query.boards.findFirst({
            where: eq(boards.id, contribution.boardId),
        });

        if (!targetBoard) {
            return new NextResponse('Target board not found', { status: 404 });
        }

        // Check if user owns the target board
        if (targetBoard.userId !== session.user.id) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // 3. Perform Merge
        // Strategy: "Smart Merge" - Union of nodes. 
        // If a node ID exists in both, Snapshot wins (update). 
        // If unique to Snapshot, Add.
        // If unique to Target, Keep.

        const targetContent = targetBoard.content as unknown as BoardContent;
        const snapshotContent = contribution.snapshot as unknown as BoardContent;

        const targetNodes = targetContent.nodes || [];
        const snapshotNodes = snapshotContent.nodes || [];

        const targetEdges = targetContent.edges || [];
        const snapshotEdges = snapshotContent.edges || [];

        // Create a map of snapshot nodes for O(1) lookup
        const snapshotNodeMap = new Map((snapshotNodes as Record<string, unknown>[]).map((n) => [n.id as string, n]));

        // Start with target nodes, but if they exist in snapshot, replace them
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

        const allEdges = [...(targetEdges as Record<string, unknown>[]), ...(snapshotEdges as Record<string, unknown>[])];
        const uniqueEdgesMap = new Map();
        allEdges.forEach((e) => uniqueEdgesMap.set(e.id as string, e));
        const mergedEdges = Array.from(uniqueEdgesMap.values());

        const newContent = {
            ...targetContent,
            nodes: mergedNodes,
            edges: mergedEdges,
        };

        // 4. Update Board and Contribution
        await db.update(boards)
            .set({ content: newContent })
            .where(eq(boards.id, targetBoard.id));

        await db.update(contributions)
            .set({ status: 'merged' })
            .where(eq(contributions.id, contributionId));

        return NextResponse.json({ success: true, mergedNodesCount: mergedNodes.length });

    } catch (error) {
        console.error('Merge error:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
