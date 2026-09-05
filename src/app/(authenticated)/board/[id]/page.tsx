import { auth } from '@/auth';
import Board from '@/components/Board';
import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

interface BoardData {
    id: string;
    title: string;
    isPublic: boolean;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    collaborators: { userId: string }[];
}

export default async function BoardPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const boardId = params.id;

    // Normal flow check with soft-delete filter
    const dbBoard = await db.query.boards.findFirst({
        where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
        with: {
            collaborators: true
        }
    });

    if (!dbBoard) {
        notFound();
    }

    const board = dbBoard as unknown as BoardData;

    const session = await auth();

    const isPublic = board.isPublic;
    const userId = session?.user?.id;
    const isOwner = !!(userId && board.userId === userId);
    const isCollaborator = !!(userId && board.collaborators.some((c) => c.userId === userId));

    if (!isPublic && !isOwner && !isCollaborator) {
        if (!session) {
            redirect(`/login?callbackUrl=/board/${boardId}`);
        } else {
            notFound();
        }
    }

    return (
        <main className="h-full w-full overflow-hidden">
            <Board />
        </main>
    );
}
