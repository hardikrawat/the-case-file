import { auth } from '@/auth';
import Board from '@/components/Board';
import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

export default async function BoardPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    const boardId = params.id;

    // Server-side permission check for better UX (prevent 403 on client load)
    const board = await db.query.boards.findFirst({
        where: eq(boards.id, boardId),
        with: {
            collaborators: true
        }
    });

    if (!board) {
        notFound();
    }

    const isPublic = board.isPublic;
    const isOwner = session?.user?.id && board.userId === session.user.id;
    const isCollaborator = session?.user?.id && board.collaborators.some(c => c.userId === session.user.id);

    if (!isPublic && !isOwner && !isCollaborator) {
        if (!session) {
            // If not logged in and private -> Redirect to login
            redirect(`/login?callbackUrl=/board/${boardId}`);
        } else {
            // Logged in but no permission -> 404 (to avoid exposing existence) or custom 403
            notFound();
        }
    }

    return (
        <main className="h-screen w-screen overflow-hidden">
            <Board />
        </main>
    );
}
